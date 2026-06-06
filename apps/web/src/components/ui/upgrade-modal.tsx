'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Sparkles, X } from 'lucide-react';

export type UpgradeReason =
  | 'insight'
  | 'pdf_export'
  | 'unlimited_medications'
  | 'interactions'
  | 'ocr_exams'
  | 'exam_analysis'
  | 'unlimited_history'
  | 'whatsapp_reminders'
  | 'family_mode'
  | 'generic';

const REASONS: Record<UpgradeReason, { title: string; description: string }> = {
  insight: {
    title: 'Insight da semana',
    description: 'Resumos inteligentes da sua saúde, atualizados toda semana, fazem parte do VidaLog Plus.',
  },
  pdf_export: {
    title: 'Exportar prontuário em PDF',
    description: 'Gere um PDF completo do seu prontuário para levar ao médico. Disponível no VidaLog Plus.',
  },
  unlimited_medications: {
    title: 'Você está cuidando de muita coisa 💙',
    description: 'No Plus você cadastra medicamentos ilimitados. Lembretes e registro de tomada continuam grátis, sempre.',
  },
  interactions: {
    title: 'Verificação de interações',
    description: 'Cruze seus medicamentos e receba alertas de possíveis interações. Disponível no VidaLog Plus.',
  },
  ocr_exams: {
    title: 'Importar exame por foto',
    description: 'Tire uma foto do laudo e a IA extrai os valores para você revisar. Disponível no VidaLog Plus.',
  },
  exam_analysis: {
    title: 'Narrativa de Saúde',
    description: 'Entenda seus exames em linguagem simples, com priorização e evolução. Disponível no VidaLog Plus.',
  },
  unlimited_history: {
    title: 'Histórico completo',
    description: 'Veja a evolução da sua saúde por 1 ano ou mais. No Free, o histórico vai até 90 dias.',
  },
  whatsapp_reminders: {
    title: 'Lembretes por WhatsApp',
    description: 'Receba lembretes de medicação e consultas direto no WhatsApp. Disponível no VidaLog Plus.',
  },
  family_mode: {
    title: 'Modo Família',
    description: 'Cuide de quem você ama: convide familiares, defina permissões e acompanhe o cuidado. VidaLog Plus Família (R$ 34,90/mês).',
  },
  generic: {
    title: 'Recurso VidaLog Plus',
    description: 'Este recurso faz parte do VidaLog Plus.',
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
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-2xl"
            initial={{ scale: 0.94, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-3 py-1 text-xs font-bold text-white">
              <Sparkles className="h-3.5 w-3.5" /> VidaLog Plus
            </span>
            <h2 className="mt-4 text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
              {info.title}
            </h2>
            <p className="mt-2 text-sm text-muted">{info.description}</p>

            <ul className="mt-4 space-y-2">
              {PERKS.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-sm text-fg-soft">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
