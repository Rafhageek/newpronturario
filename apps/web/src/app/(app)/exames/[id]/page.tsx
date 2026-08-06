'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useExam, useExamMetrics } from '@hubpatients/supabase';
import { EXAM_CATEGORY_LABELS } from '@hubpatients/core';
import { useActiveProfile } from '@/components/profile-context';
import { ExamReport } from '@/components/exams/exam-report';

export default function ExamReportPage() {
  const params = useParams<{ id: string }>();
  const examId = params.id;
  const { patientId } = useActiveProfile();
  const { data: exam, isLoading } = useExam(examId);
  const { data: metrics } = useExamMetrics(examId);

  if (isLoading) {
    return <div className="mx-auto max-w-3xl"><div className="h-40 animate-pulse rounded-2xl bg-surface-2" /></div>;
  }
  if (!exam) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm text-muted">Exame não encontrado.</p>
        <Link href="/exames" className="mt-2 inline-block text-sm text-primary hover:underline">Voltar aos exames</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 hp-page">
      <div className="flex items-center gap-3">
        <Link href="/exames" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>{exam.title}</h1>
          <p className="text-xs text-muted">
            {EXAM_CATEGORY_LABELS[exam.category]}
            {exam.exam_date ? ` · ${new Date(exam.exam_date).toLocaleDateString('pt-BR')}` : ''}
            {exam.doctor_name ? ` · ${exam.doctor_name}` : ''}
          </p>
        </div>
      </div>

      <ExamReport exam={exam} metrics={metrics ?? []} patientId={patientId} />
    </div>
  );
}
