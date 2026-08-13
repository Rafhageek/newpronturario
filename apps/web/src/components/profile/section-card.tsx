'use client';

import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, type LucideIcon } from 'lucide-react';

/** Card de seção do prontuário, expansível. */
export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  defaultOpen = false,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex min-h-16 w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-primary">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          {/*
           * LEGIBILIDADE 50+ — este cabeçalho aparece em TODAS as seções do
           * Perfil, então ele sozinho respondia por boa parte da queixa mais
           * repetida do projeto ("os caracteres estão claros"). O subtítulo que
           * o cliente apontou com a seta ("Substâncias e gravidade") era
           * `text-xs` (12px) + `--muted`: abaixo do piso de 13px do sistema e
           * três degraus abaixo do corpo do app.
           *
           * Os dois degraus vêm da mesma revisão já aplicada nas primitivas do
           * Painel (components/ui/painel/primitives.tsx): linha principal em
           * `text-body` (17px) e metadado em `text-body-sm` (15px), os dois em
           * `rem` puro — é o que faz o Modo Sênior levá-los a ~22px e ~19,5px.
           * Um `text-[Npx]` aqui desligaria o Modo Sênior em seis seções.
           *
           * Tinta, medida com a fórmula da WCAG 2.x contra o fundo REAL deste
           * botão (`--surface`) e contra o fundo de hover (`--surface-2`):
           *
           *              claro (#ffffff / #f7f8fc)   escuro (#171717 / #212121)
           *   muted      5,90 / 5,56                 7,84 / 7,04     (ANTES)
           *   fg-soft   10,40 / 9,80                12,05 / 10,82    (DEPOIS)
           *
           * O `truncate` do subtítulo SAIU, e isso é obrigatório junto com o
           * aumento — não opcional. Subir a letra dentro da mesma largura só
           * troca "pequeno demais para ler" por "cortado antes de terminar",
           * que é a mesma falha com outro nome (foi exatamente o que aconteceu
           * com o StatCard compacto nesta semana). O botão é `min-h-16` com
           * `items-center`: ele foi feito para crescer, então o subtítulo
           * quebra a linha e o cabeçalho acompanha.
           */}
          <p className="text-body font-semibold leading-tight text-fg">{title}</p>
          {subtitle && (
            <p className="mt-0.5 text-body-sm leading-snug text-fg-soft [overflow-wrap:anywhere]">
              {subtitle}
            </p>
          )}
        </div>
        {/* O selo vem de fora e não declara `shrink-0`. Agora que o texto ao
            lado pode ocupar duas linhas, sem isto ele seria o primeiro a ser
            espremido. */}
        {badge && <span className="shrink-0">{badge}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div id={contentId} className="border-t border-line px-5 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
