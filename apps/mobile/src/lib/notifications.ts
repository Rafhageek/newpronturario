import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { Medication, Appointment } from '@hubpatients/core';
import { recordDoseEvents } from '@hubpatients/supabase';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * Lembretes LOCAIS (on-device) de medicação e consulta — sem push/servidor.
 * Tudo agendado pelo próprio aparelho via expo-notifications (SDK 53). Não há
 * envio de PHI para fora: o nome do remédio fica só no aparelho, na notificação.
 *
 * Triggers (API real do SDK 53):
 * - Medicação: SchedulableTriggerInputTypes.DAILY ({ hour, minute }) — repete
 *   todo dia naquele horário (o tipo DAILY já é repetitivo por natureza).
 * - Consulta: SchedulableTriggerInputTypes.DATE ({ date }) — dispara uma vez na
 *   data/hora calculada (X minutos antes da consulta).
 *
 * Identificadores: cada lembrete recebe um id com prefixo para permitir cancelar
 * só os de medicação (MED_PREFIX) ou só os de consulta sem mexer nos outros.
 *
 * Ações na notificação (categoria `med-dose`): "Tomei", "Adiar 15 min" e
 * "Pulei" resolvem a dose sem abrir o app. Tudo JS puro — `expo-notifications`
 * já está no binário 0.2.0, então isto entrega por OTA (sem APK novo).
 * O que é gravado é AUTORRELATO: a pessoa confirma, o app registra. Nunca
 * prescreve nem muda horário sozinho — "Adiar" só reagenda AQUELE lembrete.
 */

const ANDROID_CHANNEL_ID = 'reminders';
const MED_PREFIX = 'med-reminder:';
const APPT_PREFIX = 'appt-reminder:';
const SNOOZE_PREFIX = 'med-snooze:';
const PREF_KEY = 'hubpatients.reminders';

/** Categoria com os botões de ação da dose. */
const DOSE_CATEGORY = 'med-dose';
const ACTION_TAKEN = 'dose-taken';
const ACTION_SNOOZE = 'dose-snooze';
const ACTION_SKIP = 'dose-skip';

/** Quanto tempo o "Adiar" empurra o lembrete. */
export const SNOOZE_MINUTES = 15;

/** Fila local de eventos que não conseguiram subir (offline / sessão expirada). */
const DOSE_QUEUE_KEY = 'hubpatients.doseQueue';
/**
 * O SecureStore do Android trava em ~2 KB por valor. Cada item vira uma tupla
 * compacta (~85 bytes), então 12 cabe com folga. Estourando, o mais antigo cai.
 */
const DOSE_QUEUE_MAX = 12;

type DoseStatus = 'taken' | 'snoozed' | 'skipped';
type DoseSource = 'notification' | 'app';
/** [medicationId, scheduledForISO, status, source] — só uuid e horário, sem nome de remédio. */
type QueuedDose = [string, string, DoseStatus, DoseSource];

/** Quiet hours opcionais (HH:MM). Horários de medicação dentro do intervalo são pulados. */
export type QuietHours = {
  quietStart?: string | null;
  quietEnd?: string | null;
};

let handlerConfigured = false;

/**
 * Configura o handler (banner em foreground) e o canal Android. Idempotente —
 * pode ser chamado mais de uma vez sem efeito colateral. O orquestrador chama
 * isto no boot; as funções de agendamento também garantem (defensivo).
 */
export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // SDK 53: shouldShowAlert foi dividido em banner + list.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Lembretes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      // LGPD: na tela de bloqueio o Android oculta o conteúdo (nome do remédio /
      // médico) e mostra só "conteúdo oculto"; ao desbloquear, o texto completo
      // aparece. Protege PHI sem perder a utilidade do lembrete.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }).catch((e) => logger.warn('Falha ao criar canal de notificações', { error: String(e) }));
  }

  void registerDoseCategory();
  registerDoseResponseListener();
  recoverLastDoseResponse();
  void flushDoseQueue();
}

