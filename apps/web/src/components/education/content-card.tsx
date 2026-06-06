'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, ChevronDown, Clock, ExternalLink, Sparkles } from 'lucide-react';
import type { HealthContent } from '@vidalog/core';
import { GlossaryText } from './glossary-text';

export function ContentCard({
  content,
  saved,
  relevant,
  onToggleSave,
}: {
  content: HealthContent;
  saved: boolean;
  relevant?: boolean;
  onToggleSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {relevant && (
              <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" /> Para você
              </span>
            )}
            <h3 className="text-base font-semibold text-fg">{content.title}</h3>
            <p className="mt-1 flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {content.reading_minutes} min</span>
              <span>· {content.source}</span>
            </p>
          </div>
          <button onClick={onToggleSave} className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-primary" aria-label={saved ? 'Remover da lista' : 'Salvar para depois'}>
            {saved ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}
          </button>
        </div>

        <button onClick={() => setOpen((o) => !o)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          {open ? 'Fechar' : 'Ler'} <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="border-t border-line px-5 py-4">
              <GlossaryText text={content.body} />
              {content.source_url && (
                <a href={content.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Fonte: {content.source} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
