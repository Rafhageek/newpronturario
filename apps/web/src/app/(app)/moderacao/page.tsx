'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, EyeOff, Flag, Gavel, History, Lock, Pin, ShieldX, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCommunityMember, useReports, useFlagged, useModerationActions, useModerationMutations,
} from '@hubpatients/supabase';
import type { Post } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { timeAgo } from '@/lib/time';

type Tab = 'reports' | 'flagged' | 'history';

export default function ModeracaoPage() {
  const { user } = useAuth();
  const { data: me, isLoading: loadingMe } = useCommunityMember(user?.id);
  const isStaff = me?.staff_role === 'admin' || me?.staff_role === 'moderator';

  const [tab, setTab] = useState<Tab>('reports');

  if (loadingMe) {
    return <div className="mx-auto max-w-3xl"><div className="h-40 animate-pulse rounded-2xl bg-surface-2" /></div>;
  }
  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShieldX className="mx-auto h-10 w-10 text-status-alert-ink" />
        <h1 className="mt-3 text-lg font-bold text-fg">Acesso restrito</h1>
        <p className="mt-1 text-sm text-muted">Esta área é exclusiva da equipe de moderação.</p>
        <Link href="/comunidade" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar à Comunidade</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 hp-page">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-primary">
          <Gavel className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Moderação</h1>
          <p className="text-sm text-muted">Fila de denúncias, conteúdo sinalizado e histórico auditável.</p>
        </div>
      </header>

      <div className="flex gap-1.5">
        <TabBtn active={tab === 'reports'} onClick={() => setTab('reports')} icon={Flag}>Denúncias</TabBtn>
        <TabBtn active={tab === 'flagged'} onClick={() => setTab('flagged')} icon={AlertTriangle}>Para revisão</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={History}>Histórico</TabBtn>
      </div>

      {tab === 'reports' && <ReportsTab />}
      {tab === 'flagged' && <FlaggedTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Flag; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? 'bg-sky-500/15 text-primary' : 'text-muted hover:bg-surface-2'}`}>
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

function ModButtons({ post }: { post: { id: string; hidden?: boolean } }) {
  const mod = useModerationMutations();
  function hide() {
    const reason = window.prompt('Motivo para ocultar (o autor será notificado):') ?? '';
    mod.hide.mutate({ postId: post.id, reason }, { onSuccess: () => toast.success('Publicação ocultada.') });
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {post.hidden ? (
        <ActBtn onClick={() => mod.unhide.mutate(post.id, { onSuccess: () => toast.success('Reexibido.') })} icon={Eye}>Reexibir</ActBtn>
      ) : (
        <ActBtn onClick={hide} icon={EyeOff} tone="danger">Ocultar</ActBtn>
      )}
      <ActBtn onClick={() => mod.pin.mutate({ postId: post.id, pinned: true }, { onSuccess: () => toast.success('Fixado.') })} icon={Pin}>Fixar</ActBtn>
      <ActBtn onClick={() => mod.lock.mutate({ postId: post.id, locked: true }, { onSuccess: () => toast.success('Trancado.') })} icon={Lock}>Trancar</ActBtn>
    </div>
  );
}

function StrikeButton({ userId, postId }: { userId: string; postId: string }) {
  const mod = useModerationMutations();
  function strike() {
    const reason = window.prompt('Motivo da advertência (3 em 90 dias suspendem por 7 dias):');
    if (!reason) return;
    mod.strike.mutate({ userId, reason, postId }, { onSuccess: () => toast.success('Advertência aplicada.') });
  }
  return <ActBtn onClick={strike} icon={AlertTriangle} tone="danger">Advertir autor</ActBtn>;
}

function ReportsTab() {
  const { data: reports, isLoading } = useReports();
  if (isLoading) return <Loading />;
  if (!reports || reports.length === 0) return <Empty>Nenhuma denúncia pendente. 🎉</Empty>;
  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="rounded-2xl border border-line bg-surface p-4">
          <p className="flex items-center gap-2 text-xs text-muted">
            <Flag className="h-3.5 w-3.5 text-status-alert-ink" /> {r.reason} · {timeAgo(r.created_at)}
            {r.post?.hidden && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px]">oculto</span>}
          </p>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-fg">{r.post?.content ?? '(conteúdo indisponível)'}</p>
          {r.post && <ModButtons post={r.post} />}
        </div>
      ))}
    </div>
  );
}

function FlaggedTab() {
  const { data: flagged, isLoading } = useFlagged();
  if (isLoading) return <Loading />;
  if (!flagged || flagged.length === 0) return <Empty>Nada sinalizado para revisão.</Empty>;
  return (
    <div className="space-y-2">
      {flagged.map((p: Post) => (
        <div key={p.id} className="rounded-2xl border border-amber-500/20 bg-surface p-4">
          <p className="flex items-center gap-2 text-xs text-muted">
            <AlertTriangle className="h-3.5 w-3.5 text-status-attention-ink" />
            {p.review_reason ? `Motivo: ${p.review_reason}` : 'Sinalizado'} · {timeAgo(p.created_at)}
          </p>
          {p.title && <p className="mt-1 text-sm font-semibold text-fg">{p.title}</p>}
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-fg">{p.content}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ModButtons post={p} />
            <StrikeButton userId={p.author_id} postId={p.id} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryTab() {
  const { data: actions, isLoading } = useModerationActions();
  if (isLoading) return <Loading />;
  if (!actions || actions.length === 0) return <Empty>Nenhuma ação registrada ainda.</Empty>;
  const LABEL: Record<string, string> = {
    hide: 'Ocultou', unhide: 'Reexibiu', pin: 'Fixou', unpin: 'Desafixou',
    lock: 'Trancou', unlock: 'Destrancou', move: 'Moveu', strike: 'Advertiu', suspend: 'Suspendeu',
  };
  return (
    <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
      {actions.map((a) => (
        <li key={a.id} className="flex items-start gap-2 px-4 py-3 text-sm">
          <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="text-fg-soft"><span className="font-medium text-fg">{LABEL[a.action] ?? a.action}</span>{a.reason ? ` — ${a.reason}` : ''}</p>
            <p className="text-[11px] text-faint">{timeAgo(a.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActBtn({ onClick, icon: Icon, children, tone }: { onClick: () => void; icon: typeof Flag; children: React.ReactNode; tone?: 'danger' }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${tone === 'danger' ? 'border-rose-500/30 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300' : 'border-line text-fg-soft hover:bg-surface-2'}`}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function Loading() {
  return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />)}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">{children}</p>;
}
