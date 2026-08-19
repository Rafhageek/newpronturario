import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  History,
  Scale,
} from 'lucide-react-native';
import {
  useDashboard,
  useProfile,
  useVitals,
  useVitalsRange,
  useNextAppointment,
  useDiarySummary,
  useDiaryEntries,
  useCreateDiaryEntryFull,
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
  estadoSecao,
  podeAfirmarAusencia,
  dataDoDia,
  diaEMes,
  diaLocal,
  dataEHoraLocal,
  horaLocal,
  saudacao,
  DIAS_SEMANA_PT,
  type EstadoSecao,
  type ClinicalZone,
} from '@hubpatients/core';
import { useActiveProfile } from '@/lib/active-profile';
import {
  PageHeader,
  PanelCard,
  PanelButton,
  IconChip,
  Seal,
  SectionHeader,
  StatCard,
  StatRow,
  StatusChip,
  ErrorState,
  EmptyState,
  QuickActions,
  MoodScale,
  MoodMark,
  chipToneFor,
  type QuickAction,
  type StatCardProps,
} from '@/components/painel';
import { useTabBarSpace } from '@/components/tab-bar';
import { WhatsNewSheet } from '@/components/whats-new-sheet';
import { CreatePasswordSheet } from '@/components/create-password-sheet';
import { ActiveProfileSwitcher } from '@/components/active-profile-switcher';
import { WaterCard } from '@/components/water-card';
import { StepsCard } from '@/components/steps-card';
import { BodyCompositionCard } from '@/components/body-composition-card';
import { toast } from '@/components/toast';
import { LineChart } from '@/components/charts';
import {
  useColors,
  useType,
  useFontScale,
  useFontScaler,
  useTapTarget,
  fonts,
  space,
  radius,
  status,
  chart,
} from '@/theme';

/* ══════════════════════════════ Formatação ══════════════════════════════
 * NADA aqui usa `Intl`: no Hermes ele derruba o app (dois incidentes reais —
 * `RelativeTimeFormat` e `DateTimeFormat` com dateStyle/timeStyle). Data por
 * extenso vem de `datas-pt.ts` (@hubpatients/core), a mesma tabela que a web
 * consome; hora é concatenação de dois números.
 * ===================================================================== */

