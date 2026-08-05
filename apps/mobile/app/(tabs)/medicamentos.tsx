import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  Pill,
  Plus,
  Check,
  Clock,
  Package,
  PackagePlus,
  Stethoscope,
  AlertTriangle,
  Info,
  ExternalLink,
  CalendarCheck,
  Barcode,
} from 'lucide-react-native';
import {
  useMedications,
  useRecentIntakes,
  useRegisterIntake,
  useDrugInteractions,
  useUpdateStock,
  useMarkRefill,
  useDoseAdherence,
  useRecordDoseEvent,
  useHubPatientsClient,
  useUserSettings,
  useAllergies,
  createMedication,
  queryKeys,
} from '@hubpatients/supabase';
import { useQueryClient } from '@tanstack/react-query';
import {
  medicationSchema,
  MEDICATION_FORM_LABELS,
  MEDICATION_FREQUENCY_LABELS,
  INTERACTION_SEVERITY,
  findMedicationAllergyNameMatch,
  computeAdherence,
  dailyDosesFromMed,
  daysRemainingForMed,
  formatStockStatus,
  resolveBulaUrl,
  findFarmaciaPopularItem,
  adherenceRate,
  adherenceByHour,
  expectedDosesInDays,
  stockForecast,
  ADHERENCE_DISCLAIMER,
  ANVISA_EXIT_NOTICE,
  type Medication,
  type MedicationIntake,
  type MedicationForm,
} from '@hubpatients/core';
import { useActiveProfile } from '@/lib/active-profile';
import { Screen, AppHeader, Card, Input, Button, EmptyState, ErrorState, IconCircle } from '@/components/ui';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
import { BarcodeScannerSheet, type ScannedCode } from '@/components/barcode-scanner-sheet';
import { MedicationAutocomplete } from '@/components/medication-autocomplete';
import { FarmaciaPopularBadge } from '@/components/farmacia-popular-badge';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { SwipeRow, AnimatedNumber, AnimatedBar, SkeletonList, haptics } from '@/components/feedback';
import { flushDoseQueue, loadRemindersPref, scheduleMedicationReminders } from '@/lib/notifications';
import { motion, status } from '@hubpatients/ui-tokens';
import { useColors, fonts, useTapTarget, useFontScaler } from '@/theme';

const FORM_OPTIONS: MedicationForm[] = ['tablet', 'capsule', 'liquid', 'drops', 'inhaler', 'injection', 'cream', 'other'];
const CONTINUOUS = { borderCurve: 'continuous' as const };

/**
 * Os dois estados do chip de dose, em cor. Espelham as classes que estavam no
 * JSX (`bg-trust-100` e `bg-health-300/25`, `text-health-600`), agora em valor
 * literal porque `interpolateColor` precisa de cor resolvida.
 */
const DOSE_BG_PENDING = 'rgba(217,225,255,1)'; // trust-100
const DOSE_BG_DONE = 'rgba(110,231,183,0.25)'; // health-300 / 25%
/**
 * Tinta do chip confirmado. Era `#059669` (health-600): 3,34:1 sobre esse verde
 * claro — reprova o AA (4,5:1 exigido em texto pequeno). `status.light.ok.ink`
 * é o verde de status já auditado dos tokens. Vem da rampa `light` de propósito:
 * o fundo do chip acima também é fixo em claro, e ink e fundo têm que combinar.
 */
const DOSE_INK_DONE = status.light.ok.ink; // #007149

/** Janela do painel de adesão e do alerta de reposição. */
const ADHERENCE_DAYS = 30;
const STOCK_ALERT_DAYS = 7;

/** Horário "HH:MM" -> ISO de hoje (evita registrar dose no dia errado perto da meia-noite). */
function scheduledAtToday(time: string): string {
  const hhmm = time.slice(0, 5);
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return new Date(`${local}T${hhmm}`).toISOString();
}

/** 'AAAA-MM-DD' -> 'DD/MM'. Manual: Hermes não é confiável com Intl. */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return month && day ? `${day}/${month}` : isoDate;
}

const dayWord = (n: number) => (n === 1 ? 'dia' : 'dias');

