import { View, Text, Pressable } from 'react-native';
import {
  Bell,
  BellOff,
  NotebookPen,
  Pill,
  FlaskConical,
  CalendarDays,
  Trophy,
  Ruler,
  Users,
  CheckCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { notificationCategory, type NotificationCategory } from '@hubpatients/core';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, EmptyState } from '@/components/ui';
import { useColors, fonts } from '@/theme';

// Tempo relativo em pt-BR ("agora", "há 2 h", "ontem"). SEM Intl — o Hermes
// (motor JS do RN) não garante Intl.RelativeTimeFormat e usá-lo derruba o app.
function timeAgo(iso: string): string {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'agora';
  const min = Math.round(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return hr === 1 ? 'há 1 h' : `há ${hr} h`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'ontem';
  if (day < 30) return `há ${day} dias`;
  const mon = Math.round(day / 30);
  return mon === 1 ? 'há 1 mês' : `há ${mon} meses`;
}

// Cada categoria de notificação tem um ícone (mesma semântica da web).
const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  diary: NotebookPen,
  medication: Pill,
  exam: FlaskConical,
  appointment: CalendarDays,
  milestone: Trophy,
  growth: Ruler,
  community: Users,
  system: Bell,
};

export default function NotificacoesScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const uid = user?.id;
  const { data: items = [], isLoading, refetch, isRefetching } = useNotifications(uid);
  const markRead = useMarkNotificationRead(uid ?? '');
  const markAll = useMarkAllNotificationsRead(uid ?? '');
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Notificações"
        subtitle={unread > 0 ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Tudo em dia'}
        back
        right={
          unread > 0 ? (
            <Pressable
              onPress={() => markAll.mutate()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Marcar todas como lidas"
              className="flex-row items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 active:opacity-80"
            >
              <CheckCheck size={14} color={colors.primary} />
              <Text style={{ fontFamily: fonts.medium, color: colors.primary }} className="text-[12px]">
                Marcar lidas
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <Screen onRefresh={() => void refetch()} refreshing={isRefetching}>
        <View className="p-4">
          {isLoading ? (
            <View className="gap-2">
              {[0, 1, 2].map((i) => (
                <View key={i} className="h-16 rounded-3xl bg-surface-2" style={{ borderCurve: 'continuous' }} />
              ))}
            </View>
          ) : items.length === 0 ? (
            <View className="pt-10">
              <EmptyState
                icon={BellOff}
                title="Tudo em dia"
                subtitle="Suas ações aparecem aqui — diário, exames, consultas e conquistas. Comece registrando algo hoje. 💙"
              />
            </View>
          ) : (
            <View className="gap-2">
              {items.map((item) => {
                const Icon = CATEGORY_ICON[notificationCategory(item.type)];
                const isUnread = !item.read_at;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => isUnread && markRead.mutate(item.id)}
                    style={{ borderCurve: 'continuous' }}
                    className={`flex-row items-start gap-3 rounded-3xl border p-4 active:opacity-80 ${
                      isUnread ? 'border-primary/30 bg-primary/5' : 'border-line bg-surface'
                    }`}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                      <Icon size={18} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text
                          style={{ fontFamily: isUnread ? fonts.semibold : fonts.medium }}
                          className="flex-1 text-[14px] text-fg"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {isUnread && <View className="h-2 w-2 rounded-full bg-primary" />}
                      </View>
                      <Text
                        style={{ fontFamily: fonts.regular }}
                        className="mt-0.5 text-[13px] leading-[18px] text-muted"
                        numberOfLines={3}
                      >
                        {item.body}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular }} className="mt-1 text-[11px] text-faint">
                        {timeAgo(item.created_at)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </Screen>
    </View>
  );
}