/** "Quarta-feira, 5 de agosto" — o `eyebrow` do cabeçalho de página. */
function dataDoCabecalho(dia: string): string {
  const d = dataDoDia(dia);
  if (!d) return '';
  const semana = DIAS_SEMANA_PT[d.getDay()] ?? '';
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${diaEMes(dia)}`;
}

/**
 * "14:30" e "12 de agosto, 14:30" — subiram para `@hubpatients/core` (datas-pt),
 * junto de `saudacao`. Estavam escritos aqui por concatenação, e a web ia
 * precisar dos mesmos: a hora do prontuário não pode ser formatada de um jeito
 * numa plataforma e de outro na outra. Nada deles usa `Intl`.
 */
const dataEHora = dataEHoraLocal;

/** Número em PT-BR sem `Intl` — uma casa decimal, vírgula. */
function umaCasa(n: number): string {
  return n.toFixed(1).replace('.', ',');
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
 * cartão, `full` é a frase que o leitor de tela anuncia, e `glyph` é o sinal
 * NÃO-cromático (WCAG SC 1.4.1).
 */
const ZONE_READING: Record<ClinicalZone, { glyph: string; short: string; full: string }> = {
  ok: { glyph: '•', short: 'Na faixa de referência', full: 'Dentro do intervalo de referência' },
  attention: {
    glyph: '↑',
    short: 'No limite da faixa',
    full: 'No limite do intervalo de referência',
  },
  alert: { glyph: '↑', short: 'Acima da faixa', full: 'Acima do intervalo de referência' },
};

const ptsOf = (vals: number[]) => vals.map((y, x) => ({ x, y }));

/**
 * Atalhos de navegação — a "barra de ações rápidas" do Painel.
 *
 * Substituiu a grade de 4 colunas com rótulo de 12 px fixo: em 4 colunas o
 * nome do destino ou truncava ou saía ilegível, e o tamanho literal matava o
 * Modo Sênior justamente na parte mais tocada da Home. `QuickActions` empilha
 * em 2 colunas, com alvo de `useTapTarget()` e rótulo que cresce junto.
 *
 * Nenhum destino se perdeu na troca. "Convênio" apontava para `/perfil`, o que
 * era simplesmente o destino errado — agora vai para `/plano-saude`, a tela que
 * existe para isso (a mesma que a aba Mais abre).
 */
const ACOES_RAPIDAS: QuickAction[] = [
  { label: 'Exames', icon: FlaskConical, href: '/exames' },
  { label: 'Consultas', icon: CalendarDays, href: '/consultas' },
  { label: 'Linha do tempo', icon: History, href: '/linha-do-tempo' },
  { label: 'Plano de saúde', icon: CreditCard, href: '/plano-saude' },
  { label: 'Conexão médica', icon: Stethoscope, href: '/comunidade' },
  { label: 'Farmácias', icon: Store, href: '/locais/pharmacy' },
  { label: 'Laboratórios', icon: TestTube, href: '/locais/lab' },
  { label: 'Hospitais', icon: Building2, href: '/locais/hospital' },
];

/**
 * Tom de CATEGORIA de cada cartão, derivado de uma semente estável.
 *
 * A semente é um slug de domínio (não o rótulo visível) para que web e mobile
 * cheguem à mesma cor mesmo que uma das duas escreva "Pressão" e a outra
 * "Pressão arterial". `chipToneFor` é determinístico nas duas plataformas.
 */
const TOM = {
  pressao: chipToneFor('pressao-arterial'),
  medicamentos: chipToneFor('medicamentos'),
  consultas: chipToneFor('consultas'),
  bemEstar: chipToneFor('bem-estar'),
  peso: chipToneFor('composicao-corporal'),
  lembretes: chipToneFor('lembretes'),
  humor: chipToneFor('diario'),
  insight: chipToneFor('insight'),
} as const;

/**
 * `StatCard` com o piso de altura da fileira.
 *
 * O que sobrou de um remendo maior: o `PanelCard` não repassava `style` ao
 * `PressableScale`, então o `flex: 1` pousava na View de dentro e quem esticava
 * a fileira era um Pressable com largura de conteúdo — "Próxima consulta"
 * (valor longo) empurrava os vizinhos e a grade saía irregular. Isso foi
 * consertado NA PRIMITIVA (`layoutStyle`), e a View extra que existia aqui só
 * para isso deixou de ser necessária.
 *
 * O piso de altura fica: ele alinha a linha quando uma dica quebra em duas
 * linhas e a vizinha não. É `minHeight` (nunca `height`) e cresce pelo MESMO
 * fator de `useType()` — o cartão cresce em vez de cortar.
 */
function CartaoMetrica(props: StatCardProps) {
  const { style: fator } = useFontScale();
  return <StatCard {...props} style={{ minHeight: Math.round(132 * fator) }} />;
}

/** O que um cartão de métrica pode dizer sem inventar um fato que não confirmou. */
type Leitura = { value: string; hint: string };

/**
 * Traduz o estado de uma consulta para o par valor/dica de um `StatCard`.
 *
 * O ponto: "—" com "Nenhum registro ainda" é uma AFIRMAÇÃO de ausência, e só
 * `podeAfirmarAusencia()` autoriza uma. Enquanto a consulta não confirmou, o
 * cartão diz que não sabe — nunca que não tem.
 */
function leitura(estado: EstadoSecao, pronto: () => Leitura | null, vazio: string): Leitura {
  if (estado === 'falhou') return { value: '—', hint: 'Não foi possível carregar' };
  if (!podeAfirmarAusencia(estado)) return { value: '—', hint: 'Carregando…' };
  return pronto() ?? { value: '—', hint: vazio };
}

export default function InicioScreen() {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const { colorScheme } = useColorScheme();
  const escuro = colorScheme === 'dark';

  const { width } = useWindowDimensions();
  const { patientId, ownId, active, isViewingDependent } = useActiveProfile();
  const pid = patientId || undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();

  // "O que mudou" tem prioridade — só oferece "Criar senha" depois que ele
  // decidir NÃO aparecer, para nunca empilhar dois sheets de boas-vindas.
  const [whatsNewShowing, setWhatsNewShowing] = useState<boolean | null>(null);

  const dashboardQ = useDashboard(pid);
  const { data: profile } = useProfile(pid);
  const bpRangeQ = useVitalsRange(pid, 'blood_pressure', 30);
  const proximaQ = useNextAppointment(pid);
  const bemEstarQ = useDiarySummary(pid);
  const alergiasQ = useAllergies(pid);
  const pesoQ = useVitals(pid, 'weight');
  const diarioQ = useDiaryEntries(pid);
  const isPlus = useHasPlusAccess(pid).data ?? false;
  const registerIntake = useRegisterIntake(pid ?? '');
  const registrarHumor = useCreateDiaryEntryFull(pid ?? '');
  const unreadNotifs = (useNotifications(ownId || undefined).data ?? []).filter(
    (n) => !n.read_at,
  ).length;

  /*
   * "Já sabemos DE QUEM é este prontuário?" precisa ser uma pergunta separada
   * das flags do React Query: enquanto `pid` está vazio a consulta fica
   * `enabled: false` e `isLoading`/`isError` são AMBOS falsos — as duas travas
   * habituais são contornadas ao mesmo tempo e a tela renderiza afirmando
   * ausência sobre um paciente que ela ainda não sabe qual é.
   */
  const sujeitoConhecido = Boolean(pid);
  const est = (q: { isSuccess: boolean; isError: boolean }): EstadoSecao =>
    estadoSecao({ sujeitoConhecido, isSuccess: q.isSuccess, isError: q.isError });

  const estPainel = est(dashboardQ);
  const estPressao = est(bpRangeQ);
  const estConsulta = est(proximaQ);
  const estBemEstar = est(bemEstarQ);
  const estPeso = est(pesoQ);
  const estAlergias = est(alergiasQ);
  const estDiario = est(diarioQ);

  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  // Qual lembrete está sendo registrado (spinner só na linha tocada).
  const [registrandoId, setRegistrandoId] = useState<string | null>(null);

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
          qc.invalidateQueries({ queryKey: queryKeys.diary(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.allergies(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.hasPlusAccess(pid) }),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const primeiroNome = profile?.full_name?.split(' ')[0];
  const bp = dashboardQ.data?.latestBloodPressure ?? null;
  const meds = dashboardQ.data?.activeMedications ?? [];
  const pendentes = dashboardQ.data?.upcomingIntakes ?? [];
  const serie = bpRangeQ.data ?? [];
  const proxima = proximaQ.data ?? null;
  const bemEstar = bemEstarQ.data ?? null;
  const paPct = smoothedTrendPct(serie.map((v) => v.value_primary));
  const paDir = trendDirection(paPct);
  const alergiasGraves = (alergiasQ.data ?? []).filter((a) => a.severity === 'severe');
  const ultimoPeso =
    (pesoQ.data ?? [])
      .slice()
      .sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime())[0]
      ?.value_primary ?? null;
  const idade = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;
  const gradeBemEstarCompacta = width >= 430;

  const hoje = diaLocal();
  const humorDeHoje = (diarioQ.data ?? []).find((e) => e.entry_date === hoje)?.mood ?? null;

  const nomeDoMed = (id: string): string => meds.find((m) => m.id === id)?.name ?? 'Medicação';

  const bpStatus =
    bp && bp.value_secondary != null
      ? classifyBloodPressure(bp.value_primary, bp.value_secondary)
      : null;

  // Mini-tendência da sistólica (penúltimo vs. último).
  const tendencia: 'up' | 'down' | 'flat' = (() => {
    if (serie.length < 2) return 'flat';
    const anterior = serie[serie.length - 2];
    const ultimo = serie[serie.length - 1];
    if (!anterior || !ultimo) return 'flat';
    return ultimo.value_primary > anterior.value_primary
      ? 'up'
      : ultimo.value_primary < anterior.value_primary
        ? 'down'
        : 'flat';
  })();

  /* ── Os cinco cartões de métrica ──────────────────────────────────────────
   * Na web são cinco lado a lado. Aqui a pressão ocupa a largura toda (ela leva
   * o chip de faixa de referência junto, que não cabe num tile de meia tela) e
   * os outros quatro caem numa grade de 2 × 2. Nada é escondido atrás de um
   * gesto e nenhum texto encolhe para caber; num aparelho estreito demais a
   * própria `StatRow` empilha tudo em uma coluna. */

  const lPressao = leitura(
    estPainel,
    () => (bp ? { value: formatVital(bp), hint: 'Última medição registrada' } : null),
    'Nenhuma medição registrada',
  );
  const lMedicamentos = leitura(
    estPainel,
    () =>
      meds.length > 0
        ? {
            value: String(meds.length),
            hint: meds.length === 1 ? 'medicamento em uso' : 'medicamentos em uso',
          }
        : null,
    'Nenhum cadastrado ainda',
  );
  const lConsulta = leitura(
    estConsulta,
    () =>
      proxima
        ? { value: dataEHora(proxima.scheduled_at), hint: proxima.doctor_name ?? 'Consulta' }
        : null,
    'Nenhuma agendada',
  );
  const lBemEstar = leitura(
    estBemEstar,
    () =>
      bemEstar?.wellbeing != null
        ? { value: `${umaCasa(bemEstar.wellbeing)} / 5`, hint: 'média dos últimos 7 dias' }
        : null,
    'Sem registros no diário',
  );
  const lPeso = leitura(
    estPeso,
    () => (ultimoPeso != null ? { value: `${umaCasa(ultimoPeso)} kg`, hint: 'último registro' } : null),
    'Nenhuma pesagem registrada',
  );

  const algoFalhou = [estPainel, estPressao, estConsulta, estBemEstar, estPeso].includes('falhou');

  async function registrarPendente(intake: (typeof pendentes)[number]) {
    if (!pid || registrandoId) return;
    setRegistrandoId(intake.id);
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
      setRegistrandoId(null);
    }
  }

  async function escolherHumor(valor: number) {
    if (!pid || registrarHumor.isPending) return;
    try {
      await registrarHumor.mutateAsync({ entryDate: new Date(), mood: valor, symptoms: [] });
      toast.success('Humor registrado no seu diário.');
    } catch {
      toast.error('Não foi possível registrar agora.');
    }
  }

  function recarregarMetricas() {
    void dashboardQ.refetch();
    void bpRangeQ.refetch();
    void proximaQ.refetch();
    void bemEstarQ.refetch();
    void pesoQ.refetch();
  }

  const agora = Date.now();

  return (
    // Canvas frio do Painel (#f5f7fb). Desde 2026-08 ele é o `bg` do app inteiro
    // — a tela não precisa mais ir buscar o token do Painel por fora.
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
        <View
          style={{
            width: '100%',
            maxWidth: 760,
            alignSelf: 'center',
            paddingTop: insets.top + space[3],
            paddingHorizontal: space[4] + 2,
            gap: space[3],
          }}
        >
          {/* ── Topo: marca à esquerda, ações pessoais à direita ── */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space[3],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <HeartPulse size={22} color={colors.primary} strokeWidth={2.5} />
              <Text style={[{ fontFamily: fonts.bold, color: colors.primary }, fs(18, 24)]}>
                HubPatients
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Pressable
                onPress={() => router.push('/notificacoes' as never)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  unreadNotifs > 0 ? `Notificações, ${unreadNotifs} não lidas` : 'Notificações'
                }
                style={{
                  borderCurve: 'continuous',
                  minHeight: tap,
                  minWidth: tap,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={21} color={colors.fg} />
                {unreadNotifs > 0 ? (
                  // Contador de não lidas em tinta PRIMÁRIA (8,27:1 com o branco).
                  // Era coral #f24b59, que dava 3,54:1 e reprovava AA — e ainda
                  // por cima gastava vermelho, que é reservado a aviso de risco.
                  <View
                    style={{
                      position: 'absolute',
                      right: 2,
                      top: 2,
                      minHeight: 18,
                      minWidth: 18,
                      paddingHorizontal: 4,
                      borderRadius: radius.full,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[{ fontFamily: fonts.bold, color: colors.white }, fs(11, 14)]}
                    >
                      {unreadNotifs > 9 ? '9+' : unreadNotifs}
                    </Text>
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                onPress={() => router.push('/perfil')}
                accessibilityRole="button"
                accessibilityLabel="Abrir meu perfil"
                style={{
                  borderCurve: 'continuous',
                  minHeight: tap,
                  minWidth: tap,
                  borderRadius: radius.full,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserRound size={21} color={colors.primary} />
              </Pressable>
            </View>
          </View>

          {/* ── Cabeçalho de página: data, saudação, subtítulo ── */}
          <PageHeader
            eyebrow={dataDoCabecalho(hoje)}
            title={
              isViewingDependent
                ? `Cuidado de ${active.name}`
                : `${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ''}! 👋`
            }
            subtitle={
              isViewingDependent
                ? 'Você está vendo o prontuário de outra pessoa.'
                : 'Aqui está o resumo do seu dia.'
            }
          />
          <Seal icon={ShieldCheck} label="Dados protegidos • LGPD" />

          {/* Status do DIA — lembrete pendente ou aviso de alergia. A cor de
              sistema mora na definição do componente, lá embaixo, e a região de
              exceção está em volta dela. */}
          <StatusDoDia
            pendentes={pendentes.length}
            alergiasGraves={alergiasGraves.length}
            estadoPainel={estPainel}
            estadoAlergias={estAlergias}
          />
        </View>

        {/* ── Conteúdo ── */}
        <View
          style={{
            width: '100%',
            maxWidth: 760,
            alignSelf: 'center',
            paddingHorizontal: space[4] + 2,
            paddingTop: space[4],
            gap: space[5],
          }}
        >
          <ActiveProfileSwitcher />

          {/* 1) SEGURANÇA primeiro: alergia grave registrada.
              @cor-do-sistema — o vermelho aqui é permitido e intencional. Não é
              a MEDIDA de um corpo sendo classificada em bom/ruim: é um aviso
              acionável ("você registrou uma alergia grave, confira antes de
              tomar algo"), da mesma família de "remédio atrasado" e "erro de
              upload". `ui-tokens` reserva âmbar/vermelho exatamente para isso. */}
          {alergiasGraves.length > 0 ? (
            <Pressable
              onPress={isViewingDependent ? undefined : () => router.push('/perfil')}
              accessibilityRole={isViewingDependent ? 'text' : 'button'}
              accessibilityLabel={`${
                alergiasGraves.length === 1
                  ? 'Alergia grave registrada'
                  : `${alergiasGraves.length} alergias graves registradas`
              }: ${alergiasGraves.map((a) => a.substance).join(', ')}`}
              style={{
                borderCurve: 'continuous',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: status[escuro ? 'dark' : 'light'].alert.mark,
                backgroundColor: status[escuro ? 'dark' : 'light'].alert.tint,
                padding: space[4],
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: space[2] + 2,
              }}
            >
              <AlertTriangle size={20} color={colors.alert} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={[{ fontFamily: fonts.semibold, color: colors.alert }, fs(15, 20)]}>
                  {alergiasGraves.length === 1
                    ? 'Alergia grave registrada'
                    : `${alergiasGraves.length} alergias graves registradas`}
                </Text>
                <Text
                  style={[
                    { fontFamily: fonts.regular, color: colors.fgSoft, marginTop: 2 },
                    fs(13, 19),
                  ]}
                >
                  {alergiasGraves
                    .map((a) => a.substance + (a.reaction ? ` (${a.reaction})` : ''))
                    .join(' · ')}
                </Text>
              </View>
              {!isViewingDependent ? <ChevronRight size={18} color={colors.alert} /> : null}
            </Pressable>
          ) : null}
          {/* @fim-cor-do-sistema */}

          {/* 2) Fileira de métricas */}
          <View style={{ gap: space[3] }}>
            <StatRow>
              <CartaoPressao
                valor={lPressao.value}
                dica={lPressao.hint}
                zona={bpStatus?.zone ?? null}
                tendencia={bp ? tendencia : null}
              />
              <CartaoMetrica
                icon={Pill}
                tone={TOM.medicamentos}
                label="Medicamentos"
                value={lMedicamentos.value}
                hint={lMedicamentos.hint}
                href="/medicamentos"
              />
              <CartaoMetrica
                icon={CalendarDays}
                tone={TOM.consultas}
                label="Próxima consulta"
                value={lConsulta.value}
                hint={lConsulta.hint}
                href="/consultas"
              />
              <CartaoMetrica
                icon={Smile}
                tone={TOM.bemEstar}
                label="Bem-estar"
                value={lBemEstar.value}
                hint={lBemEstar.hint}
                clinical
                href="/diario"
              />
              <CartaoMetrica
                icon={Scale}
                tone={TOM.peso}
                label="Peso"
                value={lPeso.value}
                hint={lPeso.hint}
                clinical
                href="/composicao-corporal"
              />
            </StatRow>

            {/* Falha é falha, e falha sempre oferece tentar de novo. */}
            {algoFalhou ? (
              <PanelButton
                label="Tentar carregar de novo"
                variant="quiet"
                size="sm"
                onPress={recarregarMetricas}
                style={{ alignSelf: 'flex-start' }}
              />
            ) : null}
          </View>

          {/* 3) AÇÃO PRINCIPAL: lembretes de hoje */}
          <View style={{ gap: space[3] }}>
            <SectionHeader
              title="Lembretes de hoje"
              icon={Clock}
              tone={TOM.lembretes}
              href="/medicamentos"
            />
            {estPainel === 'falhou' ? (
              <ErrorState
                title="Não conseguimos carregar seus lembretes"
                description="Sem isso não dá para dizer se há tomada pendente. Tente de novo."
                onRetry={() => void dashboardQ.refetch()}
              />
            ) : !podeAfirmarAusencia(estPainel) ? (
              <PanelCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[t.bodySm, { color: colors.muted }]}>
                    Conferindo seus lembretes…
                  </Text>
                </View>
              </PanelCard>
            ) : pendentes.length === 0 ? (
              meds.length === 0 ? (
                <EmptyState
                  icon={Pill}
                  tone={TOM.medicamentos}
                  title="Nenhum medicamento cadastrado"
                  description="Cadastre seus remédios e o app avisa a hora de cada tomada."
                  actionLabel="Cadastrar medicamento"
                  actionHref="/medicamentos"
                />
              ) : (
                <EmptyState
                  icon={Check}
                  tone={TOM.lembretes}
                  title="Tudo em dia por aqui"
                  description="Nenhuma tomada pendente para agora. Volte mais tarde."
                />
              )
            ) : (
              <PanelCard>
                {pendentes.map((intake, i) => {
                  const hora = intake.scheduled_for ? horaLocal(intake.scheduled_for) : null;
                  // O horário passou e a tomada segue `pending`. O app sabe que
                  // NÃO HOUVE CONFIRMAÇÃO — não sabe se a pessoa tomou ou não.
                  const semConfirmacao = intake.scheduled_for
                    ? new Date(intake.scheduled_for).getTime() < agora
                    : false;
                  const medicamento = meds.find((m) => m.id === intake.medication_id);
                  const dose = [medicamento?.dosage, medicamento?.unit].filter(Boolean).join(' ');
                  const ocupado = registrandoId === intake.id;
                  return (
                    <View
                      key={intake.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space[3],
                        paddingVertical: space[3],
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: colors.line,
                      }}
                    >
                      <IconChip icon={Pill} tone={TOM.medicamentos} size="lg" />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: space[2],
                          }}
                        >
                          {hora ? (
                            <Text style={[t.data, { color: colors.fg }]}>{hora}</Text>
                          ) : null}
                          {/* Sem isto, uma tomada cujo horário venceu às 8h e
                              uma marcada para daqui a pouco chegam com o mesmo
                              peso visual — e a pessoa não tem como saber que uma
                              passou. A cor de sistema mora na definição do chip,
                              com a região de exceção em volta dela. */}
                          {semConfirmacao ? <ChipSemConfirmacao /> : null}
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[{ fontFamily: fonts.semibold, color: colors.fg }, fs(15, 20)]}
                        >
                          {nomeDoMed(intake.medication_id)}
                        </Text>
                        <Text style={[t.caption, { color: colors.muted }]}>
                          {/* Descreve o que o app SABE (não houve confirmação),
                              nunca o que ele supõe (que a pessoa esqueceu) — e
                              deixa aberta a hipótese mais provável. Mesma
                              redação do Guardião de Dose (migração 0041). */}
                          {semConfirmacao
                            ? `${dose ? `${dose} · ` : ''}Pode ser só o registro que faltou.`
                            : dose || 'Tomada pendente'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => registrarPendente(intake)}
                        disabled={ocupado || registrandoId !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Registrar tomada de ${nomeDoMed(intake.medication_id)}`}
                        accessibilityState={{
                          disabled: ocupado || registrandoId !== null,
                          busy: ocupado,
                        }}
                        style={{
                          borderCurve: 'continuous',
                          minHeight: tap,
                          borderRadius: radius.full,
                          borderWidth: 1,
                          borderColor: colors.primary,
                          backgroundColor: colors.surface,
                          paddingHorizontal: space[3] + 2,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space[1] + 2,
                        }}
                      >
                        {ocupado ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Check size={15} color={colors.primary} />
                        )}
                        <Text
                          style={[{ fontFamily: fonts.semibold, color: colors.primary }, fs(13, 18)]}
                        >
                          {ocupado ? 'Registrando…' : 'Tomei'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </PanelCard>
            )}
          </View>

          {/* 4) Humor de hoje — cinco opções ordenadas por FORMA e por palavra.
                 O mockup trazia carinhas de vermelha a verde; virou `MoodScale`,
                 que ordena por curva da boca, inclinação do olho, posição e
                 rótulo. Detalhe do porquê em docs/DESIGN.md §5. */}
          {!isViewingDependent ? (
            <View style={{ gap: space[3] }}>
              <SectionHeader
                title="Como está seu dia"
                icon={Smile}
                tone={TOM.humor}
                href="/diario"
                actionLabel="Abrir Diário"
              />
              <PanelCard>
                {estDiario === 'falhou' ? (
                  <View style={{ gap: space[3] }}>
                    <Text style={[t.bodySm, { color: colors.fgSoft }]}>
                      Não conseguimos conferir se você já registrou hoje.
                    </Text>
                    <PanelButton
                      label="Tentar de novo"
                      variant="secondary"
                      size="sm"
                      onPress={() => void diarioQ.refetch()}
                      style={{ alignSelf: 'flex-start' }}
                    />
                  </View>
                ) : humorDeHoje != null ? (
                  <View style={{ gap: space[3] }}>
                    <Text style={[{ fontFamily: fonts.semibold, color: colors.fg }, fs(15, 20)]}>
                      Você registrou hoje
                    </Text>
                    <MoodMark value={humorDeHoje} />
                    <PanelButton
                      label="Abrir o Diário"
                      variant="secondary"
                      size="sm"
                      href="/diario"
                      style={{ alignSelf: 'flex-start' }}
                    />
                  </View>
                ) : (
                  <MoodScale
                    value={null}
                    onChange={(v) => void escolherHumor(v)}
                    disabled={!podeAfirmarAusencia(estDiario) || registrarHumor.isPending}
                  />
                )}
              </PanelCard>
            </View>
          ) : null}

          {/* 5) Ações rápidas — navegação, alta na tela de propósito: alcança
                 qualquer área sem rolar a Home inteira. */}
          <View style={{ gap: space[3] }}>
            <SectionHeader title="Ações rápidas" />
            <QuickActions actions={ACOES_RAPIDAS} />
          </View>

          {/* 6) Pressão arterial · 30 dias */}
          <View style={{ gap: space[3] }}>
            <SectionHeader
              title="Pressão arterial · 30 dias"
              icon={HeartPulse}
              tone={TOM.pressao}
              href="/analise"
              actionLabel="Ver análise"
            />
            {estPressao === 'falhou' ? (
              <ErrorState
                title="Não conseguimos carregar o período"
                description="Sem os dados não dá para dizer que não há medições. Tente de novo."
                onRetry={() => void bpRangeQ.refetch()}
              />
            ) : !podeAfirmarAusencia(estPressao) ? (
              <PanelCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[t.bodySm, { color: colors.muted }]}>Carregando o período…</Text>
                </View>
              </PanelCard>
            ) : serie.length < 2 ? (
              <EmptyState
                icon={HeartPulse}
                tone={TOM.pressao}
                title="Sem medições no período"
                description="Com duas medições já dá para ver a evolução dos últimos 30 dias."
                actionLabel="Registrar pressão"
                actionHref="/diario"
              />
            ) : (
              <PanelCard style={{ gap: space[3] }}>
                {serie.length >= 4 ? (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[1] + 2,
                      paddingHorizontal: space[2] + 2,
                      paddingVertical: space[1],
                      borderRadius: radius.full,
                      backgroundColor: colors.surface2,
                    }}
                  >
                    {/* Direção na FORMA da seta e no texto — nunca na cor. */}
                    {paDir === 'up' ? (
                      <TrendingUp size={13} color={colors.primary} />
                    ) : paDir === 'down' ? (
                      <TrendingDown size={13} color={colors.primary} />
                    ) : (
                      <Minus size={13} color={colors.muted} />
                    )}
                    <Text
                      style={[
                        { fontFamily: fonts.medium, color: paDir === 'flat' ? colors.muted : colors.primary },
                        fs(12, 16),
                      ]}
                    >
                      Sistólica {trendLabel(paPct)}
                    </Text>
                  </View>
                ) : null}
                {/* Faixa de referência NEUTRA e rotulada, não semáforo. As três
                    bandas verde/âmbar/vermelha que existiam aqui classificavam o
                    corpo do paciente em "bom / atenção / ruim". Faixa 90–130
                    mmHg: Diretrizes Brasileiras de Hipertensão Arterial 2020
                    (SBC/SBH/SBN), mesma fonte de `referenceBandFor` na web.
                    As séries usam a paleta neutra-clínica de `chart`, e não mais
                    o acento coral — vermelho num traço de pressão é semáforo. */}
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
                    {
                      points: ptsOf(serie.map((v) => v.value_primary)),
                      color: chart[escuro ? 'dark' : 'light'][0],
                    },
                    {
                      points: ptsOf(serie.map((v) => v.value_secondary ?? 0)),
                      color: chart[escuro ? 'dark' : 'light'][1],
                    },
                  ]}
                />
                <View style={{ flexDirection: 'row', gap: space[4] }}>
                  <PontoLegenda color={chart[escuro ? 'dark' : 'light'][0]} label="Sistólica" />
                  <PontoLegenda color={chart[escuro ? 'dark' : 'light'][1]} label="Diastólica" />
                </View>
                <Text style={[t.caption, { color: colors.hint }]}>
                  {DISCLAIMERS.examInterpretation}
                </Text>
              </PanelCard>
            )}
          </View>

          {/* 7) Bem-estar — hábitos reunidos (hidratação · passos · composição) */}
          <View style={{ gap: space[3] }}>
            <SectionHeader title="Bem-estar" icon={Smile} tone={TOM.bemEstar} />
            <View style={gradeBemEstarCompacta ? { flexDirection: 'row', gap: space[3] } : { gap: space[3] }}>
              <WaterCard
                patientId={pid}
                weightKg={ultimoPeso}
                age={idade}
                compact={gradeBemEstarCompacta}
              />
              {!isViewingDependent ? <StepsCard compact={gradeBemEstarCompacta} /> : null}
            </View>
            {!isViewingDependent ? <BodyCompositionCard /> : null}
          </View>

          {/* 8) Insight da semana (recurso Plus) */}
          <View style={{ gap: space[3] }}>
            <SectionHeader title="Insight da semana" icon={Brain} tone={TOM.insight} />
            <CartaoInsight
              isPlus={isPlus}
              bemEstar={bemEstar}
              estadoBemEstar={estBemEstar}
              tendenciaPa={tendencia}
              temPa={Boolean(bp)}
              estadoPa={estPainel}
              onUpgrade={() => {
                toast.info('Insights semanais fazem parte do HubPatients Plus.');
                router.push('/planos');
              }}
            />
          </View>
        </View>
      </ScrollView>

      {/* "O que mudou" — aparece uma vez por versão e se esconde sozinho. */}
      <WhatsNewSheet onDecided={setWhatsNewShowing} />
      {/* "Criar senha" (contas só-Google) — só entra na fila depois do "O que mudou". */}
      {whatsNewShowing === false ? <CreatePasswordSheet /> : null}
    </View>
  );
}

