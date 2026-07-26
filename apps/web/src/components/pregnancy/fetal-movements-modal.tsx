'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { fetalMovementSchema } from '@hubpatients/core';
import { useLogFetalMovement } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

export function FetalMovementsModal({
  open,
  onClose,
  journeyId,
}: {
  open: boolean;
  onClose: () => void;
  journeyId: string;
}) {
  const log = useLogFetalMovement(journeyId);
  const [duration, setDuration] = useState('');
  const [count, setCount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    const parsed = fetalMovementSchema.safeParse({
      durationMinutes: duration || undefined,
      movementsCount: count || undefined,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os dados.');
      return;
    }
    try {
      await log.mutateAsync(parsed.data);
      toast.success('Registro salvo.');
      setDuration('');
      setCount('');
      setNotes('');
      onClose();
    } catch {
      setError('Não foi possível salvar.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar movimentos do bebê" className="max-w-md">
      <p className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
        Este é apenas um registro pessoal — o app não avalia se os movimentos estão normais. Se
        você perceber redução dos movimentos, contate seu obstetra ou a maternidade.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Duração (min)" htmlFor="fm-dur">
          <Input id="fm-dur" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ex.: 60" />
        </Field>
        <Field label="Nº de movimentos" htmlFor="fm-count" error={error ?? undefined}>
          <Input id="fm-count" type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Ex.: 10" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Observações (opcional)" htmlFor="fm-notes">
          <Input id="fm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">
          Cancelar
        </button>
        <Button onClick={onSubmit} disabled={log.isPending}>
          {log.isPending ? 'Salvando…' : 'Salvar registro'}
        </Button>
      </div>
    </Modal>
  );
}
