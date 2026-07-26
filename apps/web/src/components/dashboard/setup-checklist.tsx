'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, Rocket, X } from 'lucide-react';

export interface SetupStep {
  label: string;
  href: string;
  done: boolean;
}

/**
 * Checklist de primeiros passos (onboarding). Aparece só enquanto houver etapas
 * pendentes e o usuário não tiver dispensado. Deriva de dados reais — some sozinho
 * conforme o usuário completa o perfil, alergias e o primeiro medicamento.
 */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const [dismissed, setDismissed] = useState(true); // começa oculto até hidratar
  useEffect(() => {
    setDismissed(localStorage.getItem('vl-onboarding-dismissed') === '1');
  }, []);

  const done = steps.filter((s) => s.done).length;
  const allDone = done === steps.length;
  if (dismissed || allDone) return null;

  function dismiss() {
    localStorage.setItem('vl-onboarding-dismissed', '1');
    setDismissed(true);
  }

  return (
    <section className="vl-rise relative overflow-hidden rounded-2xl border border-sky-400/25 bg-sky-500/[0.05] p-5">
      <button
        onClick={dismiss}
        aria-label="Dispensar primeiros passos"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-primary">
          <Rocket className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-fg">Comece por aqui</h3>
          <p className="text-xs text-muted">{done} de {steps.length} concluídos — leva poucos minutos.</p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {steps.map((s) => (
          <li key={s.href + s.label}>
            <Link
              href={s.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                s.done ? 'text-muted' : 'bg-surface text-fg hover:bg-surface-2'
              }`}
            >
              {s.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-status-ok-ink" aria-hidden />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-faint" aria-hidden />
              )}
              <span className={`flex-1 ${s.done ? 'line-through' : 'font-medium'}`}>{s.label}</span>
              {!s.done && <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
