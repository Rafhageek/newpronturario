/**
 * ════════════════════════════════════════════════════════════════════════════
 * PROGRESSO DO DIÁRIO ALIMENTAR (mobile) — sem cor de julgamento
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Gêmeo de `apps/web/src/components/diario-alimentar/progresso.tsx`, com as
 * mesmas quatro decisões — e pelo mesmo motivo: verde em caloria afirma "você
 * está indo bem" sobre o que a pessoa comeu, e a regra do projeto reserva
 * verde/âmbar/vermelho ao SISTEMA, nunca ao corpo do paciente.
 *
 *  1. COMPRIMENTO é o canal principal (arco e barra).
 *  2. NÚMERO sempre escrito — nada depende de enxergar cor.
 *  3. MARCA DA META, um traço nos 100%, substitui a mudança de cor ao atingir
 *     a meta. A referência fica visível mesmo com a barra curta.
 *  4. EXCEDENTE POR CONTINUAÇÃO: passar da meta estende a barra além do traço,
 *     no mesmo matiz. Nunca repinta de vermelho.
 *
 * A tinta sai de `colors.primary` e `status[tema].neutro` — um matiz só, que
 * acompanha o modo escuro. Tamanhos passam por `useType()`/`useFontScaler()`
 * para o Modo Sênior ampliar tudo junto.
 */

import { View, Text, Pressable } from 'react-native';
import Svg, { Circle, Line as SvgLine } from 'react-native-svg';
import type { ProgressoNutriente } from '@hubpatients/core';
import { useColors, useType, useFontScaler, useTapTarget, fonts } from '@/theme';

const CONTINUOUS = { borderCurve: 'continuous' as const };

/**
 * A figura representa `max(1, fração total)`, para um dia acima da meta ainda
 * caber nela. O traço da meta anda junto — é ele a referência, não a borda.
 */
function escalaDe(p: ProgressoNutriente): number {
  return Math.max(1, p.fracao + p.excedente);
}

/* ──────────────────────────────── Anel ──────────────────────────────── */

