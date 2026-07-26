import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import {
  Gavel,
  Flag,
  AlertTriangle,
  History,
  EyeOff,
  Eye,
  Pin,
  Lock,
  ShieldX,
  type LucideIcon,
} from 'lucide-react-native';
import {
  useCommunityMember,
  useReports,
  useFlagged,
  useModerationActions,
  useModerationMutations,
} from '@hubpatients/supabase';
import type { Post } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Badge, EmptyState } from '@/components/ui';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts } from '@/theme';

type Tab = 'reports' | 'flagged' | 'history';

/** Tempo relativo em pt-BR (sem dependências). Espelha lib/time da web. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

const ACTION_LABELS: Record<string, string> = {
  hide: 'Ocultou',
  unhide: 'Reexibiu',
  pin: 'Fixou',
  unpin: 'Desafixou',
  lock: 'Trancou',
  unlock: 'Destrancou',
  move: 'Moveu',
  strike: 'Advertiu',
  suspend: 'Suspendeu',
};

export default function ModeracaoScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const userId = user?.id;
  const { data: me, isLoading: loadingMe } = useCommunityMember(userId);
  const isStaff = me?.staff_role === 'admin' || me?.staff_role === 'moderator';

  const [tab, setTab] = useState<Tab>('reports');

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Moderação"
        subtitle="Denúncias, conteúdo sinalizado e histórico"
        icon={Gavel}
        back
      />
      <Screen>
        {loadingMe ? (
          <ActivityIndicator color={colors.primary} />
        ) : !isStaff ? (
          <EmptyState
            icon={ShieldX}
            title="Acesso restrito"
            subtitle="Esta área é exclusiva da equipe de moderação."
          />
        ) : (
          <>
            <Tabs tab={tab} onChange={setTab} />
            {tab === 'reports' ? <ReportsTab /> : null}
            {tab === 'flagged' ? <FlaggedTab /> : null}
            {tab === 'history' ? <HistoryTab /> : null}
          </>
        )}
      </Screen>
    </View>
  );
}

/* ──────────────────────────── Abas ──────────────────────────── */

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const colors = useColors();
  const items: { v: Tab; label: string; icon: LucideIcon }[] = [
    { v: 'reports', label: 'Denúncias', icon: Flag },
    { v: 'flagged', label: 'Revisão', icon: AlertTriangle },
    { v: 'history', label: 'Histórico', icon: History },
  ];
  return (
    <View
      style={{ borderCurve: 'continuous' }}
      className="flex-row rounded-2xl border border-line bg-surface-2 p-1"
    >
      {items.map((t) => {
        const active = tab === t.v;
        const Icon = t.icon;
        return (
          <Pressable
            key={t.v}
            onPress={() => onChange(t.v)}
            style={{ borderCurve: 'continuous' }}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2 ${active ? 'bg-trust-100' : ''}`}
          >
            <Icon size={14} color={active ? colors.primary : colors.muted} />
            <Text
              style={{ fontFamily: fonts.semibold }}
              className={`text-[12px] ${active ? 'text-primary' : 'text-muted'}`}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ──────────────────────────── Botões de ação ──────────────────────────── */

function ActBtn({
  onClick,
  icon: Icon,
  children,
  tone,
}: {
  onClick: () => void;
  icon: LucideIcon;
  children: string;
  tone?: 'danger';
}) {
  const colors = useColors();
  const danger = tone === 'danger';
  return (
    <Pressable
      onPress={onClick}
      style={{ borderCurve: 'continuous' }}
      className={`flex-row items-center gap-1 rounded-xl border px-2.5 py-1.5 active:opacity-70 ${danger ? 'border-rose-200 bg-rose-50' : 'border-line bg-surface'}`}
    >
      <Icon size={14} color={danger ? colors.alert : colors.fgSoft} />
      <Text
        style={{ fontFamily: fonts.semibold }}
        className={`text-[12px] ${danger ? 'text-rose-700' : 'text-fg-soft'}`}
      >
        {children}
      </Text>
    </Pressable>
  );
}

/** Ações de moderação sobre um post (ocultar/reexibir, fixar, trancar). */
function ModButtons({ post }: { post: { id: string; hidden?: boolean | null } }) {
  const mod = useModerationMutations();

  function doHide(reason: string) {
    mod.hide.mutate(
      { postId: post.id, reason: reason.trim() },
      { onSuccess: () => toast.success('Publicação ocultada.') },
    );
  }

  function hide() {
    if (Alert.prompt) {
      Alert.prompt(
        'Ocultar publicação',
        'Motivo (o autor será notificado):',
        (reason?: string) => doHide(reason ?? ''),
      );
      return;
    }
    Alert.alert('Ocultar publicação', 'O autor será notificado. Confirmar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ocultar', style: 'destructive', onPress: () => doHide('Conteúdo inadequado') },
    ]);
  }

  return (
    <View className="mt-1 flex-row flex-wrap gap-1.5">
      {post.hidden ? (
        <ActBtn
          onClick={() =>
            mod.unhide.mutate(post.id, { onSuccess: () => toast.success('Reexibido.') })
          }
          icon={Eye}
        >
          Reexibir
        </ActBtn>
      ) : (
        <ActBtn onClick={hide} icon={EyeOff} tone="danger">
          Ocultar
        </ActBtn>
      )}
      <ActBtn
        onClick={() =>
          mod.pin.mutate(
            { postId: post.id, pinned: true },
            { onSuccess: () => toast.success('Fixado.') },
          )
        }
        icon={Pin}
      >
        Fixar
      </ActBtn>
      <ActBtn
        onClick={() =>
          mod.lock.mutate(
            { postId: post.id, locked: true },
            { onSuccess: () => toast.success('Trancado.') },
          )
        }
        icon={Lock}
      >
        Trancar
      </ActBtn>
    </View>
  );
}

/** Advertência ao autor do post (3 em 90 dias suspendem por 7 dias). */
function StrikeButton({ userId, postId }: { userId: string; postId: string }) {
  const mod = useModerationMutations();

  function confirmStrike(reason: string) {
    if (!reason.trim()) return;
    mod.strike.mutate(
      { userId, reason: reason.trim(), postId },
      { onSuccess: () => toast.success('Advertência aplicada.') },
    );
  }

  function strike() {
    if (Alert.prompt) {
      Alert.prompt(
        'Advertir autor',
        'Motivo (3 advertências em 90 dias suspendem por 7 dias):',
        (reason?: string) => confirmStrike(reason ?? ''),
      );
      return;
    }
    Alert.alert(
      'Advertir autor',
      'Aplicar advertência a este autor? (3 em 90 dias suspendem por 7 dias)',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Advertir', style: 'destructive', onPress: () => confirmStrike('Conteúdo inadequado') },
      ],
    );
  }

  return (
    <ActBtn onClick={strike} icon={AlertTriangle} tone="danger">
      Advertir autor
    </ActBtn>
  );
}

/* ──────────────────────────── Denúncias ──────────────────────────── */

function ReportsTab() {
  const colors = useColors();
  const { data: reports, isLoading } = useReports();
  if (isLoading) return <ActivityIndicator color={colors.primary} />;
  if (!reports || reports.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        title="Nenhuma denúncia pendente"
        subtitle="A fila está limpa por enquanto."
      />
    );
  }
  return (
    <View className="gap-3">
      {reports.map((r, i) => (
        <FadeInItem key={r.id} index={i}>
          <Card className="gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <Flag size={14} color={colors.alert} />
              <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
                {r.reason} · {timeAgo(r.created_at)}
              </Text>
              {r.post?.hidden ? <Badge tone="neutral">oculto</Badge> : null}
            </View>
            <Text
              style={{ fontFamily: fonts.regular }}
              numberOfLines={3}
              className="text-[14px] leading-5 text-fg"
            >
              {r.post?.content ?? '(conteúdo indisponível)'}
            </Text>
            {r.post ? <ModButtons post={r.post} /> : null}
          </Card>
        </FadeInItem>
      ))}
    </View>
  );
}

/* ──────────────────────────── Para revisão ──────────────────────────── */

function FlaggedTab() {
  const colors = useColors();
  const { data: flagged, isLoading } = useFlagged();
  if (isLoading) return <ActivityIndicator color={colors.primary} />;
  if (!flagged || flagged.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Nada para revisar"
        subtitle="Nenhum conteúdo sinalizado no momento."
      />
    );
  }
  return (
    <View className="gap-3">
      {flagged.map((p: Post, i) => (
        <FadeInItem key={p.id} index={i}>
          <Card className="gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <AlertTriangle size={14} color={colors.attention} />
              <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
                {p.review_reason ? `Motivo: ${p.review_reason}` : 'Sinalizado'} ·{' '}
                {timeAgo(p.created_at)}
              </Text>
            </View>
            {p.title ? (
              <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
                {p.title}
              </Text>
            ) : null}
            <Text
              style={{ fontFamily: fonts.regular }}
              numberOfLines={3}
              className="text-[14px] leading-5 text-fg"
            >
              {p.content}
            </Text>
            <View className="mt-1 flex-row flex-wrap gap-1.5">
              <ModButtons post={p} />
              <StrikeButton userId={p.author_id} postId={p.id} />
            </View>
          </Card>
        </FadeInItem>
      ))}
    </View>
  );
}

/* ──────────────────────────── Histórico ──────────────────────────── */

function HistoryTab() {
  const colors = useColors();
  const { data: actions, isLoading } = useModerationActions();
  if (isLoading) return <ActivityIndicator color={colors.primary} />;
  if (!actions || actions.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sem registros"
        subtitle="Nenhuma ação de moderação foi registrada ainda."
      />
    );
  }
  return (
    <View className="gap-2.5">
      {actions.map((a, i) => (
        <FadeInItem key={a.id} index={i}>
          <Card className="flex-row items-start gap-3">
            <Gavel size={16} color={colors.muted} style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text style={{ fontFamily: fonts.regular }} className="text-[14px] leading-5 text-fg">
                <Text style={{ fontFamily: fonts.semibold }}>
                  {ACTION_LABELS[a.action] ?? a.action}
                </Text>
                {a.reason ? ` — ${a.reason}` : ''}
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="mt-0.5 text-[11px] text-faint">
                {timeAgo(a.created_at)}
              </Text>
            </View>
          </Card>
        </FadeInItem>
      ))}
    </View>
  );
}
