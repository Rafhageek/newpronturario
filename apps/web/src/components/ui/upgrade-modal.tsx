'use client';

import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

export type UpgradeReason =
  | 'insight'
  | 'pdf_export'
  | 'ocr_exams'
  | 'exam_analysis'
  | 'unlimited_history'
  | 'whatsapp_reminders'
  | 'family_mode'
  | 'generic';

const REASONS: Record<UpgradeReason, { title: string; description: string }> = {
  insight: {
    title: 'Insight da semana',
    description: 'Resumos inteligentes da sua saúde, atualizados toda semana, fazem parte do HubPatients Plus.',
  },
  pdf_export: {
    title: 'Exportar prontuário em PDF',
    description: 'Gere um PDF completo do seu prontuário para levar ao médico. Disponível no HubPatients Plus.',
  },
  ocr_exams: {
    title: 'Importar exame por foto',
    description: 'Tire uma foto do laudo e a IA extrai os valores para você revisar. Disponível no HubPatients Plus.',
  },
  exam_analysis: {
    title: 'Narrativa de Saúde',
    description: 'Entenda seus exames em linguagem simples, com priorização e evolução. Disponível no HubPatients Plus.',
  },
  unlimited_history: {
    title: 'Histórico completo',
    description: 'Veja a evolução da sua saúde por 1 ano ou mais. No Free, o histórico vai até 90 dias.',
  },
  whatsapp_reminders: {
    title: 'Lembretes por WhatsApp',
    description: 'Receba lembretes de medicação e consultas direto no WhatsApp. Disponível no HubPatients Plus.',
  },
  family_mode: {
    title: 'Modo Família',
    description: 'Cuide de quem você ama: convide familiares, defina permissões e acompanhe o cuidado. Disponível no HubPatients Plus Família.',
  },
  generic: {
    title: 'Recurso HubPatients Plus',
    description: 'Este recurso faz parte do HubPatients Plus.',
  },
};

const PERKS = [
  'Exames didáticos em linguagem leiga',
  'Insights semanais de saúde',
  'Exportar prontuário em PDF',
  'Modo família/cuidador',
];

export function UpgradeModal({
  open,
  reason = 'generic',
  onClose,
}: {
  open: boolean;
  reason?: UpgradeReason;
  onClose: () => void;
}) {
  const info = REASONS[reason];
  return (
    <Modal open={open} onClose={onClose} title={info.title} description={info.description} className="max-w-md">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-3 py-1 text-xs font-bold text-white">
        <Sparkles className="h-3.5 w-3.5" /> HubPatients Plus
      </span>

      <ul className="mt-4 space-y-2">
        {PERKS.map((p) => (
          <li key={p} className="flex items-center gap-2.5 text-sm text-fg-soft">
            <Check className="h-4 w-4 shrink-0 text-status-ok-ink" />
            {p}
          </li>
        ))}
      </ul>

      <Link
        href="/planos"
        onClick={onClose}
        className="mt-6 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90"
      >
        <Sparkles className="h-4 w-4" /> Conhecer o Plus
      </Link>
      <button onClick={onClose} className="mt-2 w-full text-center text-xs text-muted hover:text-fg-soft">
        Agora não
      </button>
    </Modal>
  );
}
