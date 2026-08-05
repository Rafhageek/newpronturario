import { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import {
  Bell,
  HeartPulse,
  Pill,
  Clock,
  FlaskConical,
  CalendarDays,
  ChevronRight,
  Smile,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  Brain,
  Lock,
  Sparkles,
  Stethoscope,
  CreditCard,
  Store,
  Building2,
  TestTube,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import {
  useDashboard,
  useProfile,
  useVitals,
  useVitalsRange,
  useNextAppointment,
  useDiarySummary,
  useAllergies,
  useRegisterIntake,
  useNotifications,
  useHasPlusAccess,
  queryKeys,
} from '@hubpatients/supabase';
import { useQueryClient } from '@tanstack/react-query';
import {
  classifyBloodPressure,
  DISCLAIMERS,
  formatVital,
  smoothedTrendPct,
  trendDirection,
  trendLabel,
  type ClinicalZone,
} from '@hubpatients/core';
import { useActiveProfile } from '@/lib/active-profile';
import { Card, SectionTitle, IconCircle, EmptyState, ErrorState, Button } from '@/components/ui';
import { useTabBarSpace } from '@/components/tab-bar';
import { WhatsNewSheet } from '@/components/whats-new-sheet';
import { ActiveProfileSwitcher } from '@/components/active-profile-switcher';
import { WaterCard } from '@/components/water-card';
import { StepsCard } from '@/components/steps-card';
import { BodyCompositionCard } from '@/components/body-composition-card';
import { toast } from '@/components/toast';
import { LineChart } from '@/components/charts';
import { useColors, fonts, cardShadow, status, useFontScaler } from '@/theme';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Leitura da faixa de referência — TEXTO e SETA, nunca semáforo.
 *
 * Aqui existia o `ZONE_TONE`, que pintava a pressão de `bg-amber-100` /
 * `bg-rose-100`. Isso quebra a regra dura do design system (`status` em
 * `packages/ui-tokens/src/index.ts`): vermelho e âmbar pertencem ao SISTEMA
 * (remédio atrasado, erro de upload) e NUNCA ao corpo do paciente — semáforo em
 * dado clínico é diagnóstico disfarçado, e o app não diagnostica.
 *
 * A informação não foi removida, só trocou de canal: `short` é o que aparece no
 * cartão (largura de ~30% da tela), `full` é a frase que o leitor de tela
 * anuncia, e `glyph` é o sinal NÃO-cromático (WCAG SC 1.4.1).
 */
const ZONE_READING: Record<ClinicalZone, { glyph: string; short: string; full: string }> = {
  ok: { glyph: '•', short: 'Na faixa de referência', full: 'Dentro do intervalo de referência' },
  attention: { glyph: '↑', short: 'No limite da faixa', full: 'No limite do intervalo de referência' },
  alert: { glyph: '↑', short: 'Acima da faixa', full: 'Acima do intervalo de referência' },
};

const ptsOf = (vals: number[]) => vals.map((y, x) => ({ x, y }));

// Menus principais da Home (grade de acesso rápido, estilo app de banco).
type MenuItem = { label: string; icon: LucideIcon; route?: string; soon?: boolean };
const MENU: MenuItem[] = [
  { label: 'Exames', icon: FlaskConical, route: '/exames' },
  { label: 'Consultas', icon: CalendarDays, route: '/consultas' },
  { label: 'Conexão médica', icon: Stethoscope, route: '/comunidade' },
  { label: 'Convênio', icon: CreditCard, route: '/perfil' },
  { label: 'Farmácia', icon: Store, route: '/locais/pharmacy' },
  { label: 'Hospitais', icon: Building2, route: '/locais/hospital' },
  { label: 'Laboratório', icon: TestTube, route: '/locais/lab' },
];

export default function InicioScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { patientId, ownId, active, isViewingDependent } = useActiveProfile();
  const pid = patientId || undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();

  const { data, isLoading, isError, refetch } = useDashboard(pid);
  const { data: profile } = useProfile(pid);
  const { data: bpRange } = useVitalsRange(pid, 'blood_pressure', 30);
  const { data: nextAppt } = useNextAppointment(pid);
  const { data: wellbeing } = useDiarySummary(pid);
  const { data: allergies } = useAllergies(pid);
  const { data: weightVitals } = useVitals(pid, 'weight');
  const isPlus = useHasPlusAccess(pid).data ?? false;
  const registerIntake = useRegisterIntake(pid ?? '');
  const unreadNotifs = (useNotifications(ownId || undefined).data ?? []).filter(
    (n) => !n.read_at,
  ).length;

  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  // Qual lembrete está sendo registrado (mostra spinner só na linha tocada).
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Invalida só as chaves desta tela (não o cache inteiro do app).
      if (pid) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.dashboard(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.profile(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.vitalsRange(pid, 'blood_pressure', 30) }),
          qc.invalidateQueries({ queryKey: queryKeys.nextAppointment(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.diarySummary(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.allergies(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.hasPlusAccess(pid) }),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const firstName = profile?.full_name?.split(' ')[0];
  const bp = data?.latestBloodPressure ?? null;
  const meds = data?.activeMedications ?? [];
  const upcoming = data?.upcomingIntakes ?? [];
  const range = bpRange ?? [];
  const paPct = smoothedTrendPct(range.map((v) => v.value_primary));
  const paDir = trendDirection(paPct);
  const severeAllergies = (allergies ?? []).filter((a) => a.severity === 'severe');
  const latestWeight =
    (weightVitals ?? [])
      .slice()
      .sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime())[0]
      ?.value_primary ?? null;
  const age = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;
  const useCompactWellnessGrid = width >= 430;

  // Nome do medicamento por id (lembretes só trazem medication_id).
  const medNameById = (id: string): string => meds.find((m) => m.id === id)?.name ?? 'Medicação';

  const bpStatus =
    bp && bp.value_secondary != null
      ? classifyBloodPressure(bp.value_primary, bp.value_secondary)
      : null;

  // Mini-tendência da sistólica (penúltimo vs. último).
  const trend: 'up' | 'down' | 'flat' = (() => {
    if (range.length < 2) return 'flat';
    const prev = range[range.length - 2];
    const last = range[range.length - 1];
    if (!prev || !last) return 'flat';
    return last.value_primary > prev.value_primary
      ? 'up'
      : last.value_primary < prev.value_primary
        ? 'down'
        : 'flat';
  })();

  // Registra uma tomada pendente específica (lista "Lembretes de hoje").
  async function handleRegisterPending(intake: (typeof upcoming)[number]) {
    if (!pid || registeringId) return;
    setRegisteringId(intake.id);
    try {
      await registerIntake.mutateAsync({
        patient_id: pid,
        medication_id: intake.medication_id,
        schedule_id: intake.schedule_id,
        scheduled_for: intake.scheduled_for,
        status: 'taken',
        taken_at: new Date().toISOString(),
      });
      toast.success('Tomada registrada com sucesso.');
    } catch {
      toast.error('Não foi possível registrar a tomada.');
    } finally {
      setRegisteringId(null);
    }
  }

  function handleMenu(m: MenuItem) {
    if (m.soon || !m.route) {
      toast.info(`${m.label} chega em breve.`);
      return;
    }
    router.push(m.route as never);
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarSpace }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Marca, saudação, status do dia e ações pessoais. */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 18,
            paddingBottom: 18,
          }}
          className="bg-bg"
        >
          <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
            <View className="flex-row items-start justify-between">
              <View className="min-w-0 flex-1 pr-3">
                <View className="flex-row items-center gap-2">
                  <HeartPulse size={23} color={colors.primary} strokeWidth={2.5} />
                  <Text style={{ fontFamily: fonts.bold }} className="text-[18px] text-primary">
                    HubPatients
                  </Text>
                </View>
                <Text
                  style={{ fontFamily: fonts.displayX }}
                  className="mt-3 text-[29px] leading-9 text-fg"
                  numberOfLines={2}
                >
                  {isViewingDependent
                    ? `Cuidado de ${active.name}`
                    : `${greeting()}${firstName ? `, ${firstName}` : ''} 👋`}
                </Text>

                {/* Status do DIA (lembretes / aviso de alergia).
                    @cor-do-sistema — domínio de agenda e segurança, não medida
                    do corpo: aqui o vermelho é permitido pela regra. */}
                <View
                  style={{ backgroundColor: 'rgba(13,148,136,0.10)', borderCurve: 'continuous' }}
                  className="mt-3 flex-row items-center gap-2 self-start rounded-full px-3.5 py-2"
                >
                  {upcoming.length > 0 ? (
                    <Clock size={16} color="#0f766e" />
                  ) : severeAllergies.length > 0 ? (
                    <AlertTriangle size={16} color={colors.alert} />
                  ) : (
                    <ShieldCheck size={17} color="#0f766e" />
                  )}
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      color: severeAllergies.length > 0 ? colors.alert : '#0f766e',
                    }}
                    className="text-[14px]"
                  >
                    {upcoming.length > 0
                      ? `${upcoming.length} ${upcoming.length === 1 ? 'lembrete' : 'lembretes'} para hoje`
                      : severeAllergies.length > 0
                        ? 'Atenção às alergias registradas'
                        : 'Tudo tranquilo por aqui hoje'}
                  </Text>
                </View>
                {/* @fim-cor-do-sistema */}
              </View>

              <View className="mt-1 flex-row items-center gap-2">
                <Pressable
                  onPress={() => router.push('/notificacoes' as never)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    unreadNotifs > 0 ? `Notificações, ${unreadNotifs} não lidas` : 'Notificações'
                  }
                  style={{ borderCurve: 'continuous' }}
                  className="relative h-12 w-12 items-center justify-center rounded-full bg-surface active:opacity-75"
                >
                  <Bell size={23} color={colors.fg} />
                  {unreadNotifs > 0 ? (
                    <View className="absolute right-1 top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral-500 px-1">
                      <Text style={{ fontFamily: fonts.bold }} className="text-[10px] text-white">
                        {unreadNotifs > 9 ? '9+' : unreadNotifs}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={() => router.push('/perfil')}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir meu perfil"
                  style={{ borderCurve: 'continuous' }}
                  className="h-12 w-12 items-center justify-center rounded-full bg-trust-100 active:opacity-75"
                >
                  <UserRound size={23} color={colors.primary} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Conteúdo */}
        <View
          style={{
            width: '100%',
            maxWidth: 760,
            alignSelf: 'center',
            paddingHorizontal: 18,
            gap: 12,
          }}
        >
          <ActiveProfileSwitcher />
          {isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : isError && !data ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : (
            <>
              {/* 1) SEGURANÇA: alerta de alergia grave primeiro.
                  @cor-do-sistema — o vermelho aqui é permitido e intencional.
                  Não é a MEDIDA de um corpo sendo classificada em bom/ruim: é um
                  aviso de segurança acionável ("você registrou uma alergia grave,
                  confira antes de tomar algo"), da mesma família de "remédio
                  atrasado" e "erro de upload". A regra de `ui-tokens` reserva
                  âmbar/vermelho exatamente para este papel. */}
              {severeAllergies.length > 0 ? (
                <Pressable
                  onPress={isViewingDependent ? undefined : () => router.push('/perfil')}
                  style={{ borderCurve: 'continuous' }}
                  className="flex-row items-start gap-2.5 rounded-3xl border border-rose-200 bg-rose-50 p-4 active:opacity-80"
                >
                  <AlertTriangle size={20} color={colors.alert} style={{ marginTop: 1 }} />
                  <View className="flex-1">
                    <Text
                      style={{ fontFamily: fonts.semibold }}
                      className="text-[14px] text-rose-700"
                    >
                      {severeAllergies.length === 1
                        ? 'Alergia grave registrada'
                        : `${severeAllergies.length} alergias graves registradas`}
                    </Text>
                    <Text
                      style={{ fontFamily: fonts.regular }}
                      className="mt-0.5 text-[13px] text-rose-600"
                    >
                      {severeAllergies
                        .map((a) => a.substance + (a.reaction ? ` (${a.reaction})` : ''))
                        .join(' · ')}
                    </Text>
                  </View>
                  {!isViewingDependent ? <ChevronRight size={18} color={colors.alert} /> : null}
                </Pressable>
              ) : null}
              {/* @fim-cor-do-sistema */}

              {/* 3) AÇÃO PRINCIPAL: Lembretes de hoje (tomadas pendentes registráveis) */}
              <SectionTitle
                action={
                  <Pressable
                    onPress={() => router.push('/medicamentos')}
                    className="flex-row items-center"
                  >
                    <Text
                      style={{ fontFamily: fonts.semibold }}
                      className="text-[13px] text-primary"
                    >
                      Ver todos
                    </Text>
                  </Pressable>
                }
              >
                Lembretes de hoje
              </SectionTitle>
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title={meds.length === 0 ? 'Sem lembretes ainda' : 'Tudo em dia'}
                  subtitle={
                    meds.length === 0
                      ? 'Cadastre medicamentos para receber lembretes de tomada.'
                      : 'Nenhuma tomada pendente por agora.'
                  }
                />
              ) : (
                <View
                  style={[{ borderCurve: 'continuous' }, cardShadow]}
                  className="overflow-hidden rounded-3xl border border-line bg-surface px-4 py-2"
                >
                  {upcoming.map((intake, i) => {
                    const time = intake.scheduled_for
                      ? new Date(intake.scheduled_for).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : null;
                    const medication = meds.find((m) => m.id === intake.medication_id);
                    const dosage = [medication?.dosage, medication?.unit].filter(Boolean).join(' ');
                    const busy = registeringId === intake.id;
                    return (
                      <View
                        key={intake.id}
                        className={`flex-row items-center gap-3 py-3.5 ${i > 0 ? 'border-t border-line' : ''}`}
                      >
                        <View
                          style={{
                            backgroundColor: 'rgba(13,148,136,0.11)',
                            borderCurve: 'continuous',
                          }}
                          className="h-14 w-14 items-center justify-center rounded-full"
                        >
                          <Pill size={27} color="#0f9f8c" strokeWidth={2.2} />
                        </View>
                        <View className="min-w-0 flex-1">
                          {time ? (
                            <Text
                              style={{ fontFamily: fonts.bold }}
                              className="text-[20px] leading-6 text-[#0f9f8c]"
                            >
                              {time}
                            </Text>
                          ) : null}
                          <Text
                            style={{ fontFamily: fonts.semibold }}
                            className="text-[15px] text-fg"
                            numberOfLines={1}
                          >
                            {medNameById(intake.medication_id)}
                          </Text>
                          <Text
                            style={{ fontFamily: fonts.regular }}
                            className="text-[12px] text-muted"
                          >
                            {dosage || 'Tomada pendente'}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handleRegisterPending(intake)}
                          disabled={busy || registeringId !== null}
                          accessibilityRole="button"
                          accessibilityLabel={`Registrar tomada de ${medNameById(intake.medication_id)}`}
                          accessibilityState={{ disabled: busy || registeringId !== null, busy }}
                          style={{
                            borderCurve: 'continuous',
                            minHeight: 44,
                            borderColor: colors.primary,
                          }}
                          className="flex-row items-center gap-1.5 rounded-full border bg-surface px-3.5 py-2.5 active:opacity-70"
                        >
                          {busy ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Check size={14} color={colors.primary} />
                          )}
                          <Text
                            style={{ fontFamily: fonts.semibold }}
                            className="text-[13px] text-primary"
                          >
                            {busy ? 'Registrando…' : 'Tomei'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* 4) Acesso rápido — é navegação: fica acima dos cartões de leitura
                     para alcançar qualquer área sem rolar a Home inteira. */}
              <SectionTitle>Acesso rápido</SectionTitle>
              <MenuGrid items={MENU} onPick={handleMenu} />

              {/* 5) Resumo de hoje — 3 cartões de leitura (pressão · consulta · bem-estar) */}
              <SectionTitle>Resumo de hoje</SectionTitle>
              <View className="flex-row flex-wrap gap-3">
                {/* Última pressão */}
                {/* Ícone em tinta primária, não na do semáforo: ele identifica a
                    CATEGORIA do cartão, não a gravidade do valor medido. */}
                <MetricCard icon={HeartPulse} accent="primary" label="Última pressão" index={0}>
                  <View className="mt-1 flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: fonts.bold }} className="text-[20px] text-fg">
                      {bp ? formatVital(bp) : '—'}
                    </Text>
                    {bp ? <TrendIcon direction={trend} /> : null}
                  </View>
                  {bpStatus ? (
                    <ClinicalRangeChip zone={bpStatus.zone} />
                  ) : (
                    <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                      Sem registros
                    </Text>
                  )}
                </MetricCard>

                {/* Próxima consulta.
                    @cor-do-sistema — âmbar em cartão de AGENDA (compromisso a
                    cumprir), não em medida do corpo. */}
                <MetricCard
                  icon={CalendarDays}
                  accent="attention"
                  label="Próxima consulta"
                  index={1}
                >
                  {/* @fim-cor-do-sistema */}
                  {nextAppt ? (
                    <>
                      <Text
                        style={{ fontFamily: fonts.bold }}
                        className="mt-1 text-[14px] leading-[18px] text-fg"
                        numberOfLines={2}
                      >
                        {new Date(nextAppt.scheduled_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Text
                        style={{ fontFamily: fonts.regular }}
                        className="text-[11px] text-muted"
                        numberOfLines={1}
                      >
                        {nextAppt.doctor_name}
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={{ fontFamily: fonts.regular }}
                      className="mt-2 text-[13px] text-muted"
                    >
                      Nenhuma agendada.
                    </Text>
                  )}
                </MetricCard>

                {/* Bem-estar 7 dias */}
                <MetricCard icon={Smile} accent="accent" label="Bem-estar" index={2}>
                  {wellbeing?.wellbeing != null ? (
                    <>
                      <View className="mt-1 flex-row items-baseline gap-0.5">
                        <Text style={{ fontFamily: fonts.bold }} className="text-[20px] text-fg">
                          {wellbeing.wellbeing.toFixed(1)}
                        </Text>
                        <Text
                          style={{ fontFamily: fonts.medium }}
                          className="text-[12px] text-muted"
                        >
                          /5
                        </Text>
                      </View>
                      <Text
                        style={{ fontFamily: fonts.regular }}
                        className="text-[12px] text-muted"
                      >
                        humor {wellbeing.mood?.toFixed(1) ?? '—'} · energia{' '}
                        {wellbeing.energy?.toFixed(1) ?? '—'}
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={{ fontFamily: fonts.regular }}
                      className="mt-2 text-[13px] text-muted"
                    >
                      Registre no Diário.
                    </Text>
                  )}
                </MetricCard>
              </View>

              {/* 6) Pressão arterial · 30 dias — evolução, adjacente ao card de pressão */}
              <SectionTitle
                action={
                  <Pressable
                    onPress={() => router.push('/analise')}
                    className="flex-row items-center"
                  >
                    <Text
                      style={{ fontFamily: fonts.semibold }}
                      className="text-[13px] text-primary"
                    >
                      Ver análise
                    </Text>
                  </Pressable>
                }
              >
                Pressão arterial · 30 dias
              </SectionTitle>
              {range.length < 2 ? (
                <EmptyState
                  icon={HeartPulse}
                  title="Sem dados no período"
                  subtitle="Registre sua pressão para acompanhar a evolução."
                />
              ) : (
                <Card className="gap-3">
                  {range.length >= 4 ? (
                    <View
                      className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${paDir !== 'flat' ? 'bg-primary/10' : 'bg-surface-2'}`}
                    >
                      {paDir === 'up' ? (
                        <TrendingUp size={13} color={colors.primary} />
                      ) : paDir === 'down' ? (
                        <TrendingDown size={13} color={colors.primary} />
                      ) : (
                        <Minus size={13} color={colors.muted} />
                      )}
                      <Text
                        style={{ fontFamily: fonts.medium }}
                        className={`text-[11px] ${paDir !== 'flat' ? 'text-primary' : 'text-muted'}`}
                      >
                        Sistólica {trendLabel(paPct)}
                      </Text>
                    </View>
                  ) : null}
                  {/* Faixa de referência NEUTRA e rotulada, não semáforo. As três
                      bandas verde/âmbar/vermelha que existiam aqui classificavam o
                      corpo do paciente em "bom / atenção / ruim". A web já tinha
                      corrigido isso (components/dashboard/bp-chart.tsx); esta é a
                      paridade. Faixa 90–130 mmHg: Diretrizes Brasileiras de
                      Hipertensão Arterial 2020 (SBC/SBH/SBN), mesma fonte de
                      `referenceBandFor('pressao_sistolica')` na web. */}
                  <LineChart
                    yMin={40}
                    yMax={200}
                    showZoneLabels
                    zones={[
                      {
                        from: 90,
                        to: 130,
                        color: colors.muted,
                        label: 'sistólica — referência 90 a 130 mmHg',
                      },
                    ]}
                    series={[
                      { points: ptsOf(range.map((v) => v.value_primary)), color: colors.primary },
                      {
                        points: ptsOf(range.map((v) => v.value_secondary ?? 0)),
                        color: colors.accent,
                      },
                    ]}
                  />
                  <View className="flex-row gap-4">
                    <LegendDot color={colors.primary} label="Sistólica" />
                    <LegendDot color={colors.accent} label="Diastólica" />
                  </View>
                  <Text
                    style={{ fontFamily: fonts.regular }}
                    className="text-[11px] leading-4 text-faint"
                  >
                    {DISCLAIMERS.examInterpretation}
                  </Text>
                </Card>
              )}

              {/* 7) Bem-estar — hábitos reunidos (constância · hidratação · passos) */}
              <SectionTitle>Bem-estar</SectionTitle>
              <View className={useCompactWellnessGrid ? 'flex-row gap-3' : 'gap-3'}>
                <WaterCard
                  patientId={pid}
                  weightKg={latestWeight}
                  age={age}
                  compact={useCompactWellnessGrid}
                />
                {!isViewingDependent ? <StepsCard compact={useCompactWellnessGrid} /> : null}
              </View>
              {!isViewingDependent ? <BodyCompositionCard /> : null}

              {/* 8) Insight da semana (recurso Plus) */}
              <SectionTitle>Insight da semana</SectionTitle>
              <WeekInsightCard
                isPlus={isPlus}
                wellbeing={wellbeing ?? null}
                bpTrend={trend}
                hasBp={Boolean(bp)}
                onUpgrade={() => {
                  toast.info('Insights semanais fazem parte do HubPatients Plus.');
                  router.push('/planos');
                }}
              />
            </>
          )}
        </View>
      </ScrollView>

      {/* "O que mudou" — aparece uma vez por versão e se esconde sozinho. */}
      <WhatsNewSheet />
    </View>
  );
}

function MetricCard({
  icon: Icon,
  accent,
  label,
  index = 0,
  children,
}: {
  icon: LucideIcon;
  accent: 'primary' | 'accent' | 'attention' | 'alert';
  label: string;
  index?: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(340).delay(index * 60)}
      style={{ width: '30.5%' }}
    >
      <View
        style={[{ borderCurve: 'continuous', minHeight: 124 }, cardShadow]}
        className="rounded-3xl border border-line bg-surface p-3"
      >
        <View className="flex-row items-center gap-1.5">
          <IconCircle icon={Icon} tone={accent} size={30} />
          <Text
            style={{ fontFamily: fonts.medium }}
            className="flex-1 text-[11px] text-muted"
            numberOfLines={2}
          >
            {label}
          </Text>
        </View>
        {children}
      </View>
    </Animated.View>
  );
}

/**
 * Seta de tendência entre duas medições.
 *
 * SEM SEMÁFORO de propósito. Antes, "subiu" saía em VERMELHO (`colors.alert`) e
 * "caiu" em VERDE (`colors.ok`) — ou seja, o app dizia ao paciente que subir é
 * ruim e cair é bom. "Tendência" é justamente um dos casos citados na regra:
 * vermelho/âmbar (e o verde que os acompanha) são do SISTEMA, nunca do corpo do
 * paciente. Subir de peso ou de pressão não é "ruim" por si só — quem interpreta
 * é o médico.
 *
 * A direção continua inteira: está na FORMA da seta e no rótulo lido em voz alta
 * (SC 1.4.1). Gêmeo web: `Trend` em `apps/web/src/components/dashboard/metric-cards.tsx`.
 */
const TREND_READING = {
  up: { Icon: TrendingUp, label: 'acima da medição anterior' },
  down: { Icon: TrendingDown, label: 'abaixo da medição anterior' },
  flat: { Icon: Minus, label: 'igual à medição anterior' },
} as const;

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  const colors = useColors();
  const { Icon, label } = TREND_READING[direction];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Icon size={16} color={direction === 'flat' ? colors.muted : colors.primary} />
    </View>
  );
}

/**
 * Chip da faixa de referência de um dado do CORPO — tinta `neutro`, glifo e
 * texto. Substitui o `ZONE_TONE` âmbar/vermelho (ver `ZONE_READING` no topo).
 *
 * A gramática (tint de fundo + mark na borda + ink no texto + glifo obrigatório)
 * é a mesma de `src/components/clinical-value.tsx`, que é o componente canônico
 * de valor clínico. Não usamos o `ClinicalValue` inteiro aqui porque este cartão
 * tem ~30% da largura da tela e já desenha o próprio rótulo no cabeçalho —
 * empilhar o rótulo dele de novo, em 15px, estouraria o tile. O que importa (os
 * tokens e a regra "cor nunca sozinha") vem do mesmo lugar.
 */
function ClinicalRangeChip({ zone }: { zone: ClinicalZone }) {
  const { colorScheme } = useColorScheme();
  const fs = useFontScaler();
  const tone = status[colorScheme === 'dark' ? 'dark' : 'light'].neutro;
  const { glyph, short, full } = ZONE_READING[zone];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={full}
      style={{
        borderCurve: 'continuous',
        borderWidth: 1,
        backgroundColor: tone.tint,
        borderColor: tone.mark,
      }}
      className="mt-1.5 flex-row items-center gap-1 self-start rounded-full px-2 py-0.5"
    >
      {/* Leitura da faixa de referência de um dado do corpo. Estava a 11px, o
          menor patamar do app, justamente onde mora a interpretação clínica.
          O chip cresce e o rótulo quebra — o tile não trunca. */}
      <Text style={[{ fontFamily: fonts.bold, color: tone.ink }, fs(11, 15)]}>{glyph}</Text>
      <Text style={[{ fontFamily: fonts.semibold, color: tone.ink, flexShrink: 1 }, fs(11, 15)]}>
        {short}
      </Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ backgroundColor: color }} className="h-2.5 w-2.5 rounded-full" />
      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
        {label}
      </Text>
    </View>
  );
}

/**
 * Grade do "Acesso rápido" — 4 colunas fixas.
 *
 * Os vãos da última fileira são preenchidos por espaçadores porque
 * `space-between` distribui SOBRAS: com 7 itens, os 3 últimos se esparramavam
 * pela largura toda em vez de alinhar nas colunas de cima.
 */
function MenuGrid({ items, onPick }: { items: MenuItem[]; onPick: (m: MenuItem) => void }) {
  const fillers = (4 - (items.length % 4)) % 4;
  return (
    <View className="flex-row flex-wrap" style={{ justifyContent: 'space-between', rowGap: 14 }}>
      {items.map((m, i) => (
        <MenuTile key={m.label} item={m} index={i} onPress={() => onPick(m)} />
      ))}
      {Array.from({ length: fillers }, (_, i) => (
        <View key={`filler-${i}`} style={{ width: '23%' }} pointerEvents="none" />
      ))}
    </View>
  );
}

/** Tile da grade "Acesso rápido": um cartão inteiro por destino, como na referência. */
function MenuTile({
  item,
  onPress,
  index,
}: {
  item: MenuItem;
  onPress: () => void;
  index: number;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const Icon = item.icon;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(340).delay(Math.min(index, 8) * 45)}
      style={{ width: '23%' }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        style={({ pressed }) => [
          {
            minHeight: 102,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: pressed ? colors.primary : colors.line,
            backgroundColor: pressed ? colors.surface2 : colors.surface,
            shadowColor: colors.bg === '#0d0d0d' ? '#000000' : '#24446f',
            shadowOpacity: colors.bg === '#0d0d0d' ? 0.48 : 0.16,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 7 },
            elevation: 6,
            transform: pressed && !reduced ? [{ scale: 0.96 }] : undefined,
          },
        ]}
        className="items-center justify-center gap-2 rounded-2xl px-1 py-3"
      >
        <Icon size={27} color={colors.primary} strokeWidth={2.1} />
        <Text
          maxFontSizeMultiplier={1.3}
          style={{ fontFamily: fonts.semibold, lineHeight: 16 }}
          className="text-center text-[12px] text-fg-soft"
          numberOfLines={2}
        >
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function WeekInsightCard({
  isPlus,
  wellbeing,
  bpTrend,
  hasBp,
  onUpgrade,
}: {
  isPlus: boolean;
  wellbeing: { mood: number | null; energy: number | null; wellbeing: number | null } | null;
  bpTrend: 'up' | 'down' | 'flat';
  hasBp: boolean;
  onUpgrade: () => void;
}) {
  const colors = useColors();

  if (!isPlus) {
    return (
      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <IconCircle icon={Brain} tone="primary" size={36} />
          <View className="flex-1">
            <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
              Insight da semana
            </Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
              Um resumo inteligente da sua saúde, atualizado toda semana.
            </Text>
          </View>
        </View>
        <View className="items-center gap-2 py-2">
          <View
            style={{ borderCurve: 'continuous' }}
            className="h-11 w-11 items-center justify-center rounded-full bg-trust-100"
          >
            <Lock size={20} color={colors.primary} />
          </View>
          <Text
            style={{ fontFamily: fonts.regular }}
            className="text-center text-[13px] text-fg-soft"
          >
            Esse recurso faz parte do{' '}
            <Text style={{ fontFamily: fonts.semibold }}>HubPatients Plus</Text>.
          </Text>
        </View>
        <Button
          label="Desbloquear no Plus"
          icon={Sparkles}
          variant="primary"
          size="sm"
          onPress={onUpgrade}
        />
      </Card>
    );
  }

  // Insight didático a partir dos dados já em mãos (sem chamada extra).
  const lines: string[] = [];
  if (wellbeing?.wellbeing != null) {
    const w = wellbeing.wellbeing;
    const tone = w >= 4 ? 'animador' : w >= 3 ? 'estável' : 'de atenção';
    lines.push(
      `Seu bem-estar médio na semana foi ${w.toFixed(1)}/5 — um quadro ${tone}.` +
        (wellbeing.mood != null && wellbeing.energy != null
          ? ` Humor ${wellbeing.mood.toFixed(1)} e energia ${wellbeing.energy.toFixed(1)}.`
          : ''),
    );
  }
  if (hasBp) {
    lines.push(
      bpTrend === 'up'
        ? 'Sua pressão sistólica subiu na última medição — vale observar nos próximos dias.'
        : bpTrend === 'down'
          ? 'Sua pressão sistólica recuou na última medição. Continue registrando.'
          : 'Sua pressão arterial está estável entre as últimas medições.',
    );
  }
  if (lines.length === 0) {
    lines.push('Registre seu diário e sua pressão para receber um resumo semanal personalizado.');
  }

  return (
    <View
      style={[
        {
          borderCurve: 'continuous',
          backgroundColor: colors.bg === '#0d0d0d' ? colors.surface2 : '#eff5ff',
          borderColor: colors.bg === '#0d0d0d' ? colors.lineStrong : '#b8d0ff',
        },
        cardShadow,
      ]}
      className="relative overflow-hidden rounded-3xl border p-4"
    >
      <Brain
        size={90}
        color={colors.primary}
        opacity={0.08}
        style={{ position: 'absolute', right: -8, bottom: -14 }}
        accessible={false}
      />
      <View className="flex-row items-start gap-3 pr-8">
        <IconCircle icon={Brain} tone="primary" size={40} />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.bold }} className="text-[15px] text-fg">
            Ótimo trabalho nesta semana
          </Text>
          <View className="mt-1 gap-1">
            {lines.map((line) => (
              <View key={line} className="flex-row gap-1.5">
                <Sparkles size={13} color={colors.primary} style={{ marginTop: 3 }} />
                <Text
                  style={{ fontFamily: fonts.regular }}
                  className="flex-1 text-[13px] leading-[18px] text-fg-soft"
                >
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
