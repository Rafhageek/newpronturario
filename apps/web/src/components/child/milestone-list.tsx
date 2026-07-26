'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Child, ChildMilestone, ChildMilestoneCatalog, MilestoneCategory } from '@hubpatients/core';
import { CHILD_MILESTONE_CATEGORY_LABELS } from '@hubpatients/core';
import { useChildMilestones, useMarkMilestone, useMilestoneCatalog } from '@hubpatients/supabase';
import { confirmAction } from '@/lib/confirm';

const CATEGORY_ORDER: MilestoneCategory[] = ['motor', 'language', 'social', 'cognitive'];

function typicalAgeLabel(min: number, max: number): string {
  const fmt = (m: number) => {
    if (m < 12) return `${m} m`;
    const y = Math.floor(m / 12);
    const r = m % 12;
    return r > 0 ? `${y}a${r}m` : `${y}a`;
  };
  return min === max ? `~${fmt(min)}` : `${fmt(min)}–${fmt(max)}`;
}

export function MilestoneList({ child }: { child: Child }) {
  const { data: catalog, isLoading: catalogLoading, isError: catalogError } = useMilestoneCatalog();
  const { data: milestones, isLoading: milestonesLoading, isError: milestonesError } = useChildMilestones(child.id);
  const mark = useMarkMilestone(child.id);

  const achievedMap = useMemo(() => {
    const map = new Map<string, ChildMilestone>();
    for (const m of milestones ?? []) {
      if (m.achieved_at) map.set(m.milestone_code, m);
    }
    return map;
  }, [milestones]);

  const byCategory = useMemo(() => {
    const groups = new Map<MilestoneCategory, ChildMilestoneCatalog[]>();
    for (const c of catalog ?? []) {
      const arr = groups.get(c.category) ?? [];
      arr.push(c);
      groups.set(c.category, arr);
    }
    return groups;
  }, [catalog]);

  if (catalogLoading || milestonesLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />;
  }
  if (catalogError || milestonesError) {
    return (
      <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
        Não foi possível carregar os marcos do desenvolvimento.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
        As faixas etárias são típicas, não rígidas. Cada criança tem seu próprio ritmo.
      </p>

      {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => (
        <section key={cat}>
          <h3 className="mb-2 text-sm font-semibold text-fg">{CHILD_MILESTONE_CATEGORY_LABELS[cat]}</h3>
          <ul className="space-y-1.5">
            {(byCategory.get(cat) ?? []).map((item) => (
              <MilestoneRow
                key={item.code}
                item={item}
                achieved={achievedMap.get(item.code) ?? null}
                pending={mark.isPending}
                onMark={(achievedAt) => {
                  mark.mutate(
                    { code: item.code, achievedAt },
                    {
                      onSuccess: () => toast.success(achievedAt ? 'Marco registrado.' : 'Marco desmarcado.'),
                      onError: () => toast.error('Não foi possível salvar.'),
                    },
                  );
                }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MilestoneRow({
  item,
  achieved,
  pending,
  onMark,
}: {
  item: ChildMilestoneCatalog;
  achieved: ChildMilestone | null;
  pending: boolean;
  onMark: (achievedAt: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dateStr, setDateStr] = useState('');
  const isDone = achieved != null;

  function toggle() {
    if (isDone) {
      if (confirmAction('Desmarcar este marco do desenvolvimento?')) onMark(null);
      return;
    }
    setEditing(true);
  }

  function confirmDate() {
    onMark(dateStr || new Date().toISOString().slice(0, 10));
    setEditing(false);
    setDateStr('');
  }

  return (
    <li className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-pressed={isDone}
          aria-label={isDone ? `Desmarcar: ${item.label_pt}` : `Marcar como atingido: ${item.label_pt}`}
          onClick={toggle}
          disabled={pending}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
            isDone
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'border-line text-muted hover:bg-surface-2'
          }`}
        >
          <Check className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">{item.label_pt}</p>
          <p className="text-xs text-muted">
            Faixa típica: {typicalAgeLabel(item.typical_age_months_min, item.typical_age_months_max)}
            {achieved?.achieved_at ? ` · atingido em ${new Date(achieved.achieved_at).toLocaleDateString('pt-BR')}` : ''}
          </p>
          {item.description_short && !editing && (
            <p className="mt-0.5 text-xs text-faint">{item.description_short}</p>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <label className="text-xs text-muted">
            Data em que atingiu
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="mt-1 block h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
            />
          </label>
          <button
            type="button"
            onClick={confirmDate}
            disabled={pending}
            className="inline-flex h-10 items-center rounded-xl bg-sky-500/15 px-3.5 text-sm font-semibold text-primary hover:bg-sky-500/25"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setDateStr(''); }}
            className="inline-flex h-10 items-center rounded-xl border border-line px-3.5 text-sm text-fg-soft hover:bg-surface-2"
          >
            Cancelar
          </button>
        </div>
      )}
    </li>
  );
}
