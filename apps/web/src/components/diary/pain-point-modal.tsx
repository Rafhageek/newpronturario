'use client';

import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import {
  PAIN_TYPES,
  PAIN_TYPE_LABELS,
  painIntensityColor,
  painIntensityTextColor,
  painPointSchema,
  bodyRegion,
  type PainPointInput,
} from '@hubpatients/core';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui';
import { Slider } from '@/components/ui/slider';

type SideValue = 'left' | 'right' | 'center';

const SIDE_LABELS: Record<SideValue, string> = {
  left: 'Esquerdo',
  right: 'Direito',
  center: 'Centro',
};

/**
 * Modal de registro de um ponto de dor na região escolhida.
 * É REGISTRO, nunca diagnóstico — só captura intensidade/lado/tipo/notas.
 */
export function PainPointModal({
  open,
  onClose,
  regionCode,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** Código da região escolhida no mapa (null quando fechado). */
  regionCode: string | null;
  /** Ponto já existente nessa região (edição), se houver. */
  initial?: PainPointInput;
  onSave: (point: PainPointInput) => void;
}) {
  const region = regionCode ? bodyRegion(regionCode) : undefined;
  const isLateral = region?.side === 'left' || region?.side === 'right';

  const [intensity, setIntensity] = useState(3);
  const [side, setSide] = useState<SideValue>('center');
  const [type, setType] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const sliderId = useId();
  const notesId = useId();

  // Reidrata o formulário sempre que o modal abre numa região.
  useEffect(() => {
    if (!open || !region) return;
    setIntensity(initial?.intensity ?? 3);
    setSide((initial?.side as SideValue) ?? (region.side as SideValue) ?? 'center');
    setType(initial?.type);
    setNotes(initial?.notes ?? '');
  }, [open, regionCode, region, initial]);

  function handleSave() {
    if (!regionCode) return;
    const parsed = painPointSchema.safeParse({
      bodyRegion: regionCode,
      side,
      intensity,
      type: type || undefined,
      notes: notes.trim() || undefined,
    });
    if (!parsed.success) {
      toast.error('Verifique os dados do ponto de dor.');
      return;
    }
    onSave(parsed.data);
  }

  const intensityColor = painIntensityColor(intensity);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={region ? `Dor em: ${region.label_pt}` : 'Registrar dor'}
      description="Registro pessoal para você comunicar ao seu médico."
      className="max-w-md"
    >
      <div className="space-y-5">
        {/* Intensidade */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor={sliderId} className="text-sm font-medium text-fg-soft">
              Intensidade
            </label>
            <span
              className="inline-flex h-7 min-w-[44px] items-center justify-center rounded-lg px-2 text-sm font-bold"
              style={{ backgroundColor: intensityColor, color: painIntensityTextColor(intensity) }}
              aria-hidden
            >
              {intensity}
            </span>
          </div>
          <Slider
            label="Intensidade da dor de 0 a 10"
            value={intensity}
            min={0}
            max={10}
            valueLabel={`${intensity}/10`}
            onChange={setIntensity}
          />
        </div>

        {/* Lado — sempre ajustável; default ao lado da região */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg-soft">Lado</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Lado do corpo">
            {(['left', 'center', 'right'] as SideValue[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                aria-pressed={side === s}
                className={`min-h-[44px] rounded-xl border px-4 text-sm font-medium transition ${
                  side === s
                    ? 'border-sky-400 bg-sky-500/15 text-primary'
                    : 'border-line bg-surface-2 text-fg-soft hover:border-sky-400/50'
                }`}
              >
                {SIDE_LABELS[s]}
              </button>
            ))}
          </div>
          {isLateral && (
            <p className="mt-1.5 text-[11px] text-muted">
              Esta região já indica um lado; você pode ajustar se necessário.
            </p>
          )}
        </fieldset>

        {/* Tipo de dor */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg-soft">
            Tipo de dor <span className="text-xs font-normal text-muted">(opcional)</span>
          </legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de dor">
            {PAIN_TYPES.map((t) => {
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(active ? undefined : t)}
                  aria-pressed={active}
                  className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition ${
                    active
                      ? 'border-sky-400 bg-sky-500/15 text-primary'
                      : 'border-line bg-surface-2 text-fg-soft hover:border-sky-400/50'
                  }`}
                >
                  {PAIN_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Notas */}
        <div className="space-y-1.5">
          <label htmlFor={notesId} className="block text-sm font-medium text-fg-soft">
            Notas <span className="text-xs font-normal text-muted">(opcional)</span>
          </label>
          <Input
            id={notesId}
            value={notes}
            maxLength={300}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: piora ao caminhar"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