/**
 * Garante a permissão de notificação. Retorna true se concedida. Não relança —
 * em erro retorna false para o chamador decidir a UX (toast etc.).
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  } catch (e) {
    logger.warn('Falha ao checar permissão de notificação', { error: String(e) });
    return false;
  }
}

/* ─────────────────── Ações na notificação (categoria med-dose) ─────────────────── */

let doseCategoryRegistered = false;
// ReturnType em vez de importar EventSubscription: o tipo vem de
// expo-modules-core e não é reexportado no namespace do expo-notifications.
let doseListenerSub: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null =
  null;

/**
 * Registra os três botões da notificação de dose. Idempotente.
 *
 * `opensAppToForeground: false` é o ponto da feature: a pessoa resolve a dose
 * da tela de bloqueio, sem abrir o app. Os títulos dos botões são genéricos —
 * NÃO carregam o nome do remédio, então nada de PHI vaza pelo botão.
 */
async function registerDoseCategory(): Promise<void> {
  if (doseCategoryRegistered) return;
  doseCategoryRegistered = true;
  try {
    await Notifications.setNotificationCategoryAsync(DOSE_CATEGORY, [
      { identifier: ACTION_TAKEN, buttonTitle: 'Tomei', options: { opensAppToForeground: false } },
      {
        identifier: ACTION_SNOOZE,
        buttonTitle: `Adiar ${SNOOZE_MINUTES} min`,
        options: { opensAppToForeground: false },
      },
      { identifier: ACTION_SKIP, buttonTitle: 'Pulei', options: { opensAppToForeground: false } },
    ]);
  } catch (e) {
    doseCategoryRegistered = false; // deixa tentar de novo no próximo boot
    logger.warn('Falha ao registrar ações da notificação de dose', { error: String(e) });
  }
}

/** Assina o listener de resposta às ações. Idempotente. */
function registerDoseResponseListener(): void {
  if (doseListenerSub) return;
  try {
    doseListenerSub = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleDoseResponse(response);
    });
  } catch (e) {
    logger.warn('Falha ao assinar respostas de notificação', { error: String(e) });
  }
}

/** Remove o listener (usado só em teardown/Fast Refresh). */
export function unregisterDoseResponseListener(): void {
  doseListenerSub?.remove();
  doseListenerSub = null;
}

/**
 * Rede de segurança: com `opensAppToForeground: false` e o app MORTO (não só em
 * background), o expo-notifications avisa que o listener pode não disparar. No
 * boot lemos a última resposta guardada pelo sistema e a processamos.
 *
 * Reprocessar o mesmo evento é inofensivo: o upsert no servidor é idempotente
 * pela chave (user_id, medication_id, scheduled_for) e o reagendamento do
 * "Adiar" usa identificador determinístico (substitui, não empilha).
 */
function recoverLastDoseResponse(): void {
  try {
    const last = Notifications.getLastNotificationResponse();
    if (last) void handleDoseResponse(last);
  } catch (e) {
    logger.warn('Falha ao recuperar última resposta de notificação', { error: String(e) });
  }
}

/** iOS entrega o instante em segundos; Android em milissegundos. Normaliza. */
function normalizeTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value < 1e12 ? value * 1000 : value;
}

/**
 * Horário PREVISTO da dose (não o do clique). É metade da chave idempotente,
 * então precisa ser estável: duas respostas para a mesma dose têm que gerar o
 * mesmo instante.
 *
 * Ordem: `data.scheduledFor` explícito (usado no reagendamento do "Adiar", que
 * preserva o horário original) → hora/minuto do lembrete aplicados ao dia da
 * entrega → instante da entrega, como último recurso.
 */
function doseScheduledFor(response: Notifications.NotificationResponse): string {
  const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;

  const explicit = data.scheduledFor;
  if (typeof explicit === 'string' && !Number.isNaN(new Date(explicit).getTime())) return explicit;

  const delivered = normalizeTimestamp(response.notification.date);
  const base = delivered != null ? new Date(delivered) : new Date();

  const hour = typeof data.hour === 'number' ? data.hour : null;
  const minute = typeof data.minute === 'number' ? data.minute : null;
  if (hour == null || minute == null) {
    base.setSeconds(0, 0);
    return base.toISOString();
  }

  const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0, 0);
  // Resposta dada depois da meia-noite para a dose do fim da noite anterior:
  // se o horário previsto cai muito à frente da entrega, é do dia anterior.
  if (at.getTime() - base.getTime() > 12 * 3_600_000) at.setDate(at.getDate() - 1);
  return at.toISOString();
}

