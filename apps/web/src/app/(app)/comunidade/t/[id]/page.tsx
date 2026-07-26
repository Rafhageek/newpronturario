'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Bell, BellOff, CheckCircle2, Lock, Send } from 'lucide-react';
import {
  useTopic, useThreadReplies, useFeedReactions, useSocialMutations,
  useForumMutations, useIsFollowingThread, useRealtimeThread, useUsefulMarks,
} from '@hubpatients/supabase';
import { toast } from 'sonner';
import type { FeedComment } from '@hubpatients/core';
import { CRISIS_NOTICE, detectContentRisk } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { ReactionBar } from '@/components/social/bits';
import { ThreadReply } from '@/components/social/thread-reply';
import { UserBadge } from '@/components/community/user-badge';
import { ProfessionalDisclaimer } from '@/components/community/professional-disclaimer';
import { MarkdownView } from '@/components/community/markdown-view';
import { MarkdownEditor } from '@/components/community/markdown-editor';
import { ContentGuardNotice } from '@/components/community/content-guard-notice';
import { timeAgo } from '@/lib/time';

export default function CommunityTopicPage() {
  const { id: topicId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { data: topic, isLoading } = useTopic(topicId);
  const { data: replies } = useThreadReplies(topicId);
  const { data: reactions } = useFeedReactions(null, topic ? [topic.id] : []);
  const { data: usefulMarks } = useUsefulMarks(topicId);
  const social = useSocialMutations(userId, null);
  const forum = useForumMutations(userId, topicId);
  const { data: following } = useIsFollowingThread(topicId, user?.id);
  useRealtimeThread(topicId);

  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; who: string } | null>(null);

  const usefulSet = useMemo(
    () => new Set((usefulMarks ?? []).map((m) => m.comment_id)),
    [usefulMarks],
  );

  const { roots, childrenOf } = useMemo(() => {
    const list = replies ?? [];
    const childMap = new Map<string, FeedComment[]>();
    const top: FeedComment[] = [];
    for (const r of list) {
      if (r.parent_comment_id) {
        const a = childMap.get(r.parent_comment_id) ?? [];
        a.push(r);
        childMap.set(r.parent_comment_id, a);
      } else top.push(r);
    }
    return { roots: top, childrenOf: childMap };
  }, [replies]);

  const canMark = Boolean(topic && topic.author_id && topic.author_id === userId);
  const locked = topic?.is_locked ?? false;
  const isProfessional = topic?.author_professional_badge === 'doctor';

  function toggleUseful(commentId: string, makeUseful: boolean) {
    if (makeUseful) {
      forum.markUseful.mutate(commentId, {
        onSuccess: () => toast.success('Resposta marcada como útil ✅ (+5 para quem ajudou)'),
      });
    } else {
      forum.unmarkUseful.mutate(commentId);
    }
  }

  const replyRisk = detectContentRisk(text);

  async function submitReply() {
    if (!text.trim()) return;
    if (replyRisk.medSale) {
      toast.error('Não é permitido anunciar compra, venda, troca ou doação de medicamentos.');
      return;
    }
    await forum.reply.mutateAsync({
      content: text.trim(),
      parentCommentId: replyTo?.id ?? null,
      isAnonymous: anon,
      needsReview: replyRisk.posology || replyRisk.crisis,
      reviewReason: replyRisk.posology ? 'posologia' : replyRisk.crisis ? 'crise' : null,
    });
    setText('');
    setReplyTo(null);
    setAnon(false);
  }

  if (isLoading) return <div className="mx-auto max-w-2xl"><div className="h-40 animate-pulse rounded-2xl bg-surface-2" /></div>;
  if (!topic) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm text-muted">Tópico não encontrado.</p>
        <Link href="/comunidade" className="mt-2 inline-block text-sm text-primary hover:underline">Voltar à Comunidade</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/comunidade" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-5 w-5" /> Comunidade
        </Link>
        <button onClick={() => forum.follow.mutate(following ?? false)} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs text-fg-soft hover:bg-surface-2">
          {following ? <><BellOff className="h-3.5 w-3.5" /> Seguindo</> : <><Bell className="h-3.5 w-3.5" /> Seguir tópico</>}
        </button>
      </div>

      {/* Tópico */}
      <article className="rounded-2xl border border-line bg-surface p-5">
        <h1 className="flex items-center gap-2 text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
          {topic.is_solved && <CheckCircle2 className="h-5 w-5 text-status-ok-ink" />}
          {topic.title ?? 'Tópico'}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {topic.author_id ? (
            <Link href={`/comunidade/u/${topic.author_id}`} className="font-medium text-fg-soft hover:text-primary hover:underline">
              {topic.author_display}
            </Link>
          ) : (
            <span>{topic.author_display}</span>
          )}
          <UserBadge
            staffRole={topic.author_staff_role}
            professionalBadge={topic.author_professional_badge}
            professionalRegistry={topic.author_professional_registry}
            memberTier={topic.author_member_tier}
          />
          <span>· {timeAgo(topic.created_at)} · {topic.reply_count} resposta(s)</span>
        </p>
        <MarkdownView content={topic.content} className="mt-3" />
        {isProfessional && <ProfessionalDisclaimer />}
        {topic.tags && topic.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {topic.tags.map((t) => (
              <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-fg-soft">#{t}</span>
            ))}
          </div>
        )}
        <div className="mt-4">
          <ReactionBar reactions={reactions ?? []} userId={userId} onReact={(emoji) => social.react.mutate({ postId: topic.id, emoji })} />
        </div>
      </article>

      {/* Respostas */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Respostas</h2>
        {roots.length === 0 ? (
          <p className="text-sm text-muted">Seja o primeiro a responder.</p>
        ) : (
          roots.map((r) => (
            <ThreadReply
              key={r.id}
              reply={r}
              isUseful={usefulSet.has(r.id)}
              canMark={canMark}
              onReply={(cid) => setReplyTo({ id: cid, who: r.author_display })}
              onToggleUseful={toggleUseful}
            >
              {(childrenOf.get(r.id) ?? []).map((c) => (
                <ThreadReply
                  key={c.id}
                  reply={c}
                  isUseful={usefulSet.has(c.id)}
                  canMark={canMark}
                  onReply={() => setReplyTo({ id: r.id, who: c.author_display })}
                  onToggleUseful={toggleUseful}
                />
              ))}
            </ThreadReply>
          ))
        )}
      </section>

      {/* Composer */}
      {locked ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 py-4 text-sm text-muted">
          <Lock className="h-4 w-4" /> Este tópico está trancado para novas respostas.
        </p>
      ) : (
        <div className="sticky bottom-2 space-y-2 rounded-2xl border border-line bg-surface p-3">
          {replyTo && (
            <p className="flex items-center justify-between text-xs text-muted">
              Respondendo a <span className="font-medium text-fg">{replyTo.who}</span>
              <button onClick={() => setReplyTo(null)} className="text-muted hover:text-fg-soft">cancelar</button>
            </p>
          )}
          <MarkdownEditor value={text} onChange={setText} rows={3} placeholder="Escreva uma resposta…" />
          <ContentGuardNotice risk={replyRisk} />
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setAnon((v) => !v)} className={`h-9 rounded-lg border px-3 text-xs ${anon ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted'}`}>
              {anon ? 'Anônimo' : 'Anônimo?'}
            </button>
            <button onClick={submitReply} disabled={forum.reply.isPending || !text.trim() || replyRisk.medSale} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white disabled:opacity-60">
              <Send className="h-4 w-4" /> Responder
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted">{CRISIS_NOTICE}</p>
    </div>
  );
}
