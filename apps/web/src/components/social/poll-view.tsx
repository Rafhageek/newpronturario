'use client';

import type { Poll, PollVote } from '@hubpatients/core';

export function PollView({
  poll,
  votes,
  userId,
  onVote,
}: {
  poll: Poll;
  votes: PollVote[];
  userId: string;
  onVote: (optionIndex: number) => void;
}) {
  const myVote = votes.find((v) => v.user_id === userId)?.option_index;
  const total = votes.length;

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
      <p className="mb-2 text-sm font-medium text-fg">{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((opt, i) => {
          const count = votes.filter((v) => v.option_index === i).length;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const voted = myVote != null;
          const mine = myVote === i;
          return (
            <button
              key={i}
              onClick={() => onVote(i)}
              className="relative w-full overflow-hidden rounded-lg border border-line px-3 py-2 text-left text-sm transition hover:border-primary/40"
            >
              {voted && <span className="absolute inset-y-0 left-0 bg-sky-500/15" style={{ width: `${pct}%` }} />}
              <span className="relative flex items-center justify-between">
                <span className={mine ? 'font-semibold text-primary' : 'text-fg'}>{opt}</span>
                {voted && <span className="text-xs text-muted">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted">{total} voto(s){myVote == null ? ' · toque para votar' : ''}</p>
    </div>
  );
}