/* ══════════════════════════════ Peças da Home ══════════════════════════════ */

/**
 * Selo de status do dia.
 *
 * Enquanto não sabemos de quem é o prontuário (ou a consulta ainda não voltou)
 * ele NÃO diz "tudo tranquilo": silêncio de carregamento não é boa notícia.
 *
 * @cor-do-sistema — domínio de AGENDA e SEGURANÇA, não medida do corpo. O
 * vermelho aqui avisa que existe alergia grave registrada para conferir antes de
 * tomar algo: mesma família de "remédio atrasado" e "erro de upload", que é
 * exatamente o papel que `ui-tokens` reserva a âmbar e vermelho.
 */
function StatusDoDia({
  pendentes,
  alergiasGraves,
  estadoPainel,
  estadoAlergias,
}: {
  pendentes: number;
  alergiasGraves: number;
  estadoPainel: EstadoSecao;
  estadoAlergias: EstadoSecao;
}) {
  const colors = useColors();
  const fs = useFontScaler();
  const { colorScheme } = useColorScheme();
  const tom = status[colorScheme === 'dark' ? 'dark' : 'light'];

  const sabeDosLembretes = podeAfirmarAusencia(estadoPainel);
  const sabeDasAlergias = podeAfirmarAusencia(estadoAlergias);
  if (!sabeDosLembretes || !sabeDasAlergias) return null;

  const alerta = alergiasGraves > 0;
  const Icone = pendentes > 0 ? Clock : alerta ? AlertTriangle : ShieldCheck;
  const texto =
    pendentes > 0
      ? `${pendentes} ${pendentes === 1 ? 'lembrete' : 'lembretes'} para hoje`
      : alerta
        ? 'Atenção às alergias registradas'
        : 'Tudo tranquilo por aqui hoje';
  const tinta = alerta && pendentes === 0 ? colors.alert : colors.primary;
  const fundo = alerta && pendentes === 0 ? tom.alert.tint : tom.info.tint;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={texto}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingHorizontal: space[3] + 2,
        paddingVertical: space[2],
        borderRadius: radius.full,
        borderCurve: 'continuous',
        backgroundColor: fundo,
      }}
    >
      <Icone size={16} color={tinta} />
      <Text style={[{ fontFamily: fonts.medium, color: tinta }, fs(14, 19)]}>{texto}</Text>
    </View>
  );
}
/* @fim-cor-do-sistema */

