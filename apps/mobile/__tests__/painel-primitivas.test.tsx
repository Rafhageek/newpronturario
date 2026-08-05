import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Pill } from 'lucide-react-native';
import { a11y } from '@hubpatients/ui-tokens';
import { MOOD_SCALE } from '@hubpatients/core';
import {
  ErrorState,
  MoodScale,
  PanelButton,
  PanelCard,
  PanelRow,
  StatCard,
  StatusChip,
} from '@/components/painel';
import { saveSeniorMode, status, tapTarget } from '@/theme';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRIMITIVAS DO PAINEL — as promessas que elas precisam cumprir sozinhas
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Estas primitivas vão ser a base de ~47 telas do mobile. Se nascerem com
 * `fontSize` literal, o Modo Sênior morre de novo — e morre em 47 lugares de
 * uma vez, do jeito exato que já tinha acontecido antes (a opção existia, quase
 * nenhuma tela a consumia, e ligar não mudava quase nada).
 *
 * Só dá para testar isso porque o tamanho vive em `style` calculado em tempo de
 * render, e não em `className`: o Tailwind do NativeWind resolve classe em
 * build, fora do alcance do Jest.
 */

// O harness do jest-expo entrega `fontScale: 2`; nesse cenário o clamp de 2,0 já
// está saturado e o fator ADICIONAL do Modo Sênior seria 1. Fixamos a fonte do
// sistema no padrão para medir o Modo Sênior isoladamente.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
}));

// As primitivas navegam por rota (`href`). Em teste não há Router montado.
// (o prefixo `mock` é exigido pelo Jest para variáveis usadas na fábrica.)
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));

const insets = { top: 0, left: 0, right: 0, bottom: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };

function renderApp(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={{ frame, insets }}>{ui}</SafeAreaProvider>);
}

function fontSizeOf(texto: string): number {
  const flat = StyleSheet.flatten(screen.getByText(texto).props.style) as { fontSize?: number };
  return flat.fontSize ?? 0;
}

/** minHeight/height efetivo do primeiro ancestral que declarar um dos dois. */
function alturaDe(no: { parent: unknown; props: { style?: unknown } } | null): number {
  let atual = no;
  while (atual) {
    const flat = StyleSheet.flatten(atual.props?.style) as
      | { minHeight?: number; height?: number }
      | undefined;
    const h = flat?.minHeight ?? flat?.height;
    if (typeof h === 'number') return h;
    atual = atual.parent as typeof atual;
  }
  return 0;
}

async function setSenior(ligado: boolean) {
  await act(async () => {
    await saveSeniorMode(ligado);
  });
}

describe('primitivas do Painel — Modo Sênior', () => {
  afterEach(async () => {
    await setSenior(false);
  });

  it('DESLIGADO: os tamanhos de projeto são os do desenho', async () => {
    await setSenior(false);
    await renderApp(
      <StatCard icon={Pill} label="Medicamentos" value="3 hoje" hint="próxima às 14h" />,
    );
    expect(fontSizeOf('Medicamentos')).toBe(13);
    expect(fontSizeOf('3 hoje')).toBe(24);
    expect(fontSizeOf('próxima às 14h')).toBe(13);
  });

  it('LIGADO: rótulo, valor e dica do cartão de métrica crescem 1,3×', async () => {
    await setSenior(true);
    await renderApp(
      <StatCard icon={Pill} label="Medicamentos" value="3 hoje" hint="próxima às 14h" />,
    );
    const f = a11y.seniorFontFactor;
    expect(fontSizeOf('Medicamentos')).toBe(Math.round(13 * f));
    expect(fontSizeOf('3 hoje')).toBe(Math.round(24 * f));
    expect(fontSizeOf('próxima às 14h')).toBe(Math.round(13 * f));
  });

  it('LIGADO: o botão do Painel chega ao alvo de 56 px e nunca trava a altura', async () => {
    await setSenior(true);
    await renderApp(<PanelButton label="Adicionar medicamento" onPress={() => {}} />);

    expect(fontSizeOf('Adicionar medicamento')).toBe(Math.round(15 * a11y.seniorFontFactor));

    const no = screen.getByText('Adicionar medicamento').parent as never as {
      parent: unknown;
      props: { style?: unknown };
    };
    expect(alturaDe(no)).toBeGreaterThanOrEqual(tapTarget.senior);

    // `height` fixa cortaria o rótulo ampliado — não pode voltar.
    const flat = StyleSheet.flatten(
      (screen.getByText('Adicionar medicamento').parent as never as { props: { style?: unknown } })
        .props.style,
    ) as { height?: number };
    expect(flat?.height).toBeUndefined();
  });
});