/** Ação do botão -> status gravado. null = toque no corpo (só abre o app). */
function statusForAction(actionIdentifier: string): DoseStatus | null {
  if (actionIdentifier === ACTION_TAKEN) return 'taken';
  if (actionIdentifier === ACTION_SNOOZE) return 'snoozed';
  if (actionIdentifier === ACTION_SKIP) return 'skipped';
  return null;
}

/**
 * Trata o toque num botão da notificação de dose. Nunca lança — uma falha aqui
 * não pode derrubar o app, que pode estar sendo acordado em background.
 */
async function handleDoseResponse(response: Notifications.NotificationResponse): Promise<void> {
  try {
    const content = response.notification.request.content;
    const data = (content.data ?? {}) as Record<string, unknown>;
    if (data.kind !== 'medication') return;

    const medicationId = typeof data.medicationId === 'string' ? data.medicationId : null;
    if (!medicationId) return;

    const status = statusForAction(response.actionIdentifier);
    if (!status) return; // toque no corpo: só abre o app, não registra nada

    const scheduledFor = doseScheduledFor(response);

    if (status === 'snoozed') await snoozeDoseReminder(response, scheduledFor);

    await saveDoseEvent([medicationId, scheduledFor, status, 'notification']);
  } catch (e) {
    logger.warn('Falha ao tratar ação da notificação de dose', { error: String(e) });
  }
}

/**
 * "Adiar": reagenda AQUELE lembrete para daqui a 15 minutos, reaproveitando o
 * MESMO título/corpo e o MESMO canal — a máscara de tela de bloqueio (canal
 * `reminders`, visibilidade PRIVATE) continua valendo, sem vazar o nome do
 * remédio. `scheduledFor` viaja junto para a nova notificação continuar
 * apontando para a dose original (chave idempotente estável).
 */
