'use client';

import { CheckCircle2, CornerDownRight, Star } from 'lucide-react';
import type { FeedComment } from '@vidalog/core';
import { timeAgo } from '@/lib/time';
import { MedicalBadge } from './bits';

export function ThreadReply({
  reply,
  isBest,
  canMarkBest,
  onReply,
  onMarkBest,
  children,
}: {
  reply: FeedComment;
  isBest: boolean;
  canMarkBest: boolean;
  onReply: (commentId: string) => void;
  onMarkBest: (commentId: string | null) => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className={`rounded-2xl border p-4 ${isBest ? 'border-emerald-400/30 bg-emerald-500/[0.06]' : 'border-line bg-surface'}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
            {reply.author_display}
            {reply.author_verified && <MedicalBadge />}
            {isBest && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Útil</span>}
          </p>
          <span className="text-[11px] text-muted">{timeAgo(reply.created_at)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{reply.content}</p>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <button onClick={() => onReply(reply.id)} className="inline-flex items-center gap-1 text-muted hover:text-fg">
            <CornerDownRight className="h-3.5 w-3.5" /> Responder
          </button>
          {canMarkBest && (
            <button onClick={() => onMarkBest(isBest ? null : reply.id)} className={`inline-flex items-center gap-1 ${isBest ? 'text-emerald-300' : 'text-muted hover:text-emerald-300'}`}>
              <Star className="h-3.5 w-3.5" /> {isBest ? 'Desmarcar útil' : 'Marcar como útil'}
            </button>
          )}
        </div>
      </div>
      {children && <div className="ml-5 mt-2 space-y-2 border-l border-line pl-3">{children}</div>}
    </div>
  );
}
