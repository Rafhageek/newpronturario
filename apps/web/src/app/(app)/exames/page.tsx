'use client';

import { useState } from 'react';
import { Camera, FlaskConical, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useExams, useMonthlyUploadCount } from '@vidalog/supabase';
import { FREE_UPLOAD_LIMIT, EXAM_CATEGORY_LABELS, type ExamCategory } from '@vidalog/core';
import { useActiveProfile } from '@/components/profile-context';
import { ExamCard } from '@/components/exams/exam-card';
import { ExamDisclaimer } from '@/components/exams/exam-disclaimer';
import { UploadExamModal } from '@/components/exams/upload-exam-modal';
import { UpgradeModal, type UpgradeReason } from '@/components/ui/upgrade-modal';

const PERIODS = [
  { days: 0, label: 'Tudo' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '1 ano' },
];

export default function ExamesPage() {
  const { patientId } = useActiveProfile();
  const isPlus = false;

  const [category, setCategory] = useState<ExamCategory | ''>('');
  const [period, setPeriod] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upgrade, setUpgrade] = useState<UpgradeReason | null>(null);

  const sinceIso = period > 0 ? new Date(Date.now() - period * 86400000).toISOString().slice(0, 10) : undefined;
  const { data: exams, isLoading } = useExams(patientId || undefined, { category: category || undefined, sinceIso });
  const { data: monthlyCount } = useMonthlyUploadCount(patientId || undefined);

  const usedThisMonth = monthlyCount ?? 0;
  const reachedLimit = !isPlus && usedThisMonth >= FREE_UPLOAD_LIMIT;

  function handleUpload() {
    if (reachedLimit) {
      setUpgrade('generic');
      toast.info(`Você atingiu ${FREE_UPLOAD_LIMIT} uploads neste mês (Free).`);
      return;
    }
    setUploadOpen(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Exames</h1>
          <p className="text-xs text-muted">Sua Narrativa de Saúde — exames em linguagem simples.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isPlus && <span className="text-xs text-muted">{usedThisMonth}/{FREE_UPLOAD_LIMIT} este mês</span>}
          <button onClick={() => (isPlus ? setUploadOpen(true) : setUpgrade('ocr_exams'))} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-sm font-medium text-fg transition hover:bg-surface-2">
            <Camera className="h-4 w-4 text-primary" /> Foto (IA)
            {!isPlus && <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">PLUS</span>}
          </button>
          <button onClick={handleUpload} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90">
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>
      </header>

      <ExamDisclaimer />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={category} onChange={(e) => setCategory(e.target.value as ExamCategory | '')} className="h-9 rounded-xl border border-line bg-surface px-3 text-xs text-fg">
          <option value="">Todos os tipos</option>
          {Object.entries(EXAM_CATEGORY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {PERIODS.map((p) => (
            <button key={p.days} onClick={() => setPeriod(p.days)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${period === p.days ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : exams && exams.length > 0 ? (
        <div className="space-y-3">
          {exams.map((e) => <ExamCard key={e.id} exam={e} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-16 text-center">
          <FlaskConical className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm text-muted">Nenhum exame ainda.</p>
          <button onClick={handleUpload} className="mt-3 text-sm font-medium text-primary hover:underline">Adicionar o primeiro exame →</button>
        </div>
      )}

      <UploadExamModal open={uploadOpen} onClose={() => setUploadOpen(false)} patientId={patientId} />
      <UpgradeModal open={upgrade !== null} reason={upgrade ?? 'generic'} onClose={() => setUpgrade(null)} />
    </div>
  );
}
