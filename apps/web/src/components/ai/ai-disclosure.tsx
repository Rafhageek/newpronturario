'use client';

import { useState } from 'react';
import { Info, ShieldCheck, Sparkles } from 'lucide-react';
import {
  AI_DISCLOSURE_BADGE,
  AI_DISCLOSURE_CTA,
  AI_DISCLOSURE_FIELDS,
  AI_DISCLOSURE_FULL,
  AI_DISCLOSURE_HUMAN_OVERSIGHT,
  AI_DISCLOSURE_NO_METADATA,
  AI_DISCLOSURE_NO_SOURCES,
  AI_DISCLOSURE_REFUSAL,
  AI_DISCLOSURE_REGULATION,
  AI_DISCLOSURE_TITLE,
  aiTaskLabel,
  type AiDisclosureMeta,
} from '@hubpatients/core';
import { Modal } from '@/components/ui/modal';

/**
 * Selo de transparência de IA (Resolução CFM nº 2.454/2026).
 *
 * Badge discreto + "Como isso foi gerado", que abre um painel com modelo,
 * versão do prompt, fontes citadas, data e o texto completo de disclosure.
 * Funciona SEM metadados: cada campo desconhecido vira "Não registrado" e o
 * texto genérico (estimativa, não é diagnóstico, direito de recusa) continua
 * sendo exibido — o disclosure nunca depende de a telemetria ter chegado.
 */
export function AiDisclosure({
  taskType,
  modelId,
  promptVersion,
  sources,
  createdAt,
  note,
  className = '',
}: AiDisclosureMeta & {
  /** Contexto específico da tela (ex.: o que exatamente a IA fez aqui). */
  note?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const list = (sources ?? []).filter((s) => s.trim().length > 0);

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/[0.1] px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {AI_DISCLOSURE_BADGE}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-1.5 text-[11px] font-medium text-muted underline decoration-dotted underline-offset-2 transition hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/60"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
          {AI_DISCLOSURE_CTA}
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={AI_DISCLOSURE_TITLE}
        description={AI_DISCLOSURE_REGULATION}
        className="max-w-lg"
      >
        <div className="space-y-4">
          {note && <p className="text-sm leading-relaxed text-fg-soft">{note}</p>}

          <dl className="divide-y divide-line/60 rounded-xl border border-line bg-surface-2">
            <Row label={AI_DISCLOSURE_FIELDS.task} value={aiTaskLabel(taskType)} />
            <Row label={AI_DISCLOSURE_FIELDS.model} value={clean(modelId)} mono />
            <Row label={AI_DISCLOSURE_FIELDS.promptVersion} value={clean(promptVersion)} mono />
            <Row label={AI_DISCLOSURE_FIELDS.createdAt} value={formatDateTime(createdAt)} />
            <div className="px-3 py-2.5">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
                {AI_DISCLOSURE_FIELDS.sources}
              </dt>
              <dd className="mt-1 text-sm text-fg">
                {list.length > 0 ? (
                  <ul className="space-y-0.5">
                    {list.map((s, i) => (
                      <li key={`${s}-${i}`} className="flex items-start gap-1.5 text-sm text-fg-soft">
                        <span aria-hidden className="mt-0.5 text-primary">
                          •
                        </span>
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-sm text-muted">{AI_DISCLOSURE_NO_SOURCES}</span>
                )}
              </dd>
            </div>
          </dl>

          <p className="text-sm leading-relaxed text-fg-soft">{AI_DISCLOSURE_FULL}</p>

          <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div className="space-y-1">
              <p className="text-xs leading-relaxed text-fg-soft">{AI_DISCLOSURE_REFUSAL}</p>
              <p className="text-xs leading-relaxed text-fg-soft">{AI_DISCLOSURE_HUMAN_OVERSIGHT}</p>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={`text-right text-sm ${value ? 'text-fg' : 'text-muted'} ${mono && value ? 'font-mono text-[12px]' : ''}`}
      >
        {value ?? AI_DISCLOSURE_NO_METADATA}
      </dd>
    </div>
  );
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/** Data legível; entrada inválida degrada para "Não registrado" (nunca "Invalid Date"). */
function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
