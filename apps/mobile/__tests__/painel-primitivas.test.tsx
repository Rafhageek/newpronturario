import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Pill } from 'lucide-react-native';
import { a11y } from '@hubpatients/ui-tokens';
import { MOOD_SCALE } from '@hubpatients/core';
import { MoodScale, PanelButton, StatCard } from '@/components/painel';
import { saveSeniorMode, tapTarget } from '@/theme';

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
