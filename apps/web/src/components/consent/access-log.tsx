'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { useAuditLog } from '@hubpatients/supabase';
import { LEGAL_BASIS_LABEL } from '@hubpatients/core';

const ACTION_LABELS: Record<string, string> = {
  create: 'Criou', read: 'Acessou', update: 'Alterou', delete: 'Excluiu',
  export: 'Exportou', print: 'Imprimiu', share: 'Compartilhou',
};
const RESOURCE_LABELS: Record<string, string> = {
  consent: 'consentimento', exam: 'exame', vitals: 'sinais vitais', medication: 'medicamento',
};

const PAGE_SIZE = 10;

export function AccessLog({ patientId }: { patientId: string }) {
  const [page, setPage] = useState(0);
  const { data } = useAuditLog(patientId || undefined, page, PAGE_SIZE);
  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <ScrollText className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold text-fg">Log de acessos</h2>
        <span className="text-xs text-muted">({total})</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted">Nenhum acesso registrado ainda.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-fg">
                  {ACTION_LABELS[e.action] ?? e.action} {RESOURCE_LABELS[e.resource_type] ?? e.resource_type}
                  {(e.metadata as { purpose?: string })?.purpose ? ` · ${(e.metadata as { purpose?: string }).purpose}` : ''}
                </p>
                <p className="text-xs text-muted">{LEGAL_BASIS_LABEL}</p>
              </div>
              <span className="shrink-0 text-xs text-muted">
                {new Date(e.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg p-1 disabled:opacity-40 hover:bg-surface-2"><ChevronLeft className="h-4 w-4" /></button>
          <span>{page + 1} / {pages}</span>
          <button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg p-1 disabled:opacity-40 hover:bg-surface-2"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
