'use client';

import { Check, ShieldCheck, Sparkles } from 'lucide-react';
import { FEATURES, PLANS, type PlanId } from '@hubpatients/core';
import { VoucherRedeem } from '@/components/plus/voucher-redeem';

const featureList = Object.values(FEATURES);

export default function PlanosPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-fg" style={{ fontFamily: 'var(--font-display)' }}>
          Escolha seu plano
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          As features de <span className="font-semibold text-emerald-700 dark:text-emerald-300">segurança são gratuitas para sempre</span>. O
          Plus adiciona organização e interpretação didática.
        </p>
      </header>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <PlanCard plan="free" />
        <PlanCard plan="plus" highlighted />
      </div>

      <div className="mx-auto mt-5 max-w-md">
        <VoucherRedeem />
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-status-ok-ink" />
        Trial de 14 dias no Plus · pagamento por cartão ou Pix (Fase 2)
      </p>
    </div>
  );
}

function PlanCard({ plan, highlighted }: { plan: PlanId; highlighted?: boolean }) {
  const info = PLANS[plan];
  const items = featureList.filter((f) => f.safetyCritical || f.plans.includes(plan));

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-6 ${
        highlighted ? 'border-sky-400/30 bg-sky-500/[0.06]' : 'border-line bg-surface'
      }`}
    >
      {highlighted && (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          <Sparkles className="h-3 w-3" /> Recomendado
        </span>
      )}
      <h3 className="text-lg font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
        {info.name}
      </h3>
      <p className="mt-1 text-sm text-muted">{info.description}</p>
      <p className="mt-4 text-3xl font-bold text-fg">
        {info.priceMonthlyBRL === 0 ? (
          'Grátis'
        ) : (
          <>
            R$ {info.priceMonthlyBRL.toFixed(2).replace('.', ',')}
            <span className="text-sm font-medium text-muted">/mês</span>
          </>
        )}
      </p>

      <ul className="mt-5 space-y-2.5">
        {items.map((f) => (
          <li key={f.key} className="flex items-start gap-2.5 text-sm text-fg-soft">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${f.safetyCritical ? 'text-status-ok-ink' : 'text-primary'}`} />
            <span>
              {f.label}
              {f.safetyCritical && <span className="ml-1.5 text-xs text-emerald-700 dark:text-emerald-300/80">· grátis sempre</span>}
            </span>
          </li>
        ))}
      </ul>

      <button
        disabled
        className={`mt-6 h-11 w-full rounded-xl text-sm font-semibold transition ${
          highlighted
            ? 'bg-gradient-to-r from-sky-500 to-cyan-400 text-white opacity-90'
            : 'border border-line text-fg-soft'
        }`}
      >
        {plan === 'free' ? 'Seu plano atual' : 'Assinar (em breve · Fase 2)'}
      </button>
    </div>
  );
}
