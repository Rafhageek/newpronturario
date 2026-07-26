import { useEffect, useRef, useState } from 'react';
import { View, Text, Switch, Pressable, TextInput, Alert, Share, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import QRCode from 'react-native-qrcode-svg';
import {
  Bell, Mail, MessageCircle, User, ShieldCheck, LogOut, Check, Palette, Bot, Stethoscope,
  Type, Contrast, MoonStar, Sun, Lock, Smartphone, CalendarClock, ShieldAlert,
  Share2, RefreshCw, Flower2, Trash2, KeyRound, ChevronDown, Settings2, ScanFace, Fingerprint,
  Accessibility, type LucideIcon,
} from 'lucide-react-native';
import {
  useUserSettings, useUpdateSettings, useProfile, useHubPatientsClient, useHasPlusAccess,
  useCalendarSubscription, useSetCalendarSync, useRotateCalendarToken,
  useCycleSettings, useUpdateCycleSettings, useDeleteCycleHistory,
} from '@hubpatients/supabase';
import { LOCALES } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, SectionTitle, ListRow, Button, Divider, Input, Badge } from '@/components/ui';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
import { toast } from '@/components/toast';
import {
  useColors,
  fonts,
  useSeniorMode,
  useType,
  useTapTarget,
  tapTarget,
  useTabBarStyle,
  type TabBarStyle,
} from '@/theme';
import { saveThemePref, loadThemePref, type ThemePref } from '@/lib/theme-pref';
import {
  isBiometricSupported,
  getBiometricLabel,
  loadBiometricPref,
  setBiometricPref,
  authenticateBiometric,
} from '@/lib/biometric';
import {
  ensureNotificationPermission,
  loadRemindersPref,
  saveRemindersPref,
  cancelMedicationReminders,
} from '@/lib/notifications';

const extra = Constants.expoConfig?.extra as { supabaseUrl?: string } | undefined;
const SUPABASE_URL = extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/** Passos por plataforma para assinar o feed de calendário (espelha a web). */
const CALENDAR_INSTRUCTIONS: { platform: string; steps: string[] }[] = [
  {
    platform: 'Google Calendar',
    steps: [
      'No computador, abra o Google Calendar.',
      'Em "Outras agendas", clique em + → "De um URL".',
      'Cole a URL acima e clique em "Adicionar agenda".',
    ],
  },
  {
    platform: 'Apple Calendar (iPhone/Mac)',
    steps: [
      'iPhone: Ajustes → Calendário → Contas → Adicionar conta → Outra → Adicionar calendário assinado.',
      'Cole a URL e confirme.',
    ],
  },
  {
    platform: 'Outlook',
    steps: ['Calendário → Adicionar calendário → Assinar pela Web → cole a URL.'],
  },
];

/** "22:30" → válido; aceita vazio (limpa). Retorna null se vazio, string se válido, undefined se inválido. */
function parseTime(raw: string): string | null | undefined {
  const t = raw.trim();
  if (t === '') return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : undefined;
}

