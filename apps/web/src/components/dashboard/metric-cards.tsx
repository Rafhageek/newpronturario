'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { statusVars, type StatusKind } from '@/components/ui/status-chip';

export const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
export const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

export type SystemTone = 'ok' | 'attention' | 'alert' | 'neutral';

/**
 * Ponte entre o `SystemTone` legado destes cartões e o sistema de status do
 * redesign.
 *
 * O `#10B981 / #F59E0B / #EF4444` que estava aqui dava 2,41 / 2,04 / 3,57:1 em
 * texto sobre o canvas creme — reprovava em AA nos três tons e não tinha versão
 * de tema escuro. O sistema separa `ink` (texto, ≥4,5:1 sobre o `tint`), `mark`
 * (traço, ≥3:1) e `tint` (fundo), que é a única forma honesta de ter âmbar e
 * vermelho acessíveis. Ver `components/ui/status-chip.tsx`.
 */
const SYSTEM_TONE_STATUS: Record<SystemTone, StatusKind> = {
  ok: 'ok',
  attention: 'attention',
  alert: 'alert',
  neutral: 'neutro',
};

/**
 * Cartão de leitura da Home.
 *
 * `accent` continua sendo uma cor CSS livre (API preservada), mas agora aceita
 * CSS var — por isso o fundo do ícone usa `color-mix()` em vez de concatenar
 * `${accent}1f` (concatenação de alfa só funciona com hex literal).
 */
export function MetricCard({
  icon: Icon,
  accent,
  label,
  children,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={item}
      className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition hover:border-primary/40"
    >
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </motion.div>
  );
}

/**
 * Chip de status do SISTEMA: agenda, lembrete, upload, sincronização.
 *
 * ⚠️ NÃO USE PARA DADO DO CORPO DO PACIENTE (pressão, dor, peso, IMC, humor,
 * tendência). Este chip é a única porta de âmbar/vermelho nestes cartões, e a
 * regra do design system (`status` em `packages/ui-tokens/src/index.ts`) reserva
 * essas duas tintas para o SISTEMA — semáforo em dado clínico é diagnóstico
 * disfarçado, e o app não diagnostica.
 *
 * Ele já foi usado para pintar a pressão arterial (`tone={bpStatus.zone}`) — daí
 * o nome novo e explícito. Para faixa de referência de medida clínica use
 * `<ClinicalRangeChip>` (`components/dashboard/clinical-range-chip.tsx`), que é
 * `neutro` + seta + texto. Há teste travando isso:
 * `packages/core/src/utils/regra-cor-clinica.test.ts`.
 */
export function SystemStatusChip({ tone, label }: { tone: SystemTone; label: string }) {
  const { ink, mark, tint } = statusVars(SYSTEM_TONE_STATUS[tone]);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: tint, color: ink }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: mark }} />
      {label}
    </span>
  );
}

/**
 * Seta de tendência entre duas medições.
 *
 * SEM SEMÁFORO de propósito: antes "subiu" era vermelho e "desceu" era verde —
 * isto é diagnóstico disfarçado (subir peso ou pressão não é "ruim" por si só, e
 * quem interpreta é o médico). A direção já está na FORMA da seta; a cor fica
 * neutra e o `aria-label` diz em palavras o que a seta mostra (SC 1.4.1).
 */
export function Trend({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  const cls = 'h-4 w-4 text-status-neutro-ink';
  if (direction === 'up') return <ArrowUpRight className={cls} aria-label="acima da medição anterior" role="img" />;
  if (direction === 'down') return <ArrowDownRight className={cls} aria-label="abaixo da medição anterior" role="img" />;
  return <ArrowRight className={cls} aria-label="igual à medição anterior" role="img" />;
}
