'use client';

import { useMemo, useState } from 'react';
import { BookOpen, GraduationCap } from 'lucide-react';
import { useHealthContent, useConditions, useReadingList, useToggleReadingList } from '@vidalog/supabase';
import { recommendContentByCids, isRelevant } from '@vidalog/core';
import { useAuth } from '@/components/auth-provider';
import { ContentCard } from '@/components/education/content-card';

export default function EducacaoPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: content, isLoading } = useHealthContent();
  const { data: conditions } = useConditions(user?.id);
  const { data: readingIds } = useReadingList(user?.id);
  const toggleSave = useToggleReadingList(userId);

  const [tab, setTab] = useState<'feed' | 'saved'>('feed');

  const userCids = useMemo(() => (conditions ?? []).map((c) => c.cid10_code ?? '').filter(Boolean), [conditions]);
  const ordered = useMemo(() => recommendContentByCids(content ?? [], userCids), [content, userCids]);
  const savedSet = new Set(readingIds ?? []);
  const saved = ordered.filter((c) => savedSet.has(c.id));
  const shown = tab === 'saved' ? saved : ordered;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-primary"><GraduationCap className="h-6 w-6" /></span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Educação</h1>
          <p className="mt-1 text-sm text-muted">Conteúdo confiável, personalizado para você. Termos técnicos têm explicação ao toque.</p>
        </div>
      </header>

      <div className="flex w-fit rounded-xl border border-line bg-surface p-1">
        <Tab active={tab === 'feed'} onClick={() => setTab('feed')}>Para você</Tab>
        <Tab active={tab === 'saved'} onClick={() => setTab('saved')}>Salvos ({saved.length})</Tab>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : shown.length > 0 ? (
        <div className="space-y-3">
          {shown.map((c) => (
            <ContentCard
              key={c.id}
              content={c}
              saved={savedSet.has(c.id)}
              relevant={tab === 'feed' && isRelevant(c, userCids)}
              onToggleSave={() => toggleSave.mutate({ contentId: c.id, saved: savedSet.has(c.id) })}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-16 text-center">
          <BookOpen className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm text-muted">
            {tab === 'saved' ? 'Nenhum conteúdo salvo ainda.' : 'Nenhum conteúdo disponível. Aplique a migration 0008.'}
          </p>
        </div>
      )}

      <p className="text-center text-xs text-muted">
        Conteúdo educativo de fontes confiáveis (MS, SBC, SBD, Fiocruz) — não substitui avaliação médica.
      </p>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${active ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'}`}>
      {children}
    </button>
  );
}
