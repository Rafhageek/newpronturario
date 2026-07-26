'use client';

import Link from 'next/link';
import { CheckCircle2, MessageSquare, Pin } from 'lucide-react';
import type { FeedPost } from '@hubpatients/core';
import { timeAgo } from '@/lib/time';
import { UserBadge } from '@/components/community/user-badge';

export function ForumTopicRow({
  topic,
  basePath,
  stale = false,
}: {
  topic: FeedPost;
  basePath: string;
  /** Sem resposta há >48h — destaca para a comunidade ajudar. */
  stale?: boolean;
}) {
  return (
    <Link
      href={`${basePath}/${topic.id}`}
      className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-primary/40"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-sm font-bold text-white">
        {topic.author_display.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          {topic.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />}
          {topic.is_solved && <CheckCircle2 className="h-3.5 w-3.5 text-status-ok-ink" />}
          <span className="truncate">{topic.title ?? topic.content.slice(0, 80)}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">{topic.content}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span>{topic.author_display}</span>
          <UserBadge
            staffRole={topic.author_staff_role}
            professionalBadge={topic.author_professional_badge}
            professionalRegistry={topic.author_professional_registry}
            memberTier={topic.author_member_tier}
          />
          {topic.flair && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-fg-soft">{topic.flair}</span>}
          <span>· {timeAgo(topic.last_activity_at)}</span>
        </p>
      </div>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="flex items-center gap-1 text-xs text-muted">
          <MessageSquare className="h-3.5 w-3.5" /> {topic.reply_count}
        </span>
        {stale && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            Sem resposta
          </span>
        )}
      </span>
    </Link>
  );
}
