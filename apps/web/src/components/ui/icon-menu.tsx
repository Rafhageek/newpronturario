'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Botão de ícone na topbar que abre um painel flutuante acessível.
 *
 * Acessibilidade: `aria-haspopup`/`aria-expanded` no gatilho, fecha com Esc,
 * fecha ao clicar fora, devolve o foco ao gatilho ao fechar. O conteúdo é uma
 * render-prop que recebe `close` para que ações internas possam dispensar o
 * painel (ex.: ao navegar ou marcar como lido).
 */
export function IconMenu({
  label,
  icon,
  badge,
  align = 'end',
  width = 'w-80',
  children,
}: {
  label: string;
  icon: ReactNode;
  /** Contagem exibida no badge (oculto quando 0/undefined). */
  badge?: number;
  align?: 'end' | 'start';
  width?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hasBadge = typeof badge === 'number' && badge > 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        // 36px era o menor alvo interativo do shell da web. Piso de 44px.
        className={`relative flex min-h-11 min-w-11 items-center justify-center rounded-xl transition ${
          open ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'
        }`}
      >
        {icon}
        {hasBadge && (
          /*
            O contador NÃO pulsa mais. O `animate-ping` que estava aqui era uma
            animação em LOOP INDEFINIDO ao lado de conteúdo — proibida pelo
            sistema de movimento (WCAG SC 2.2.2) e gatilho vestibular num público
            majoritariamente 40+. O que o pulso tentava fazer (chamar atenção) já
            é feito pela cor de destaque, pelo anel e pelo número.
            Tamanho em degrau semântico (`text-caption`): `text-[10px]` fixo não
            crescia no Modo Sênior, e o contador era o texto menor da casca.
          */
          <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-caption font-bold leading-none text-white ring-2 ring-surface">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={`absolute top-full z-50 mt-2 ${
              align === 'end' ? 'right-0' : 'left-0'
            } ${width} origin-top overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/10 dark:shadow-black/40`}
          >
            {children(close)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