/**
 * Cartão de pressão arterial — o "hero" da fileira de métricas.
 *
 * Por que não é um `StatCard`: o `hint` dele é texto simples, e a pressão
 * precisa levar junto o chip de faixa de referência (a gramática de
 * `clinical-value.tsx`: tint neutro + borda + GLIFO + palavra) e a seta de
 * tendência. `docs/DESIGN.md` §4 prevê exatamente este caso — "o valor precisa
 * de mais → cartão próprio dentro de `PanelCard`". Fora isso ele é montado com
 * as mesmas peças de um `StatCard`: `PanelCard` + `IconChip` + os mesmos tokens.
 */
function CartaoPressao({
  valor,
  dica,
  zona,
  tendencia,
}: {
  valor: string;
  /** Já vem honesta de `leitura()`: "Carregando…", "Não foi possível carregar"
   *  ou a afirmação de ausência, que só sai com a consulta confirmada. */
  dica: string;
  zona: ClinicalZone | null;
  tendencia: 'up' | 'down' | 'flat' | null;
}) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  const router = useRouter();
  const temValor = valor !== '—';

  return (
    // `layoutStyle` vai para o elemento MAIS EXTERNO do cartão (o Pressable),
    // que é quem precisa ocupar a linha inteira.
    <PanelCard onPress={() => router.push('/analise')} layoutStyle={{ width: '100%' }}>
      {/* Uma leitura só para o leitor de tela, como no `StatCard`. */}
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={[
          'Pressão arterial',
          temValor ? valor : dica,
          zona && temValor ? ZONE_READING[zona].full : null,
          tendencia && temValor ? TREND_READING[tendencia].label : null,
        ]
          .filter(Boolean)
          .join(', ')}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <IconChip icon={HeartPulse} tone={TOM.pressao} />
          <ChevronRight size={20} color={colors.hint} />
        </View>
        <Text
          style={[
            { fontFamily: fonts.medium, color: colors.muted, marginTop: space[3] },
            fs(13, 18),
          ]}
        >
          Pressão arterial
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: 2 }}>
          <Text style={[t.dataLg, { color: colors.fg }]}>{valor}</Text>
          {tendencia && temValor ? <SetaTendencia direcao={tendencia} /> : null}
        </View>
        {zona && temValor ? (
          <ChipFaixaClinica zona={zona} />
        ) : (
          <Text
            maxFontSizeMultiplier={1.4}
            style={[{ fontFamily: fonts.regular, color: colors.hint, marginTop: 2 }, fs(13, 18)]}
          >
            {dica}
          </Text>
        )}
      </View>
    </PanelCard>
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

