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
      className="flex w-fit rounded-xl border border-line bg-surface p-1"
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
            className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              active ? 'text-primary' : 'text-muted hover:text-fg'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`${instanceId}-tab-indicator`}
                className="absolute inset-0 rounded-lg bg-sky-500/15"
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
