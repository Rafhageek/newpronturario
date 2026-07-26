'use client';

import { useRef, useState } from 'react';
import { Bold, Eye, Italic, List, Pencil, Quote } from 'lucide-react';
import { MARKDOWN_HINT } from '@hubpatients/core';
import { MarkdownView } from './markdown-view';

/** Editor de markdown básico com barra de formatação, prévia e dica. */
export function MarkdownEditor({
  value,
  onChange,
  rows = 6,
  placeholder = 'Escreva aqui… use **negrito**, *itálico*, listas e citações.',
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function wrap(before: string, after = before, linePrefix?: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    let insert: string;
    if (linePrefix) {
      const block = (selected || 'texto')
        .split('\n')
        .map((l) => `${linePrefix}${l}`)
        .join('\n');
      insert = block;
    } else {
      insert = `${before}${selected || 'texto'}${after}`;
    }
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + insert.length);
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2">
      <div className="flex items-center gap-0.5 border-b border-line px-1.5 py-1">
        <ToolButton label="Negrito" onClick={() => wrap('**')}><Bold className="h-4 w-4" /></ToolButton>
        <ToolButton label="Itálico" onClick={() => wrap('*')}><Italic className="h-4 w-4" /></ToolButton>
        <ToolButton label="Lista" onClick={() => wrap('', '', '- ')}><List className="h-4 w-4" /></ToolButton>
        <ToolButton label="Citação" onClick={() => wrap('', '', '> ')}><Quote className="h-4 w-4" /></ToolButton>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface hover:text-fg"
        >
          {preview ? <><Pencil className="h-3.5 w-3.5" /> Editar</> : <><Eye className="h-3.5 w-3.5" /> Prévia</>}
        </button>
      </div>

      {preview ? (
        <div className="min-h-[6rem] px-3 py-2.5">
          {value.trim() ? (
            <MarkdownView content={value} />
          ) : (
            <p className="text-sm text-faint">Nada para pré-visualizar ainda.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-y bg-transparent px-3 py-2.5 text-sm text-fg placeholder:text-faint focus:outline-none"
        />
      )}
      <p className="px-3 pb-2 text-[11px] text-faint">{MARKDOWN_HINT}</p>
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"
    >
      {children}
    </button>
  );
}
