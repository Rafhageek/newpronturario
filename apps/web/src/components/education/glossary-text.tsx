'use client';

import { Fragment, useState } from 'react';
import { GLOSSARY, lookupGlossary } from '@vidalog/core';

// Regex com todos os termos do glossário (mais longos primeiro p/ casar melhor).
const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const TERM_REGEX = new RegExp(`\\b(${TERMS.map(escapeRegex).join('|')})\\b`, 'gi');

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Renderiza o texto destacando termos do glossário como tooltips clicáveis. */
export function GlossaryText({ text }: { text: string }) {
  const parts = text.split(TERM_REGEX);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-soft">
      {parts.map((part, i) => {
        const def = lookupGlossary(part);
        return def ? <GlossaryTerm key={i} term={part} definition={def} /> : <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}

function GlossaryTerm({ term, definition }: { term: string; definition: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="border-b border-dashed border-sky-400/60 text-primary hover:text-sky-100"
        aria-label={`Definição de ${term}`}
      >
        {term}
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-20 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-fg shadow-xl">
          {definition}
        </span>
      )}
    </span>
  );
}
