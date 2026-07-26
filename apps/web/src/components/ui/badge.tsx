import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

/**
 * Cor de cada tom — vem do SISTEMA DE STATUS (`--status-*` em globals.css, que
 * espelha `status` de @hubpatients/ui-tokens), nunca da paleta crua do Tailwind.
 *
 * Por quê: `amber-500` sobre off-white dá 2,04:1 e `emerald-500` 2,41:1 — ambos
 * reprovam em texto (AA pede 4,5:1). O sistema separa três papéis justamente por
 * isso: `ink` é a única cor que pode carregar texto, e ela é calculada CONTRA o
 * `tint` que serve de fundo aqui. Como as CSS vars trocam sozinhas no tema
 * escuro, o par `dark:` deixou de ser necessário.
 *
 * Mapeamento dos tons não-clínicos: `primary` e `info` (ex.: "novo", "beta")
 * caem em `--status-info-*`; `neutral` segue nas superfícies neutras.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg-soft',
  primary: 'bg-status-info-tint text-status-info-ink',
  success: 'bg-status-ok-tint text-status-ok-ink',
  warning: 'bg-status-attention-tint text-status-attention-ink',
  danger: 'bg-status-alert-tint text-status-alert-ink',
  info: 'bg-status-info-tint text-status-info-ink',
};

/** Etiqueta padronizada (uma só fonte para tamanhos/cores em todo o app). */
export function Badge({
  tone = 'neutral',
  icon,
  children,
  className = '',
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${TONES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
