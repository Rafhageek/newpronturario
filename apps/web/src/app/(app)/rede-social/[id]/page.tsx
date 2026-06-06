'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Bell, BellOff, CheckCircle2, Send } from 'lucide-react';
import {
  useTopic, useThreadReplies, useFeedReactions, useSocialMutations,
  useForumMutations, useIsFollowingThread, useRealtimeThread,
} from '@vidalog/supabase';
import type { FeedComment } from '@vidalog/core';
import { CRISIS_NOTICE } from '@vidalog/core';
import { useAuth } from '@/components/auth-provider';
import { MedicalBadge, ReactionBar } from '@/components/social/bits';
import { ThreadReply } from '@/components/social/thread-reply';
import { timeAgo } from '@/lib/time';

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const topicId = params.id;
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { data: topic, isLoading } = useTopic(topicId);
  const { data: replies } = useThreadReplies(topicId);
  const { data: reactions } = useFeedReactions(null, topic ? [topic.id] : []);
  const social = useSocialMutations(userId, null);
  const forum = useForumMutations(userId, topicId);
  const { data: following } = useIsFollowingThread(topicId, user?.id);
  useRealtimeThread(topicId);

  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; who: string } | null>(null);

  // árvore de respostas (1 nível): topo + filhos por parent_comment_id
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

  const canMarkBest = Boolean(topic && topic.author_id && topic.author_id === userId);

  async function submitReply() {
    if (!text.trim()) return;
    await forum.reply.mutateAsync({ content: text.trim(), parentCommentId: replyTo?.id ?? null, isAnonymous: anon });
    setText(''); setReplyTo(null); setAnon(false);
  }

  if (isLoading) return <div className="mx-auto max-w-2xl"><div className="h-40 animate-pulse rounded-2xl bg-surface-2" /></div>;
  if (!topic) return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm text-muted">Tópico não encontrado.</p>
      <Link href="/rede-social" className="mt-2 inline-block text-sm text-primary hover:underline">Voltar ao fórum</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/rede-social" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-5 w-5" /> Fórum
        </Link>
        <button onClick={() => forum.follow.mutate(following ?? false)} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs text-fg-soft hover:bg-surface-2">
          {following ? <><BellOff className="h-3.5 w-3.5" /> Seguindo</> : <><Bell className="h-3.5 w-3.5" /> Seguir tópico</>}
        </button>
      </div>

      {/* Tópico (post original) */}
      <article className="rounded-2xl border border-line bg-surface p-5">
        <h1 className="flex items-center gap-2 text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
          {topic.is_solved && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
          {topic.title ?? 'Tópico'}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          {topic.author_display}{topic.author_verified && <MedicalBadge />} · {timeAgo(topic.created_at)} · {topic.reply_count} resposta(s)
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">{topic.content}</p>
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
              isBest={topic.best_comment_id === r.id}
              canMarkBest={canMarkBest}
              onReply={(id) => setReplyTo({ id, who: r.author_display })}
              onMarkBest={(id) => forum.markBest.mutate(id)}
            >
              {(childrenOf.get(r.id) ?? []).map((c) => (
                <ThreadReply
                  key={c.id}
                  reply={c}
                  isBest={topic.best_comment_id === c.id}
                  canMarkBest={canMarkBest}
                  onReply={() => setReplyTo({ id: r.id, who: c.author_display })}
                  onMarkBest={(id) => forum.markBest.mutate(id)}
                />
              ))}
            </ThreadReply>
          ))
        )}
      </section>

      {/* Composer de resposta */}
      <div className="sticky bottom-2 rounded-2xl border border-line bg-surface p-3">
        {replyTo && (
          <p className="mb-1.5 flex items-center justify-between text-xs text-muted">
            Respondendo a <span className="font-medium text-fg">{replyTo.who}</span>
            <button onClick={() => setReplyTo(null)} className="text-muted hover:text-fg-soft">cancelar</button>
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Escreva uma resposta…" className="flex-1 resize-none rounded-xl border border-line bg-surface-2 p-2.5 text-sm text-fg placeholder:text-muted focus:border-sky-400/50 focus:outline-none" />
          <button onClick={() => setAnon((v) => !v)} className={`h-9 rounded-lg border px-2.5 text-xs ${anon ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted'}`}>anônimo</button>
          <button onClick={submitReply} disabled={forum.reply.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white disabled:opacity-60">
            <Send className="h-4 w-4" /> Responder
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-muted">{CRISIS_NOTICE}</p>
    </div>
  );
}
