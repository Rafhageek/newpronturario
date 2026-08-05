'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Bell,
  BellOff,
  CalendarDays,
  Check,
  CheckCheck,
  FlaskConical,
  Languages,
  LogOut,
  Monitor,
  Moon,
  NotebookPen,
  Pill,
  Ruler,
  Settings,
  Sun,
  Trophy,
  User as UserIcon,
  Users,
} from 'lucide-react';
import {
  LOCALES,
  notificationCategory,
  tempoRelativo,
  type LocaleCode,
} from '@hubpatients/core';
import type { NotificationQueueItem } from '@hubpatients/core';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useUserSettings,
  useUpdateSettings,
} from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { IconMenu } from '@/components/ui/icon-menu';
import { IconChip, type ChipTone } from '@/components/ui/painel';

/**
 * Tempo relativo em PT-BR.
 *
 * Era `new Intl.RelativeTimeFormat('pt-BR')` aqui mesmo. Funciona na web e é
 * uma bomba armada: no dia em que o sino for para o mobile, `RelativeTimeFormat`
 * derruba o app no Hermes — já aconteceu neste projeto, com essa API exata.
 * Agora sai de `@hubpatients/core`, na mesma implementação que o mobile usa, e
 * a redação passa a ser uma só nas duas plataformas.
 */
const timeAgo = tempoRelativo;

// ════════════════════════════════ TEMA ═══════════════════════════════════════
const THEME_OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const;