export function AnelDeProgresso({
  progresso,
  unidade,
}: {
  progresso: ProgressoNutriente;
  unidade: string;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();

  const raio = 70;
  const circ = 2 * Math.PI * raio;
  const escala = escalaDe(progresso);
  const preenchido = Math.min(1, (progresso.fracao + progresso.excedente) / escala);
  const semMeta = progresso.meta == null;

  // Ângulo dos 100% depois da escala. -90 põe o zero no topo.
  const anguloMeta = ((1 / escala) * 360 - 90) * (Math.PI / 180);
  const px = (r: number) => 80 + r * Math.cos(anguloMeta);
  const py = (r: number) => 80 + r * Math.sin(anguloMeta);

  const [valorTexto, metaTexto] = progresso.texto.split(' de ');
  const descricao = semMeta
    ? `${progresso.texto} registradas. Nenhuma meta definida.`
    : `${progresso.texto}. ${progresso.porcentagem}% da meta que você definiu.`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={descricao}
      accessibilityValue={{
        min: 0,
        max: progresso.meta ?? undefined,
        now: Math.round(progresso.valor),
        text: descricao,
      }}
      style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={160} height={160} style={{ position: 'absolute' }}>
        <Circle cx={80} cy={80} r={raio} fill="none" stroke={colors.surface2} strokeWidth={12} />
        {progresso.valor > 0 ? (
          <Circle
            cx={80}
            cy={80}
            r={raio}
            fill="none"
            stroke={colors.primary}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            strokeDashoffset={circ * (1 - preenchido)}
            transform={`rotate(-90 80 80)`}
          />
        ) : null}
        {!semMeta ? (
          <SvgLine
            x1={px(raio - 9)}
            y1={py(raio - 9)}
            x2={px(raio + 9)}
            y2={py(raio + 9)}
            stroke={colors.fg}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ) : null}
      </Svg>

      <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
        <Text
          maxFontSizeMultiplier={1.3}
          style={[{ fontFamily: fonts.numBold, color: colors.fg }, fs(type.dataLg.fontSize, type.dataLg.lineHeight)]}
        >
          {valorTexto ?? '0'}
        </Text>
        <Text
          maxFontSizeMultiplier={1.3}
          numberOfLines={2}
          style={[
            { fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
            fs(type.caption.fontSize, type.caption.lineHeight),
          ]}
        >
          {semMeta ? `${unidade} registradas` : `de ${metaTexto ?? ''}`}
        </Text>
      </View>
    </View>
  );
}

/* ──────────────────────────────── Barra ──────────────────────────────── */

export function BarraDeNutriente({
  rotulo,
  progresso,
}: {
  rotulo: string;
  progresso: ProgressoNutriente;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();

  const escala = escalaDe(progresso);
  const largura = ((progresso.fracao + progresso.excedente) / escala) * 100;
  const posMeta = (1 / escala) * 100;
  const semMeta = progresso.meta == null;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${rotulo}: ${progresso.texto}`}
      accessibilityValue={{
        min: 0,
        max: progresso.meta ?? undefined,
        now: Math.round(progresso.valor),
        text: progresso.texto,
      }}
      style={{ gap: 6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text
          maxFontSizeMultiplier={1.4}
          style={[{ fontFamily: fonts.medium, color: colors.fgSoft, flex: 1 }, fs(type.caption.fontSize, type.caption.lineHeight)]}
        >
          {rotulo}
        </Text>
        <Text
          maxFontSizeMultiplier={1.4}
          style={[{ fontFamily: fonts.num, color: colors.muted }, fs(type.caption.fontSize, type.caption.lineHeight)]}
        >
          {progresso.texto}
          {progresso.porcentagem != null ? `  ${progresso.porcentagem}%` : ''}
        </Text>
      </View>

      <View
        style={[
          { height: 10, borderRadius: 999, backgroundColor: colors.surface2, overflow: 'hidden' },
          CONTINUOUS,
        ]}
      >
        <View
          style={{
            height: '100%',
            width: `${largura}%`,
            borderRadius: 999,
            backgroundColor: colors.primary,
          }}
        />
        {/* Traço da meta, por cima do preenchimento: continua visível quando a
            barra passa dele — é a referência, não o fim da barra. */}
        {!semMeta && posMeta < 100 ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${posMeta}%`,
              width: 2,
              backgroundColor: colors.fg,
              opacity: 0.7,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

/* ─────────────────────────── Visão da semana ─────────────────────────── */

/**
 * Conta REGISTRO, não aderência. Dia cheio = tem anotação; dia vazio = não tem.
 * Nada aqui diz se a pessoa comeu bem — e não existe sequência nem recorde de
 * propósito (ver `resumoDaSemana` no core).
 */
export function VisaoDaSemana({
  dias,
  texto,
  iniciais,
  diaAtual,
  hoje,
  onEscolherDia,
}: {
  dias: { dia: string; registrado: boolean }[];
  texto: string;
  iniciais: readonly string[];
  diaAtual: string;
  hoje: string;
  onEscolherDia: (dia: string) => void;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
        {dias.map((d, i) => {
          const selecionado = d.dia === diaAtual;
          const futuro = d.dia > hoje;
          return (
            <Pressable
              key={d.dia}
              onPress={() => onEscolherDia(d.dia)}
              disabled={futuro}
              accessibilityRole="button"
              accessibilityState={{ selected: selecionado, disabled: futuro }}
              accessibilityLabel={`${iniciais[i]}, ${d.registrado ? 'com registro' : 'sem registro'}`}
              style={[
                {
                  flex: 1,
                  minHeight: tap,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 12,
                  paddingVertical: 6,
                  backgroundColor: selecionado ? colors.surface2 : 'transparent',
                  opacity: futuro ? 0.35 : 1,
                },
                CONTINUOUS,
              ]}
            >
              <Text
                maxFontSizeMultiplier={1.3}
                style={[{ fontFamily: fonts.medium, color: colors.muted }, fs(11, 14)]}
              >
                {iniciais[i]}
              </Text>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderStyle: d.registrado ? 'solid' : 'dashed',
                  borderColor: d.registrado ? colors.primary : colors.lineStrong,
                  backgroundColor: d.registrado ? colors.primary : 'transparent',
                }}
              >
                {/* Glifo redundante com o preenchimento: quem não distingue a
                    cor ainda lê o traço. */}
                <Text
                  maxFontSizeMultiplier={1.2}
                  style={[
                    {
                      fontFamily: fonts.semibold,
                      color: d.registrado ? colors.white : colors.faint,
                    },
                    fs(11, 14),
                  ]}
                >
                  {d.registrado ? '•' : '–'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text
        maxFontSizeMultiplier={1.4}
        style={[{ fontFamily: fonts.regular, color: colors.muted }, fs(type.caption.fontSize, type.caption.lineHeight)]}
      >
        {texto}
      </Text>
    </View>
  );
}
