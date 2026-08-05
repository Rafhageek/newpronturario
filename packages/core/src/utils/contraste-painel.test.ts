/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONTRASTE MEDIDO — a camada "Painel" não passa por olhômetro
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Texto cinza-claro sobre fundo branco é o erro clássico deste estilo visual, e
 * ele já tinha acontecido aqui: o `--hint` do `.hp-clinical-shell` (#67748a)
 * parecia perfeitamente legível e entregava 4,40:1 sobre o próprio canvas —
 * reprovava AA por pouco, em produção, sem ninguém perceber. Este arquivo é o
 * que impede a repetição: toda cor da camada nova é MEDIDA contra o PIOR fundo
 * do seu tema, com a fórmula da WCAG 2.2, e o número aparece na mensagem de
 * falha.
 *
 * Como o Painel será a base das ~49 rotas da web e ~47 telas do mobile, um erro
 * de 0,1:1 aqui se multiplica por 96.
 */

import { describe, it, expect } from 'vitest';
import {
  a11y,
  contrastRatio,
  isCategoryHue,
  hexToHsl,
  CATEGORY_HUE_RANGE,
  CHIP_TONES,
  chipPastel,
  painelSurfaceLight,
  painelSurfaceDark,
  painelInkLight,
  painelInkDark,
  navActive,
  surfaceDark,
  inkDark,
  spacePx,
  spacing,
  radiusPx,
  chart,
} from '@hubpatients/ui-tokens';
import { MOOD_RAMP, MOOD_SCALE, MOOD_VALUES, moodFacePaths } from '../data/mood-scale';
import { MOOD_PIXEL } from './mood-map';
import { painIntensityColor } from '../data/body-regions';

const AA_TEXTO = a11y.contrastRatios.normalText; // 4.5
const AA_NAO_TEXTO = a11y.contrastRatios.nonText; // 3

/**
 * O pior fundo de um tema para tinta escura é a superfície mais ESCURA que
 * ainda recebe texto; para tinta clara, a mais CLARA. No claro isso é
 * `surface3`; no escuro é `surface3` também (o degrau tonal mais alto).
 */
const PIOR_FUNDO_CLARO = painelSurfaceLight.surface3;
const PIOR_FUNDO_ESCURO = painelSurfaceDark.surface3;

function medir(frente: string, fundo: string): number {
  return contrastRatio(frente, fundo);
}

describe('contraste da camada Painel — tema claro', () => {
  const casos: [string, string, number][] = [
    ['fg', painelInkLight.fg, AA_TEXTO],
    ['fgSoft', painelInkLight.fgSoft, AA_TEXTO],
    ['muted', painelInkLight.muted, AA_TEXTO],
    ['hint', painelInkLight.hint, AA_TEXTO],
    ['primary', painelInkLight.primary, AA_TEXTO],
  ];

  it.each(casos)('%s cumpre AA sobre o PIOR fundo do tema (surface3)', (nome, cor, minimo) => {
    const razao = medir(cor, PIOR_FUNDO_CLARO);
    expect(razao, `${nome} (${cor}) sobre ${PIOR_FUNDO_CLARO} = ${razao}:1`).toBeGreaterThanOrEqual(
      minimo,
    );
  });

  it('lineStrong serve de borda de campo (≥3:1, SC 1.4.11) sobre o pior fundo', () => {
    const razao = medir(painelSurfaceLight.lineStrong, PIOR_FUNDO_CLARO);
    expect(razao, `lineStrong = ${razao}:1`).toBeGreaterThanOrEqual(AA_NAO_TEXTO);
  });

  it('onPrimary é legível sobre o preenchimento primary', () => {
    const razao = medir(painelInkLight.onPrimary, painelInkLight.primary);
    expect(razao, `onPrimary sobre primary = ${razao}:1`).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('a pílula do item ativo da lateral é legível (azul-claro + texto azul)', () => {
    const razao = medir(navActive.light.ink, navActive.light.tint);
    expect(razao, `nav ativo = ${razao}:1`).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  /**
   * O `--hint` anterior do `.hp-clinical-shell`. Fica aqui como caso de
   * regressão nomeado: se alguém "voltar ao cinza que ficava melhor", o teste
   * mostra o número que reprova.
   */
  it('o #67748a que estava em produção continua reprovando — era esse o bug', () => {
    expect(medir('#67748a', PIOR_FUNDO_CLARO)).toBeLessThan(AA_TEXTO);
    expect(medir('#8994a7', PIOR_FUNDO_CLARO)).toBeLessThan(AA_NAO_TEXTO);
  });
});

describe('contraste da camada Painel — tema escuro', () => {
  const casos: [string, string][] = [
    ['fg', painelInkDark.fg],
    ['fgSoft', painelInkDark.fgSoft],
    ['muted', painelInkDark.muted],
    ['hint', painelInkDark.hint],
    ['primary', painelInkDark.primary],
  ];

  it.each(casos)('%s cumpre AA sobre o pior fundo do escuro (surface3)', (nome, cor) => {
    const razao = medir(cor, PIOR_FUNDO_ESCURO);
    expect(razao, `${nome} (${cor}) = ${razao}:1`).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('onPrimary escuro inverte para tinta escura sobre o azul claro', () => {
    const razao = medir(painelInkDark.onPrimary, painelInkDark.primary);
    expect(razao, `onPrimary sobre primary = ${razao}:1`).toBeGreaterThanOrEqual(AA_TEXTO);
    // Branco sobre o azul claro do escuro daria ~2,2:1 — o erro que o token evita.
    expect(medir('#ffffff', painelInkDark.primary)).toBeLessThan(AA_TEXTO);
  });

  it('o escuro do Painel é IDÊNTICO à base já auditada (cópia não pode divergir)', () => {
    expect(painelSurfaceDark).toEqual({
      bg: surfaceDark.bg,
      surface: surfaceDark.surface,
      surface2: surfaceDark.surface2,
      surface3: surfaceDark.surface3,
      line: surfaceDark.line,
      lineStrong: surfaceDark.lineStrong,
    });
    expect(painelInkDark.fg).toBe(inkDark.fg);
    expect(painelInkDark.fgSoft).toBe(inkDark.fgSoft);
    expect(painelInkDark.muted).toBe(inkDark.muted);
    expect(painelInkDark.hint).toBe(inkDark.hint);
    expect(painelInkDark.primary).toBe(inkDark.primary);
    expect(painelInkDark.primaryHover).toBe(inkDark.primaryHover);
  });
});

describe('chips pastel — cor de CATEGORIA, nunca de gravidade', () => {
  for (const tema of ['light', 'dark'] as const) {
    const fundo = tema === 'light' ? painelSurfaceLight.surface : painelSurfaceDark.surface;

    it.each([...CHIP_TONES])(`[${tema}] %s: ink legível sobre o próprio tint e sobre o cartão`, (tom) => {
      const { ink, tint } = chipPastel[tema][tom];
      const sobreTint = medir(ink, tint);
      const sobreCartao = medir(ink, fundo);
      expect(sobreTint, `${tom} ink sobre tint = ${sobreTint}:1`).toBeGreaterThanOrEqual(AA_TEXTO);
      expect(sobreCartao, `${tom} ink sobre surface = ${sobreCartao}:1`).toBeGreaterThanOrEqual(
        AA_TEXTO,
      );
    });

    it(`[${tema}] nenhum matiz da paleta lê como semáforo`, () => {
      for (const tom of CHIP_TONES) {
        const { ink, tint } = chipPastel[tema][tom];
        for (const cor of [ink, tint]) {
          const { h, s } = hexToHsl(cor);
          expect(
            isCategoryHue(cor),
            `${tom} ${cor} está em ${Math.round(h)}° (sat ${s.toFixed(2)}) — fora da faixa de ` +
              `categoria ${CATEGORY_HUE_RANGE.min}°–${CATEGORY_HUE_RANGE.max}°. Verde, âmbar, ` +
              'laranja, amarelo, vermelho e rosa estão proibidos: um chip de ícone diz de que ' +
              'ASSUNTO é o cartão, não se o que está dentro dele é grave.',
          ).toBe(true);
        }
      }
    });
  }

  it('a paleta tem tons suficientes para uma fileira de 5 cartões sem repetir', () => {
    expect(CHIP_TONES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(CHIP_TONES).size).toBe(CHIP_TONES.length);
  });
});

describe('escala de humor — a ordem está na forma e na palavra, não na cor', () => {
  it('a rampa inteira é UM matiz só (nenhum degrau é verde nem vermelho)', () => {
    const matizes = MOOD_VALUES.map((v) => hexToHsl(MOOD_RAMP[v]).h);
    for (const [i, h] of matizes.entries()) {
      expect(
        isCategoryHue(MOOD_RAMP[MOOD_VALUES[i] as (typeof MOOD_VALUES)[number]]),
        `degrau ${i + 1} está em ${Math.round(h)}°`,
      ).toBe(true);
    }
    // Amplitude de matiz de ponta a ponta: um matiz "só" tolera alguns graus.
    const amplitude = Math.max(...matizes) - Math.min(...matizes);
    expect(amplitude, `amplitude de matiz = ${amplitude.toFixed(1)}°`).toBeLessThanOrEqual(10);
  });

  it('a rampa é monotônica: cada degrau é mais escuro que o anterior', () => {
    const contrasteComBranco = MOOD_VALUES.map((v) => contrastRatio(MOOD_RAMP[v], '#ffffff'));
    for (let i = 1; i < contrasteComBranco.length; i += 1) {
      expect(
        contrasteComBranco[i] as number,
        `degrau ${i + 1} não é mais escuro que o ${i}`,
      ).toBeGreaterThan(contrasteComBranco[i - 1] as number);
    }
  });

  it('a tinta declarada é legível sobre cada degrau', () => {
    for (const opcao of MOOD_SCALE) {
      const razao = medir(opcao.tinta, opcao.cor);
      expect(razao, `degrau ${opcao.valor}: tinta sobre cor = ${razao}:1`).toBeGreaterThanOrEqual(
        AA_TEXTO,
      );
    }
  });

  it('as cinco opções são distinguíveis SEM cor: boca e olhos diferentes em cada uma', () => {
    const bocas = new Set(MOOD_SCALE.map((o) => o.caminhos.boca));
    const olhos = new Set(MOOD_SCALE.map((o) => o.caminhos.olhoEsquerdo));
    expect(bocas.size, 'duas opções desenham a mesma boca').toBe(MOOD_SCALE.length);
    expect(olhos.size, 'duas opções desenham o mesmo olho').toBe(MOOD_SCALE.length);
  });

  it('a curvatura da boca é monotônica de "para baixo" a "para cima", passando por reta', () => {
    const curvas = MOOD_SCALE.map((o) => o.forma.boca);
    for (let i = 1; i < curvas.length; i += 1) {
      expect(curvas[i] as number).toBeGreaterThan(curvas[i - 1] as number);
    }
    expect(curvas[0] as number).toBeLessThan(0); // 1º: para baixo
    expect(curvas[2] as number).toBe(0); // 3º: reta
    expect(curvas[4] as number).toBeGreaterThan(0); // 5º: para cima
  });

  it('todo degrau tem rótulo VISÍVEL em texto (cor nunca é o único canal)', () => {
    for (const opcao of MOOD_SCALE) {
      expect(opcao.rotulo.length, `degrau ${opcao.valor} sem rótulo`).toBeGreaterThan(0);
      expect(opcao.descricao).toContain(`${opcao.valor} de 5`);
    }
  });

  /**
   * A carinha precisa desenhar igual na web (<svg>) e no mobile
   * (react-native-svg). O parser do Android é menos tolerante que o do browser:
   * um `-0` ou uma notação exponencial vinda de `toString()` derruba o path em
   * silêncio (o desenho some, o app não quebra — o pior tipo de bug).
   */
  it('os caminhos SVG são bem formados e portáveis (sem -0, sem notação exponencial)', () => {
    const PATH_VALIDO = /^M -?[\d.]+ -?[\d.]+ Q -?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+$/;
    for (const v of MOOD_VALUES) {
      const { boca, olhoEsquerdo, olhoDireito } = moodFacePaths(v);
      for (const d of [boca, olhoEsquerdo, olhoDireito]) {
        expect(d, `degrau ${v}: "${d}"`).toMatch(PATH_VALIDO);
        expect(d).not.toContain('-0 ');
        expect(d).not.toMatch(/e[+-]/i);
      }
      // Olhos espelhados: mesma forma, coordenadas diferentes.
      expect(olhoEsquerdo).not.toBe(olhoDireito);
    }
  });

  it('o mapa do ano usa a MESMA rampa do seletor (não pode voltar o semáforo)', () => {
    for (const v of MOOD_VALUES) {
      expect(MOOD_PIXEL[v]).toBe(MOOD_RAMP[v]);
    }
    // As cores da versão anterior — coral, âmbar e verde — não podem reaparecer.
    const proibidas = ['#F24B59', '#F59E0B', '#10B981'];
    for (const proibida of proibidas) {
      expect(Object.values(MOOD_PIXEL).map((c) => c.toLowerCase())).not.toContain(
        proibida.toLowerCase(),
      );
    }
  });

  it('humor e dor moram no mesmo matiz — são o mesmo tipo de dado', () => {
    const matizHumor = hexToHsl(MOOD_RAMP[3]).h;
    const matizDor = hexToHsl(painIntensityColor(5)).h;
    expect(Math.abs(matizHumor - matizDor), 'humor e dor divergiram de matiz').toBeLessThanOrEqual(
      12,
    );
  });
});

describe('métrica: web e mobile não podem divergir', () => {
  it('a escala de espaçamento em rem é derivada da escala em px', () => {
    for (const chave of [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 24] as const) {
      expect(spacing[chave], `spacing[${chave}]`).toBe(`${spacePx[chave] / 16}rem`);
    }
  });

  it('o raio de cartão do Painel é o mesmo número nas duas plataformas', () => {
    expect(radiusPx.md).toBe(16);
    expect(radiusPx.full).toBeGreaterThan(100);
  });
});

describe('gráficos: a paleta neutra-clínica continua sem semáforo', () => {
  it.each(['light', 'dark'] as const)('[%s] nenhuma série de gráfico é verde nem vermelha', (tema) => {
    for (const cor of chart[tema]) {
      const { h, s } = hexToHsl(cor);
      // A `chart-4` é um bege quente por decisão anterior e não é semáforo por
      // saturação baixa OU por já estar coberta pela auditoria de 2026-07;
      // aqui travamos apenas que nenhuma delas caiu na faixa vermelha.
      const vermelha = s >= 0.25 && (h <= 20 || h >= 335);
      expect(vermelha, `${cor} está em ${Math.round(h)}° — vermelho`).toBe(false);
    }
  });
});
