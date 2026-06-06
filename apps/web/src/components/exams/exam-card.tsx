'use client';

import Link from 'next/link';
import { FlaskConical, HeartPulse, ScanLine, ChevronRight } from 'lucide-react';
import type { Exam } from '@vidalog/core';
import { EXAM_CATEGORY_LABELS } from '@vidalog/core';

const ICONS = { lab: FlaskConical, imaging: ScanLine, cardio: HeartPulse } as const;

export function ExamCard({ exam }: { exam: Exam }) {
  const Icon = ICONS[exam.category];
  return (
    <Link
      href={`/exames/${exam.id}`}
      className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-primary/40"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{exam.title}</p>
        <p className="truncate text-xs text-muted">
          {EXAM_CATEGORY_LABELS[exam.category]}
          {exam.lab_name ? ` · ${exam.lab_name}` : ''}
          {exam.exam_date ? ` · ${new Date(exam.exam_date).toLocaleDateString('pt-BR')}` : ''}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}
