'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, Clock, MessageCircleQuestion, Stethoscope } from 'lucide-react';
import type { Exam, ExamMetric, ExamMetricExplanation } from '@vidalog/core';
import { buildExamNarrative, EXAM_CATEGORY_LABELS, normalizeMetricKey } from '@vidalog/core';
import { useExplanations } from '@vidalog/supabase';
import { ExamDisclaimer, CriticalBanner } from './exam-disclaimer';
import { MetricRow } from './metric-row';
import { ThematicPanels } from './thematic-panels';

export function ExamReport({
  exam,
  metrics,
  patientId,
}: {
  exam: Exam;
  metrics: ExamMetric[];
  patientId: string;
}) {
  const { data: explanations } = useExplanations();
  const [showOk, setShowOk] = useState(false);

  const explMap = useMemo(() => {
    const map = new Map<string, ExamMetricExplanation>();
    (explanations ?? []).forEach((e) => map.set(e.metric_key, e));
    return map;
  }, [explanations]);
  const explFor = (m: ExamMetric) => explMap.get(normalizeMetricKey(m.metric_code ?? m.name));

  const narrative = useMemo(() => buildExamNarrative(metrics), [metrics]);

  // Exames de imagem/cardio: sem métricas → mostra o laudo resumido.
  const isLab = exam.category === 'lab';

  return (
    <div className="space-y-5">
      {narrative.hasCritical && <CriticalBanner />}

      {/* 1) Resumo em 30 segundos */}
      <section className="rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/[0.1] to-transparent p-5">
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-fg">Resumo em 30 segundos</h3>
        </div>
        <ul className="space-y-1.5">
          {narrative.summary.map((s, i) => (
            <li key={i} className="text-sm leading-relaxed text-fg">• {s}</li>
          ))}
        </ul>
      </section>

      {isLab && metrics.length > 0 ? (
        <>
          {/* Painéis temáticos */}
          <ThematicPanels metrics={metrics} />

          {/* 2) Priorização — pontos de atenção primeiro */}
          {narrative.attention.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-amber-300">Pontos de atenção</h3>
              <div className="space-y-2">
                {narrative.attention.map((m) => (
                  <MetricRow key={m.id} metric={m} explanation={explFor(m)} patientId={patientId} />
                ))}
              </div>
            </section>
          )}

          {/* Tudo certo (colapsado) */}
          {narrative.normal.length > 0 && (
            <section>
              <button onClick={() => setShowOk((v) => !v)} className="flex w-full items-center gap-2 text-sm font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Tudo certo ({narrative.normal.length})
                <ChevronDown className={`h-4 w-4 transition-transform ${showOk ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {showOk && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 space-y-2">
                    {narrative.normal.map((m) => (
                      <MetricRow key={m.id} metric={m} explanation={explFor(m)} patientId={patientId} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* 5) Perguntas para o médico */}
          <section className="rounded-2xl border border-line bg-surface p-5">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircleQuestion className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-fg">Perguntas para levar ao médico</h3>
            </div>
            <ul className="space-y-2">
              {narrative.questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-fg-soft">
                  <span className="mt-0.5 text-primary">{i + 1}.</span>
                  {q}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        // Imagem / cardio: laudo textual resumido (nunca interpretamos a imagem)
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-2 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-fg">
              Laudo · {EXAM_CATEGORY_LABELS[exam.category]}
            </h3>
          </div>
          {exam.raw_text ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-soft">{exam.raw_text}</p>
          ) : (
            <p className="text-sm text-muted">
              Arquivo armazenado. Adicione o texto do laudo para um resumo em linguagem simples.
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted">
            Para exames de imagem, o VidaLog não interpreta a imagem — apenas organiza o laudo do seu médico.
          </p>
        </section>
      )}

      <ExamDisclaimer />
    </div>
  );
}
