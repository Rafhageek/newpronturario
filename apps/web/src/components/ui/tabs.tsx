'use client';

import { motion } from 'framer-motion';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabDef<T extends string> {
  key: T;
  label: ReactNode;
}

/** Abas acessíveis (role=tablist) com indicador animado compartilhado. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
}) {
  const instanceId = useId();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    onChange(nextTab.key);
    buttonsRef.current[nextIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex w-fit max-w-full overflow-x-auto rounded-full border border-line bg-surface-2 p-1.5 shadow-xs"
    >
      {tabs.map((t, index) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            ref={(element) => {
              buttonsRef.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onChange(t.key)}
            // A aba não declarava altura (~36px). `min-h-11` + inline-flex para
            // o rótulo continuar centrado quando o piso passa a valer.
            className={`relative inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 py-2 text-label font-medium transition ${
              active ? 'text-primary' : 'text-muted hover:text-fg'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`${instanceId}-tab-indicator`}
                className="absolute inset-0 rounded-full border border-line bg-surface shadow-sm"
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
