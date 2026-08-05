import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { a11y } from '@hubpatients/ui-tokens';
import { Badge, Button, Input } from '@/components/ui';
import { clampFontScale, saveSeniorMode, tapTarget, type as typeTokens } from '@/theme';

/**
 * O Modo Sênior existia como infraestrutura mas quase nenhuma tela o consumia:
 * ligar a opção não mudava quase nada. Estes testes travam o contrário — que os
 * componentes COMPARTILHADOS (por onde passa a maior parte do app) crescem de
 * fato, e que o alvo de toque chega aos 56 px prometidos na tela de ajustes.
 *
 * Só é possível verificar isso porque os tamanhos saíram do `className`
 * (`text-[15px]`, que o Tailwind resolve fora do alcance do Jest) e passaram a
 * ser `style` calculado em tempo de render.
 */

/**
 * O harness do jest-expo entrega `fontScale: 2` (fonte do sistema no máximo).
 * Nesse cenário o clamp de 2,0 já está saturado e o fator ADICIONAL do Modo
 * Sênior é 1 — correto, porque o próprio React Native já dobrou o texto via
 * `allowFontScaling`. Para medir o efeito do Modo Sênior isoladamente, fixamos
 * a fonte do sistema no padrão.
 */
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
}));

const insets = { top: 0, left: 0, right: 0, bottom: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };

function renderApp(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={{ frame, insets }}>{ui}</SafeAreaProvider>);
}

/** fontSize efetivo do nó de texto renderizado. */
function fontSizeOf(text: string): number {
  const flat = StyleSheet.flatten(screen.getByText(text).props.style) as { fontSize?: number };
  return flat.fontSize ?? 0;
}

/** minHeight/height efetivo do primeiro ancestral que declarar um dos dois. */
function boxHeightOf(testNode: { parent: unknown; props: { style?: unknown } } | null): number {
  let node = testNode;
  while (node) {
    const flat = StyleSheet.flatten(node.props?.style) as
      | { minHeight?: number; height?: number }
      | undefined;
    const h = flat?.minHeight ?? flat?.height;
    if (typeof h === 'number') return h;
    node = node.parent as typeof node;
  }
  return 0;
}

/**
 * `saveSeniorMode` notifica as telas montadas (useSyncExternalStore), então a
 * troca precisa acontecer dentro de `act`. Nos testes ela é sempre chamada com
 * a árvore ainda não montada; no teardown, desmontamos antes de restaurar.
 */
async function setSenior(enabled: boolean) {
  await act(async () => {
    await saveSeniorMode(enabled);
  });
}

describe('Modo Sênior', () => {
  afterEach(async () => {
    await setSenior(false);
  });

  it('clampFontScale aplica o fator 1,3 e respeita o teto de 2×', () => {
    expect(clampFontScale(1, false)).toBe(1);
    expect(clampFontScale(1, true)).toBeCloseTo(a11y.seniorFontFactor, 5);
    // Nunca encolhe, mesmo se o sistema pedir menos.
    expect(clampFontScale(0.85, false)).toBe(1);
    // Fonte do sistema no máximo × sênior não pode estourar o layout.
    expect(clampFontScale(2, true)).toBe(a11y.fontScaleClamp.max);
  });

  it('a escala tipográfica não tem mais nenhum degrau ilegível (<12px)', () => {
    for (const [nome, token] of Object.entries(typeTokens)) {
      expect(`${nome}:${token.fontSize}`).toBe(`${nome}:${Math.max(12, token.fontSize)}`);
    }
  });

  it('DESLIGADO: os componentes mantêm o tamanho de projeto', async () => {
    await setSenior(false);
    await renderApp(<Button label="Salvar" onPress={() => {}} />);
    expect(fontSizeOf('Salvar')).toBe(15);
  });

  it('LIGADO: o rótulo do botão cresce ~1,3× e o alvo chega a 56 px', async () => {
    await setSenior(true);
    await renderApp(<Button label="Salvar" onPress={() => {}} />);

    // 15 × 1,3 = 19,5 → 20
    expect(fontSizeOf('Salvar')).toBe(Math.round(15 * a11y.seniorFontFactor));

    // O botão `md` fica em tapTarget.senior + 6 de folga (o desenho já tinha
    // essa folga sobre o piso). O que importa é nunca ficar abaixo de 56.
    const altura = boxHeightOf(screen.getByText('Salvar').parent as never);
    expect(altura).toBeGreaterThanOrEqual(tapTarget.senior);
    expect(a11y.tapTarget.senior).toBe(56);
  });

  it('LIGADO: o badge de status clínico sai dos 11 px', async () => {
    await setSenior(true);
    await renderApp(<Badge tone="alert">Atrasado</Badge>);
    // 11 × 1,3 = 14,3 → 14. Pequeno ainda, mas legível — antes era imutável.
    expect(fontSizeOf('Atrasado')).toBe(Math.round(11 * a11y.seniorFontFactor));
  });

  it('LIGADO: rótulo e mensagem de erro do formulário crescem juntos', async () => {
    await setSenior(true);
    await renderApp(<Input label="Dose" error="Informe a dose." />);
    expect(fontSizeOf('Dose')).toBe(Math.round(13 * a11y.seniorFontFactor));
    expect(fontSizeOf('Informe a dose.')).toBe(Math.round(12 * a11y.seniorFontFactor));
  });

  it('o botão de altura fixa virou minHeight — texto grande faz o container crescer', async () => {
    await setSenior(true);
    await renderApp(<Button label="Confirmar todas as doses de hoje" onPress={() => {}} />);
    const flat = StyleSheet.flatten(
      (screen.getByText('Confirmar todas as doses de hoje').parent as never as { props: { style?: unknown } })
        .props.style,
    ) as { height?: number };
    // `height` fixa truncaria o rótulo ampliado; não pode voltar.
    expect(flat?.height).toBeUndefined();
  });
});
