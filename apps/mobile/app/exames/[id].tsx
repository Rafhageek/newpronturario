import { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  FlaskConical,
  CalendarClock,
  Clock,
  TriangleAlert,
  MessageCircleQuestion,
  CheckCircle2,
  HeartPulse,
} from 'lucide-react-native';
import { useExam, useExamMetrics, useMetricHistory, useExplanations } from '@hubpatients/supabase';
import {
  EXAM_CATEGORY_LABELS,
  METRIC_FLAG,
  UNCLASSIFIED_METRIC,
  THEMATIC_PANELS,
  buildExamNarrative,
  classifyExamMetric,
  normalizeMetricKey,
  type ExamMetric,
  type ExamMetricExplanation,
} from '@hubpatients/core';
import { useActiveProfile } from '@/lib/active-profile';
import { AiDisclosure } from '@/components/ai-disclosure';
import { Screen, AppHeader, Card, Badge, EmptyState, IconCircle, Divider } from '@/components/ui';
import { ReadAloudButton } from '@/components/read-aloud-button';
import { LineChart } from '@/components/charts';
import { useScreenGuard } from '@/components/screen-guard';
import { useColors, fonts } from '@/theme';

const STATUS: Record<string, string> = { uploaded: 'Enviado', processing: 'Processando', processed: 'Pronto' };
const TONE_COLOR = { ok: '#10B981', attention: '#F59E0B', alert: '#EF4444', neutral: '#64748B' } as const;

// Fontes reais do pipeline quando não há registro específico em ai_invocations
// (ex.: exame digitado à mão). Fatos do fluxo, não metadados inventados.
const EXAM_AI_SOURCES = [
  'Valores do laudo enviado por você',
  'Dicionário educativo do HubPatients (faixas de referência)',
];

const EXAM_AI_NOTE =
  'Os valores deste exame podem ter sido extraídos automaticamente do arquivo que você enviou ' +
  '(leitura por IA). O resumo, os painéis e as perguntas são montados a partir desses valores e do ' +
  'dicionário educativo do HubPatients — confira sempre com o laudo original.';

