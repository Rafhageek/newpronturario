'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { diaryEntrySchema, MOOD_LABELS } from '@vidalog/core';
import { useCreateDiaryEntryFull } from '@vidalog/supabase';
import { useActiveProfile } from '@/components/profile-context';
import { Slider } from '@/components/ui/slider';
import { SymptomMultiselect } from '@/components/diary/symptom-multiselect';
import { VoiceDictationButton } from '@/components/diary/voice-dictation-button';

type VitalsState = {
  systolic: string;
  diastolic: string;
  heartRate: string;
  temperature: string;
  weight: string;
  glucose: string;
  oxygen: string;
};
const emptyVitals: VitalsState = {
  systolic: '', diastolic: '', heartRate: '', temperature: '', weight: '', glucose: '', oxygen: '',
};

const VITAL_FIELDS: { key: keyof VitalsState; label: string; unit: string }[] = [
  { key: 'systolic', label: 'PA sistólica', unit: 'mmHg' },
  { key: 'diastolic', label: 'PA diastólica', unit: 'mmHg' },
  { key: 'heartRate', label: 'Freq. cardíaca', unit: 'bpm' },
  { key: 'temperature', label: 'Temperatura', unit: '°C' },
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'glucose', label: 'Glicemia', unit: 'mg/dL' },
  { key: 'oxygen', label: 'SpO₂', unit: '%' },
];

export default function NovoRegistroPage() {
  const { patientId } = useActiveProfile();
  const router = useRouter();
  const create = useCreateDiaryEntryFull(patientId);

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [pain, setPain] = useState(0);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [vitals, setVitals] = useState<VitalsState>(emptyVitals);

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  async function onSubmit() {
    const parsed = diaryEntrySchema.safeParse({
      mood,
      energy,
      pain,
      symptoms,
      note: note || undefined,
      vitals: {
        systolic: num(vitals.systolic),
        diastolic: num(vitals.diastolic),
        heartRate: num(vitals.heartRate),
        temperature: num(vitals.temperature),
        weight: num(vitals.weight),
        glucose: num(vitals.glucose),
        oxygen: num(vitals.oxygen),
      },
    });
    if (!parsed.success) {
      toast.error('Verifique os dados do registro.');
      return;
    }
    // PA exige os dois valores
    if ((parsed.data.vitals?.systolic == null) !== (parsed.data.vitals?.diastolic == null)) {
      toast.error('Informe sistólica e diastólica juntas.');
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      toast.success('Registro salvo no seu diário.');
      router.push('/diario');
      router.refresh();
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/diario" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Novo registro</h1>
      </div>

      {/* Sliders */}
      <section className="space-y-5 rounded-2xl border border-line bg-surface p-5">
        <Slider label="Humor" value={mood} min={1} max={5} color="#38BDF8" valueLabel={MOOD_LABELS[mood]} onChange={setMood} />
        <Slider label="Energia" value={energy} min={1} max={5} color="#34D399" valueLabel={`${energy}/5`} onChange={setEnergy} />
        <Slider label="Dor" value={pain} min={0} max={10} color={pain >= 7 ? '#EF4444' : pain >= 4 ? '#F59E0B' : '#10B981'} valueLabel={`${pain}/10`} onChange={setPain} />
      </section>

      {/* Sintomas */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-fg">Sintomas</h2>
        <SymptomMultiselect value={symptoms} onChange={setSymptoms} />
      </section>

      {/* Vitais */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-fg">Sinais vitais <span className="text-xs font-normal text-muted">(opcional)</span></h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {VITAL_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-xs text-muted">{f.label}</span>
              <div className="flex items-center rounded-xl border border-line bg-surface-2">
                <input
                  inputMode="decimal"
                  value={vitals[f.key]}
                  onChange={(e) => setVitals((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="h-10 w-full bg-transparent px-3 text-sm text-fg outline-none"
                />
                <span className="px-2 text-[10px] text-muted">{f.unit}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Notas + voz */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Notas</h2>
          <VoiceDictationButton onTranscript={(t) => setNote((n) => (n ? `${n} ${t}` : t))} />
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Como foi o seu dia? Você pode ditar por voz."
          className="w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-muted focus:border-sky-400/50 focus:outline-none"
        />
      </section>

      <div className="flex justify-end gap-2">
        <Link href="/diario" className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">Cancelar</Link>
        <button
          onClick={onSubmit}
          disabled={create.isPending}
          className="inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90 disabled:opacity-60"
        >
          {create.isPending ? 'Salvando…' : 'Salvar registro'}
        </button>
      </div>
    </div>
  );
}
