'use client';

import { CheckCircle2, CornerDownRight, Star } from 'lucide-react';
import type { FeedComment } from '@hubpatients/core';
import { timeAgo } from '@/lib/time';
import { UserBadge } from '@/components/community/user-badge';
import { ProfessionalDisclaimer } from '@/components/community/professional-disclaimer';
import { MarkdownView } from '@/components/community/markdown-view';

export function ThreadReply({
  reply,
  isUseful,
  canMark,
  onReply,
  onToggleUseful,
  children,
}: {
  reply: FeedComment;
  isUseful: boolean;
  canMark: boolean;
  onReply: (commentId: string) => void;
  onToggleUseful: (commentId: string, makeUseful: boolean) => void;
  children?: React.ReactNode;
}) {
  const isProfessional = reply.author_professional_badge === 'doctor';
  return (
    <div>
      <div className={`rounded-2xl border p-4 ${isUseful ? 'border-emerald-400/30 bg-emerald-500/[0.06]' : 'border-line bg-surface'}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-fg">
            {reply.author_display}
            <UserBadge
              staffRole={reply.author_staff_role}
              professionalBadge={reply.author_professional_badge}
              professionalRegistry={reply.author_professional_registry}
              memberTier={reply.author_member_tier}
            />
            {isUseful && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Útil
              </span>
            )}
          </p>
          <span className="shrink-0 text-[11px] text-muted">{timeAgo(reply.created_at)}</span>
        </div>
        <MarkdownView content={reply.content} className="mt-2" />
        {isProfessional && <ProfessionalDisclaimer />}
        <div className="mt-2 flex items-center gap-3 text-xs">
          <button onClick={() => onReply(reply.id)} className="inline-flex items-center gap-1 text-muted hover:text-fg">
            <CornerDownRight className="h-3.5 w-3.5" /> Responder
          </button>
          {canMark && (
            <button
              onClick={() => onToggleUseful(reply.id, !isUseful)}
              className={`inline-flex items-center gap-1 ${isUseful ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted hover:text-emerald-700 dark:hover:text-emerald-300'}`}
            >
              <Star className="h-3.5 w-3.5" /> {isUseful ? 'Desmarcar útil' : 'Marcar como útil'}
            </button>
          )}
        </div>
      </div>
      {children && <div className="ml-5 mt-2 space-y-2 border-l border-line pl-3">{children}</div>}
    </div>
  );
}
