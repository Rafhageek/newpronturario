'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  diaryEntrySchema,
  MOOD_LABELS,
  PAIN_DISCLAIMER,
  bodyRegionLabel,
  painIntensityColor,
  type PainPointInput,
} from '@hubpatients/core';
import { useCreateDiaryEntryFull, useAddPainPoints } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { useActiveProfile } from '@/components/profile-context';
import { Slider } from '@/components/ui/slider';
import { SymptomMultiselect } from '@/components/diary/symptom-multiselect';
import { VoiceDictationButton } from '@/components/diary/voice-dictation-button';
import { BodyPainMap } from '@/components/diary/body-pain-map';
import { PainPointModal } from '@/components/diary/pain-point-modal';
import { confirmAction } from '@/lib/confirm';

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
  const { user } = useAuth();
  const router = useRouter();
  const create = useCreateDiaryEntryFull(patientId);
  const addPain = useAddPainPoints(user?.id ?? '');

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [pain, setPain] = useState(0);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [vitals, setVitals] = useState<VitalsState>(emptyVitals);

  // Mapa de dor — múltiplos pontos numa mesma entrada (estado local).
  const [showMap, setShowMap] = useState(false);
  const [painPoints, setPainPoints] = useState<PainPointInput[]>([]);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  function handlePickRegion(code: string) {
    setActiveRegion(code);
  }

  function handleSavePoint(point: PainPointInput) {
    setPainPoints((prev) => {
      const rest = prev.filter((p) => p.bodyRegion !== point.bodyRegion);
      return [...rest, point];
    });
    setActiveRegion(null);
  }

  function removePoint(code: string) {
    if (!confirmAction('Remover este ponto de dor do registro?')) return;
    setPainPoints((prev) => prev.filter((p) => p.bodyRegion !== code));
  }

  const editingPoint = activeRegion
    ? painPoints.find((p) => p.bodyRegion === activeRegion)
    : undefined;

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
      const entry = await create.mutateAsync(parsed.data);
      // Pontos de dor são opcionais — falha aqui não invalida a entrada.
      if (painPoints.length > 0) {
        try {
          await addPain.mutateAsync({
            diaryEntryId: entry.id,
            points: painPoints.map((p) => ({
              bodyRegion: p.bodyRegion,
              side: p.side,
              intensity: p.intensity,
              type: p.type,
              notes: p.notes,
            })),
          });
        } catch {
          toast.error('Registro salvo, mas não foi possível anexar os pontos de dor.');
        }
      }
      toast.success('Registro salvo no seu diário.');
      router.push('/diario');
      router.refresh();
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 hp-page hp-page--wellbeing">
      <div className="flex items-center gap-3">
        <Link href="/diario" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Novo registro</h1>
      </div>

      {/* Sliders */}
      <section className="space-y-5 rounded-2xl border border-line bg-surface p-5">
        {/* Cor única e neutra nos três: humor, energia e dor são o CORPO do
            paciente. Pintar dor 8 de vermelho já é interpretar o que o usuário
            está registrando — e o semáforo cru reprovava em contraste. */}
        <Slider label="Humor" value={mood} min={1} max={5} valueLabel={MOOD_LABELS[mood]} onChange={setMood} />
        <Slider label="Energia" value={energy} min={1} max={5} valueLabel={`${energy}/5`} onChange={setEnergy} />
        <Slider label="Dor" value={pain} min={0} max={10} valueLabel={`${pain}/10`} onChange={setPain} />
      </section>

      {/* Sintomas */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-fg">Sintomas</h2>
        <SymptomMultiselect value={symptoms} onChange={setSymptoms} />
      </section>

      {/* Mapa de dor no corpo */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-fg">Dor no corpo</h2>
          <button
            type="button"
            onClick={() => setShowMap((s) => !s)}
            aria-expanded={showMap}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium text-fg-soft transition hover:bg-surface-2"
          >
            <MapPin className="h-4 w-4" aria-hidden />
            {showMap ? 'Ocultar mapa' : 'Marcar dor no corpo'}
          </button>
        </div>

        {painPoints.length > 0 && (
          <ul className="mb-3 space-y-2" aria-label="Pontos de dor marcados">
            {painPoints.map((p) => (
              <li
                key={p.bodyRegion}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => setActiveRegion(p.bodyRegion)}
                  className="flex min-h-[44px] flex-1 items-center gap-2 text-left text-sm text-fg"
                >
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: painIntensityColor(p.intensity) }}
                    aria-hidden
                  />
                  <span className="font-medium">{bodyRegionLabel(p.bodyRegion)}</span>
                  <span className="text-muted">intensidade {p.intensity}/10</span>
                </button>
                <button
                  type="button"
                  onClick={() => removePoint(p.bodyRegion)}
                  aria-label={`Remover ponto de dor em ${bodyRegionLabel(p.bodyRegion)}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-status-alert-ink"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {showMap && (
          <div className="rounded-xl border border-line bg-surface-2/40 p-4">
            <BodyPainMap points={painPoints} onPickRegion={handlePickRegion} />
            <p className="mt-3 text-xs leading-relaxed text-muted">{PAIN_DISCLAIMER}</p>
          </div>
        )}
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

      <PainPointModal
        open={activeRegion != null}
        onClose={() => setActiveRegion(null)}
        regionCode={activeRegion}
        initial={editingPoint}
        onSave={handleSavePoint}
      />
    </div>
  );
}
