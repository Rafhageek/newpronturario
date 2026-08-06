'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { ArrowLeft, Baby, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Child } from '@hubpatients/core';
import { ageInMonths, ageLabel, growthMeasurementSchema } from '@hubpatients/core';
import { useAddMeasurement, useChild, useChildGrowth } from '@hubpatients/supabase';
import { ChildDisclaimer } from '@/components/child/child-disclaimer';
import { VaccinationCalendar } from '@/components/child/vaccination-calendar';
import { MilestoneList } from '@/components/child/milestone-list';
import { Button, Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

const GrowthChart = dynamic(
  () => import('@/components/child/growth-chart').then((module) => module.GrowthChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 animate-pulse rounded-xl bg-surface-2" role="status">
        <span className="sr-only">Carregando gráfico de crescimento</span>
      </div>
    ),
  },
);

type TabKey = 'crescimento' | 'vacinas' | 'marcos' | 'consultas';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'crescimento', label: 'Crescimento' },
  { key: 'vacinas', label: 'Vacinas' },
  { key: 'marcos', label: 'Marcos' },
  { key: 'consultas', label: 'Consultas' },
];

export default function ChildDetailPage() {
  const params = useParams<{ id: string }>();
  const childId = params.id;
  const { data: child, isLoading, isError } = useChild(childId);
  const [tab, setTab] = useState<TabKey>('crescimento');

  if (isLoading) {
    return <div className="mx-auto max-w-3xl"><div className="h-40 animate-pulse rounded-2xl bg-surface-2" /></div>;
  }
  if (isError || !child) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm text-muted">Criança não encontrada.</p>
        <Link href="/criancas" className="mt-2 inline-block text-sm text-primary hover:underline">
          Voltar para a lista
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 hp-page hp-page--journey">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/criancas" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-400 text-white">
          <Baby className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            {child.full_name}
          </h1>
          <p className="text-xs text-muted">
            {ageLabel(child.birth_date, new Date())}
            {child.blood_type && child.blood_type !== 'unknown' ? ` · ${child.blood_type}` : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Seções da criança" className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.key ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        {tab === 'crescimento' && <GrowthTab child={child} />}
        {tab === 'vacinas' && <VaccinationCalendar child={child} />}
        {tab === 'marcos' && <MilestoneList child={child} />}
        {tab === 'consultas' && (
          <p className="py-8 text-center text-sm text-muted">Acompanhamento de consultas — em breve.</p>
        )}
      </section>

      <ChildDisclaimer />
    </div>
  );
}

function GrowthTab({ child }: { child: Child }) {
  const { data: measurements, isLoading, isError } = useChildGrowth(child.id);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="h-72 animate-pulse rounded-2xl bg-surface-2" />
      ) : isError ? (
        <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
          Não foi possível carregar as medidas.
        </p>
      ) : (
        <>
          <GrowthChart child={child} measurements={measurements ?? []} />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">Medidas registradas</h3>
            <Button onClick={() => setModalOpen(true)} className="h-10 px-3.5">
              <Plus className="mr-1.5 h-4 w-4" /> Nova medida
            </Button>
          </div>

          {(measurements?.length ?? 0) === 0 ? (
            <p className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-muted">
              Nenhuma medida registrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Idade</th>
                    <th className="px-3 py-2 font-medium">Peso</th>
                    <th className="px-3 py-2 font-medium">Altura</th>
                    <th className="px-3 py-2 font-medium">P. cefálico</th>
                  </tr>
                </thead>
                <tbody>
                  {(measurements ?? []).map((m) => (
                    <tr key={m.id} className="border-b border-line last:border-0 text-fg">
                      <td className="px-3 py-2">{new Date(m.measured_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-3 py-2 text-fg-soft">{m.age_months_at_measurement} m</td>
                      <td className="px-3 py-2">{m.weight_kg != null ? `${m.weight_kg} kg` : '—'}</td>
                      <td className="px-3 py-2">{m.length_or_height_cm != null ? `${m.length_or_height_cm} cm` : '—'}</td>
                      <td className="px-3 py-2">{m.head_circumference_cm != null ? `${m.head_circumference_cm} cm` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <AddMeasurementModal child={child} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function AddMeasurementModal({
  child,
  open,
  onClose,
}: {
  child: Child;
  open: boolean;
  onClose: () => void;
}) {
  const add = useAddMeasurement(child.id);
  const [measuredAt, setMeasuredAt] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [lengthOrHeightCm, setLength] = useState('');
  const [headCircumferenceCm, setHead] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMeasuredAt('');
    setWeightKg('');
    setLength('');
    setHead('');
    setNotes('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit() {
    setError(null);
    const parsed = growthMeasurementSchema.safeParse({
      measuredAt: measuredAt || undefined,
      weightKg: weightKg || undefined,
      lengthOrHeightCm: lengthOrHeightCm || undefined,
      headCircumferenceCm: headCircumferenceCm || undefined,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os dados.');
      return;
    }
    const refDate = measuredAt || new Date().toISOString().slice(0, 10);
    const ageMonths = ageInMonths(child.birth_date, refDate);
    try {
      await add.mutateAsync({
        ageMonths,
        input: {
          measuredAt: measuredAt || undefined,
          weightKg: parsed.data.weightKg,
          lengthOrHeightCm: parsed.data.lengthOrHeightCm,
          headCircumferenceCm: parsed.data.headCircumferenceCm,
          notes: parsed.data.notes,
        },
      });
      toast.success('Medida registrada.');
      reset();
      onClose();
    } catch {
      setError('Não foi possível registrar.');
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nova medida" className="max-w-md">
      <div className="space-y-4">
        <Field label="Data da medição" htmlFor="meas-date">
          <Input id="meas-date" type="date" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Peso (kg)" htmlFor="meas-weight" error={error ?? undefined}>
            <Input id="meas-weight" type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="Ex.: 8.4" />
          </Field>
          <Field label="Comprimento/altura (cm)" htmlFor="meas-length">
            <Input id="meas-length" type="number" inputMode="decimal" value={lengthOrHeightCm} onChange={(e) => setLength(e.target.value)} placeholder="Ex.: 72" />
          </Field>
        </div>
        <Field label="Perímetro cefálico (cm)" htmlFor="meas-head">
          <Input id="meas-head" type="number" inputMode="decimal" value={headCircumferenceCm} onChange={(e) => setHead(e.target.value)} placeholder="Ex.: 45" />
        </Field>
        <Field label="Observações (opcional)" htmlFor="meas-notes">
          <Input id="meas-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2">
          <button onClick={handleClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">
            Cancelar
          </button>
          <Button onClick={onSubmit} disabled={add.isPending}>
            {add.isPending ? 'Salvando…' : 'Salvar medida'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