export default function ExameDetailScreen() {
  useScreenGuard('exame-detalhe');
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const examId = typeof id === 'string' && id.trim().length > 0 ? id : undefined;
  const { patientId, active: activeProfile } = useActiveProfile();
  const { data: exam, isLoading, isError, refetch } = useExam(examId);
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
    refetch: refetchMetrics,
  } = useExamMetrics(examId);
  const { data: explanations } = useExplanations();

  const list = useMemo(() => metrics ?? [], [metrics]);
  const narrative = useMemo(() => buildExamNarrative(list), [list]);

  // Versão falável do resumo: os tópicos viram frases com ponto final, senão o
  // sintetizador lê tudo emendado e a pessoa perde o fio.
  const resumoFalado = useMemo(() => {
    const partes = narrative.summary
      .map((s) => s.trim().replace(/[.;:]+$/, ''))
      .filter((s) => s.length > 0);
    return partes.length > 0 ? `${partes.join('. ')}.` : '';
  }, [narrative.summary]);

  // Dicionário educativo indexado pela chave normalizada da métrica.
  const explFor = useMemo(() => {
    const map = new Map<string, ExamMetricExplanation>();
    (explanations ?? []).forEach((e) => map.set(e.metric_key, e));
    return (m: ExamMetric) => map.get(normalizeMetricKey(m.metric_code ?? m.name));
  }, [explanations]);

  // Só exames laboratoriais têm métricas estruturadas; imagem/cardio → laudo textual.
  const isLab = exam?.category === 'lab';

  if (!examId) {
    return (
      <ExamQueryState
        title="Exame não encontrado"
        subtitle="O link deste exame é inválido. Volte à lista e tente novamente."
      />
    );
  }

  if (isLoading) {
    return <ExamQueryState loading title="Carregando exame" subtitle="Buscando seus dados com segurança." />;
  }

  if (isError) {
    return (
      <ExamQueryState
        error
        title="Não foi possível carregar o exame"
        subtitle="Verifique sua conexão e tente novamente. Seus dados não foram alterados."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!exam || exam.patient_id !== patientId) {
    return (
      <ExamQueryState
        title="Exame não encontrado"
        subtitle="Este exame pode ter sido removido ou não estar disponível para o perfil atual."
      />
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title={exam.title}
        subtitle={activeProfile.isSelf ? 'Narrativa de saúde' : `Exame de ${activeProfile.name}`}
        back
        icon={FileText}
      />
      <Screen>
        <>
            {/* Info */}
            <Card className="gap-2">
              <View className="flex-row items-center gap-2">
                <Badge tone="info">{EXAM_CATEGORY_LABELS[exam.category]}</Badge>
                <Badge tone={exam.status === 'processed' ? 'ok' : 'neutral'}>{STATUS[exam.status] ?? exam.status}</Badge>
              </View>
              <InfoRow icon={CalendarClock} label="Data" value={exam.exam_date ? new Date(exam.exam_date).toLocaleDateString('pt-BR') : '—'} />
              {exam.lab_name ? <InfoRow icon={FlaskConical} label="Laboratório" value={exam.lab_name} /> : null}
              {exam.doctor_name ? <InfoRow icon={Stethoscope} label="Médico" value={exam.doctor_name} /> : null}
            </Card>

            {/* 1) Banner crítico — valor fora de faixa segura. Factual, não alarmista. */}
            {narrative.hasCritical ? <CriticalBanner /> : null}

            {/* Disclosure de IA (CFM 2.454/2026) — antes de qualquer saída interpretada. */}
            <AiDisclosure
              taskType="exam_reading"
              sources={EXAM_AI_SOURCES}
              createdAt={exam.created_at}
              note={EXAM_AI_NOTE}
            />

            {/* 2) Resumo em 30 segundos */}
            {metricsLoading ? (
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Carregando resultados do exame"
                className="items-center gap-2 py-6"
              >
                <ActivityIndicator color={colors.primary} />
                <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
                  Carregando resultados…
                </Text>
              </View>
            ) : metricsError ? (
              <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <EmptyState
                  icon={TriangleAlert}
                  title="Não foi possível carregar os resultados"
                  subtitle="O exame foi encontrado, mas as métricas não puderam ser consultadas."
                  actionLabel="Tentar novamente"
                  onAction={() => void refetchMetrics()}
                />
              </View>
            ) : list.length > 0 ? (
              <Card className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Clock size={16} color={colors.primary} />
                  <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
                    Resumo em 30 segundos
                  </Text>
                </View>
                <View className="gap-1.5">
                  {narrative.summary.map((s, i) => (
                    <View key={i} className="flex-row gap-2">
                      <Text style={{ fontFamily: fonts.regular }} className="text-[13px] leading-5 text-primary">
                        •
                      </Text>
                      <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] leading-5 text-fg-soft">
                        {s}
                      </Text>
                    </View>
                  ))}
                </View>
                {/* Resumo em letra de 13px é ilegível para presbiopia avançada;
                    ouvir resolve sem depender de óculos ou zoom. */}
                <ReadAloudButton text={resumoFalado} what="o resumo deste exame" label="Ouvir resumo" />
              </Card>
            ) : null}

            {!metricsLoading && !metricsError && isLab && list.length > 0 ? (
              <>
                {/* 3) Painéis temáticos */}
                <ThematicPanels metrics={list} />

                {/* 4) Priorização — pontos de atenção primeiro */}
                {narrative.attention.length > 0 ? (
                  <View className="gap-2">
                    <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
                      Pontos de atenção
                    </Text>
                    <Card className="gap-0.5">
                      {narrative.attention.map((m, i) => (
                        <View key={m.id}>
                          {i > 0 ? <Divider /> : null}
                          <MetricRow metric={m} explanation={explFor(m)} patientId={patientId} />
                        </View>
                      ))}
                    </Card>
                  </View>
                ) : null}

                {narrative.unclassified.length > 0 ? (
                  <View className="gap-2">
                    <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
                      Não classificados ({narrative.unclassified.length})
                    </Text>
                    <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-5 text-muted">
                      Falta valor ou faixa de referência no laudo. Estes resultados não contam como normais.
                    </Text>
                    <Card className="gap-0.5">
                      {narrative.unclassified.map((m, i) => (
                        <View key={m.id}>
                          {i > 0 ? <Divider /> : null}
                          <MetricRow metric={m} explanation={explFor(m)} patientId={patientId} />
                        </View>
                      ))}
                    </Card>
                  </View>
                ) : null}

                {/* Tudo certo */}
                {narrative.normal.length > 0 ? (
                  <View className="gap-2">
                    <View className="flex-row items-center gap-1.5">
                      <CheckCircle2 size={15} color={colors.accent} />
                      <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
                        Tudo certo ({narrative.normal.length})
                      </Text>
                    </View>
                    <Card className="gap-0.5">
                      {narrative.normal.map((m, i) => (
                        <View key={m.id}>
                          {i > 0 ? <Divider /> : null}
                          <MetricRow metric={m} explanation={explFor(m)} patientId={patientId} />
                        </View>
                      ))}
                    </Card>
                  </View>
                ) : null}

                {/* 5) Perguntas para levar ao médico */}
                {narrative.questions.length > 0 ? (
                  <Card className="gap-3">
                    <View className="flex-row items-center gap-2">
                      <MessageCircleQuestion size={16} color={colors.primary} />
                      <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
                        Perguntas para levar ao médico
                      </Text>
                    </View>
                    <View className="gap-2">
                      {narrative.questions.map((q, i) => (
                        <View key={i} className="flex-row gap-2">
                          <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] leading-5 text-primary">
                            {i + 1}.
                          </Text>
                          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] leading-5 text-fg-soft">
                            {q}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                ) : null}
              </>
            ) : !metricsLoading && !metricsError && list.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="Sem métricas registradas"
                subtitle={exam.raw_text ? 'Veja o texto do laudo abaixo.' : 'Adicione resultados a este exame.'}
              />
            ) : null}

            {/* Imagem / cardio: laudo textual (nunca interpretamos a imagem). */}
            {exam.raw_text ? (
              <Card className="gap-1.5">
                <View className="flex-row items-center gap-2">
                  <Stethoscope size={15} color={colors.primary} />
                  <Text style={{ fontFamily: fonts.display }} className="text-[14px] text-fg">
                    Laudo · {EXAM_CATEGORY_LABELS[exam.category]}
                  </Text>
                </View>
                <Text selectable style={{ fontFamily: fonts.regular }} className="text-[13px] leading-5 text-fg-soft">
                  {exam.raw_text}
                </Text>
                <View className="mt-1">
                  <ReadAloudButton text={exam.raw_text ?? ''} what="o laudo deste exame" label="Ouvir laudo" />
                </View>
                {!isLab ? (
                  <Text style={{ fontFamily: fonts.regular }} className="mt-1 text-[11px] text-muted">
                    Para exames de imagem, o HubPatients não interpreta a imagem — apenas organiza o laudo do seu médico.
                  </Text>
                ) : null}
              </Card>
            ) : null}

            {/* Disclaimer permanente */}
            <View className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3">
              <Info size={16} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
                Resultados organizados em linguagem simples. Apenas seu médico interpreta com o contexto completo.
              </Text>
            </View>
          </>
      </Screen>
    </View>
  );
}

