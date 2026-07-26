'use client';

import { useState } from 'react';
import { Flag, MessageCircle, MoreHorizontal, Trash2, Trophy } from 'lucide-react';
import type { FeedPost, Poll, PollVote, PostReaction } from '@hubpatients/core';
import { REPORT_REASONS } from '@hubpatients/core';
import { confirmAction } from '@/lib/confirm';
import { ReactionBar } from './bits';
import { UserBadge } from '@/components/community/user-badge';
import { PollView } from './poll-view';
import { CommentThread } from './comment-thread';

export interface PostActions {
  onReact: (postId: string, emoji: string) => void;
  onComment: (postId: string, content: string, isAnonymous: boolean) => Promise<void> | void;
  onVote: (pollId: string, optionIndex: number) => void;
  onReport: (postId: string, reason: string) => void;
  onDelete: (postId: string) => void;
}

export function PostCard({
  post,
  reactions,
  poll,
  pollVotes,
  userId,
  actions,
}: {
  post: FeedPost;
  reactions: PostReaction[];
  poll?: Poll;
  pollVotes: PollVote[];
  userId: string;
  actions: PostActions;
}) {
  const [showComments, setShowComments] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const isMine = post.author_id === userId; // null em anônimos → false

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-sm font-bold text-white">
            {post.author_display.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-fg">
              {post.author_display}
              <UserBadge
                staffRole={post.author_staff_role}
                professionalBadge={post.author_professional_badge}
                professionalRegistry={post.author_professional_registry}
                memberTier={post.author_member_tier}
              />
            </p>
            <p className="flex items-center gap-2 text-xs text-muted">
              {new Date(post.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {post.flair && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-fg-soft">{post.flair}</span>}
              {post.is_achievement && <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300"><Trophy className="h-3 w-3" /> Conquista</span>}
            </p>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg-soft"><MoreHorizontal className="h-4 w-4" /></button>
          {menu && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl" onMouseLeave={() => { setMenu(false); setReporting(false); }}>
              {!reporting ? (
                <>
                  <button onClick={() => setReporting(true)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg-soft hover:bg-surface-2"><Flag className="h-4 w-4" /> Denunciar</button>
                  {isMine && <button onClick={() => { if (confirmAction('Apagar esta publicação?')) { actions.onDelete(post.id); setMenu(false); } }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /> Apagar</button>}
                </>
              ) : (
                <div className="px-1">
                  <p className="px-2 py-1 text-[11px] text-muted">Motivo:</p>
                  {REPORT_REASONS.map((r) => (
                    <button key={r} onClick={() => { actions.onReport(post.id, r); setMenu(false); setReporting(false); }} className="block w-full px-3 py-1.5 text-left text-xs text-fg-soft hover:bg-surface-2">{r}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">{post.content}</p>

      {poll && <PollView poll={poll} votes={pollVotes} userId={userId} onVote={(i) => actions.onVote(poll.id, i)} />}

      <div className="mt-3 flex items-center justify-between">
        <ReactionBar reactions={reactions} userId={userId} onReact={(emoji) => actions.onReact(post.id, emoji)} />
        <button onClick={() => setShowComments((s) => !s)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
          <MessageCircle className="h-4 w-4" /> Comentar
        </button>
      </div>

      {showComments && (
        <CommentThread postId={post.id} userId={userId} onComment={(content, anon) => actions.onComment(post.id, content, anon)} />
      )}
    </div>
  );
}