export default function MedicamentosScreen() {
  const colors = useColors();
  const { patientId, ownId, active: activeProfile } = useActiveProfile();
  const pid = patientId;
  const client = useHubPatientsClient();
  const qc = useQueryClient();

  const { data: meds, isLoading: medsLoading, isError: medsError, refetch: refetchMeds } = useMedications(pid || undefined);
  const { data: intakes, refetch: refetchIntakes } = useRecentIntakes(pid || undefined);
  // Preferências de notificação pertencem ao usuário logado, não ao perfil visualizado.
  const { data: settings } = useUserSettings(ownId || undefined);
  // dose_events é owner-only (RLS user_id = auth.uid()): só faz sentido no próprio perfil.
  const selfView = activeProfile.isSelf;
  const { data: doseSummary } = useDoseAdherence(
    selfView && ownId ? ownId : undefined,
    ADHERENCE_DAYS,
  );
  const recordDose = useRecordDoseEvent(selfView && ownId ? ownId : undefined);
  const {
    data: allergies,
    isLoading: allergiesLoading,
    isError: allergiesError,
  } = useAllergies(pid || undefined);
  const registerIntake = useRegisterIntake(pid);

  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [formOpen, setFormOpen] = useState(false);
  const [stockMed, setStockMed] = useState<Medication | null>(null);
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const formSheetRef = useRef<AppSheetHandle>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Invalida só as chaves desta tela. medications(pid) também cobre o
      // resumo de estoque (derivado da mesma chave) por correspondência parcial.
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.medications(pid) }),
        qc.invalidateQueries({ queryKey: queryKeys.recentIntakes(pid) }),
        qc.invalidateQueries({ queryKey: queryKeys.interactions() }),
        qc.invalidateQueries({ queryKey: queryKeys.hasPlusAccess(pid) }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Form "novo medicamento"
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [unit, setUnit] = useState('');
  const [form, setForm] = useState<MedicationForm>('tablet');

  // Leitura do código de barras da caixa. `nonce` existe só para remontar o
  // campo de nome (e devolver o foco) mesmo quando o código lido é o mesmo.
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned, setScanned] = useState<{ ean: string; nonce: number } | null>(null);

  // Um rascunho iniciado para uma pessoa nunca pode atravessar a troca de perfil.
  useEffect(() => {
    setFormOpen(false);
    setStockMed(null);
    setScannerOpen(false);
    setScanned(null);
    setName('');
    setDosage('');
    setUnit('');
    setForm('tablet');
  }, [pid]);

  const active = useMemo(() => (meds ?? []).filter((m) => m.active), [meds]);
  const inactive = useMemo(() => (meds ?? []).filter((m) => !m.active), [meds]);
  const shown = tab === 'active' ? active : inactive;

  const quietStart = settings?.quiet_hours_start ?? null;
  const quietEnd = settings?.quiet_hours_end ?? null;

  // Assinatura estável: muda quando algo relevante p/ o agendamento muda (horários,
  // nome, dose) ou o quiet hours. Evita reagendar à toa a cada render.
  const scheduleSig = useMemo(
    () =>
      JSON.stringify({
        meds: active.map((m) => [m.id, m.name, m.dosage, m.unit, m.times]),
        quietStart,
        quietEnd,
      }),
    [active, quietStart, quietEnd],
  );

  // Reagenda os lembretes locais sempre que a lista de medicamentos ativos (ou o
  // quiet hours) mudar — desde que a preferência esteja ligada nas Configurações.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const on = await loadRemindersPref();
      if (cancelled || !on) return;
      await scheduleMedicationReminders(active, { quietStart, quietEnd });
    })();
    return () => {
      cancelled = true;
    };
    // scheduleSig resume as dependências relevantes; active/quietStart/quietEnd são
    // lidos no efeito mas só disparam reagendamento quando a assinatura muda.
  }, [scheduleSig]);

  // Sobe o que ficou pendente na fila local (ações da notificação feitas offline).
  useEffect(() => {
    void flushDoseQueue();
  }, []);

  // Reposição de estoque: previsão de quando acaba, para cada medicamento ativo
  // que a pessoa acompanha. Alerta se falta menos de uma semana OU se o limiar
  // que ela mesma configurou já foi atingido.
  const stockAlerts = useMemo(() => {
    const rows = active.map((med) => ({
      med,
      forecast: stockForecast({
        stockCount: med.stock_count,
        dosesPerDay: dailyDosesFromMed(med.frequency, med.times),
      }),
    }));
    return rows
      .filter(({ med, forecast }) => {
        const days = forecast.daysRemaining;
        return days != null && (days < STOCK_ALERT_DAYS || days <= med.stock_low_threshold_days);
      })
      .sort((a, b) => (a.forecast.daysRemaining ?? 0) - (b.forecast.daysRemaining ?? 0));
  }, [active]);

  const firstAlert = stockAlerts[0];

  const activeNames = active.map((m) => m.name);
  const {
    data: interactions,
    isLoading: interactionsLoading,
    isError: interactionsError,
  } = useDrugInteractions(activeNames, activeNames.length > 1);

  function handleNew() {
    setScanned(null);
    setFormOpen(true);
  }

  /**
   * Código lido da caixa. NÃO existe catálogo público que ligue código de barras
   * a medicamento no Brasil (a Anvisa não publica um), e a base embarcada do app
   * não guarda EAN — então aqui o código serve para a pessoa CONFERIR que pegou
   * a caixa certa, e o nome continua sendo confirmado por ela na busca abaixo.
   * O número não sai do aparelho: nenhuma consulta de rede acontece.
   */
  function handleScannedBox({ ean }: ScannedCode) {
    setScanned({ ean, nonce: Date.now() });
  }

  /** Grava o medicamento de fato (após validação e checagem de alergia). */
  async function persistMedication(data: {
    name: string;
    dosage?: string;
    unit?: string;
    form: MedicationForm;
  }) {
    setSaving(true);
    try {
      await createMedication(client, {
        patient_id: pid,
        name: data.name,
        dosage: data.dosage || null,
        unit: data.unit || null,
        form: data.form,
        frequency: 'daily',
        times: [],
        active: true,
      });
      // Recarrega a lista de medicamentos.
      qc.invalidateQueries({ queryKey: queryKeys.medications(pid) });
      setName('');
      setDosage('');
      setUnit('');
      setForm('tablet');
      setScanned(null);
      formSheetRef.current?.close();
      toast.success('Medicamento cadastrado.');
    } catch {
      toast.error('Não foi possível adicionar o medicamento.');
    } finally {
      setSaving(false);
    }
  }

  async function onAdd() {
    const parsed = medicationSchema.safeParse({
      name,
      dosage: dosage || undefined,
      unit: unit || undefined,
      form,
    });
    if (!parsed.success) {
      toast.info(parsed.error.issues[0]?.message ?? 'Informe o nome.');
      return;
    }

    if (allergiesLoading) {
      toast.info('Aguarde a verificação das alergias registradas.');
      return;
    }
    if (allergiesError || !allergies) {
      toast.error('Não foi possível verificar suas alergias. Tente novamente antes de adicionar o medicamento.');
      return;
    }

    // Checagem remédio × alergia: alerta factual e não-diagnóstico exigindo
    // confirmação consciente (não bloqueia em definitivo). Comparação por
    // substring case-insensitive nos dois sentidos (ex.: "Amoxicilina 500" vs
    // "Amoxicilina"). NÃO usa toast auto-dismiss — precisa de acknowledgment.
    const matched = findMedicationAllergyNameMatch(parsed.data.name, allergies);

    if (matched) {
      Alert.alert(
        'Atenção: alergia registrada',
        `Há uma alergia registrada a ${matched.substance}. A verificação compara apenas os nomes cadastrados e não confirma que ${parsed.data.name} é seguro.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Adicionar mesmo assim',
            style: 'destructive',
            onPress: () => void persistMedication(parsed.data),
          },
        ],
      );
      return;
    }

    await persistMedication(parsed.data);
  }

  /**
   * Espelha a confirmação em `dose_events` para a adesão contar tanto o que
   * veio da notificação quanto o que foi marcado aqui. Silencioso de propósito:
   * a tomada já foi registrada, uma falha aqui não pode virar erro na tela.
   */
  function mirrorDoseEvent(medicationId: string, scheduledFor: string) {
    if (!selfView || !ownId) return;
    recordDose
      .mutateAsync({
        medication_id: medicationId,
        scheduled_for: scheduledFor,
        status: 'taken',
        source: 'app',
      })
      .catch(() => undefined);
  }

  /*
   * Confirmar dose é a ação mais importante desta tela — e a única aqui que
   * merece háptico. Ele é de NOTIFICAÇÃO (`Success`), não de impacto: registrar
   * dose é resultado de uma escrita, não colisão física. Por isso dispara UMA
   * vez, depois que a gravação conclui, e nunca no gesto (senão vibraria também
   * quando a escrita falha).
   */
  async function handleRegister(medicationId: string, time: string) {
    const scheduledFor = scheduledAtToday(time);
    try {
      await registerIntake.mutateAsync({
        patient_id: pid,
        medication_id: medicationId,
        status: 'taken',
        scheduled_for: scheduledFor,
        taken_at: new Date().toISOString(),
      });
      mirrorDoseEvent(medicationId, scheduledFor);
      await refetchIntakes();
      haptics.success();
      toast.success('Tomada registrada.');
    } catch {
      toast.error('Não foi possível registrar a tomada.');
    }
  }

  /**
   * Apaga o espelho da dose em `dose_events` (a fonte do painel de 30 dias).
   * Silencioso pelo mesmo motivo de `mirrorDoseEvent`: a tomada já saiu do
   * histórico principal, e uma falha aqui não pode virar erro na tela.
   * `dose_events` ainda não está nos tipos gerados do Supabase — mesmo cast
   * controlado que o pacote usa em `queries/doses.ts`.
   */
  async function undoDoseEvent(medicationId: string, scheduledFor: string | null) {
    if (!selfView || !ownId || !scheduledFor) return;
    type Filter = { eq: (column: string, value: string) => Filter } & PromiseLike<unknown>;
    const doseEvents = client as unknown as { from: (name: 'dose_events') => { delete: () => Filter } };
    try {
      await doseEvents
        .from('dose_events')
        .delete()
        .eq('user_id', ownId)
        .eq('medication_id', medicationId)
        .eq('scheduled_for', scheduledFor);
      qc.invalidateQueries({ queryKey: ['dose-adherence', ownId] });
      qc.invalidateQueries({ queryKey: ['dose-events', ownId] });
    } catch {
      // ver comentário acima: falha aqui não interrompe o desfazer
    }
  }

  /**
   * Desfaz uma tomada marcada por engano.
   *
   * Por que APAGAR e não gravar "pulei": "pulei" é outra informação clínica (a
   * pessoa decidiu não tomar). Aqui o registro simplesmente não deveria existir,
   * então some do histórico — e o gatilho da migração 0018 devolve a unidade ao
   * estoque sozinho, por isso a lista de medicamentos também é invalidada.
   *
   * Apagamos pelo `id` da linha que já está em mãos, e não recalculando o
   * horário previsto: o registro pode ter vindo da notificação, com um
   * `scheduled_for` que não bate no segundo com o que esta tela derivaria.
   */
  async function undoRegister(intake: MedicationIntake) {
    setUndoing(true);
    try {
      const { data, error } = await client
        .from('medication_intakes')
        .delete()
        .eq('id', intake.id)
        .select('id');
      if (error) throw error;
      // A RLS não devolve erro quando barra um DELETE: apaga zero linhas. Sem
      // esta conferência o app diria "desfeito" com a dose ainda registrada.
      if ((data ?? []).length === 0) {
        toast.error('Não foi possível desfazer esta tomada.');
        return;
      }
      await undoDoseEvent(intake.medication_id, intake.scheduled_for);
      await Promise.all([
        refetchIntakes(),
        qc.invalidateQueries({ queryKey: queryKeys.medications(pid) }),
        qc.invalidateQueries({ queryKey: queryKeys.dashboard(pid) }),
      ]);
      toast.success('Registro desfeito.');
    } catch {
      toast.error('Não foi possível desfazer esta tomada.');
    } finally {
      setUndoing(false);
    }
  }

  /**
   * Desfazer altera o histórico de adesão que a equipe de saúde pode ler, então
   * pede confirmação consciente — igual ao alerta de alergia, e pelo mesmo
   * motivo: `toast` some sozinho e não serve para decisão.
   */
  function confirmUndo(dose: { intake: MedicationIntake; label: string; medicationName: string }) {
    Alert.alert(
      'Desfazer esta tomada?',
      `A dose das ${dose.label} de ${dose.medicationName} sai do seu histórico de adesão. Use se marcou sem querer — não use para registrar que pulou a dose.`,
      [
        { text: 'Manter registro', style: 'cancel' },
        { text: 'Desfazer', style: 'destructive', onPress: () => void undoRegister(dose.intake) },
      ],
    );
  }

  async function handleRegisterNow(medicationId: string) {
    const now = new Date();
    now.setSeconds(0, 0);
    try {
      await registerIntake.mutateAsync({
        patient_id: pid,
        medication_id: medicationId,
        status: 'taken',
        taken_at: now.toISOString(),
      });
      mirrorDoseEvent(medicationId, now.toISOString());
      await refetchIntakes();
      haptics.success();
      toast.success('Tomada registrada.');
    } catch {
      toast.error('Não foi possível registrar a tomada.');
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Medicamentos"
        subtitle={activeProfile.isSelf ? 'Seus remédios, tomadas e estoque' : `Dados de ${activeProfile.name}`}
        icon={Pill}
      />
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        <Button label="Novo medicamento" icon={Plus} onPress={handleNew} />

        {/* Lembrete de reposição: quando acaba e em que data. */}
        {firstAlert ? (
          <View
            accessible
            accessibilityRole="alert"
            style={CONTINUOUS}
            className="flex-row items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4"
          >
            <Package size={20} color={colors.alert} />
            <View className="flex-1">
              <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] leading-5 text-rose-700">
                {`Seu estoque de ${firstAlert.med.name} acaba em ${firstAlert.forecast.daysRemaining} ${dayWord(firstAlert.forecast.daysRemaining ?? 0)}.`}
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-4 text-rose-700/80">
                {firstAlert.forecast.runsOutOn
                  ? `Previsão pelo consumo cadastrado: por volta de ${shortDate(firstAlert.forecast.runsOutOn)}.`
                  : 'Previsão pelo consumo cadastrado.'}
                {stockAlerts.length > 1 ? ` Outros ${stockAlerts.length - 1} também estão acabando.` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => setStockMed(firstAlert.med)}
              accessibilityRole="button"
              accessibilityLabel={`Repor estoque de ${firstAlert.med.name}`}
              style={CONTINUOUS}
              className="rounded-xl bg-rose-500 px-3 py-2 active:opacity-80"
            >
              <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-white">
                Comprei mais
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Adesão dos últimos 30 dias (só no próprio perfil — dose_events é owner-only). */}
        {selfView ? <AdherencePanel meds={active} summary={doseSummary} /> : null}

        {/* Banner de interações: recurso de segurança disponível em todos os planos. */}
        {active.length > 1 ? (
          <InteractionBanner
            interactions={interactions ?? []}
            isLoading={interactionsLoading}
            isError={interactionsError}
          />
        ) : null}

        {/* Abas Ativos / Inativos */}
        <View
          style={CONTINUOUS}
          className="flex-row self-start rounded-xl border border-line bg-surface p-1"
        >
          {(
            [
              { key: 'active' as const, label: `Ativos (${active.length})` },
              { key: 'inactive' as const, label: `Inativos (${inactive.length})` },
            ]
          ).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={CONTINUOUS}
              className={`rounded-lg px-3.5 py-1.5 ${tab === t.key ? 'bg-trust-100' : ''}`}
            >
              <Text
                style={{ fontFamily: fonts.semibold }}
                className={`text-[12px] ${tab === t.key ? 'text-primary' : 'text-muted'}`}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Lista */}
        {medsLoading ? (
          <SkeletonList rows={3} />
        ) : medsError && !meds ? (
          <ErrorState onRetry={() => void refetchMeds()} />
        ) : shown.length > 0 ? (
          <View className="gap-3">
            {shown.map((m, i) => (
              <FadeInItem key={m.id} index={i} animateExit>
                <SwipeRow
                  rightActions={[
                    { label: 'Tomei', icon: Check, tone: 'accent', onPress: () => handleRegisterNow(m.id) },
                    { label: 'Repor', icon: PackagePlus, tone: 'primary', onPress: () => setStockMed(m) },
                  ]}
                >
                  <MedicationCard
                    medication={m}
                    intakes={(intakes ?? []).filter((it) => it.medication_id === m.id)}
                    busy={registerIntake.isPending || undoing}
                    // Só o dono apaga a própria tomada: a RLS de
                    // `medication_intakes` permite DELETE a quem tem
                    // `patient_id = auth.uid()`. O cuidador registra, mas não
                    // desfaz — então nem oferecemos a ação a ele.
                    canUndo={selfView}
                    onRegister={(time) => handleRegister(m.id, time)}
                    onRegisterNow={() => handleRegisterNow(m.id)}
                    onUndo={confirmUndo}
                    onStock={() => setStockMed(m)}
                  />
                </SwipeRow>
              </FadeInItem>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={Pill}
            title={tab === 'active' ? 'Nenhum medicamento ativo' : 'Nenhum medicamento inativo'}
            subtitle={
              tab === 'active'
                ? 'Cadastre seus remédios para registrar as tomadas e acompanhar o estoque.'
                : undefined
            }
            actionLabel={tab === 'active' ? 'Cadastrar medicamento' : undefined}
            actionIcon={Plus}
            onAction={tab === 'active' ? handleNew : undefined}
          />
        )}

        <Text style={{ fontFamily: fonts.regular }} className="text-center text-[12px] text-muted">
          Lembrete básico e registro de tomada são gratuitos, sempre. 💙
        </Text>
      </Screen>

      {/* Form "novo medicamento" em bottom sheet arrastável */}
      {formOpen ? (
        <AppSheet ref={formSheetRef} onClose={() => setFormOpen(false)} title="Novo medicamento">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            <View className="gap-3">
              {/* Ler a caixa: atalho para quem tem a embalagem na mão. */}
              <Pressable
                onPress={() => setScannerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Escanear o código de barras da caixa"
                accessibilityHint="O código ajuda você a conferir a caixa; o nome você confirma na busca"
                style={[{ minHeight: 56 }, CONTINUOUS]}
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-primary bg-trust-100 px-4 active:opacity-80"
              >
                <Barcode size={20} color={colors.primary} />
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={{ fontFamily: fonts.semibold, color: colors.primary }}
                  className="text-[15px]"
                >
                  Ler o código da caixa
                </Text>
              </Pressable>

              {scanned ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={CONTINUOUS}
                  className="flex-row items-start gap-2 rounded-2xl border border-line bg-surface-2 p-3"
                >
                  <Info size={16} color={colors.primary} style={{ marginTop: 2 }} />
                  <View className="flex-1">
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-fg">
                      {`Código lido: ${scanned.ean}`}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular }} className="mt-0.5 text-[12px] leading-4 text-muted">
                      Não existe uma lista pública que ligue esse número ao remédio, então ele serve só para você conferir que é a caixa certa. Digite o nome abaixo e escolha na lista — o número não é salvo nem enviado para lugar nenhum.
                    </Text>
                  </View>
                </View>
              ) : null}

              <View className="gap-1.5">
                <Text
                  maxFontSizeMultiplier={1.6}
                  style={{ fontFamily: fonts.medium }}
                  className="text-[13px] text-fg-soft"
                >
                  Nome
                </Text>
                <MedicationAutocomplete
                  key={scanned ? `scan-${scanned.nonce}` : 'sem-codigo'}
                  value={name}
                  onChange={setName}
                  autoFocus={scanned != null}
                />
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  {/* Campo numérico: sem `keyboardType` abria o teclado de letras
                      e a pessoa tinha que caçar os números — no campo de maior
                      consequência clínica do app. "decimal-pad" aceita a vírgula
                      (dose fracionada: 0,5 comprimido, 2,5 ml). */}
                  <Input
                    label="Dose"
                    value={dosage}
                    onChangeText={setDosage}
                    keyboardType="decimal-pad"
                    placeholder="50"
                  />
                </View>
                <View className="flex-1">
                  <Input label="Unidade" value={unit} onChangeText={setUnit} placeholder="mg" />
                </View>
              </View>
              <View>
                <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">
                  Forma
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {FORM_OPTIONS.map((f) => (
                    <Pressable
                      key={f}
                      onPress={() => setForm(f)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: form === f }}
                      style={CONTINUOUS}
                      className={`rounded-full border px-3 py-2 ${form === f ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'}`}
                    >
                      <Text
                        style={{ fontFamily: fonts.semibold }}
                        className={`text-[12px] ${form === f ? 'text-accent' : 'text-muted'}`}
                      >
                        {MEDICATION_FORM_LABELS[f]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Button label="Salvar medicamento" icon={Plus} loading={saving} onPress={onAdd} />
            </View>
          </ScrollView>
        </AppSheet>
      ) : null}

      {stockMed ? (
        <StockSheet
          patientId={pid}
          medication={stockMed}
          onClose={() => setStockMed(null)}
        />
      ) : null}

      {/* Fica fora do sheet do formulário para aparecer por cima dele. */}
      {scannerOpen ? (
        <BarcodeScannerSheet
          title="Código da caixa"
          helpText="Aponte a câmera para o código de barras da caixa do remédio, dentro da moldura."
          privacyNote="O código fica só no seu aparelho: nada é enviado pela internet e o número não é salvo no cadastro."
          onScanned={handleScannedBox}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}
    </View>
  );
}

/* ──────────────────────────── Adesão · 30 dias ──────────────────────────── */

/** Formato mínimo do agregado (evita depender do tipo exportado do pacote). */
type DoseSummaryLike = {
  taken: number;
  snoozed: number;
  skipped: number;
  registered: number;
  events: { scheduled_for: string; status: 'taken' | 'snoozed' | 'skipped' }[];
};

/**
 * Doses confirmadas nos últimos 30 dias — pela ação da notificação ou aqui na
 * tela. É contagem, não avaliação: nada de "adesão ruim". Quem lê o tratamento
 * é a equipe de saúde.
 */
function AdherencePanel({
  meds,
  summary,
}: {
  meds: Medication[];
  summary: DoseSummaryLike | undefined;
}) {
  const colors = useColors();
  const fs = useFontScaler();

  const timesPerDay = meds.reduce((sum, m) => sum + m.times.length, 0);
  const expected = expectedDosesInDays(timesPerDay, ADHERENCE_DAYS);
  const events = summary?.events ?? [];
  const rate = adherenceRate(events, expected);

  // Padrão por horário: ajuda a pessoa a ver sozinha qual dose costuma escapar.
  const byHour = adherenceByHour(events).filter((b) => b.total >= 3);
  const lowest = byHour.length > 1 ? byHour.reduce((a, b) => ((b.rate ?? 100) < (a.rate ?? 100) ? b : a)) : null;
  const weakest = lowest != null && lowest.rate != null && lowest.rate < 100 ? lowest : null;

  if (meds.length === 0) return null;

  return (
    <Card className="gap-2">
      <View className="flex-row items-center gap-2">
        <CalendarCheck size={16} color={colors.primary} />
        <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">
          Doses confirmadas · {ADHERENCE_DAYS} dias
        </Text>
        {rate != null ? (
          <AnimatedNumber
            value={rate}
            suffix="%"
            maxFontSizeMultiplier={1.4}
            style={{ fontFamily: fonts.semibold, color: colors.primary, fontSize: 18, padding: 0, margin: 0 }}
          />
        ) : null}
      </View>

      {rate != null ? (
        <>
          <AnimatedBar percent={rate} color={colors.primary} height={8} />
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-4 text-fg-soft">
            {`Você confirmou ${summary?.taken ?? 0} de ${expected} doses previstas nos últimos ${ADHERENCE_DAYS} dias.`}
          </Text>
        </>
      ) : (
        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-4 text-fg-soft">
          Cadastre os horários dos seus remédios para acompanhar as doses confirmadas.
        </Text>
      )}

      {weakest ? (
        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-4 text-muted">
          {`Por horário: às ${String(weakest.hour).padStart(2, '0')}h você confirmou ${weakest.taken} de ${weakest.total} vezes.`}
        </Text>
      ) : null}

      {/* Adesão ao tratamento: quantas doses foram adiadas ou puladas. É o dado
          que a pessoa leva para a consulta — não pode ficar em 11px fixo. */}
      {(summary?.snoozed ?? 0) > 0 || (summary?.skipped ?? 0) > 0 ? (
        <Text style={[{ fontFamily: fonts.regular }, fs(11, 16)]} className="text-muted">
          {`Adiadas: ${summary?.snoozed ?? 0} · marcadas como puladas: ${summary?.skipped ?? 0}.`}
        </Text>
      ) : null}

      <Text style={[{ fontFamily: fonts.regular }, fs(11, 16)]} className="text-muted">
        {ADHERENCE_DISCLAIMER}
      </Text>
    </Card>
  );
}

/* ──────────────────────────── Card de medicamento ──────────────────────────── */

function MedicationCard({
  medication,
  intakes,
  busy,
  canUndo,
  onRegister,
  onRegisterNow,
  onUndo,
  onStock,
}: {
  medication: Medication;
  intakes: MedicationIntake[];
  /** Alguma escrita de dose em andamento (registrar ou desfazer). */
  busy?: boolean;
  canUndo: boolean;
  onRegister: (time: string) => void;
  onRegisterNow: () => void;
  onUndo: (dose: { intake: MedicationIntake; label: string; medicationName: string }) => void;
  onStock: () => void;
}) {
  const colors = useColors();
  const fs = useFontScaler();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const stockDays = daysRemainingForMed(medication);
  const stockUrgent =
    medication.stock_count != null && stockDays != null && stockDays <= medication.stock_low_threshold_days;

  // Etiqueta informativa: o princípio ativo consta no elenco gratuito do
  // Farmácia Popular. Não é indicação nem promessa de direito adquirido.
  const farmaciaPopular = findFarmaciaPopularItem(medication.name);

  // Adesão últimos 7 dias.
  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const takenLast7 = intakes.filter(
    (i) => i.status === 'taken' && i.taken_at != null && new Date(i.taken_at) >= sevenAgo,
  ).length;
  const expected = medication.times.length * 7;
  const adherence = computeAdherence(takenLast7, expected);

  /**
   * A LINHA da tomada de hoje naquele horário (null = ainda não registrada).
   * Devolve a linha, e não só um booleano, porque é ela que torna o desfazer
   * exato: apagamos pelo `id` que já veio do banco.
   */
  const intakeToday = (time: string): MedicationIntake | null =>
    intakes.find(
      (i) =>
        i.status === 'taken' &&
        i.scheduled_for != null &&
        i.scheduled_for.slice(0, 10) === today &&
        i.scheduled_for.slice(11, 16) === time,
    ) ?? null;

  return (
    <Card className="gap-3">
      <View className="flex-row items-start gap-3">
        <IconCircle icon={Pill} tone="accent" size={44} />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
            {medication.name}
            {medication.dosage ? (
              <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
                {`  ${medication.dosage}${medication.unit ?? ''}`}
              </Text>
            ) : null}
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
            {MEDICATION_FREQUENCY_LABELS[medication.frequency]} · {MEDICATION_FORM_LABELS[medication.form]}
          </Text>
          {medication.prescriber ? (
            <View className="mt-1 flex-row items-center gap-1">
              <Stethoscope size={12} color={colors.faint} />
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                {medication.prescriber}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {farmaciaPopular ? (
        <FarmaciaPopularBadge
          item={farmaciaPopular}
          onFindPharmacies={() => router.push('/locais/pharmacy' as never)}
        />
      ) : null}

      <AdherenceBar percent={adherence} />

      {/* Estoque */}
      <Pressable
        onPress={onStock}
        style={CONTINUOUS}
        className={`flex-row items-center justify-between gap-2 rounded-xl border px-3 py-2 active:opacity-80 ${stockUrgent ? 'border-rose-300 bg-rose-50' : 'border-line bg-surface-2'}`}
      >
        <View className="flex-1 flex-row items-center gap-1.5">
          <Package size={14} color={stockUrgent ? colors.alert : colors.muted} />
          <Text
            style={{ fontFamily: fonts.medium }}
            className={`text-[12px] ${stockUrgent ? 'text-rose-700' : 'text-fg-soft'}`}
          >
            {formatStockStatus(medication)}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-primary">
          {medication.stock_count == null ? 'Acompanhar' : 'Comprei mais'}
        </Text>
      </Pressable>

      {/* Doses de hoje */}
      {medication.times.length > 0 ? (
        <View>
          <Text style={{ fontFamily: fonts.medium }} className="mb-2 text-[12px] text-muted">
            Doses de hoje
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {medication.times.map((t) => {
              const intake = intakeToday(t);
              return (
                <DoseChip
                  key={t}
                  time={t}
                  done={intake != null}
                  busy={busy}
                  canUndo={canUndo}
                  medicationName={medication.name}
                  onPress={() => onRegister(t)}
                  onUndo={() => {
                    if (intake) {
                      onUndo({ intake, label: t.slice(0, 5), medicationName: medication.name });
                    }
                  }}
                />
              );
            })}
          </View>
        </View>
      ) : (
        <Button label="Registrar tomada agora" size="sm" variant="outline" icon={Check} onPress={onRegisterNow} disabled={busy} />
      )}

      {/* Bula oficial Anvisa */}
      <View className="mt-1 border-t border-line pt-3">
        <Pressable
          onPress={() => Linking.openURL(resolveBulaUrl(medication))}
          accessibilityRole="link"
          accessibilityLabel={`Ver a bula de ${medication.name} no Bulário oficial da Anvisa. Abre no navegador.`}
          accessibilityHint={ANVISA_EXIT_NOTICE}
          style={CONTINUOUS}
          className="flex-row items-center gap-1.5 self-start rounded-lg active:opacity-70"
        >
          <ExternalLink size={14} color={colors.primary} />
          <Text style={[{ fontFamily: fonts.semibold, flexShrink: 1 }, fs(12, 16)]} className="text-primary">
            Ver bula oficial (Anvisa)
          </Text>
        </Pressable>
        {/* Aviso de saída para o Bulário da Anvisa — a bula é a fonte oficial
            de dose e contraindicação. */}
        <Text style={[{ fontFamily: fonts.regular }, fs(11, 16)]} className="mt-1 text-muted">
          {ANVISA_EXIT_NOTICE}
        </Text>
      </View>
    </Card>
  );
}

/* ──────────────────────────── Chip de dose do dia ──────────────────────────── */

/**
 * Uma dose de hoje: pendente ⇄ confirmada.
 *
 * O alvo tinha ~32px (padding 8 + fonte 12 + ícone 14) e nenhum hitSlop, num app
 * cujo público tem tremor, artrose e visão baixa. Agora ele parte de
 * `useTapTarget()` — 44px, 56px no Modo Sênior — e tocar num chip JÁ confirmado
 * desfaz a tomada, com confirmação. Antes o chip virava `disabled` no toque:
 * quem errasse de dose ficava com o registro errado no histórico, sem saída.
 *
 * A microinteração da ação mais importante do app. Antes ela era invisível — só
 * um `toast.success` no canto da tela, que quem estava olhando para o próprio
 * chip nem via. Agora o PRÓPRIO alvo tocado muda de estado, e muda do jeito mais
 * barato possível em custo vestibular:
 *  - só COR e OPACIDADE, em `duration.fast` (160 ms). Zero deslocamento: nada de
 *    escala, "pop", salto ou reordenação — o chip não sai do lugar onde o dedo
 *    acabou de encostar;
 *  - o relógio some enquanto o check aparece (crossfade no mesmo ponto), então
 *    nenhum elemento troca de posição e a linha não reflui;
 *  - por isso o comportamento é IDÊNTICO com "reduzir movimento" ligado: não há
 *    nada aqui que precise ser desligado. O estado final é sempre o mesmo.
 * O háptico de sucesso não fica aqui: quem o dispara é a tela, no sucesso da
 * escrita (ver `handleRegister`).
 */
function DoseChip({
  time,
  done,
  busy,
  canUndo,
  medicationName,
  onPress,
  onUndo,
}: {
  time: string;
  done: boolean;
  busy?: boolean;
  /** Tocar num chip confirmado desfaz? Só no próprio perfil (RLS). */
  canUndo: boolean;
  medicationName: string;
  onPress: () => void;
  onUndo: () => void;
}) {
  const colors = useColors();
  const tap = useTapTarget();
  const p = useSharedValue(done ? 1 : 0);
  const label = time.slice(0, 5);
  // Confirmado sem poder desfazer (perfil de dependente) continua inerte.
  const interactive = !busy && (done ? canUndo : true);

  useEffect(() => {
    p.value = withTiming(done ? 1 : 0, { duration: motion.duration.fast });
  }, [done, p]);

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [DOSE_BG_PENDING, DOSE_BG_DONE]),
  }));
  const clockStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [colors.primary, DOSE_INK_DONE]),
  }));

  return (
    <Pressable
      onPress={() => {
        if (busy) return;
        if (done) {
          if (canUndo) onUndo();
        } else {
          onPress();
        }
      }}
      disabled={!interactive}
      // 4px = METADE do respiro de 8px entre os chips. Amplia o alvo sem que dois
      // chips vizinhos disputem o mesmo ponto: na sobreposição quem vence é o
      // último irmão desenhado, ou seja, um toque no meio registraria a dose
      // ERRADA — justamente o engano que este chip agora permite desfazer.
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: done, disabled: !interactive, busy: !!busy }}
      accessibilityLabel={
        done
          ? `Dose das ${label} de ${medicationName} já registrada`
          : `Registrar dose das ${label} de ${medicationName}`
      }
      accessibilityHint={done && canUndo ? 'Desfaz o registro desta dose.' : undefined}
      className={interactive ? 'active:opacity-80' : undefined}
    >
      <Animated.View
        style={[
          CONTINUOUS,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 12,
            paddingHorizontal: 14,
            // minHeight/minWidth em vez de padding fixo: o alvo obedece ao Modo
            // Sênior (56px) e o conteúdo pode crescer com a fonte do sistema.
            minHeight: tap,
            minWidth: tap,
          },
          chipStyle,
        ]}
      >
        {/* Caixa de tamanho fixo: os dois ícones ocupam o MESMO ponto, então a
            troca é crossfade puro — o rótulo ao lado não se desloca. */}
        <View style={{ width: 16, height: 16 }}>
          <Animated.View style={[StyleSheet.absoluteFill, clockStyle]}>
            <Clock size={16} color={colors.primary} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, checkStyle]}>
            {/* Mesma tinta do rótulo: o check é glifo de status e precisa dos
                3:1 de contraste não-textual sobre o verde claro do chip. */}
            <Check size={16} color={DOSE_INK_DONE} />
          </Animated.View>
        </View>
        <Animated.Text
          maxFontSizeMultiplier={1.4}
          style={[{ fontFamily: fonts.semibold, fontSize: 14 }, textStyle]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/* ──────────────────────────── Barra de adesão ──────────────────────────── */

function AdherenceBar({ percent }: { percent: number | null }) {
  const colors = useColors();
  if (percent == null) {
    return (
      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
        Sem horários definidos para calcular adesão.
      </Text>
    );
  }
  const color = percent >= 80 ? colors.ok : percent >= 50 ? colors.attention : colors.alert;
  const zone = percent >= 80 ? 'boa' : percent >= 50 ? 'atenção' : 'baixa';
  return (
    <View accessible accessibilityLabel={`Adesão dos últimos 7 dias: ${percent}%, ${zone}`}>
      <View className="mb-1 flex-row items-center justify-between">
        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
          Adesão · 7 dias
        </Text>
        <AnimatedNumber
          value={percent}
          suffix="%"
          maxFontSizeMultiplier={1.4}
          style={{ fontFamily: fonts.semibold, color, fontSize: 12, padding: 0, margin: 0 }}
        />
      </View>
      <AnimatedBar percent={percent} color={color} height={8} />
    </View>
  );
}

/* ──────────────────────────── Banner de interações ──────────────────────────── */

function InteractionBanner({
  interactions,
  isLoading,
  isError,
}: {
  interactions: { id: string; drug_a: string; drug_b: string; description: string; severity: keyof typeof INTERACTION_SEVERITY }[];
  isLoading: boolean;
  isError: boolean;
}) {
  const colors = useColors();
  const fs = useFontScaler();
  if (isLoading) {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Verificando possíveis interações na base disponível"
        style={CONTINUOUS}
        className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4"
      >
        <Info size={20} color={colors.primary} />
        <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] text-fg-soft">
          Verificando possíveis interações na base disponível…
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={CONTINUOUS}
        className="flex-row items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
      >
        <AlertTriangle size={20} color={colors.attention} />
        <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] leading-5 text-amber-800">
          Não foi possível verificar possíveis interações agora. Confira os princípios ativos e consulte um médico ou farmacêutico antes de tomar qualquer decisão.
        </Text>
      </View>
    );
  }

  if (interactions.length === 0) {
    return (
      <View
        style={CONTINUOUS}
        className="flex-row items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4"
      >
        <Info size={20} color={colors.primary} />
        <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] leading-5 text-fg-soft">
          A base atual não encontrou correspondências entre os nomes cadastrados. A verificação não é completa e não substitui um médico ou farmacêutico. Confira os princípios ativos e as bulas.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {interactions.map((i) => {
        const meta = INTERACTION_SEVERITY[i.severity];
        const alert = meta.tone === 'alert';
        return (
          <View
            key={i.id}
            style={CONTINUOUS}
            className={`flex-row items-start gap-3 rounded-2xl border p-4 ${alert ? 'border-rose-300 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}
          >
            <AlertTriangle size={20} color={alert ? colors.alert : colors.attention} />
            <View className="flex-1">
              <Text
                style={{ fontFamily: fonts.semibold }}
                className={`text-[13px] ${alert ? 'text-rose-700' : 'text-amber-700'}`}
              >
                {i.drug_a} + {i.drug_b} · {meta.label}
              </Text>
              <Text style={[{ fontFamily: fonts.regular }, fs(12, 17)]} className="mt-0.5 text-fg-soft">
                {i.description}
              </Text>
              {/* Interação medicamentosa: a orientação de procurar o médico é o
                  desfecho de ação do banner. Era o texto menor do bloco. */}
              <Text style={[{ fontFamily: fonts.regular }, fs(11, 16)]} className="mt-1 text-muted">
                Converse com seu médico. O HubPatients não substitui avaliação profissional.
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ──────────────────────────── Folha de estoque ──────────────────────────── */

function StockSheet({
  patientId,
  medication,
  onClose,
}: {
  patientId: string;
  medication: Medication;
  onClose: () => void;
}) {
  const colors = useColors();
  const update = useUpdateStock(patientId, medication.id);
  const refill = useMarkRefill(patientId, medication.id);
  const sheetRef = useRef<AppSheetHandle>(null);

  const [tracking, setTracking] = useState(medication.stock_count != null);
  const [count, setCount] = useState(medication.stock_count?.toString() ?? '');
  const [unit, setUnit] = useState(medication.stock_unit ?? 'comprimidos');
  const [packageSize, setPackageSize] = useState(medication.package_size?.toString() ?? '');
  const [threshold, setThreshold] = useState(String(medication.stock_low_threshold_days ?? 5));
  const [refillQty, setRefillQty] = useState('');

  // Estoque pode ser fracionado (ex.: líquidos em ml); teclado pt-BR gera vírgula.
  const toNum = (v: string) => Number(v.replace(',', '.').trim());
  const pkg = toNum(packageSize) || 0;

  async function save() {
    try {
      await update.mutateAsync({
        stockCount: tracking ? toNum(count || '0') : null,
        stockUnit: unit || 'comprimidos',
        packageSize: packageSize ? toNum(packageSize) : null,
        stockLowThresholdDays: Number(threshold || 5),
      });
      sheetRef.current?.close();
    } catch {
      toast.error('Não foi possível salvar o estoque.');
    }
  }

  async function doRefill(units: number) {
    if (!units || units <= 0) {
      toast.info('Informe uma quantidade válida.');
      return;
    }
    try {
      await refill.mutateAsync(units);
      sheetRef.current?.close();
    } catch {
      toast.error('Não foi possível repor o estoque.');
    }
  }

  return (
    <AppSheet ref={sheetRef} onClose={onClose} title="Controle de estoque">
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
        <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
          {medication.name}
        </Text>
        <Text style={{ fontFamily: fonts.regular }} className="mb-3 text-[12px] text-muted">
          {formatStockStatus(medication)}
        </Text>

        {/* Reposição rápida (quando já rastreia) */}
        {medication.stock_count != null ? (
          <Card className="mb-3 gap-2">
            <View className="flex-row items-center gap-1.5">
              <Package size={16} color={colors.primary} />
              <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                Comprei mais
              </Text>
            </View>
            {pkg > 0 ? (
              <Button
                label={`+ 1 caixa (${pkg})`}
                size="sm"
                variant="outline"
                icon={Plus}
                onPress={() => doRefill(pkg)}
                disabled={refill.isPending}
              />
            ) : null}
            <View className="flex-row items-end gap-2">
              <View className="flex-1">
                <Input
                  label="Ou quantidade"
                  value={refillQty}
                  onChangeText={setRefillQty}
                  keyboardType="number-pad"
                  placeholder="Ex.: 30"
                />
              </View>
              <View className="pb-0.5">
                <Button
                  label="Adicionar"
                  size="sm"
                  variant="outline"
                  onPress={() => doRefill(toNum(refillQty))}
                  disabled={refill.isPending}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {/* Configuração do estoque */}
        <Pressable
          onPress={() => setTracking((t) => !t)}
          style={CONTINUOUS}
          className="mb-3 flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 active:opacity-80"
        >
          <Text style={{ fontFamily: fonts.medium }} className="flex-1 text-[14px] text-fg">
            Acompanhar o estoque deste medicamento
          </Text>
          <View
            style={CONTINUOUS}
            className={`h-6 w-11 justify-center rounded-full px-0.5 ${tracking ? 'bg-primary' : 'bg-surface-2'}`}
          >
            <View
              style={{ alignSelf: tracking ? 'flex-end' : 'flex-start' }}
              className="h-5 w-5 rounded-full bg-white"
            />
          </View>
        </Pressable>

        {tracking ? (
          <View className="gap-3">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="Quantos você tem?" value={count} onChangeText={setCount} keyboardType="number-pad" placeholder="30" />
              </View>
              <View className="flex-1">
                <Input label="Unidade" value={unit} onChangeText={setUnit} placeholder="comprimidos" />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input label="Vêm na caixa?" value={packageSize} onChangeText={setPackageSize} keyboardType="number-pad" placeholder="30" />
              </View>
              <View className="flex-1">
                <Input label="Avisar com X dias" value={threshold} onChangeText={setThreshold} keyboardType="number-pad" placeholder="5" />
              </View>
            </View>
          </View>
        ) : null}

        <View className="mt-4">
          <Button label="Salvar" icon={Check} loading={update.isPending} onPress={save} />
        </View>
      </ScrollView>
    </AppSheet>
  );
}