function SetaTendencia({ direcao }: { direcao: 'up' | 'down' | 'flat' }) {
  const colors = useColors();
  const { Icon, label } = TREND_READING[direcao];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Icon size={18} color={direcao === 'flat' ? colors.muted : colors.primary} />
    </View>
  );
}

/**
 * Chip da faixa de referência de um dado do CORPO — tinta `neutro`, glifo e
 * texto. Substitui o `ZONE_TONE` âmbar/vermelho (ver `ZONE_READING` no topo).
 *
 * A gramática (tint de fundo + mark na borda + ink no texto + glifo obrigatório)
 * é a mesma de `src/components/clinical-value.tsx`, o componente canônico de
 * valor clínico.
 */
function ChipFaixaClinica({ zona }: { zona: ClinicalZone }) {
  const { colorScheme } = useColorScheme();
  const fs = useFontScaler();
  const tom = status[colorScheme === 'dark' ? 'dark' : 'light'].neutro;
  const { glyph, short, full } = ZONE_READING[zona];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={full}
      style={{
        alignSelf: 'flex-start',
        marginTop: space[2],
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1],
        paddingHorizontal: space[2],
        paddingVertical: 2,
        borderRadius: radius.full,
        borderCurve: 'continuous',
        borderWidth: 1,
        backgroundColor: tom.tint,
        borderColor: tom.mark,
      }}
    >
      <Text style={[{ fontFamily: fonts.bold, color: tom.ink }, fs(12, 16)]}>{glyph}</Text>
      <Text style={[{ fontFamily: fonts.semibold, color: tom.ink, flexShrink: 1 }, fs(12, 16)]}>
        {short}
      </Text>
    </View>
  );
}