export function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Antes de montar não sabemos o tema (evita mismatch de hidratação).
  const TriggerIcon = !mounted ? Sun : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <IconMenu
      label="Tema"
      width="w-48"
      icon={<TriggerIcon className="h-[18px] w-[18px]" />}
    >
      {(close) => (
        <div className="p-1.5">
          <p className="px-2.5 py-1.5 text-caption font-semibold uppercase tracking-wider text-faint">
            Aparência
          </p>
          {THEME_OPTIONS.map((opt) => {
            const active = (theme ?? 'system') === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(opt.value);
                  close();
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-body-sm transition ${
                  active ? 'bg-nav-active-tint text-nav-active-ink' : 'text-fg-soft hover:bg-surface-2'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{opt.label}</span>
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </IconMenu>
  );
}

// ════════════════════════════════ IDIOMA ═════════════════════════════════════
function setLocaleCookie(code: LocaleCode) {
  document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000; SameSite=Lax`;
}

export function LanguageMenu() {
  const { user } = useAuth();
  const { data: settings } = useUserSettings(user?.id);
  const updateSettings = useUpdateSettings(user?.id ?? '');
  const current = (settings?.locale as LocaleCode | undefined) ?? 'pt-BR';

  return (
    <IconMenu
      label="Idioma"
      width="w-56"
      icon={<Languages className="h-[18px] w-[18px]" />}
    >
      {(close) => (
        <div className="p-1.5">
          <p className="px-2.5 py-1.5 text-caption font-semibold uppercase tracking-wider text-faint">
            Idioma
          </p>
          {LOCALES.map((loc) => {
            const active = current === loc.code;
            return (
              <button
                key={loc.code}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLocaleCookie(loc.code);
                  if (user?.id) updateSettings.mutate({ locale: loc.code });
                  close();
                  if (loc.code === 'pt-BR') {
                    toast.success('Idioma definido para Português (Brasil)');
                  } else {
                    toast.info(`${loc.label} selecionado`, {
                      description: 'A tradução completa da interface chega em breve.',
                    });
                  }
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-body-sm transition ${
                  active ? 'bg-nav-active-tint text-nav-active-ink' : 'text-fg-soft hover:bg-surface-2'
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {loc.flag}
                </span>
                <span className="flex-1 text-left">{loc.label}</span>
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </IconMenu>
  );
}

// ════════════════════════════ NOTIFICAÇÕES ═══════════════════════════════════
/**
 * Ícone e tom de CATEGORIA por tipo de notificação.
 *
 * O âmbar que estava em `medication` e o verde de `milestone`/`growth` faziam o
 * aviso nascer com gravidade escolhida pela categoria: um lembrete de remédio de
 * rotina chegava pintado igual a um alerta, e "cresceu 2 cm" chegava com o verde
 * de aprovação sobre o corpo de uma criança. Os tons pastel da fundação dizem
 * apenas de que ASSUNTO é o aviso — urgência, quando existir, vai no texto, que
 * é o canal que sobrevive ao daltonismo e à impressão.
 */
const CATEGORY_VISUAL = {
  diary: { Icon: NotebookPen, tone: 'azul' },
  medication: { Icon: Pill, tone: 'indigo' },
  exam: { Icon: FlaskConical, tone: 'violeta' },
  appointment: { Icon: CalendarDays, tone: 'turquesa' },
  milestone: { Icon: Trophy, tone: 'ameixa' },
  growth: { Icon: Ruler, tone: 'turquesa' },
  community: { Icon: Users, tone: 'ardosia' },
  system: { Icon: Bell, tone: 'azul' },
} as const satisfies Record<string, { Icon: LucideIcon; tone: ChipTone }>;

function notifVisual(type: string) {
  return CATEGORY_VISUAL[notificationCategory(type)];
}

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationQueueItem;
  onRead: (id: string) => void;
}) {
  const unread = !item.read_at;
  const { Icon, tone } = notifVisual(item.type);
  return (
    <li className={`relative ${unread ? 'bg-surface-2' : ''}`}>
      {unread && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
      <button
        onClick={() => unread && onRead(item.id)}
        className="flex min-h-11 w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-3"
      >
        <IconChip icon={Icon} tone={tone} size="sm" className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate text-body-sm ${unread ? 'font-semibold text-fg' : 'text-fg-soft'}`}>
              {item.title}
            </span>
            {/* "Não lida" precisa ser PALAVRA, não só um ponto colorido. */}
            {unread && (
              <>
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <span className="sr-only">Não lida</span>
              </>
            )}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-caption text-muted">{item.body}</span>
          <span className="mt-1 block text-caption text-faint">{timeAgo(item.created_at)}</span>
        </span>
      </button>
    </li>
  );
}

export function NotificationsMenu() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: items = [], isLoading } = useNotifications(user?.id);
  const markRead = useMarkNotificationRead(user?.id ?? '');
  const markAll = useMarkAllNotificationsRead(user?.id ?? '');
  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <IconMenu
      label="Notificações"
      width="w-[22rem]"
      badge={unreadCount}
      icon={<Bell className="h-[18px] w-[18px]" />}
    >
      {(close) => (
        <div className="flex max-h-[28rem] flex-col">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
            <p className="text-body-sm font-semibold text-fg">Notificações</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 text-caption font-medium text-primary transition hover:underline disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-surface-2" />
                    <div className="flex-1 space-y-2 py-0.5">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
                      <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
                  <BellOff className="h-6 w-6 text-faint" />
                </span>
                <p className="text-body-sm font-medium text-fg-soft">Tudo em dia</p>
                <p className="max-w-[15rem] text-caption text-muted">
                  Você não tem notificações novas. Avisamos aqui sobre estoque baixo, lembretes e mais.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line/60">
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} onRead={(id) => markRead.mutate(id)} />
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line p-1.5">
            <button
              onClick={() => {
                close();
                router.push('/medicamentos');
              }}
              className="w-full rounded-xl px-3 py-2 text-center text-body-sm font-medium text-fg-soft transition hover:bg-surface-2"
            >
              Ver medicamentos
            </button>
          </div>
        </div>
      )}
    </IconMenu>
  );
}

// ════════════════════════════════ AVATAR ═════════════════════════════════════
export function UserMenu({
  initial,
  name,
  email,
  onSignOut,
}: {
  initial: string;
  name: string;
  email?: string;
  onSignOut: () => void;
}) {
  const router = useRouter();
  return (
    <IconMenu
      label="Conta"
      align="end"
      width="w-60"
      icon={
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-body-sm font-bold text-white">
          {initial}
        </span>
      }
    >
      {(close) => (
        <div>
          <div className="border-b border-line px-3.5 py-3">
            <p className="truncate text-body-sm font-semibold text-fg">{name}</p>
            {email && <p className="truncate text-caption text-muted">{email}</p>}
          </div>
          <div className="p-1.5">
            {[
              { label: 'Meu perfil', icon: UserIcon, href: '/perfil' },
              { label: 'Configurações', icon: Settings, href: '/configuracoes' },
            ].map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.href}
                  role="menuitem"
                  onClick={() => {
                    close();
                    router.push(it.href);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-body-sm text-fg-soft transition hover:bg-surface-2"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {it.label}
                </button>
              );
            })}
          </div>
          <div className="border-t border-line p-1.5">
            <button
              role="menuitem"
              onClick={() => {
                close();
                onSignOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-body-sm text-status-alert-ink transition hover:bg-status-alert-tint"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sair da conta
            </button>
          </div>
        </div>
      )}
    </IconMenu>
  );
}