function ExamQueryState({
  title,
  subtitle,
  loading,
  error,
  onRetry,
}: {
  title: string;
  subtitle: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const colors = useColors();
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Exame" subtitle="Narrativa de saúde" back icon={FileText} />
      <Screen>
        {loading ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={title}
            className="items-center gap-3 py-12"
          >
            <ActivityIndicator color={colors.primary} />
            <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
              {subtitle}
            </Text>
          </View>
        ) : (
          <View accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion={error ? 'assertive' : 'polite'}>
            <EmptyState
              icon={error ? TriangleAlert : FileText}
              title={title}
              subtitle={subtitle}
              actionLabel={onRetry ? 'Tentar novamente' : undefined}
              onAction={onRetry}
            />
          </View>
        )}
      </Screen>
    </View>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  const colors = useColors();
  return (
    <View className="flex-row items-center gap-2">
      <Icon size={15} color={colors.muted} />
      <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
        {label}:
      </Text>
      <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-fg">
        {value}
      </Text>
    </View>
  );
}

/** Banner vermelho factual: aciona quando há valor fora de faixa segura. */
function CriticalBanner() {
  const colors = useColors();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel="Atenção. Algum resultado está fora da faixa de segurança. Não é um diagnóstico. Procure avaliação médica e mostre este exame ao seu médico."
      className="flex-row items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3"
    >
      <TriangleAlert size={18} color={colors.alert} style={{ marginTop: 1 }} accessible={false} />
      <View className="flex-1 gap-0.5">
        <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-rose-700">
          Algum resultado está fora da faixa de segurança.
        </Text>
        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-5 text-fg-soft">
          Não é um diagnóstico — apenas um aviso para você procurar avaliação médica e mostrar este exame ao seu médico.
        </Text>
      </View>
    </View>
  );
}

