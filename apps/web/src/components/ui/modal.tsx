'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal acessível e reutilizável:
 * - role="dialog" + aria-modal + aria-labelledby ligado ao título
 * - move o foco para dentro ao abrir e RESTAURA ao fechar
 * - prende o Tab (focus-trap) e fecha com Escape
 * - trava o scroll do fundo
 * - animação respeita prefers-reduced-motion (via MotionConfig global)
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** classe de largura do painel (ex.: 'max-w-md', 'max-w-2xl') */
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  /*
   * `onClose` fica num ref, e o efeito depende SÓ de `open`.
   *
   * Sem isso, digitar num campo dentro do modal quebrava o formulário: quase
   * todo pai passa `onClose={() => ...}` inline, então a função é recriada a
   * cada render; cada tecla digitada re-renderiza, o efeito abaixo rodava de
   * novo e reposicionava o foco no PRIMEIRO elemento focável — o botão X.
   * Na prática, a pessoa digitava uma letra e o cursor pulava para o "fechar".
   *
   * O ref mantém o handler sempre atual para o Escape, sem fazer o efeito
   * (que também é quem dá o foco inicial) depender da identidade da função.
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // foco inicial: primeiro focável dentro do painel, senão o próprio painel
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      const activeEl = document.activeElement;
      if (e.shiftKey && activeEl === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={`relative max-h-[90vh] w-full ${className} overflow-y-auto rounded-2xl border border-line bg-surface p-6 text-fg shadow-2xl outline-none`}
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <h2
              id={titleId}
              className="pr-10 text-lg font-bold text-fg"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-xs text-muted">
                {description}
              </p>
            )}
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
