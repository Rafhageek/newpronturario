'use client';

import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { REACTIONS, SOCIAL_DISCLAIMER } from '@hubpatients/core';
import type { PostReaction } from '@hubpatients/core';
import { UserBadge } from '@/components/community/user-badge';

/**
 * Selo médico legado. Agora delega ao <UserBadge> (fonte única de precedência
 * e do aviso ético). `registry` é o "CRM 12345-PE" vindo das views do feed.
 */
export function MedicalBadge({ registry }: { registry?: string | null }) {
  return <UserBadge professionalBadge="doctor" professionalRegistry={registry} />;
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
          <motion.button
            key={r.emoji}
            onClick={() => onReact(r.emoji)}
            title={r.label}
            aria-pressed={mine}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${mine ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted hover:bg-surface-2'}`}
          >
            <span>{r.emoji}</span>
            {count > 0 && <span className="font-medium">{count}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
