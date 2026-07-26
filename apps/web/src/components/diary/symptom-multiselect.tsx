'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { COMMON_SYMPTOMS } from '@hubpatients/core';

export function SymptomMultiselect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [custom, setCustom] = useState('');

  function toggle(s: string) {
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  }
  function addCustom() {
    const t = custom.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom('');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {COMMON_SYMPTOMS.map((s) => {
          const on = value.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                on ? 'border-sky-400/40 bg-sky-500/20 text-primary' : 'border-line text-muted hover:bg-surface-2'
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Sintomas personalizados selecionados que não estão na lista comum */}
      {value.filter((s) => !COMMON_SYMPTOMS.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value
            .filter((s) => !COMMON_SYMPTOMS.includes(s))
            .map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 text-xs text-primary">
                {s}
                <button type="button" onClick={() => toggle(s)} aria-label="Remover"><X className="h-3 w-3" /></button>
              </span>
            ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Outro sintoma…"
          className="h-10 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-muted focus:border-sky-400/50 focus:outline-none"
        />
        <button type="button" onClick={addCustom} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm text-fg-soft hover:bg-surface-2">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  );
}
