'use client';

import { AlertTriangle, Ban, HeartHandshake } from 'lucide-react';
import type { ContentRisk } from '@hubpatients/core';

/**
 * Aviso pré-publicação dos guardrails de saúde. Não bloqueia por conta própria —
 * a página decide (venda de medicamento = bloqueio; posologia/crise = aviso).
 */
export function ContentGuardNotice({ risk }: { risk: ContentRisk }) {
  if (!risk.posology && !risk.medSale && !risk.crisis) return null;
  return (
    <div className="space-y-2">
      {risk.medSale && (
        <Notice tone="block" icon={Ban}>
          Compra, venda, troca ou doação de medicamentos é proibida por lei no Brasil e não pode ser
          publicada aqui.
        </Notice>
      )}
      {risk.crisis && (
        <Notice tone="support" icon={HeartHandshake}>
          Sentimos muito que você esteja passando por isso — você não está sozinho(a). Fale agora com
          o <strong>CVV: 188</strong> (24h, gratuito e sigiloso). Seu relato é bem-vindo na comunidade.
        </Notice>
      )}
      {risk.posology && (
        <Notice tone="warn" icon={AlertTriangle}>
          Experiências pessoais são bem-vindas; recomendações de dose só podem vir do seu médico. Sua
          publicação pode passar por revisão.
        </Notice>
      )}
    </div>
  );
}

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'block' | 'warn' | 'support';
  icon: typeof Ban;
  children: React.ReactNode;
}) {
  const styles = {
    block: 'border-rose-500/30 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300',
    warn: 'border-amber-500/30 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
    support: 'border-sky-400/30 bg-sky-500/[0.06] text-fg-soft',
  }[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