/** Painéis temáticos: agrupa métricas por sistema, com a cor do pior achado. */
function ThematicPanels({ metrics }: { metrics: ExamMetric[] }) {
  const panels = THEMATIC_PANELS.map((panel) => {
    const matched = metrics.filter((m) => panel.metricKeys.includes(normalizeMetricKey(m.metric_code ?? m.name)));
    return { panel, matched };
  }).filter((p) => p.matched.length > 0);

  if (panels.length === 0) return null;

  return (
    <View className="gap-2">
      <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
        Por área da saúde
      </Text>
      <View className="gap-2.5">
        {panels.map(({ panel, matched }) => {
          const tone = worstTone(matched);
          const color = TONE_COLOR[tone];
          return (
            <Card key={panel.key} className="gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <HeartPulse size={16} color={color} />
                  <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                    {panel.label}
                  </Text>
                </View>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                {matched.map((m) => (
                  <View key={m.id} className="rounded-full bg-surface-2 px-2.5 py-1">
                    <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-fg-soft">
                      {m.name}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

function worstTone(metrics: ExamMetric[]): keyof typeof TONE_COLOR {
  const classifications = metrics.map(classifyExamMetric);
  if (classifications.includes('alert')) return 'alert';
  if (classifications.includes('attention')) return 'attention';
  if (classifications.includes('ok')) return 'ok';
  return 'neutral';
}

function MetricRow({
  metric,
  explanation,
  patientId,
}: {
  metric: ExamMetric;
  explanation?: ExamMetricExplanation;
  patientId?: string;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const classification = classifyExamMetric(metric);
  const flag = classification === 'unclassified' ? UNCLASSIFIED_METRIC : METRIC_FLAG[classification];
  const badgeTone = flag.tone;
  const iconTone = flag.tone === 'ok' ? ('accent' as const) : flag.tone;
  const { data: history } = useMetricHistory(patientId, metric.name, metric.metric_code);
  const points = (history ?? [])
    .filter((h) => h.value != null)
    .map((h, x) => ({ x, y: h.value as number }));

  // Direção real do desvio: alto e baixo avaliados de forma independente; se não
  // dá para determinar (sem referência), não arriscamos a interpretação trocada.
  const isHigh = metric.value != null && metric.reference_max != null && metric.value > metric.reference_max;
  const isLow = metric.value != null && metric.reference_min != null && metric.value < metric.reference_min;
  const meaning = isHigh ? explanation?.high_means : isLow ? explanation?.low_means : undefined;
  const action = isHigh ? explanation?.actions_high : isLow ? explanation?.actions_low : undefined;

  const valueStr = metric.value != null ? `${metric.value}${metric.unit ? ` ${metric.unit}` : ''}` : (metric.value_text ?? '—');
  const ref =
    metric.reference_min != null && metric.reference_max != null
      ? `${metric.reference_min}–${metric.reference_max}${metric.unit ? ` ${metric.unit}` : ''}`
      : null;

  // Expansível: há explicação educativa ou histórico para mostrar?
  const expandable = explanation != null || points.length >= 2;

  return (
    <Pressable onPress={() => expandable && setOpen((o) => !o)} className="py-2.5">
      <View className="flex-row items-center gap-3">
        <IconCircle icon={FlaskConical} tone={iconTone} size={36} />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
            {explanation?.metric_name ?? metric.name}
          </Text>
          {ref ? (
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
              Referência: {ref}
            </Text>
          ) : null}
        </View>
        <Text style={{ fontFamily: fonts.bold }} className="text-[15px] text-fg">
          {valueStr}
        </Text>
        <Badge tone={badgeTone}>{flag.label}</Badge>
        {expandable ? (
          open ? <ChevronUp size={16} color={colors.faint} /> : <ChevronDown size={16} color={colors.faint} />
        ) : null}
      </View>

      {open ? (
        <View className="mt-2.5 gap-3 border-t border-line pt-3">
          {explanation ? (
            <>
              <ExplField label="O que mede" text={explanation.what_measures} />
              <ExplField label="Por que importa" text={explanation.why_matters} />
              {flag.tone !== 'ok' && meaning ? <ExplField label="O que pode significar" text={meaning} /> : null}
              {flag.tone !== 'ok' && action ? <ExplField label="Converse com seu médico" text={action} accent /> : null}
            </>
          ) : (
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
              Explicação educativa indisponível para esta métrica.
            </Text>
          )}
          {points.length >= 2 ? (
            <View className="gap-1">
              <Text style={{ fontFamily: fonts.medium }} className="text-[11px] text-muted">
                Evolução
              </Text>
              <LineChart series={[{ points, color: colors.primary }]} height={120} formatY={(n) => n.toFixed(0)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function ExplField({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <View className="gap-0.5">
      <Text style={{ fontFamily: fonts.semibold }} className="text-[11px] uppercase tracking-wide text-muted">
        {label}
      </Text>
      <Text
        style={{ fontFamily: fonts.regular }}
        className={`text-[13px] leading-5 ${accent ? 'text-primary' : 'text-fg-soft'}`}
      >
        {text}
      </Text>
    </View>
  );
}