/**
 * "Sem confirmação" — SISTEMA (agenda), não corpo.
 *
 * Era um chip montado à mão AQUI, com a sua própria região de exceção de cor em
 * volta. Virou `<StatusChip status="attention">` das primitivas: a regra da cor
 * de sistema (três papéis de tinta, rótulo obrigatório, glifo) passou a morar
 * num lugar só, em vez de ser reescrita em cada tela que precisa dela — e a
 * exceção saiu da tela e foi para a fundação, onde é revisada uma vez.
 *
 * (Não escreva o marcador de exceção por extenso em comentário: a varredura lê
 * o arquivo como texto e abriria uma região aqui sem ninguém pedir.)
 *
 * O que a redação continua acertando, e por isso está preservada palavra por
 * palavra: o chip diz o que o app SABE — não houve confirmação da dose — e não
 * o que ele supõe ("você esqueceu", "atrasou"). A hipótese mais provável é que
 * a pessoa tomou e não registrou, e a linha abaixo do nome diz isso em letra:
 * "Pode ser só o registro que faltou." Âmbar com frase de cobrança é o problema
 * que acabou de sair do diário alimentar, vestido de outra roupa.
 *
 * E continua legível SEM a cor: o que distingue esta linha das outras é o
 * ÍCONE, a PALAVRA e a moldura do chip (SC 1.4.1).
 */