describe('escala de humor — a ordem sobrevive sem cor', () => {
  afterEach(async () => {
    await setSenior(false);
  });

  it('as cinco opções aparecem com RÓTULO VISÍVEL, não só em aria-label', async () => {
    await renderApp(<MoodScale value={null} onChange={() => {}} />);
    for (const opcao of MOOD_SCALE) {
      // getByText falha se o rótulo estiver só na acessibilidade.
      expect(screen.getByText(opcao.rotulo)).toBeTruthy();
    }
  });

  it('cada opção é um rádio que anuncia rótulo E posição ("Bem — 4 de 5")', async () => {
    await renderApp(<MoodScale value={4} onChange={() => {}} />);
    const opcoes = screen.getAllByRole('radio');
    expect(opcoes).toHaveLength(MOOD_SCALE.length);

    opcoes.forEach((no, i) => {
      const opcao = MOOD_SCALE[i]!;
      expect(no.props.accessibilityLabel).toBe(opcao.descricao);
      expect(no.props.accessibilityLabel).toContain(`${opcao.valor} de 5`);
      // O estado escolhido é anunciado, não só pintado.
      expect(no.props.accessibilityState?.checked).toBe(opcao.valor === 4);
    });
  });

  it('tocar numa opção devolve o degrau escolhido', async () => {
    const onChange = jest.fn();
    await renderApp(<MoodScale value={null} onChange={onChange} />);
    fireEvent.press(screen.getAllByRole('radio')[0]!);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('LIGADO o Modo Sênior, pergunta e rótulos crescem junto', async () => {
    await setSenior(true);
    await renderApp(<MoodScale value={null} onChange={() => {}} />);
    const f = a11y.seniorFontFactor;
    expect(fontSizeOf('Como você está se sentindo hoje?')).toBe(Math.round(15 * f));
    expect(fontSizeOf(MOOD_SCALE[0]!.rotulo)).toBe(Math.round(13 * f));
  });

  it('o alvo de toque de cada opção respeita o piso (44 px, 56 no Modo Sênior)', async () => {
    await renderApp(<MoodScale value={null} onChange={() => {}} />);
    for (const no of screen.getAllByRole('radio')) {
      const flat = StyleSheet.flatten(no.props.style) as { minHeight?: number };
      expect(flat.minHeight).toBeGreaterThanOrEqual(tapTarget.min);
    }

    await setSenior(true);
    await renderApp(<MoodScale value={null} onChange={() => {}} />);
    for (const no of screen.getAllByRole('radio')) {
      const flat = StyleSheet.flatten(no.props.style) as { minHeight?: number };
      expect(flat.minHeight).toBeGreaterThanOrEqual(tapTarget.senior);
    }
  });

  /**
   * A prova de que o semáforo não voltou: as cinco opções NÃO têm cor própria.
   * A carinha recebe a cor de quem a contém, e o container só distingue
   * escolhida × não escolhida — a 1ª e a 5ª opção usam exatamente a mesma cor.
   */
  it('nenhuma opção tem cor própria: a 1ª e a 5ª são pintadas igual', async () => {
    await renderApp(<MoodScale value={null} onChange={() => {}} />);
    const opcoes = screen.getAllByRole('radio');
    const cor = (i: number) =>
      StyleSheet.flatten(opcoes[i]!.props.style) as { borderColor?: string; backgroundColor?: string };
    expect(cor(0).borderColor).toBe(cor(4).borderColor);
    expect(cor(0).backgroundColor).toBe(cor(4).backgroundColor);
  });
});

describe('PanelCard: o estilo tem que chegar no elemento que a fileira estica', () => {
  /**
   * O bug: com `onPress`, o `PanelCard` embrulhava o conteúdo num
   * `PressableScale` e NÃO repassava `style`. O `flex: 1` pousava na View de
   * dentro, e quem era o item flexível da `StatRow` era o Pressable de fora —
   * com largura de conteúdo. Um cartão de valor longo ("Próxima consulta")
   * esticava e empurrava os vizinhos: a fileira deixava de ser grade.
   *
   * A tela tinha contornado com uma View extra em volta. Remendo de tela em
   * cima de primitiva não escala para 47 telas — por isso o conserto foi aqui, e
   * por isso este teste existe.
   */
  function estiloDoNoRaiz(no: { props: { style?: unknown } }): Record<string, unknown> {
    return (StyleSheet.flatten(no.props.style) ?? {}) as Record<string, unknown>;
  }

  it('StatCard clicável: o `flex: 1` fica no elemento MAIS EXTERNO', async () => {
    const { UNSAFE_root } = await renderApp(
      <StatCard icon={Pill} label="Próxima consulta" value="12 de agosto" onPress={() => {}} />,
    );
    // Sobe do texto até achar quem declara `flex: 1`, e confere que esse nó
    // também é quem responde ao toque (ou seja: é o de fora, não a View interna).
    let no = screen.getByText('Próxima consulta').parent as never as {
      parent: unknown;
      props: { style?: unknown; onStartShouldSetResponder?: unknown };
    } | null;
    let achouFlex = false;
    let flexEraTocavel = false;
    while (no) {
      const flat = estiloDoNoRaiz(no);
      if (flat.flex === 1) {
        achouFlex = true;
        flexEraTocavel = typeof no.props.onStartShouldSetResponder === 'function';
        break;
      }
      no = no.parent as typeof no;
    }
    void UNSAFE_root;
    // Sem isto, nenhum ancestral declara `flex: 1` e a fileira não vira grade.
    expect(achouFlex).toBe(true);
    // E se o `flex: 1` estiver na View interna em vez do Pressable, o bug voltou.
    expect(flexEraTocavel).toBe(true);
  });

  it('PanelCard sem onPress continua aplicando `style` normalmente', async () => {
    await renderApp(
      <PanelCard style={{ width: 321 }}>
        <Text>conteúdo</Text>
      </PanelCard>,
    );
    let no = screen.getByText('conteúdo').parent as never as {
      parent: unknown;
      props: { style?: unknown };
    } | null;
    let largura: unknown;
    while (no) {
      const flat = estiloDoNoRaiz(no);
      if (flat.width !== undefined) {
        largura = flat.width;
        break;
      }
      no = no.parent as typeof no;
    }
    expect(largura).toBe(321);
  });
});

describe('primitivas que faltavam ao Painel', () => {
  afterEach(async () => {
    await setSenior(false);
  });

  it('ErrorState oferece caminho de volta e NÃO se confunde com o vazio', async () => {
    const onRetry = jest.fn();
    await renderApp(<ErrorState onRetry={onRetry} />);
    // Texto padrão acolhedor, sem jargão técnico.
    expect(screen.getByText('Não conseguimos carregar')).toBeTruthy();
    expect(screen.getByText('Verifique sua conexão e tente novamente.')).toBeTruthy();
    // Erro SEMPRE oferece tentar de novo — é o que o separa do estado vazio.
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('ErrorState cresce no Modo Sênior como todo o resto', async () => {
    await setSenior(true);
    await renderApp(<ErrorState />);
    expect(fontSizeOf('Não conseguimos carregar')).toBe(
      Math.round(17 * a11y.seniorFontFactor),
    );
  });

  it('StatusChip renderiza o RÓTULO, não só a cor (SC 1.4.1)', async () => {
    await renderApp(<StatusChip status="attention" label="Sem confirmação" />);
    // Se o rótulo estivesse só no accessibilityLabel, `getByText` falharia — e
    // quem lê no sol, imprime ou tem daltonismo ficaria sem a informação.
    expect(screen.getByText('Sem confirmação')).toBeTruthy();
  });

  it('StatusChip usa os três papéis de tinta (ink no texto, mark na borda)', async () => {
    await renderApp(<StatusChip status="attention" label="Sem confirmação" />);
    const tom = status.light.attention;
    const texto = StyleSheet.flatten(
      screen.getByText('Sem confirmação').props.style,
    ) as { color?: string };
    expect(texto.color).toBe(tom.ink);

    const chip = screen.getByLabelText('Sem confirmação');
    const caixa = StyleSheet.flatten(chip.props.style) as {
      borderColor?: string;
      backgroundColor?: string;
    };
    expect(caixa.borderColor).toBe(tom.mark);
    expect(caixa.backgroundColor).toBe(tom.tint);
  });

  it('PanelRow é um alvo de toque inteiro e se anuncia por completo', async () => {
    const onPress = jest.fn();
    await renderApp(
      <PanelRow icon={Pill} title="Losartana 50 mg" subtitle="08:00" onPress={onPress} />,
    );
    const linha = screen.getByLabelText('Losartana 50 mg, 08:00');
    fireEvent.press(linha);
    expect(onPress).toHaveBeenCalled();

    // A linha inteira é o alvo, e ela cresce com o Modo Sênior.
    const flat = StyleSheet.flatten(
      (screen.getByText('Losartana 50 mg').parent as never as { parent: { props: { style?: unknown } } })
        .parent.props.style,
    ) as { minHeight?: number };
    expect(flat.minHeight).toBeGreaterThanOrEqual(tapTarget.min);
  });

  it('PanelRow LIGADO o Modo Sênior: título e subtítulo crescem juntos', async () => {
    await setSenior(true);
    await renderApp(<PanelRow title="Losartana 50 mg" subtitle="08:00" onPress={() => {}} />);
    const f = a11y.seniorFontFactor;
    expect(fontSizeOf('Losartana 50 mg')).toBe(Math.round(15 * f));
    expect(fontSizeOf('08:00')).toBe(Math.round(13 * f));
  });
});
