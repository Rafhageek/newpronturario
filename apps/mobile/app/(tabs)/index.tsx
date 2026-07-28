import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  Video,
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
  APPOINTMENT_KIND_LABELS,
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
import { useColors, fonts, gradients, cardShadow } from '@/theme';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const ZONE_TONE: Record<ClinicalZone, { bg: string; text: string }> = {
  ok: { bg: 'bg-health-300/30', text: 'text-health-600' },
  attention: { bg: 'bg-amber-100', text: 'text-amber-700' },
  alert: { bg: 'bg-rose-100', text: 'text-rose-700' },
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
  const unreadNotifs = (useNotifications(ownId || undefined).data ?? []).filter((n) => !n.read_at).length;

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
        {/* Hero em gradiente (full-bleed) */}
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 16,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            borderCurve: 'continuous',
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <HeartPulse size={15} color="rgba(255,255,255,0.9)" />
                <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-white/90">
                  HubPatients
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.bold }} className="mt-0.5 text-[16px] leading-5 text-white" numberOfLines={1}>
                {isViewingDependent
                  ? `Cuidado de ${active.name}`
                  : `${greeting()}${firstName ? `, ${firstName}` : '!'}`}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/notificacoes' as never)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={unreadNotifs > 0 ? `Notificações, ${unreadNotifs} não lidas` : 'Notificações'}
              className="relative h-10 w-10 items-center justify-center rounded-full bg-white/15 active:opacity-80"
            >
              <Bell size={20} color="#ffffff" />
              {unreadNotifs > 0 ? (
                <View className="absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral-500 px-1">
                  <Text style={{ fontFamily: fonts.bold }} className="text-[10px] text-white">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          {/* Linha de status acionável (substitui os 3 contadores repetidos) */}
          <View className="mt-2.5 flex-row items-center gap-1.5 self-start rounded-full bg-white/15 px-3 py-1.5">
            {upcoming.length > 0 ? (
              <Clock size={13} color="rgba(255,255,255,0.95)" />
            ) : severeAllergies.length > 0 ? (
              <AlertTriangle size={13} color="rgba(255,255,255,0.95)" />
            ) : (
              <Smile size={13} color="rgba(255,255,255,0.95)" />
            )}
            <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-white/95">
              {upcoming.length > 0
                ? `${isViewingDependent ? active.name : 'Você'} tem ${upcoming.length} ${upcoming.length === 1 ? 'tomada pendente' : 'tomadas pendentes'} hoje`
                : severeAllergies.length > 0
                  ? 'Atenção às alergias registradas'
                  : 'Tudo tranquilo por aqui hoje 💙'}
            </Text>
          </View>
        </LinearGradient>

        {/* Conteúdo */}
        <View style={{ padding: 16, gap: 16 }}>
          <ActiveProfileSwitcher />
          {isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : isError && !data ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : (
            <>
              {/* 1) SEGURANÇA: alerta de alergia grave primeiro */}
              {severeAllergies.length > 0 ? (
                <Pressable
                  onPress={isViewingDependent ? undefined : () => router.push('/perfil')}
                  style={{ borderCurve: 'continuous' }}
                  className="flex-row items-start gap-2.5 rounded-3xl border border-rose-200 bg-rose-50 p-4 active:opacity-80"
                >
                  <AlertTriangle size={20} color={colors.alert} style={{ marginTop: 1 }} />
                  <View className="flex-1">
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-rose-700">
                      {severeAllergies.length === 1
                        ? 'Alergia grave registrada'
                        : `${severeAllergies.length} alergias graves registradas`}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular }} className="mt-0.5 text-[13px] text-rose-600">
                      {severeAllergies
                        .map((a) => a.substance + (a.reaction ? ` (${a.reaction})` : ''))
                        .join(' · ')}
                    </Text>
                  </View>
                  {!isViewingDependent ? <ChevronRight size={18} color={colors.alert} /> : null}
                </Pressable>
              ) : null}

              {/* 3) AÇÃO PRINCIPAL: Lembretes de hoje (tomadas pendentes registráveis) */}
              <SectionTitle
                action={
                  <Pressable
                    onPress={() => router.push('/medicamentos')}
                    className="flex-row items-center"
                  >
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-primary">
                      Medicamentos
                    </Text>
                    <ChevronRight size={16} color={colors.primary} />
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
                <Card className="gap-1">
                  {upcoming.map((intake, i) => {
                    const time = intake.scheduled_for
                      ? new Date(intake.scheduled_for).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : null;
                    const busy = registeringId === intake.id;
                    return (
                      <View
                        key={intake.id}
                        className={`flex-row items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}
                      >
                        <IconCircle icon={Pill} tone="primary" size={38} />
                        <View className="flex-1">
                          <Text
                            style={{ fontFamily: fonts.semibold }}
                            className="text-[15px] text-fg"
                            numberOfLines={1}
                          >
                            {medNameById(intake.medication_id)}
                          </Text>
                          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                            {time ? `Previsto para ${time}` : 'Tomada pendente'}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handleRegisterPending(intake)}
                          disabled={busy || registeringId !== null}
                          accessibilityRole="button"
                          accessibilityLabel={`Registrar tomada de ${medNameById(intake.medication_id)}`}
                          accessibilityState={{ disabled: busy || registeringId !== null, busy }}
                          style={{ borderCurve: 'continuous', minHeight: 44 }}
                          className="flex-row items-center gap-1.5 rounded-xl bg-health-300/30 px-3.5 py-2.5 active:opacity-70"
                        >
                          {busy ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                          ) : (
                            <Check size={14} color={colors.accent} />
                          )}
                          <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-health-600">
                            {busy ? 'Registrando…' : 'Registrar'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </Card>
              )}

              {/* 4) Acesso rápido — é navegação: fica acima dos cartões de leitura
                     para alcançar qualquer área sem rolar a Home inteira. */}
              <SectionTitle>Acesso rápido</SectionTitle>
              <MenuGrid items={MENU} onPick={handleMenu} />

              {/* 5) Resumo de hoje — 3 cartões de leitura (pressão · consulta · bem-estar) */}
              <SectionTitle>Resumo de hoje</SectionTitle>
              <View className="flex-row flex-wrap gap-3">
                {/* Última pressão */}
                <MetricCard icon={HeartPulse} accent="alert" label="Última pressão" index={0}>
                  <View className="mt-1 flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: fonts.bold }} className="text-[20px] text-fg">
                      {bp ? formatVital(bp) : '—'}
                    </Text>
                    {bp ? <TrendIcon direction={trend} /> : null}
                  </View>
                  {bpStatus ? (
                    <View
                      className={`mt-1.5 self-start rounded-full px-2.5 py-0.5 ${ZONE_TONE[bpStatus.zone].bg}`}
                    >
                      <Text
                        style={{ fontFamily: fonts.semibold }}
                        className={`text-[11px] ${ZONE_TONE[bpStatus.zone].text}`}
                      >
                        {bpStatus.label}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                      Sem registros
                    </Text>
                  )}
                </MetricCard>

                {/* Próxima consulta */}
                <MetricCard icon={CalendarDays} accent="attention" label="Próxima consulta" index={1}>
                  {nextAppt ? (
                    <>
                      <Text
                        style={{ fontFamily: fonts.bold }}
                        className="mt-1 text-[16px] text-fg"
                        numberOfLines={1}
                      >
                        {nextAppt.doctor_name}
                      </Text>
                      <Text
                        style={{ fontFamily: fonts.regular }}
                        className="text-[12px] text-muted"
                        numberOfLines={1}
                      >
                        {nextAppt.specialty ?? 'Consulta'}
                      </Text>
                      <View className="mt-1 flex-row items-center gap-1.5">
                        {nextAppt.kind === 'telehealth' ? (
                          <Video size={13} color={colors.faint} />
                        ) : (
                          <CalendarDays size={13} color={colors.faint} />
                        )}
                        <Text
                          style={{ fontFamily: fonts.regular }}
                          className="flex-1 text-[12px] text-muted"
                          numberOfLines={1}
                        >
                          {new Date(nextAppt.scheduled_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' · '}
                          {APPOINTMENT_KIND_LABELS[nextAppt.kind]}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={{ fontFamily: fonts.regular }} className="mt-2 text-[13px] text-muted">
                      Nenhuma agendada.
                    </Text>
                  )}
                </MetricCard>

                {/* Bem-estar 7 dias */}
                <MetricCard icon={Smile} accent="accent" label="Bem-estar (7 dias)" index={2}>
                  {wellbeing?.wellbeing != null ? (
                    <>
                      <View className="mt-1 flex-row items-baseline gap-0.5">
                        <Text style={{ fontFamily: fonts.bold }} className="text-[20px] text-fg">
                          {wellbeing.wellbeing.toFixed(1)}
                        </Text>
                        <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
                          /5
                        </Text>
                      </View>
                      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                        humor {wellbeing.mood?.toFixed(1) ?? '—'} · energia{' '}
                        {wellbeing.energy?.toFixed(1) ?? '—'}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontFamily: fonts.regular }} className="mt-2 text-[13px] text-muted">
                      Registre no Diário.
                    </Text>
                  )}
                </MetricCard>
              </View>

              {/* 6) Pressão arterial · 30 dias — evolução, adjacente ao card de pressão */}
              <SectionTitle
                action={
                  <Pressable onPress={() => router.push('/analise')} className="flex-row items-center">
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-primary">
                      Análise
                    </Text>
                    <ChevronRight size={16} color={colors.primary} />
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
                    <View className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${paDir !== 'flat' ? 'bg-primary/10' : 'bg-surface-2'}`}>
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
                  <LineChart
                    yMin={40}
                    yMax={200}
                    zones={[
                      { from: 40, to: 130, color: colors.ok },
                      { from: 130, to: 140, color: colors.attention },
                      { from: 140, to: 200, color: colors.alert },
                    ]}
                    series={[
                      { points: ptsOf(range.map((v) => v.value_primary)), color: colors.primary },
                      { points: ptsOf(range.map((v) => v.value_secondary ?? 0)), color: colors.accent },
                    ]}
                  />
                  <View className="flex-row gap-4">
                    <LegendDot color={colors.primary} label="Sistólica" />
                    <LegendDot color={colors.accent} label="Diastólica" />
                  </View>
                  <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-faint">
                    {DISCLAIMERS.examInterpretation}
                  </Text>
                </Card>
              )}

              {/* 7) Bem-estar — hábitos reunidos (constância · hidratação · passos) */}
              <SectionTitle>Bem-estar</SectionTitle>
              <WaterCard patientId={pid} weightKg={latestWeight} age={age} />
              {!isViewingDependent ? <StepsCard /> : null}
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
      style={{ width: '47%' }}
    >
      <View
        style={{ borderCurve: 'continuous' }}
        className="rounded-3xl border border-line bg-surface p-3.5"
      >
        <View className="flex-row items-center gap-2">
          <IconCircle icon={Icon} tone={accent} size={30} />
          <Text style={{ fontFamily: fonts.medium }} className="flex-1 text-[12px] text-muted" numberOfLines={1}>
            {label}
          </Text>
        </View>
        {children}
      </View>
    </Animated.View>
  );
}

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  const colors = useColors();
  if (direction === 'up') return <TrendingUp size={16} color={colors.alert} />;
  if (direction === 'down') return <TrendingDown size={16} color={colors.ok} />;
  return <Minus size={16} color={colors.faint} />;
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

/** Tile da grade "Acesso rápido" (ícone num quadrado + rótulo). 4 por linha. */
function MenuTile({ item, onPress, index }: { item: MenuItem; onPress: () => void; index: number }) {
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
        className="items-center gap-1.5"
      >
        {({ pressed }) => (
          <>
            <View
              style={[
                { borderCurve: 'continuous' },
                cardShadow,
                // O quadrado inteiro acende no toque (fundo + borda), em vez de só
                // esmaecer: num alvo pequeno, quem tem mão trêmula precisa
                // confirmar QUAL tile recebeu o toque. A escala é enfeite e só
                // entra para quem não pediu "reduzir movimento".
                pressed && {
                  backgroundColor: colors.surface2,
                  borderColor: colors.primary,
                  transform: reduced ? undefined : [{ scale: 0.94 }],
                },
              ]}
              className="h-[58px] w-[58px] items-center justify-center rounded-2xl border border-line bg-surface"
            >
              <Icon size={24} color={colors.primary} />
            </View>
            <Text
              maxFontSizeMultiplier={1.3}
              style={{ fontFamily: fonts.medium, lineHeight: 15 }}
              className="text-center text-[12px] text-fg-soft"
              numberOfLines={2}
            >
              {item.label}
            </Text>
          </>
        )}
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
          <Text style={{ fontFamily: fonts.regular }} className="text-center text-[13px] text-fg-soft">
            Esse recurso faz parte do <Text style={{ fontFamily: fonts.semibold }}>HubPatients Plus</Text>.
          </Text>
        </View>
        <Button label="Desbloquear no Plus" icon={Sparkles} variant="primary" size="sm" onPress={onUpgrade} />
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
      <View className="gap-2">
        {lines.map((line) => (
          <View key={line} className="flex-row gap-2">
            <Sparkles size={14} color={colors.primary} style={{ marginTop: 3 }} />
            <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] leading-5 text-fg-soft">
              {line}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
