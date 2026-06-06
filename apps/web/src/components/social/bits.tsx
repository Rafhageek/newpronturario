'use client';

import { BadgeCheck, Info } from 'lucide-react';
import { REACTIONS, SOCIAL_DISCLAIMER } from '@vidalog/core';
import type { PostReaction } from '@vidalog/core';

export function MedicalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300" title="Profissional com CRM verificado">
      <BadgeCheck className="h-3 w-3" /> Médico verificado
    </span>
  );
}

export function SocialDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="text-xs leading-relaxed text-fg-soft">{SOCIAL_DISCLAIMER}</p>
    </div>
  );
}

export function ReactionBar({
  reactions,
  userId,
  onReact,
}: {
  reactions: PostReaction[];
  userId: string;
  onReact: (emoji: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {REACTIONS.map((r) => {
        const count = reactions.filter((x) => x.emoji === r.emoji).length;
        const mine = reactions.some((x) => x.emoji === r.emoji && x.user_id === userId);
        return (
          <button
            key={r.emoji}
            onClick={() => onReact(r.emoji)}
            title={r.label}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${mine ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted hover:bg-surface-2'}`}
          >
            <span>{r.emoji}</span>
            {count > 0 && <span className="font-medium">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
