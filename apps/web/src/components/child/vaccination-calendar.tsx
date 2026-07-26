'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Plus, Syringe } from 'lucide-react';
import { toast } from 'sonner';
import type { Child } from '@hubpatients/core';
import { nextDueVaccines, recordVaccineSchema } from '@hubpatients/core';
import { useChildVaccinations, useRecordVaccine, useVaccineSchedule } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { Button, Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

const STATUS_STYLES: Record<'overdue' | 'due' | 'upcoming', { label: string; cls: string }> = {
  overdue: { label: 'Em atraso', cls: 'text-rose-700 dark:text-rose-300 bg-rose-500/10' },
  due: { label: 'Para agora', cls: 'text-amber-700 dark:text-amber-300 bg-amber-500/10' },
  upcoming: { label: 'A seguir', cls: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10' },
};

function ageLabelMonths(months: number): string {
  if (months === 0) return 'Ao nascer';
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} ${years === 1 ? 'ano' : 'anos'}`;
  return rest > 0 ? `${y} e ${rest} ${rest === 1 ? 'mês' : 'meses'}` : y;
}

export function VaccinationCalendar({ child }: { child: Child }) {
  const { data: vaccinations, isLoading, isError } = useChildVaccinations(child.id);
  const { data: schedule, isLoading: schedLoading } = useVaccineSchedule();
  const [modalOpen, setModalOpen] = useState(false);

  const appliedCodes = useMemo(
    () =>
      (vaccinations ?? [])
        .map((v) => v.dose_label ?? v.vaccine_name)
        .filter((c): c is string => Boolean(c)),
    [vaccinations],
  );

  const due = useMemo(() => {
    if (!schedule) return [];
    return nextDueVaccines(
      child.birth_date,
      appliedCodes,
      schedule.map((s) => ({ code: s.code, recommended_age_months: s.recommended_age_months })),
      new Date(),
    );
  }, [child.birth_date, appliedCodes, schedule]);

  const dueMeta = useMemo(() => {
    return due
      .map((d) => {
        const meta = schedule?.find((s) => s.code === d.code);
        return meta ? { ...d, label_pt: meta.label_pt, dose_label: meta.dose_label } : null;
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }, [due, schedule]);

  const nextCode = dueMeta[0]?.code;

  if (isLoading || schedLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />;
  }
  if (isError) {
    return (
      <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
        Não foi possível carregar as vacinas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">Calendário vacinal (PNI)</h3>
        <Button onClick={() => setModalOpen(true)} className="h-10 px-3.5">
          <Plus className="mr-1.5 h-4 w-4" /> Registrar vacina
        </Button>
      </div>

      {/* Pendentes / próximas */}
      {dueMeta.length > 0 ? (
        <ul className="space-y-2">
          {dueMeta.map((v) => {
            const status = STATUS_STYLES[v.status];
            const isNext = v.code === nextCode;
            return (
              <li
                key={v.code}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  isNext ? 'border-sky-400/40 bg-sky-500/[0.06]' : 'border-line bg-surface'
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary">
                  <Syringe className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    {v.label_pt}
                    {v.dose_label ? ` · ${v.dose_label}` : ''}
                  </p>
                  <p className="text-xs text-muted">Recomendada: {ageLabelMonths(v.recommended_age_months)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.cls}`}>
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-muted">
          Nenhuma dose pendente no calendário registrado.
        </p>
      )}

      {/* Aplicadas */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Vacinas registradas</h4>
        {(vaccinations ?? []).length === 0 ? (
          <p className="text-xs text-muted">Nenhuma vacina registrada ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {(vaccinations ?? []).map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">
                    {v.vaccine_name}
                    {v.dose_label ? ` · ${v.dose_label}` : ''}
                  </p>
                  {v.applied_at && (
                    <p className="text-xs text-muted">{new Date(v.applied_at).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecordVaccineModal child={child} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function RecordVaccineModal({
  child,
  open,
  onClose,
}: {
  child: Child;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const record = useRecordVaccine(child.id, user?.id ?? '');

  const [vaccineName, setVaccineName] = useState('');
  const [doseLabel, setDoseLabel] = useState('');
  const [appliedAt, setAppliedAt] = useState('');
  const [lot, setLot] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setVaccineName('');
    setDoseLabel('');
    setAppliedAt('');
    setLot('');
    setManufacturer('');
    setLocation('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit() {
    setError(null);
    const parsed = recordVaccineSchema.safeParse({
      vaccineName,
      doseLabel: doseLabel || undefined,
      appliedAt: appliedAt || undefined,
      lot: lot || undefined,
      manufacturer: manufacturer || undefined,
      location: location || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os dados.');
      return;
    }
    try {
      await record.mutateAsync({
        vaccineName: parsed.data.vaccineName,
        doseLabel: parsed.data.doseLabel,
        appliedAt: appliedAt || undefined,
        lot: parsed.data.lot,
        manufacturer: parsed.data.manufacturer,
        location: parsed.data.location,
      });
      toast.success('Vacina registrada.');
      reset();
      onClose();
    } catch {
      setError('Não foi possível registrar.');
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Registrar vacina" className="max-w-md">
      <div className="space-y-4">
        <Field label="Vacina" htmlFor="vac-name">
          <Input id="vac-name" value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} placeholder="Ex.: Pentavalente" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dose (opcional)" htmlFor="vac-dose">
            <Input id="vac-dose" value={doseLabel} onChange={(e) => setDoseLabel(e.target.value)} placeholder="Ex.: 1ª dose" />
          </Field>
          <Field label="Data de aplicação" htmlFor="vac-date">
            <Input id="vac-date" type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} />
          </Field>
          <Field label="Lote (opcional)" htmlFor="vac-lot">
            <Input id="vac-lot" value={lot} onChange={(e) => setLot(e.target.value)} />
          </Field>
          <Field label="Fabricante (opcional)" htmlFor="vac-maker">
            <Input id="vac-maker" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
          </Field>
        </div>
        <Field label="Local de aplicação (opcional)" htmlFor="vac-loc">
          <Input id="vac-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: UBS Central" />
        </Field>

        {error && (
          <p className="text-xs text-status-alert-ink" role="alert">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={handleClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">
            Cancelar
          </button>
          <Button onClick={onSubmit} disabled={record.isPending}>
            {record.isPending ? 'Salvando…' : 'Registrar vacina'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