export default function ConfiguracoesScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const userId = user?.id ?? '';
  const { data: settings } = useUserSettings(user?.id);
  const { data: profile } = useProfile(user?.id);
  const update = useUpdateSettings(userId);
  const isPlus = useHasPlusAccess(user?.id).data ?? false;
  const colors = useColors();

  const [themePref, setThemePref] = useState<ThemePref>('system');
  useEffect(() => {
    void loadThemePref().then(setThemePref);
  }, []);
  async function onThemeChange(p: ThemePref) {
    setThemePref(p);
    await saveThemePref(p);
  }

  /** Abre os ajustes do sistema (Tela/Acessibilidade ficam por conta do SO). */
  function openSystemSettings() {
    void Linking.openSettings().catch(() =>
      toast.info('Abra Ajustes do aparelho → Tela/Acessibilidade.'),
    );
  }

  const notif = {
    push: settings?.notif_push ?? true,
    email: settings?.notif_email ?? true,
    whatsapp: settings?.notif_whatsapp ?? false,
  };
  const locale = settings?.locale ?? 'pt-BR';

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Configurações" subtitle="Notificações, idioma e conta" back />
      <Screen>
        {/* Notificações */}
        <SectionTitle>Notificações</SectionTitle>
        <Card className="gap-1">
          <ToggleRow
            icon={Bell}
            label="Notificações push"
            value={notif.push}
            onChange={(v) => update.mutate({ notif_push: v })}
          />
          <Divider />
          <DeviceRemindersRow />
          <Divider />
          <ToggleRow
            icon={Mail}
            label="E-mail"
            value={notif.email}
            onChange={(v) => update.mutate({ notif_email: v })}
          />
          <Divider />
          <ToggleRow
            icon={MessageCircle}
            label="Lembretes por WhatsApp"
            badge={isPlus ? undefined : 'PLUS'}
            value={isPlus && notif.whatsapp}
            onChange={(v) => {
              if (!isPlus) {
                toast.info('Lembretes por WhatsApp são um recurso Plus. Ative o plano Plus para usar.');
                return;
              }
              update.mutate({ notif_whatsapp: v });
            }}
          />
          <Divider />
          <QuietHoursRow
            start={settings?.quiet_hours_start ?? null}
            end={settings?.quiet_hours_end ?? null}
            onChange={(patch) => update.mutate(patch)}
          />
        </Card>

        {/* Idioma */}
        <SectionTitle>Idioma</SectionTitle>
        <Card className="gap-0.5">
          {LOCALES.map((l, i) => (
            <View key={l.code}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => update.mutate({ locale: l.code })}
                className="flex-row items-center gap-3 py-3 active:opacity-70"
              >
                <Text className="text-[18px]">{l.flag}</Text>
                <Text className="flex-1 text-[15px] font-medium text-fg">{l.label}</Text>
                {locale === l.code ? <Check size={20} color={colors.accent} /> : null}
              </Pressable>
            </View>
          ))}
        </Card>

        {/* Aparência */}
        <SectionTitle>Aparência</SectionTitle>
        <Card className="gap-3">
          <View className="flex-row items-center gap-2.5">
            <Palette size={18} color={colors.primary} />
            <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
              Tema do aplicativo
            </Text>
          </View>
          <View className="flex-row gap-2">
            {(
              [
                { key: 'system' as const, label: 'Sistema', icon: Smartphone },
                { key: 'light' as const, label: 'Claro', icon: Sun },
                { key: 'dark' as const, label: 'Escuro', icon: MoonStar },
              ]
            ).map((opt) => {
              const active = themePref === opt.key;
              const Icon = opt.icon;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => onThemeChange(opt.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Tema ${opt.label}`}
                  style={{ borderCurve: 'continuous' }}
                  className={`flex-1 items-center gap-1.5 rounded-2xl border py-3 ${active ? 'border-primary bg-trust-100' : 'border-line bg-surface-2'}`}
                >
                  <Icon size={20} color={active ? colors.primary : colors.muted} />
                  <Text
                    style={{ fontFamily: fonts.semibold }}
                    className={`text-[12px] ${active ? 'text-primary' : 'text-muted'}`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Acessibilidade */}
        {/* Comparação temporária das duas aparências do menu (ver tab-bar.tsx) */}
        <SectionTitle>Aparência do menu</SectionTitle>
        <TabBarStyleSection />

        <SectionTitle>Acessibilidade</SectionTitle>
        <SeniorModeSection />
        <Card className="mt-3 gap-0.5">
          <ListRow
            icon={Type}
            iconTone="primary"
            title="Tamanho da letra"
            subtitle="Ajuste em Ajustes do aparelho → Tela/Acessibilidade. O app respeita o tamanho do sistema."
            onPress={openSystemSettings}
          />
          <Divider />
          <ListRow
            icon={Contrast}
            iconTone="neutral"
            title="Alto contraste"
            subtitle="Ative o alto contraste do sistema para textos e bordas mais fortes — útil para baixa visão."
            onPress={openSystemSettings}
          />
          <View className="pt-2">
            <Button
              label="Abrir ajustes do sistema"
              variant="outline"
              size="sm"
              icon={Settings2}
              onPress={openSystemSettings}
            />
          </View>
        </Card>

        {/* Conta */}
        <SectionTitle>Conta</SectionTitle>
        <Card className="gap-0.5">
          <ListRow
            icon={User}
            iconTone="primary"
            title="Meu perfil"
            subtitle="Dados pessoais e de saúde"
            onPress={() => router.push('/perfil')}
          />
          <Divider />
          <ListRow
            icon={ShieldCheck}
            iconTone="accent"
            title="Privacidade (LGPD)"
            subtitle="Consentimentos e exportação de dados"
            onPress={() => router.push('/consentimento')}
          />
          <Divider />
          <ListRow
            icon={Bot}
            iconTone="primary"
            title="Acesso de IA ao prontuário"
            subtitle="Token de leitura para seu assistente"
            onPress={() => router.push('/acesso-ia')}
          />
          <Divider />
          <ListRow
            icon={Stethoscope}
            iconTone="accent"
            title="Verificação profissional"
            subtitle="Selo de médico no fórum (CRM)"
            onPress={() => router.push('/verificacao-profissional')}
          />
        </Card>

        {/* Segurança */}
        <SectionTitle>Segurança</SectionTitle>
        <BiometricSection />
        <SecuritySection lastSignInAt={user?.last_sign_in_at ?? null} />
        <TwoFactorSection />

        {/* Sincronização de calendário */}
        <SectionTitle>Calendário externo</SectionTitle>
        <CalendarSyncSection userId={userId} />

        {/* Privacidade do ciclo (apenas perfis femininos) */}
        {profile?.biological_sex === 'female' ? (
          <>
            <SectionTitle>Ciclo menstrual</SectionTitle>
            <CyclePrivacySection userId={userId} />
          </>
        ) : null}

        {/* Versão instalada — para saber se a atualização já chegou */}
        <SectionTitle>Sobre esta versão</SectionTitle>
        <AboutVersionSection />

        <Button label="Sair da conta" variant="outline" icon={LogOut} onPress={signOut} />
      </Screen>
    </View>
  );
}

/* ──────────────────────────── Sobre esta versão ──────────────────────────── */

/**
 * Mostra QUAL build e QUAL atualização estão rodando no aparelho.
 *
 * Existe porque não há como perguntar isso de fora: o app só usa notificação
 * LOCAL (lembrete agendado no próprio aparelho) e não registra token de push,
 * então ninguém consegue "tocar" no celular para conferir se a atualização
 * chegou. Aqui a própria pessoa confere — e consegue ler o dado no telefone
 * para quem estiver dando suporte.
 *
 * `Updates.updateId` é nulo quando o app está rodando o código embutido no
 * APK (nenhuma OTA aplicada ainda) — daí a distinção explícita no texto, em
 * vez de mostrar um campo vazio.
 */
function AboutVersionSection() {
  const appVersion = Constants.expoConfig?.version ?? '—';
  const embedded = Updates.isEmbeddedLaunch;
  const updateId = Updates.updateId;
  const created = Updates.createdAt;

  return (
    <Card className="gap-1">
      <InfoRow label="Versão do app" value={appVersion} />
      <InfoRow label="Base do app (runtime)" value={Updates.runtimeVersion ?? '—'} />
      <InfoRow label="Canal" value={Updates.channel ?? '—'} />
      <InfoRow
        label="Atualização"
        value={
          embedded || !updateId
            ? 'a que veio no aplicativo'
            : `${updateId.slice(0, 8)}${created ? ` · ${created.toLocaleDateString('pt-BR')}` : ''}`
        }
      />
      <Text style={{ fontFamily: fonts.regular }} className="mt-1.5 text-[12px] leading-4 text-muted">
        {embedded || !updateId
          ? 'Você está com o conteúdo que veio junto do aplicativo. Feche e abra o app novamente para buscar atualizações.'
          : 'As atualizações chegam sozinhas ao fechar e abrir o aplicativo — não é preciso reinstalar.'}
      </Text>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-1">
      <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
        {label}
      </Text>
      <Text
        style={{ fontFamily: fonts.semibold }}
        className="shrink text-right text-[13px] text-fg"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

/* ──────────────────────── Aparência do menu (temporário) ──────────────────────── */

/**
 * Escolha entre as duas aparências do menu inferior, para decidir olhando no
 * aparelho em vez de no papel. É TEMPORÁRIO: quando a decisão sair, a versão
 * perdedora e este bloco saem do código.
 *
 * O aviso sobre o Modo Sênior não é detalhe: com ele ligado a barra fica sólida
 * de qualquer forma, então sem essa frase a pessoa mexeria aqui e concluiria
 * que o app está com defeito.
 */
function TabBarStyleSection() {
  const colors = useColors();
  const { style, setStyle } = useTabBarStyle();
  const { enabled: senior } = useSeniorMode();

  const OPCOES: { valor: TabBarStyle; titulo: string; descricao: string }[] = [
    {
      valor: 'glass',
      titulo: 'Vidro',
      descricao: 'Barra flutuante, com desfoque do conteúdo por trás.',
    },
    {
      valor: 'solid',
      titulo: 'Sólido',
      descricao: 'Barra encostada na borda, sem transparência.',
    },
  ];

  return (
    <Card className="gap-1">
      {OPCOES.map((opcao, i) => {
        const ativo = style === opcao.valor;
        return (
          <View key={opcao.valor}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              onPress={() => void setStyle(opcao.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={opcao.titulo}
              className="flex-row items-center gap-3 py-2.5"
            >
              <View className="flex-1">
                <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
                  {opcao.titulo}
                </Text>
                <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                  {opcao.descricao}
                </Text>
              </View>
              {ativo ? <Check size={20} color={colors.primary} /> : null}
            </Pressable>
          </View>
        );
      })}

      {senior ? (
        <Text style={{ fontFamily: fonts.regular }} className="mt-1.5 text-[11px] leading-4 text-fg-soft">
          O Modo simples está ligado, então o menu fica sólido de qualquer forma — sobre desfoque
          não é possível garantir a legibilidade do texto.
        </Text>
      ) : null}
    </Card>
  );
}

/* ──────────────────────────── Modo simples (Modo Sênior) ──────────────────────────── */

/**
 * "Modo simples": texto 1,3× maior (com clamp de 2× sobre a fonte do aparelho)
 * e alvos de toque de 56 px — bem acima do mínimo de 24 px do WCAG 2.2 (2.5.8).
 * A preferência é persistida no SecureStore (mesmo mecanismo do tema) e vale no
 * app inteiro assim que é trocada. O bloco de preview mostra o tamanho real do
 * texto, sem animação (a mudança é instantânea — nada a reduzir).
 */
function SeniorModeSection() {
  const colors = useColors();
  const { enabled, setEnabled } = useSeniorMode();
  const t = useType();
  const minTap = useTapTarget();

  function toggle(next: boolean) {
    void setEnabled(next).then(() => {
      toast.success(
        next
          ? 'Modo simples ligado. Letras maiores e botões mais fáceis de tocar.'
          : 'Modo simples desligado. Voltamos ao tamanho normal.',
      );
    });
  }

  return (
    <Card className="gap-3">
      <Pressable
        onPress={() => toggle(!enabled)}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        accessibilityLabel="Modo simples, recomendado para leitura fácil"
        accessibilityHint="Deixa as letras maiores e os botões mais fáceis de tocar em todo o aplicativo"
        style={{ minHeight: minTap }}
        className="flex-row items-center gap-3 active:opacity-70"
      >
        <Accessibility size={22} color={colors.primary} />
        <View className="flex-1">
          <Text style={t.bodySemibold} className="text-fg">
            Modo simples
          </Text>
          <Text style={t.caption} className="text-muted">
            Recomendado para leitura fácil
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          trackColor={{ false: colors.line, true: colors.accent }}
          thumbColor="#ffffff"
          // O Pressable acima já é o alvo acessível; evita foco duplicado no leitor de tela.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </Pressable>

      <Text style={t.body} className="text-fg-soft">
        Quando o modo simples está ligado:
      </Text>
      <View className="gap-1.5">
        <SeniorBullet text="As letras ficam maiores em todo o aplicativo." />
        <SeniorBullet text={`Os botões ficam maiores e mais fáceis de acertar (${tapTarget.senior} pontos em vez de ${tapTarget.min}).`} />
        <SeniorBullet text="Se você já aumentou a letra nos ajustes do aparelho, os dois se somam — com um limite para nada sair da tela." />
      </View>

      {/* Preview: o texto abaixo já usa o tamanho que valerá no app. */}
      <View
        accessible
        accessibilityLabel="Exemplo de como o texto vai aparecer"
        style={{ borderCurve: 'continuous' }}
        className="gap-1 rounded-2xl border border-line bg-surface-2 p-3"
      >
        <Text style={t.label} className="text-faint">
          {enabled ? 'Assim está o texto agora' : 'Assim está o texto agora (modo normal)'}
        </Text>
        <Text style={t.body} className="text-fg">
          Tomar Losartana 50 mg às 8h da manhã.
        </Text>
      </View>

      <Text style={t.caption} className="text-faint">
        Você pode ligar e desligar quando quiser. Nada do seu prontuário muda — só o
        tamanho das letras e dos botões.
      </Text>
    </Card>
  );
}

function SeniorBullet({ text }: { text: string }) {
  const colors = useColors();
  const t = useType();
  return (
    <View className="flex-row gap-2">
      <Check size={16} color={colors.ok} style={{ marginTop: 2 }} />
      <Text style={t.body} className="flex-1 text-fg-soft">
        {text}
      </Text>
    </View>
  );
}

/* ──────────────────────────── Notificações ──────────────────────────── */

function ToggleRow({
  icon: Icon,
  label,
  value,
  onChange,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  /** Selo opcional (ex.: "PLUS") exibido ao lado do rótulo p/ recursos bloqueados. */
  badge?: string;
}) {
  const colors = useColors();
  return (
    <View className="flex-row items-center gap-3 py-2.5">
      <Icon size={20} color={colors.muted} />
      <View className="flex-1 flex-row items-center gap-1.5">
        <Text className="text-[15px] text-fg">{label}</Text>
        {badge ? <Badge tone="info">{badge}</Badge> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.accent }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

/**
 * Lembretes locais (on-device) de medicação. Ao ligar, pede permissão de
 * notificação; se negada, avisa e mantém desligado. O agendamento em si acontece
 * na tela de Medicamentos (reage à lista de medicamentos ativos). Ao desligar,
 * cancela os lembretes de medicação já agendados.
 */
function DeviceRemindersRow() {
  const colors = useColors();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadRemindersPref().then(setEnabled);
  }, []);

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const ok = await ensureNotificationPermission();
        if (!ok) {
          toast.info('Ative as notificações nas configurações do aparelho para receber lembretes.');
          return;
        }
        await saveRemindersPref(true);
        setEnabled(true);
        toast.success('Lembretes de medicação ativados neste aparelho.');
      } else {
        await cancelMedicationReminders();
        await saveRemindersPref(false);
        setEnabled(false);
        toast.info('Lembretes de medicação desativados.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-row items-center gap-3 py-2.5">
      <Smartphone size={20} color={colors.muted} />
      <View className="flex-1">
        <Text className="text-[15px] text-fg">Lembretes no aparelho (medicação)</Text>
        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
          Avisa nos horários dos seus remédios, mesmo sem internet.
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={toggle}
        disabled={busy}
        trackColor={{ false: colors.line, true: colors.accent }}
        thumbColor="#ffffff"
        accessibilityLabel="Lembretes de medicação no aparelho"
      />
    </View>
  );
}

/** Horário de silêncio — grava quiet_hours_start/end (formato HH:MM). */
function QuietHoursRow({
  start,
  end,
  onChange,
}: {
  start: string | null;
  end: string | null;
  onChange: (patch: { quiet_hours_start?: string | null; quiet_hours_end?: string | null }) => void;
}) {
  const colors = useColors();
  const [from, setFrom] = useState(start ?? '');
  const [to, setTo] = useState(end ?? '');

  useEffect(() => setFrom(start ?? ''), [start]);
  useEffect(() => setTo(end ?? ''), [end]);

  function commit(which: 'start' | 'end', raw: string) {
    const v = parseTime(raw);
    if (v === undefined) {
      toast.info('Use o formato HH:MM (ex.: 22:00).');
      if (which === 'start') setFrom(start ?? '');
      else setTo(end ?? '');
      return;
    }
    if (which === 'start') onChange({ quiet_hours_start: v });
    else onChange({ quiet_hours_end: v });
  }

  return (
    <View className="gap-2 py-2.5">
      <View className="flex-row items-center gap-3">
        <MoonStar size={20} color={colors.muted} />
        <Text className="flex-1 text-[15px] text-fg">Horário de silêncio</Text>
      </View>
      <View className="flex-row items-center gap-2 pl-8">
        <TimeField value={from} onChangeText={setFrom} onEndEditing={() => commit('start', from)} />
        <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
          até
        </Text>
        <TimeField value={to} onChangeText={setTo} onEndEditing={() => commit('end', to)} />
      </View>
      <Text style={{ fontFamily: fonts.regular }} className="pl-8 text-[11px] text-faint">
        Não enviaremos notificações neste intervalo. Deixe em branco para desativar.
      </Text>
    </View>
  );
}

function TimeField({
  value,
  onChangeText,
  onEndEditing,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onEndEditing: () => void;
}) {
  const colors = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onEndEditing}
      placeholder="HH:MM"
      placeholderTextColor={colors.faint}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      style={{ fontFamily: fonts.regular, borderCurve: 'continuous' }}
      className="h-11 w-24 rounded-2xl border border-line bg-surface px-3 text-center text-[15px] text-fg"
    />
  );
}

/* ──────────────────────────── Segurança ──────────────────────────── */

/** Desbloqueio por biometria (Face ID / digital) ao abrir o app. */
function BiometricSection() {
  const colors = useColors();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [label, setLabel] = useState('Biometria');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const ok = await isBiometricSupported();
      if (!mounted) return;
      setSupported(ok);
      if (ok) {
        setLabel(await getBiometricLabel());
        setEnabled(await loadBiometricPref());
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function toggle(next: boolean) {
    if (busy) return;
    if (next) {
      setBusy(true);
      const ok = await authenticateBiometric('Confirme para ativar o desbloqueio');
      setBusy(false);
      if (!ok) {
        toast.info('Não foi possível confirmar a biometria.');
        return;
      }
      await setBiometricPref(true);
      setEnabled(true);
      toast.success(`${label} ativado para abrir o app.`);
    } else {
      await setBiometricPref(false);
      setEnabled(false);
      toast.info('Desbloqueio por biometria desativado.');
    }
  }

  if (supported === null) return null; // ainda checando — evita flash

  const isFace = label.toLowerCase().includes('face') || label.toLowerCase().includes('facial');
  const Icon = isFace ? ScanFace : Fingerprint;

  return (
    <Card>
      <View className="flex-row items-center gap-3 py-1">
        <Icon size={20} color={supported ? colors.primary : colors.faint} />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.medium }} className="text-[15px] text-fg">
            {supported ? `Desbloquear com ${label}` : 'Biometria'}
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
            {supported
              ? 'Pede a biometria ao abrir o app e ao voltar do segundo plano.'
              : 'Cadastre uma digital ou Face ID no aparelho para usar.'}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={!supported || busy}
          trackColor={{ false: colors.line, true: colors.accent }}
          thumbColor="#ffffff"
          accessibilityLabel={`Desbloquear com ${label}`}
        />
      </View>
    </Card>
  );
}

function SecuritySection({ lastSignInAt }: { lastSignInAt: string | null }) {
  const colors = useColors();
  const client = useHubPatientsClient();
  const [busy, setBusy] = useState(false);

  function confirmSignOutOthers() {
    Alert.alert(
      'Sair de outros dispositivos',
      'Você continuará conectado neste aparelho, mas todas as outras sessões serão encerradas. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair dos outros', style: 'destructive', onPress: signOutOthers },
      ],
    );
  }

  async function signOutOthers() {
    setBusy(true);
    try {
      const { error } = await client.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast.success('Você saiu dos outros dispositivos.');
    } catch {
      toast.error('Não foi possível encerrar as outras sessões. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const last = lastSignInAt ? new Date(lastSignInAt).toLocaleString('pt-BR') : '—';

  return (
    <Card className="gap-2">
      <View className="flex-row items-center gap-3 py-1">
        <Lock size={20} color={colors.muted} />
        <Text className="flex-1 text-[15px] text-fg">Sessões ativas</Text>
      </View>
      <View className="flex-row items-center gap-2 pl-8">
        <Smartphone size={15} color={colors.faint} />
        <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] text-faint">
          Este dispositivo · último acesso {last}
        </Text>
      </View>
      <View className="pl-8 pt-1">
        <Button
          label={busy ? 'Saindo…' : 'Sair de outros dispositivos'}
          variant="outline"
          size="sm"
          icon={LogOut}
          loading={busy}
          onPress={confirmSignOutOthers}
        />
      </View>
    </Card>
  );
}

/* ──────────────────────────── 2FA (TOTP) ──────────────────────────── */

/**
 * Verificação em duas etapas (TOTP) via Supabase Auth MFA — espelha a web:
 * listFactors → enroll (QR + segredo) → challenge + verify para ativar;
 * unenroll com reautenticação por senha para desativar. Sem 2FA por SMS.
 */
function TwoFactorSection() {
  const colors = useColors();
  const { user } = useAuth();
  const client = useHubPatientsClient();

  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

  // Passo de ativação (QR + código) — apresentado num AppSheet.
  const [enroll, setEnroll] = useState<{ factorId: string; uri: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const enrollSheet = useRef<AppSheetHandle>(null);

  // Passo de desativação (reautenticação por senha) — outro AppSheet.
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState('');
  const disableSheet = useRef<AppSheetHandle>(null);

  async function refresh() {
    const { data } = await client.auth.mfa.listFactors();
    setEnabled(Boolean(data?.totp?.some((factor) => factor.status === 'verified')));
    setChecking(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function logSecurity(event: 'enabled' | 'disabled') {
    // Trilha de auditoria (RPC SECURITY DEFINER — grava só para o próprio usuário).
    try {
      await client.rpc('log_self_security_event', {
        p_resource_type: 'two_factor',
        p_metadata: { event },
      });
    } catch {
      // auditoria não deve bloquear o fluxo do usuário
    }
  }

  async function startEnroll() {
    setLoading(true);
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp' });
    setLoading(false);
    if (error || !data) {
      toast.error('Não foi possível iniciar a verificação em duas etapas.');
      return;
    }
    // uri é o otpauth:// (ideal p/ o QR); qr_code é um SVG. Renderizamos o QR a
    // partir do uri com react-native-qrcode-svg e mostramos o segredo como fallback.
    setCode('');
    setEnroll({ factorId: data.id, uri: data.totp.uri, secret: data.totp.secret });
  }

  async function confirmEnroll() {
    if (!enroll) return;
    setLoading(true);
    try {
      const challenge = await client.auth.mfa.challenge({ factorId: enroll.factorId });
      if (challenge.error || !challenge.data) {
        toast.error('Falha ao gerar o desafio. Tente novamente.');
        return;
      }
      const verify = await client.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) {
        toast.error('Código inválido. Confira o app autenticador e tente de novo.');
        return;
      }
      await logSecurity('enabled');
      toast.success('Verificação em duas etapas ativada!');
      enrollSheet.current?.close();
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function confirmDisable() {
    setLoading(true);
    try {
      const email = user?.email;
      if (!email) {
        toast.error('Sessão inválida. Entre novamente.');
        return;
      }
      // Reautenticação: confirma a senha antes de remover a proteção (igual à web).
      const reauth = await client.auth.signInWithPassword({ email, password });
      if (reauth.error) {
        toast.error('Senha incorreta.');
        return;
      }
      const { data } = await client.auth.mfa.listFactors();
      const factor = data?.totp?.find((item) => item.status === 'verified');
      if (!factor) {
        setEnabled(false);
        disableSheet.current?.close();
        return;
      }
      const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
      if (error) {
        toast.error('Não foi possível remover a verificação. Tente novamente.');
        return;
      }
      await logSecurity('disabled');
      toast.success('Verificação em duas etapas desativada.');
      disableSheet.current?.close();
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-3 gap-3">
      <View className="flex-row items-center gap-3">
        <KeyRound size={20} color={colors.primary} />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
            Verificação em duas etapas
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
            Um código do app autenticador, além da senha.
          </Text>
        </View>
        {checking ? (
          <ActivityIndicator color={colors.primary} />
        ) : enabled ? (
          <Badge tone="ok">Ativo</Badge>
        ) : null}
      </View>

      {!checking ? (
        enabled ? (
          <Button
            label="Desativar"
            variant="outline"
            size="sm"
            icon={ShieldCheck}
            onPress={() => {
              setPassword('');
              setDisabling(true);
            }}
          />
        ) : (
          <Button
            label={loading ? 'Iniciando…' : 'Ativar'}
            size="sm"
            icon={ShieldCheck}
            loading={loading}
            onPress={startEnroll}
          />
        )
      ) : null}

      {/* Passo de ativação: QR + segredo + código de 6 dígitos */}
      {enroll ? (
        <AppSheet
          ref={enrollSheet}
          title="Ativar verificação em duas etapas"
          onClose={() => {
            setEnroll(null);
            setCode('');
          }}
        >
          <Text style={{ fontFamily: fonts.regular }} className="mb-3 text-[13px] text-muted">
            Escaneie o QR com seu app autenticador (Google Authenticator, Authy…) ou digite o código
            manualmente. Depois informe o código de 6 dígitos para confirmar.
          </Text>

          <View
            style={{ borderCurve: 'continuous' }}
            className="mb-3 items-center gap-2 self-center rounded-2xl border border-line bg-white p-4"
          >
            <QRCode value={enroll.uri} size={180} color="#000000" backgroundColor="#ffffff" />
          </View>

          <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-fg-soft">
            Ou digite esta chave no app:
          </Text>
          <View
            style={{ borderCurve: 'continuous' }}
            className="mb-3 mt-1 rounded-2xl border border-line bg-surface-2 px-3 py-2.5"
          >
            <Text
              selectable
              accessibilityLabel={`Chave de configuração: ${enroll.secret}`}
              style={{ fontFamily: fonts.regular }}
              className="text-center text-[14px] tracking-[2px] text-fg"
            >
              {enroll.secret}
            </Text>
          </View>

          <Text style={{ fontFamily: fonts.regular }} className="mb-3 text-[11px] text-faint">
            Guarde bem o acesso ao app autenticador — ele é necessário para entrar. Não há recuperação
            por SMS.
          </Text>

          <Input
            label="Código de 6 dígitos"
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (code.trim().length === 6 && !loading) void confirmEnroll();
            }}
          />
          <View className="mt-3">
            <Button
              label={loading ? 'Confirmando…' : 'Confirmar e ativar'}
              icon={ShieldCheck}
              loading={loading}
              disabled={code.trim().length !== 6}
              onPress={confirmEnroll}
            />
          </View>
        </AppSheet>
      ) : null}

      {/* Passo de desativação: reautenticação por senha */}
      {disabling ? (
        <AppSheet
          ref={disableSheet}
          title="Desativar verificação em duas etapas"
          onClose={() => {
            setDisabling(false);
            setPassword('');
          }}
        >
          <Text style={{ fontFamily: fonts.regular }} className="mb-3 text-[13px] text-muted">
            Para sua segurança, confirme sua senha para remover a verificação em duas etapas.
          </Text>
          <Input
            label="Sua senha"
            value={password}
            onChangeText={setPassword}
            placeholder="Digite sua senha"
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (password.length > 0 && !loading) void confirmDisable();
            }}
          />
          <View className="mt-3">
            <Button
              label={loading ? 'Removendo…' : 'Remover proteção'}
              variant="outline"
              icon={ShieldCheck}
              loading={loading}
              disabled={password.length === 0}
              onPress={confirmDisable}
            />
          </View>
        </AppSheet>
      ) : null}
    </Card>
  );
}

/* ──────────────────────────── Calendário externo ──────────────────────────── */

function CalendarSyncSection({ userId }: { userId: string }) {
  const colors = useColors();
  const { data: sub, isLoading } = useCalendarSubscription(userId || undefined, SUPABASE_URL);
  const setSync = useSetCalendarSync(userId);
  const rotate = useRotateCalendarToken(userId);
  const [howToOpen, setHowToOpen] = useState(false);

  const enabled = sub?.enabled ?? false;

  function shareUrl() {
    if (!sub?.feedUrl) return;
    void Share.share({ message: sub.feedUrl });
  }

  function onRotate() {
    Alert.alert(
      'Gerar nova URL',
      'A URL anterior deixa de funcionar. Os calendários já adicionados param de atualizar até você adicionar a nova URL. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Gerar nova',
          style: 'destructive',
          onPress: () => {
            rotate.mutate(undefined, {
              onError: () =>
                toast.error('Não foi possível gerar uma nova URL. Tente novamente.'),
            });
          },
        },
      ],
    );
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <CalendarClock size={20} color={colors.primary} />
        <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[15px] text-fg">
          Sincronizar consultas
        </Text>
        <Switch
          value={enabled}
          onValueChange={(v) => setSync.mutate(v)}
          trackColor={{ false: colors.line, true: colors.accent }}
          thumbColor="#ffffff"
        />
      </View>
      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
        Veja suas consultas no Google Calendar, Apple Calendar ou Outlook — atualiza sozinho.
      </Text>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {enabled && sub?.feedUrl ? (
        <View className="gap-3">
          <View
            style={{ borderCurve: 'continuous' }}
            className="flex-row items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3"
          >
            <ShieldAlert size={16} color={colors.attention} style={{ marginTop: 1 }} />
            <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] text-fg-soft">
              Esta URL dá acesso ao seu calendário de consultas. Compartilhe apenas com seus próprios
              dispositivos. Os eventos contêm só a logística (médico, horário, local) — nunca diagnósticos.
            </Text>
          </View>

          <View
            style={{ borderCurve: 'continuous' }}
            className="rounded-2xl border border-line bg-surface-2 p-3"
          >
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.regular }}
              className="text-[12px] text-muted"
            >
              {sub.feedUrl}
            </Text>
          </View>

          {/* Acordeão: passos por plataforma (Google / Apple / Outlook) */}
          <View style={{ borderCurve: 'continuous' }} className="rounded-2xl border border-line">
            <Pressable
              onPress={() => setHowToOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: howToOpen }}
              className="flex-row items-center gap-2 px-3 py-3 active:opacity-70"
            >
              <Text style={{ fontFamily: fonts.medium }} className="flex-1 text-[13px] text-fg-soft">
                Como adicionar no Google / Apple / Outlook
              </Text>
              <ChevronDown
                size={18}
                color={colors.muted}
                style={{ transform: [{ rotate: howToOpen ? '180deg' : '0deg' }] }}
              />
            </Pressable>
            {howToOpen ? (
              <View className="gap-3 border-t border-line p-3">
                {CALENDAR_INSTRUCTIONS.map((g) => (
                  <View key={g.platform} className="gap-1">
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-fg">
                      {g.platform}
                    </Text>
                    {g.steps.map((s, i) => (
                      <View key={i} className="flex-row gap-1.5">
                        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                          {i + 1}.
                        </Text>
                        <Text
                          style={{ fontFamily: fonts.regular }}
                          className="flex-1 text-[12px] text-muted"
                        >
                          {s}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Compartilhar URL" variant="outline" size="sm" icon={Share2} onPress={shareUrl} />
            </View>
            <View className="flex-1">
              <Button
                label={rotate.isPending ? 'Gerando…' : 'Gerar nova URL'}
                variant="ghost"
                size="sm"
                icon={RefreshCw}
                loading={rotate.isPending}
                onPress={onRotate}
              />
            </View>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/* ──────────────────────────── Privacidade do ciclo ──────────────────────────── */

function CyclePrivacySection({ userId }: { userId: string }) {
  const colors = useColors();
  const { data: settings, isLoading } = useCycleSettings(userId || undefined);
  const update = useUpdateCycleSettings(userId);
  const deleteHistory = useDeleteCycleHistory(userId);

  const trackingEnabled = settings?.tracking_enabled ?? true;
  const shareWithCaregiver = settings?.share_with_caregiver ?? false;
  const shareWithDoctor = settings?.share_with_doctor ?? false;
  const shareWithResearch = settings?.share_with_research ?? false;
  const averageCycleDays = settings?.average_cycle_days ?? 28;

  const [cycleDaysInput, setCycleDaysInput] = useState(String(averageCycleDays));
  useEffect(() => setCycleDaysInput(String(averageCycleDays)), [averageCycleDays]);

  function patch(p: Parameters<typeof update.mutate>[0]) {
    update.mutate(p, { onError: () => toast.error('Não foi possível salvar a preferência.') });
  }

  function commitCycleDays() {
    const n = Number(cycleDaysInput);
    if (!Number.isInteger(n) || n < 15 || n > 60) {
      toast.error('Informe um ciclo médio entre 15 e 60 dias.');
      setCycleDaysInput(String(averageCycleDays));
      return;
    }
    if (n === averageCycleDays) return;
    patch({ averageCycleDays: n });
  }

  function confirmDelete() {
    Alert.alert(
      'Apagar histórico do ciclo',
      'Apagar TODO o histórico do ciclo? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar tudo',
          style: 'destructive',
          onPress: () => {
            deleteHistory.mutate(undefined, {
              onSuccess: () => toast.success('Histórico do ciclo apagado.'),
              onError: () => toast.error('Não foi possível apagar o histórico.'),
            });
          },
        },
      ],
    );
  }

  if (isLoading) {
    return <Card><ActivityIndicator color={colors.primary} /></Card>;
  }

  return (
    <Card className="gap-1">
      <View className="flex-row items-center gap-3 pb-1">
        <Flower2 size={20} color={colors.primary} />
        <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] text-muted">
          Os dados do ciclo são privados. Os compartilhamentos abaixo são opcionais (opt-in) e podem ser
          desativados a qualquer momento.
        </Text>
      </View>

      <CycleToggleRow
        title="Ativar acompanhamento"
        subtitle="Habilita o registro do ciclo e as estimativas de fase no app."
        value={trackingEnabled}
        disabled={update.isPending}
        onChange={() => patch({ trackingEnabled: !trackingEnabled })}
      />
      <Divider />
      <CycleToggleRow
        title="Compartilhar com cuidador"
        subtitle="Permite que cuidadores autorizados vejam o resumo do seu ciclo."
        value={shareWithCaregiver}
        disabled={update.isPending}
        onChange={() => patch({ shareWithCaregiver: !shareWithCaregiver })}
      />
      <Divider />
      <CycleToggleRow
        title="Compartilhar com médico"
        subtitle="Inclui o resumo do ciclo no que é exibido ao seu médico."
        value={shareWithDoctor}
        disabled={update.isPending}
        onChange={() => patch({ shareWithDoctor: !shareWithDoctor })}
      />
      <Divider />
      <CycleToggleRow
        title="Compartilhar para pesquisa"
        subtitle="Contribui com dados anonimizados para fins de pesquisa."
        value={shareWithResearch}
        disabled={update.isPending}
        onChange={() => patch({ shareWithResearch: !shareWithResearch })}
      />
      <Divider />

      <View className="flex-row items-center gap-3 py-2.5">
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
            Ciclo médio (dias)
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
            Usado nas estimativas quando ainda não há histórico suficiente.
          </Text>
        </View>
        <TextInput
          value={cycleDaysInput}
          onChangeText={setCycleDaysInput}
          onEndEditing={commitCycleDays}
          editable={!update.isPending}
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel="Ciclo médio em dias"
          placeholder="28"
          placeholderTextColor={colors.faint}
          style={{ fontFamily: fonts.regular, borderCurve: 'continuous' }}
          className="h-11 w-20 rounded-2xl border border-line bg-surface px-3 text-center text-[15px] text-fg"
        />
      </View>

      <View className="pt-3">
        <Button
          label={deleteHistory.isPending ? 'Apagando…' : 'Apagar todo o histórico do ciclo'}
          variant="outline"
          size="sm"
          icon={Trash2}
          loading={deleteHistory.isPending}
          onPress={confirmDelete}
        />
      </View>
    </Card>
  );
}

function CycleToggleRow({
  title,
  subtitle,
  value,
  disabled,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  const colors = useColors();
  return (
    <View className="flex-row items-center gap-3 py-2.5">
      <View className="flex-1">
        <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
          {title}
        </Text>
        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.line, true: colors.accent }}
        thumbColor="#ffffff"
      />
    </View>
  );
}
