'use client';

import { useState } from 'react';
import { Baby } from 'lucide-react';
import { toast } from 'sonner';
import { startPregnancySchema, type PregnancyRisk } from '@hubpatients/core';
import { useStartPregnancy } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';
import { PregnancyDisclaimer } from './pregnancy-disclaimer';

export function PregnancyOnboarding({ userId }: { userId: string }) {
  const start = useStartPregnancy(userId);
  const [mode, setMode] = useState<'dpp' | 'dum'>('dpp');
  const [dateStr, setDateStr] = useState('');
  const [risk, setRisk] = useState<PregnancyRisk | ''>('');
  const [obName, setObName] = useState('');
  const [obPhone, setObPhone] = useState('');
  const [matName, setMatName] = useState('');
  const [matPhone, setMatPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    const parsed = startPregnancySchema.safeParse({
      dueDate: mode === 'dpp' && dateStr ? dateStr : undefined,
      lmpDate: mode === 'dum' && dateStr ? dateStr : undefined,
      riskLevel: risk || undefined,
      obstetricianName: obName || undefined,
      obstetricianPhone: obPhone || undefined,
      maternityReference: matName || undefined,
      maternityPhone: matPhone || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os dados.');
      return;
    }
    try {
      await start.mutateAsync({
        dueDate: parsed.data.dueDate,
        lmpDate: parsed.data.lmpDate,
        riskLevel: parsed.data.riskLevel,
        obstetricianName: parsed.data.obstetricianName,
        obstetricianPhone: parsed.data.obstetricianPhone,
        maternityReference: parsed.data.maternityReference,
        maternityPhone: parsed.data.maternityPhone,
      });
      toast.success('Acompanhamento iniciado. 🤰');
    } catch {
      setError('Não foi possível iniciar. Você já pode ter uma gestação ativa.');
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-400 text-white">
          <Baby className="h-8 w-8" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
          Iniciar acompanhamento da gestação
        </h1>
        <p className="mt-2 text-sm text-muted">
          Informe uma data para calcularmos a idade gestacional e sugerirmos o calendário de
          pré-natal do Ministério da Saúde.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        {/* DUM ou DPP */}
        <div role="group" aria-label="Como você quer informar a data" className="flex rounded-xl border border-line bg-surface-2 p-1">
          <button
            type="button"
            aria-pressed={mode === 'dpp'}
            onClick={() => setMode('dpp')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${mode === 'dpp' ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'}`}
          >
            Sei a data provável do parto
          </button>
          <button
            type="button"
            aria-pressed={mode === 'dum'}
            onClick={() => setMode('dum')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${mode === 'dum' ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'}`}
          >
            Sei a data da última menstruação
          </button>
        </div>

        <Field
          label={mode === 'dpp' ? 'Data provável do parto (DPP)' : 'Data da última menstruação (DUM)'}
          htmlFor="preg-date"
          error={error ?? undefined}
        >
          <Input id="preg-date" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
        </Field>

        <Field label="Risco (informado pelo seu médico — opcional)" htmlFor="preg-risk">
          <select
            id="preg-risk"
            value={risk}
            onChange={(e) => setRisk(e.target.value as PregnancyRisk | '')}
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
          >
            <option value="">Não informado</option>
            <option value="habitual">Risco habitual</option>
            <option value="alto">Alto risco</option>
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Obstetra (opcional)" htmlFor="preg-ob"><Input id="preg-ob" value={obName} onChange={(e) => setObName(e.target.value)} placeholder="Dra. Ana" /></Field>
          <Field label="Telefone do obstetra" htmlFor="preg-ob-phone"><Input id="preg-ob-phone" value={obPhone} onChange={(e) => setObPhone(e.target.value)} placeholder="(11) 9…" /></Field>
          <Field label="Maternidade de referência" htmlFor="preg-mat"><Input id="preg-mat" value={matName} onChange={(e) => setMatName(e.target.value)} /></Field>
          <Field label="Telefone da maternidade" htmlFor="preg-mat-phone"><Input id="preg-mat-phone" value={matPhone} onChange={(e) => setMatPhone(e.target.value)} placeholder="(11) …" /></Field>
        </div>

        <Button onClick={onSubmit} disabled={start.isPending} className="w-full">
          {start.isPending ? 'Iniciando…' : 'Iniciar acompanhamento da gestação'}
        </Button>
      </div>

      <PregnancyDisclaimer />
    </div>
  );
}
