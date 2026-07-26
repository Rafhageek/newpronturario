'use client';

import { useState } from 'react';
import { Scale, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BODY_COMPOSITION_FIELDS,
  formatBodyValue,
  BODY_DISCLAIMER,
  type BodyField,
} from '@hubpatients/core';
import {
  useBodyComposition,
  useLogBodyComposition,
  type BodyCompositionInput,
} from '@hubpatients/supabase';
import { useActiveProfile } from '@/components/profile-context';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

const INT_FIELDS = new Set(['bmr_kcal']);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const asRecord = (r: unknown) => r as Record<string, number | null>;

export default function ComposicaoCorporalPage() {
  const { ownId } = useActiveProfile();
  const { data: history = [], isLoading } = useBodyComposition(ownId || undefined);
  const logBody = useLogBodyComposition(ownId || undefined);
  const [values, setValues] = useState<Record<string, string>>({});

  const latest = history[0] ?? null;
  const prev = history[1] ?? null;

  async function handleSave() {
    if (logBody.isPending) return;
    const input: BodyCompositionInput = {};
    let any = false;
    for (const f of BODY_COMPOSITION_FIELDS) {
      const raw = values[f.key]?.trim();
      if (!raw) continue;
      const n = parseFloat(raw.replace(',', '.'));
      if (Number.isFinite(n)) {
        (input as Record<string, number>)[f.key] = INT_FIELDS.has(f.key) ? Math.round(n) : n;
        any = true;
      }
    }
    if (!any) {
      toast.info('Preencha ao menos um campo.');
      return;
    }
    try {
      await logBody.mutateAsync(input);
      setValues({});
      toast.success('Medição registrada.');
    } catch {
      toast.error('Não foi possível registrar agora.');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-status-info-ink">
          <Scale className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Composição corporal
          </h1>
          <p className="text-sm text-muted">O que sua balança indica — registro pessoal, sem diagnóstico.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : latest ? (
        <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fg">Última medição</h2>
            <span className="text-xs text-muted">{fmtDate(latest.measured_at)}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {BODY_COMPOSITION_FIELDS.map((f) => (
              <SnapshotCell
                key={f.key}
                field={f}
                value={asRecord(latest)[f.key]}
                prevValue={prev ? asRecord(prev)[f.key] : null}
              />
            ))}
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
          Nada registrado ainda — preencha abaixo o que sua balança mostra.
        </p>
      )}

      <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-fg">Registrar medição</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {BODY_COMPOSITION_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                {f.label}
                {f.unit ? ` (${f.unit})` : ''}
              </span>
              <input
                inputMode="decimal"
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                placeholder="—"
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none transition focus:border-primary"
              />
            </label>
          ))}
        </div>
        <button
          onClick={handleSave}
          disabled={logBody.isPending}
          aria-busy={logBody.isPending || undefined}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {logBody.isPending ? <Spinner className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
          {logBody.isPending ? 'Salvando…' : 'Salvar medição'}
        </button>
        <p className="mt-3 text-[11px] leading-4 text-muted">{BODY_DISCLAIMER}</p>
      </section>

      {history.length > 1 && (
        <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-fg">Histórico</h2>
          <ul className="divide-y divide-line">
            {history.slice(0, 20).map((row) => (
              <li key={row.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-semibold text-fg">{fmtDate(row.measured_at)}</span>
                <span className="text-xs text-muted">
                  {[
                    row.weight_kg != null ? `${row.weight_kg.toFixed(1).replace('.', ',')} kg` : null,
                    row.body_fat_pct != null ? `${row.body_fat_pct.toFixed(1).replace('.', ',')}% gordura` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Medição registrada'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SnapshotCell({
  field,
  value,
  prevValue,
}: {
  field: BodyField;
  value: number | null | undefined;
  prevValue: number | null | undefined;
}) {
  const delta =
    value != null && prevValue != null && Number.isFinite(value) && Number.isFinite(prevValue)
      ? value - prevValue
      : null;
  const show = delta != null && Math.abs(delta) >= (field.decimals === 0 ? 1 : 0.1);
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <p className="text-xs text-muted">{field.label}</p>
      <div className="mt-0.5 flex items-center gap-1">
        <p className="text-lg font-bold text-fg">{formatBodyValue(value, field)}</p>
        {show && (
          <span className="flex items-center text-[11px] text-muted">
            {delta! > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta!).toFixed(field.decimals).replace('.', ',')}
          </span>
        )}
      </div>
    </div>
  );
}