async function snoozeDoseReminder(
  response: Notifications.NotificationResponse,
  scheduledFor: string,
): Promise<void> {
  const content = response.notification.request.content;
  const data = (content.data ?? {}) as Record<string, unknown>;
  const medicationId = typeof data.medicationId === 'string' ? data.medicationId : '';

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${SNOOZE_PREFIX}${medicationId}:${scheduledFor}`,
      content: {
        title: content.title ?? 'Hora do remédio',
        body: content.body ?? 'Hora do remédio',
        categoryIdentifier: DOSE_CATEGORY,
        data: { ...data, scheduledFor, snoozed: true },
        ...(Platform.OS === 'android' ? { priority: 'high' } : null),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + SNOOZE_MINUTES * 60_000),
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : null),
      },
    });
  } catch (e) {
    logger.warn('Falha ao adiar lembrete de dose', { error: String(e) });
  }
}

/* ─────────────────── Gravação (com fila local se offline) ─────────────────── */

const DOSE_STATUSES: readonly string[] = ['taken', 'snoozed', 'skipped'];
const DOSE_SOURCES: readonly string[] = ['notification', 'app'];

/**
 * Valida item por item. Uma linha inválida na fila faria o servidor recusar o
 * lote INTEIRO (check constraint), travando a fila para sempre — melhor
 * descartar o item corrompido do que nunca mais registrar dose nenhuma.
 */
function isQueuedDose(item: unknown): item is QueuedDose {
  if (!Array.isArray(item) || item.length !== 4) return false;
  const [medicationId, scheduledFor, status, source] = item as unknown[];
  return (
    typeof medicationId === 'string' &&
    medicationId.length > 0 &&
    typeof scheduledFor === 'string' &&
    !Number.isNaN(new Date(scheduledFor).getTime()) &&
    typeof status === 'string' &&
    DOSE_STATUSES.includes(status) &&
    typeof source === 'string' &&
    DOSE_SOURCES.includes(source)
  );
}

/** Lê a fila local. Nunca lança: fila corrompida vira fila vazia. */
async function readDoseQueue(): Promise<QueuedDose[]> {
  try {
    const raw = await SecureStore.getItemAsync(DOSE_QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedDose);
  } catch {
    return [];
  }
}

async function writeDoseQueue(queue: readonly QueuedDose[]): Promise<void> {
  try {
    if (queue.length === 0) {
      await SecureStore.deleteItemAsync(DOSE_QUEUE_KEY);
      return;
    }
    // Estourou o limite? Descarta o mais ANTIGO — a dose de hoje importa mais.
    const trimmed = queue.slice(-DOSE_QUEUE_MAX);
    await SecureStore.setItemAsync(DOSE_QUEUE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    logger.warn('Falha ao salvar fila de doses', { error: String(e) });
  }
}

/**
 * Tenta gravar o evento no Supabase; se falhar (offline, sessão expirada),
 * guarda na fila local e tenta de novo no próximo evento ou no `flushDoseQueue`.
 * O upsert do lado do servidor é idempotente pela chave
 * (user_id, medication_id, scheduled_for) — reenviar não duplica a dose.
 */
async function saveDoseEvent(dose: QueuedDose): Promise<void> {
  const pending = await readDoseQueue();
  const queue = [...pending, dose];

  const userId = await currentUserId();
  if (!userId) {
    await writeDoseQueue(queue);
    return;
  }

  try {
    await recordDoseEvents(
      supabase,
      userId,
      queue.map(([medication_id, scheduled_for, status, source]) => ({
        medication_id,
        scheduled_for,
        status,
        source,
      })),
    );
    await writeDoseQueue([]);
  } catch (e) {
    await writeDoseQueue(queue);
    logger.warn('Evento de dose ficou na fila local', { error: String(e) });
  }
}

/** ID do usuário logado a partir da sessão local (funciona offline). */
async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Sobe os eventos que ficaram pendentes. Seguro chamar a qualquer momento
 * (ex.: ao abrir a tela de medicamentos ou quando a rede volta).
 */
export async function flushDoseQueue(): Promise<void> {
  const queue = await readDoseQueue();
  if (queue.length === 0) return;

  const userId = await currentUserId();
  if (!userId) return;

  try {
    await recordDoseEvents(
      supabase,
      userId,
      queue.map(([medication_id, scheduled_for, status, source]) => ({
        medication_id,
        scheduled_for,
        status,
        source,
      })),
    );
    await writeDoseQueue([]);
  } catch (e) {
    logger.warn('Fila de doses continua pendente', { error: String(e) });
  }
}

/** Cancela os lembretes adiados pendentes (não mexe nos lembretes diários). */
export async function cancelDoseSnoozes(): Promise<void> {
  await cancelByPrefix(SNOOZE_PREFIX);
}

/** "HH:MM" -> { hour, minute } válido, ou null se malformado. */
function parseHHMM(time: string): { hour: number; minute: number } | null {
  const hhmm = time.slice(0, 5);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * true se `minutes` (minutos desde a meia-noite) cai dentro do quiet hours.
 * Suporta intervalo que cruza a meia-noite (ex.: 22:00 → 07:00). Se start === end,
 * considera intervalo vazio (não silencia nada) para evitar bloquear o dia todo.
 */
function isWithinQuietHours(minutes: number, quiet: QuietHours): boolean {
  const start = quiet.quietStart ? parseHHMM(quiet.quietStart) : null;
  const end = quiet.quietEnd ? parseHHMM(quiet.quietEnd) : null;
  if (!start || !end) return false;
  const startM = start.hour * 60 + start.minute;
  const endM = end.hour * 60 + end.minute;
  if (startM === endM) return false;
  if (startM < endM) return minutes >= startM && minutes < endM; // mesmo dia
  return minutes >= startM || minutes < endM; // cruza a meia-noite
}

/**
 * Reagenda TODOS os lembretes de medicação: cancela os anteriores e cria, para
 * cada med ativo com horários, uma notificação diária por horário. Horários
 * dentro do quiet hours são pulados. Falhas individuais não derrubam o lote.
 */
export async function scheduleMedicationReminders(
  meds: Medication[],
  opts?: QuietHours,
): Promise<void> {
  configureNotificationHandler();
  await cancelMedicationReminders();

  const quiet: QuietHours = opts ?? {};

  for (const med of meds) {
    if (!med.active || med.times.length === 0) continue;
    const dose = med.dosage ? ` (${med.dosage}${med.unit ?? ''})` : '';

    for (const time of med.times) {
      const parsed = parseHHMM(time);
      if (!parsed) continue;
      if (isWithinQuietHours(parsed.hour * 60 + parsed.minute, quiet)) continue;

      // Id determinístico por med+horário: identifica e permite cancelar só estes.
      const identifier = `${MED_PREFIX}${med.id}:${parsed.hour}-${parsed.minute}`;
      try {
        await Notifications.scheduleNotificationAsync({
          identifier,
          content: {
            title: 'Hora do remédio',
            body: `Hora do remédio: ${med.name}${dose}`,
            // Botões "Tomei" / "Adiar 15 min" / "Pulei". O corpo com o nome do
            // remédio segue mascarado na tela de bloqueio pelo canal `reminders`
            // (visibilidade PRIVATE) — as ações não mudam isso.
            categoryIdentifier: DOSE_CATEGORY,
            // hour/minute reconstroem o horário PREVISTO da dose na resposta,
            // já que o trigger DAILY se repete e não carrega a data.
            data: {
              kind: 'medication',
              medicationId: med.id,
              hour: parsed.hour,
              minute: parsed.minute,
            },
            ...(Platform.OS === 'android' ? { priority: 'high' } : null),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: parsed.hour,
            minute: parsed.minute,
            ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : null),
          },
        });
      } catch (e) {
        logger.warn('Falha ao agendar lembrete de medicação', {
          medicationId: med.id,
          error: String(e),
        });
      }
    }
  }
}

/**
 * Agenda os lembretes de UMA consulta: para cada `reminders` (minutos antes),
 * uma notificação na data/hora correspondente. Só agenda instantes futuros.
 */
export async function scheduleAppointmentReminders(appointment: Appointment): Promise<void> {
  configureNotificationHandler();

  const start = new Date(appointment.scheduled_at).getTime();
  if (Number.isNaN(start)) return;
  const now = Date.now();
  const when = new Date(appointment.scheduled_at).toLocaleString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  for (const minutesBefore of appointment.reminders) {
    const fireAt = start - minutesBefore * 60_000;
    if (fireAt <= now) continue; // já passou — não agenda

    const identifier = `${APPT_PREFIX}${appointment.id}:${minutesBefore}`;
    const body =
      minutesBefore >= 1440
        ? `Consulta com ${appointment.doctor_name} amanhã às ${when}.`
        : `Consulta com ${appointment.doctor_name} às ${when}.`;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: 'Lembrete de consulta',
          body,
          data: { kind: 'appointment', appointmentId: appointment.id },
          ...(Platform.OS === 'android' ? { priority: 'high' } : null),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(fireAt),
          ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : null),
        },
      });
    } catch (e) {
      logger.warn('Falha ao agendar lembrete de consulta', {
        appointmentId: appointment.id,
        error: String(e),
      });
    }
  }
}

/** Cancela só os lembretes de medicação (pelo prefixo do identificador). */
export async function cancelMedicationReminders(): Promise<void> {
  await cancelByPrefix(MED_PREFIX);
}

/** Cancela TODOS os lembretes locais agendados (medicação + consulta). */
export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    logger.warn('Falha ao cancelar todos os lembretes', { error: String(e) });
  }
}

async function cancelByPrefix(prefix: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(prefix))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch (e) {
    logger.warn('Falha ao cancelar lembretes por prefixo', { prefix, error: String(e) });
  }
}

/** Lê a preferência de lembretes no aparelho (default: desligado). */
export async function loadRemindersPref(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PREF_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Persiste a preferência de lembretes no aparelho. */
export async function saveRemindersPref(on: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREF_KEY, on ? '1' : '0');
  } catch (e) {
    logger.warn('Falha ao salvar preferência de lembretes', { error: String(e) });
  }
}