function ChipSemConfirmacao() {
  return <StatusChip status="attention" label="Sem confirmação" icon={Clock} />;
}

function PontoLegenda({ color, label }: { color: string; label: string }) {
  const colors = useColors();
  const t = useType();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] + 2 }}>
      <View style={{ width: 10, height: 10, borderRadius: radius.full, backgroundColor: color }} />
      <Text style={[t.caption, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

/** Resumo semanal montado com o que já está em mãos (sem chamada extra). */
function CartaoInsight({
  isPlus,
  bemEstar,
  estadoBemEstar,
  tendenciaPa,
  temPa,
  estadoPa,
  onUpgrade,
}: {
  isPlus: boolean;
  bemEstar: { mood: number | null; energy: number | null; wellbeing: number | null } | null;
  estadoBemEstar: EstadoSecao;
  tendenciaPa: 'up' | 'down' | 'flat';
  temPa: boolean;
  estadoPa: EstadoSecao;
  onUpgrade: () => void;
}) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();

  if (!isPlus) {
    return (
      <PanelCard style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <IconChip icon={Lock} tone={TOM.insight} />
          <View style={{ flex: 1 }}>
            <Text style={[{ fontFamily: fonts.semibold, color: colors.fg }, fs(15, 20)]}>
              Insight da semana
            </Text>
            <Text style={[t.caption, { color: colors.muted }]}>
              Um resumo da sua saúde, atualizado toda semana.
            </Text>
          </View>
        </View>
        <PanelButton label="Desbloquear no Plus" icon={Sparkles} size="sm" onPress={onUpgrade} />
      </PanelCard>
    );
  }

  /*
   * Cada frase só entra se a seção que a alimenta CONFIRMOU. Sem isso o resumo
   * vira o pior tipo de mentira: uma frase afirmativa, em tom de conselho,
   * construída em cima de uma consulta que falhou.
   */
  const frases: string[] = [];
  if (podeAfirmarAusencia(estadoBemEstar) && bemEstar?.wellbeing != null) {
    const w = bemEstar.wellbeing;
    frases.push(
      `Seu bem-estar médio na semana foi ${umaCasa(w)} de 5.` +
        (bemEstar.mood != null && bemEstar.energy != null
          ? ` Humor ${umaCasa(bemEstar.mood)} e energia ${umaCasa(bemEstar.energy)}.`
          : ''),
    );
  }
  if (podeAfirmarAusencia(estadoPa) && temPa) {
    frases.push(
      tendenciaPa === 'up'
        ? 'Sua pressão sistólica subiu na última medição — vale observar nos próximos dias.'
        : tendenciaPa === 'down'
          ? 'Sua pressão sistólica recuou na última medição. Continue registrando.'
          : 'Sua pressão arterial está estável entre as últimas medições.',
    );
  }
  if (frases.length === 0) {
    frases.push(
      'Registre seu diário e sua pressão para receber um resumo semanal personalizado.',
    );
  }

  return (
    <PanelCard style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <IconChip icon={Brain} tone={TOM.insight} />
        <View style={{ flex: 1, gap: space[2] }}>
          <Text style={[{ fontFamily: fonts.semibold, color: colors.fg }, fs(15, 20)]}>
            Seu resumo desta semana
          </Text>
          {frases.map((frase) => (
            <View key={frase} style={{ flexDirection: 'row', gap: space[2] }}>
              <Sparkles size={14} color={colors.primary} style={{ marginTop: 4 }} />
              <Text style={[t.bodySm, { color: colors.fgSoft, flex: 1 }]}>{frase}</Text>
            </View>
          ))}
        </View>
      </View>
    </PanelCard>
  );
}
