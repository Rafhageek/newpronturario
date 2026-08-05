/**
 * Progresso do diário alimentar — o que não pode regredir.
 *
 * Dois riscos concretos, e um teste para cada:
 *
 *  · A LEGIBILIDADE SEM COR. Como o progresso não usa mais verde/vermelho, tudo
 *    que informa passou a estar no COMPRIMENTO e no NÚMERO. Se alguém apagar o
 *    texto "1.250 de 2.000 kcal" achando que a barra basta, a tela fica
 *    ilegível para quem não distingue a cor — e ninguém percebe olhando.
 *
 *  · O MODO SÊNIOR. Os dias da semana são alvos tocáveis; 56 px é o mínimo com
 *    o modo ligado.
 */

import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { progressoNutriente, resumoDaSemana, SEMANA_CURTA_SEG_PRIMEIRO } from '@hubpatients/core';
import { a11y } from '@hubpatients/ui-tokens';
import { BarraDeNutriente, VisaoDaSemana } from '@/components/diario-alimentar/progresso';
import { saveSeniorMode } from '@/theme';

// O harness do jest-expo reporta fontScale 2; fixamos em 1 para as asserções
// de tamanho falarem do Modo Sênior, e não da ampliação do sistema.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderApp(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);
}

const SEMANA = [
  '2026-08-03',
  '2026-08-04',
  '2026-08-05',
  '2026-08-06',
  '2026-08-07',
  '2026-08-08',
  '2026-08-09',
];

afterEach(async () => {
  await act(async () => {
    await saveSeniorMode(false);
  });
});

describe('BarraDeNutriente', () => {
  it('escreve o número por extenso — nada depende de enxergar a cor', async () => {
    await renderApp(
      <BarraDeNutriente rotulo="Proteínas" progresso={progressoNutriente(45, 75, 'g')} />,
    );
    expect(screen.getByText('Proteínas')).toBeTruthy();
    // Valor, meta e porcentagem, todos em texto.
    expect(screen.getByText(/45 de 75 g/)).toBeTruthy();
    expect(screen.getByText(/60%/)).toBeTruthy();
  });

  it('não escreve "restantes" — a barra informa posição, não saldo a gastar', async () => {
    await renderApp(
      <BarraDeNutriente rotulo="Carboidratos" progresso={progressoNutriente(120, 275, 'g')} />,
    );
    expect(screen.queryByText(/restante/i)).toBeNull();
    expect(screen.queryByText(/falta/i)).toBeNull();
  });

  it('acima da meta continua factual, sem alarme', async () => {
    await renderApp(
      <BarraDeNutriente rotulo="Gorduras" progresso={progressoNutriente(80, 67, 'g')} />,
    );
    expect(screen.getByText(/80 de 67 g/)).toBeTruthy();
    expect(screen.getByText(/119%/)).toBeTruthy();
    for (const palavra of [/excedeu/i, /ultrapassou/i, /atenção/i, /cuidado/i]) {
      expect(screen.queryByText(palavra)).toBeNull();
    }
  });

  it('sem meta mostra só o registrado, e não inventa um alvo', async () => {
    await renderApp(
      <BarraDeNutriente rotulo="Fibras" progresso={progressoNutriente(12, null, 'g')} />,
    );
    expect(screen.getByText('12 g')).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });
});

describe('VisaoDaSemana', () => {
  const resumo = resumoDaSemana(SEMANA, ['2026-08-03', '2026-08-05']);

  function semana() {
    return (
      <VisaoDaSemana
        dias={resumo.dias}
        texto={resumo.texto}
        iniciais={SEMANA_CURTA_SEG_PRIMEIRO}
        diaAtual="2026-08-05"
        hoje="2026-08-09"
        onEscolherDia={() => {}}
      />
    );
  }

  it('conta registro, não aderência', async () => {
    await renderApp(semana());
    expect(screen.getByText('2 de 7 dias registrados')).toBeTruthy();
    expect(screen.queryByText(/sequência|ofensiva|recorde|meta/i)).toBeNull();
  });

  it('o dia registrado é distinguível sem depender da cor', async () => {
    await renderApp(semana());
    // Dois dias com registro (glifo cheio) e cinco sem (traço). Se alguém
    // remover o glifo, sobra só a cor de preenchimento — e a informação some
    // para quem tem daltonismo ou imprime a tela.
    expect(screen.getAllByText('•')).toHaveLength(2);
    expect(screen.getAllByText('–')).toHaveLength(5);
  });

  it('cada dia é rotulado para o leitor de tela com o estado, não só o nome', async () => {
    await renderApp(semana());
    expect(screen.getByLabelText('Seg, com registro')).toBeTruthy();
    expect(screen.getByLabelText('Ter, sem registro')).toBeTruthy();
  });

  it('no Modo Sênior, cada dia respeita o alvo de 56 px', async () => {
    await act(async () => {
      await saveSeniorMode(true);
    });
    await renderApp(semana());

    const alvo = screen.getByLabelText('Seg, com registro');
    const flat = StyleSheet.flatten(alvo.props.style);
    expect(a11y.tapTarget.senior).toBe(56);
    expect(flat?.minHeight).toBe(a11y.tapTarget.senior);
    // `height` fixa truncaria o conteúdo ampliado; não pode voltar.
    expect(flat?.height).toBeUndefined();
  });
});
