'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CYCLE_MOODS,
  CYCLE_SYMPTOMS,
  FLOW_LEVEL_LABELS,
  cycleLogSchema,
} from '@hubpatients/core';
import { useAddCycleLog } from '@hubpatients/supabase';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input } from '@/components/ui';

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDatePt(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const FLOW_LEVELS = [0, 1, 2, 3] as const;

/**
 * Modal de registro diário do ciclo: fluxo (0..3), sintomas e humor (múltiplos)
 * e notas. Valida com cycleLogSchema (safeParse) e grava via useAddCycleLog.
 */
export function LogDayModal({
  open,
  onClose,
  userId,
  targetDate,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  /** Data alvo (YYYY-MM-DD). Default: hoje. */
  targetDate?: string | null;
}) {
  const addLog = useAddCycleLog(userId);

  const [flowLevel, setFlowLevel] = useState(0);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const date = useMemo(() => targetDate ?? todayISO(), [targetDate]);

  // Ao (re)abrir, zera o formulário.
  useEffect(() => {
    if (open) {
      setFlowLevel(0);
      setSymptoms([]);
      setMood([]);
      setNotes('');
    }
  }, [open, date]);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function submit() {
    const parsed = cycleLogSchema.safeParse({
      logDate: date,
      flowLevel,
      symptoms,
      mood,
      notes: notes.trim() || undefined,
    });
    if (!parsed.success) {
      toast.error('Verifique os dados do registro.');
      return;
    }
    try {
      await addLog.mutateAsync({
        logDate: date,
        input: {
          flowLevel: parsed.data.flowLevel,
          symptoms: parsed.data.symptoms,
          mood: parsed.data.mood,
          notes: parsed.data.notes,
        },
      });
      toast.success('Registro salvo.');
      onClose();
    } catch {
      toast.error('Não foi possível salvar o registro.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar dia"
      description={formatDatePt(date)}
    >
      <div className="space-y-5">
        {/* Nível de fluxo */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-fg-soft">Nível de fluxo</legend>
          <div className="flex flex-wrap gap-2">
            {FLOW_LEVELS.map((level) => {
              const active = flowLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFlowLevel(level)}
                  className={`inline-flex h-11 min-h-[44px] items-center rounded-xl border px-4 text-sm font-medium transition ${
                    active
                      ? 'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300'
                      : 'border-line bg-surface-2 text-fg-soft hover:bg-surface'
                  }`}
                >
                  {FLOW_LEVEL_LABELS[level]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Sintomas */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-fg-soft">Sintomas</legend>
          <div className="flex flex-wrap gap-2">
            {CYCLE_SYMPTOMS.map((s) => {
              const active = symptoms.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(symptoms, setSymptoms, s)}
                  className={`inline-flex h-11 min-h-[44px] items-center rounded-xl border px-3.5 text-sm font-medium transition ${
                    active
                      ? 'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300'
                      : 'border-line bg-surface-2 text-fg-soft hover:bg-surface'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Humor */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-fg-soft">Humor</legend>
          <div className="flex flex-wrap gap-2">
            {CYCLE_MOODS.map((m) => {
              const active = mood.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(mood, setMood, m)}
                  className={`inline-flex h-11 min-h-[44px] items-center rounded-xl border px-3.5 text-sm font-medium transition ${
                    active
                      ? 'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300'
                      : 'border-line bg-surface-2 text-fg-soft hover:bg-surface'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Notas */}
        <Field label="Notas (opcional)" htmlFor="cycle-notes">
          <Input
            id="cycle-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Algo que queira lembrar deste dia…"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm font-medium text-fg-soft transition hover:bg-surface-2"
          >
            Cancelar
          </button>
          <Button type="button" onClick={submit} disabled={addLog.isPending}>
            {addLog.isPending ? 'Salvando…' : 'Salvar registro'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
