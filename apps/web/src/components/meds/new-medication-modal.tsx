'use client';

import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  medicationSchema,
  type MedicationInput,
  MEDICATION_UNITS,
  MEDICATION_FREQUENCY_LABELS,
  findMedicationAllergyNameMatch,
} from '@hubpatients/core';
import { useAllergies, useHubPatientsClient, createMedication, queryKeys } from '@hubpatients/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { confirmAction } from '@/lib/confirm';

/**
 * Mesma aparência do `Input` do sistema (15px, borda forte, fundo do cartão).
 * Os `select` estavam em 14px sobre `surface-2`, um degrau abaixo dos campos de
 * texto ao lado — a queixa do cliente sobre "caracteres claros" começa nesses
 * degraus que ninguém nota isolados.
 */
/*
 * A largura fica FORA da base: `SELECT_CLASS + ' w-auto'` deixava `w-full` e
 * `w-auto` na mesma classe, e quem vence passa a depender da ordem em que o
 * Tailwind emitiu as regras — layout decidido por sorteio. Cada uso declara a
 * sua largura uma vez só.
 */
const CAMPO_BASE =
  'min-h-11 rounded-chip border border-line-strong bg-surface px-3 text-body-sm text-fg shadow-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20';

const SELECT_CLASS = `${CAMPO_BASE} w-full`;

export function NewMedicationModal({
  open,
  onClose,
  patientId,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
}) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const {
    data: allergies,
    isLoading: allergiesLoading,
    isError: allergiesError,
  } = useAllergies(patientId || undefined);
  const [times, setTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState('08:00');
  const [anvisaReg, setAnvisaReg] = useState('');
  const [saving, setSaving] = useState(false);

  // Nenhuma data entra em `defaultValues`: "Início" e "Fim" são opcionais de
  // verdade, e um valor pré-preenchido seria data inventada num prontuário.
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MedicationInput>({
    resolver: zodResolver(medicationSchema),
    defaultValues: { form: 'tablet', frequency: 'daily' },
  });

  /**
   * Rede de segurança OBRIGATÓRIA: se a validação reprovar, o clique em
   * "Adicionar" não pode virar silêncio.
   *
   * Foi exatamente esse silêncio que gerou a queixa do cliente — o campo de
   * data reprovava quando ficava em branco, o `handleSubmit` do React Hook Form
   * nunca chamava o `onSubmit`, e a tela não dizia nada. A causa raiz já foi
   * consertada no schema (`dataOpcional`, em packages/core), mas o formulário
   * também não pode depender de o schema nunca mais reprovar por outro motivo:
   * agora todo campo mostra o erro abaixo dele, o foco vai para o primeiro
   * inválido (padrão do RHF) e ainda sai um aviso para quem não estava olhando
   * para aquela parte do formulário.
   */
  function onInvalid(erros: FieldErrors<MedicationInput>) {
    const primeira = Object.values(erros).find(
      (e) => typeof e?.message === 'string' && e.message.length > 0,
    )?.message;
    toast.error(
      typeof primeira === 'string'
        ? `Não foi possível salvar: ${primeira}`
        : 'Não foi possível salvar. Confira os campos com aviso e tente de novo.',
    );
  }

  function addTime() {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime) && !times.includes(newTime)) {
      setTimes((t) => [...t, newTime].sort());
    }
  }

  async function onSubmit(values: MedicationInput) {
    if (allergiesLoading) {
      toast.info('Aguarde a verificação das alergias registradas.');
      return;
    }
    if (allergiesError || !allergies) {
      toast.error('Não foi possível verificar suas alergias. Tente novamente antes de adicionar o medicamento.');
      return;
    }

    const matched = findMedicationAllergyNameMatch(values.name, allergies);
    if (
      matched &&
      !confirmAction(
        `Atenção: há uma alergia registrada a "${matched.substance}". ` +
          `A verificação compara apenas os nomes cadastrados e não confirma que "${values.name}" é seguro. ` +
          'Adicionar mesmo assim?',
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await createMedication(client, {
        patient_id: patientId,
        name: values.name,
        dosage: values.dosage || null,
        unit: values.unit || null,
        form: values.form,
        frequency: values.frequency,
        times,
        prescriber: values.prescriber || null,
        started_at: values.startedAt ? values.startedAt.toISOString().slice(0, 10) : null,
        ended_at: values.endedAt ? values.endedAt.toISOString().slice(0, 10) : null,
        notes: values.notes || null,
        anvisa_registration: anvisaReg.trim() || null,
        active: true,
      });
      qc.invalidateQueries({ queryKey: queryKeys.medications(patientId) });
      toast.success('Medicamento adicionado.');
      reset();
      setTimes([]);
      setAnvisaReg('');
      onClose();
    } catch {
      toast.error('Não foi possível adicionar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo medicamento" className="max-w-lg">
            <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
              <Field label="Nome" htmlFor="m-name" error={errors.name?.message}>
                <Input id="m-name" {...register('name')} placeholder="Ex.: Losartana" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Dose" htmlFor="m-dose" error={errors.dosage?.message}>
                  <Input id="m-dose" {...register('dosage')} placeholder="50" />
                </Field>
                <Field label="Unidade" htmlFor="m-unit" error={errors.unit?.message}>
                  <select id="m-unit" {...register('unit')} className={SELECT_CLASS}>
                    <option value="">—</option>
                    {MEDICATION_UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
                  </select>
                </Field>
                <Field label="Frequência" htmlFor="m-freq" error={errors.frequency?.message}>
                  <select id="m-freq" {...register('frequency')} className={SELECT_CLASS}>
                    {Object.entries(MEDICATION_FREQUENCY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </Field>
                <Field label="Médico prescritor" htmlFor="m-presc" error={errors.prescriber?.message}>
                  <Input id="m-presc" {...register('prescriber')} />
                </Field>
              </div>

              {/* Horários */}
              <div>
                <p className="mb-1.5 text-sm font-medium text-fg-soft" id="m-horarios">Horários (opcional)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    aria-labelledby="m-horarios"
                    className={`${CAMPO_BASE} w-auto`}
                  />
                  <button
                    type="button"
                    onClick={addTime}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-chip border border-line-strong px-4 text-label font-medium text-fg-soft hover:bg-surface-2"
                  >
                    {/* "Incluir horário", não "Adicionar": o botão de enviar o
                        formulário logo abaixo também se chama "Adicionar". */}
                    <Plus className="h-4 w-4" aria-hidden /> Incluir horário
                  </button>
                </div>
                {times.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {times.map((t) => (
                      <span key={t} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-sky-500/15 pl-3 pr-0.5 text-body-sm font-medium text-primary">
                        {t}
                        {/* 44×44 é o alvo mínimo (WCAG 2.5.5): a mão que treme
                            precisa acertar o X sem apagar o horário errado. */}
                        <button
                          type="button"
                          onClick={() => setTimes((arr) => arr.filter((x) => x !== t))}
                          aria-label={`Remover o horário ${t}`}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-sky-500/20"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/*
                As DUAS datas são opcionais, e a interface precisa dizer isso —
                antes só "Fim" trazia a palavra, então "Início" parecia
                obrigatório para quem não lembra a data em que começou o
                remédio. Cada campo agora também renderiza a própria mensagem
                de erro: um campo de data que reprova sem dizer nada foi a
                origem do "cliquei e não aconteceu nada".
              */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Início (opcional)" htmlFor="m-start" error={errors.startedAt?.message}>
                  <Input id="m-start" type="date" aria-describedby="m-datas-ajuda" {...register('startedAt')} />
                </Field>
                <Field label="Fim (opcional)" htmlFor="m-end" error={errors.endedAt?.message}>
                  <Input id="m-end" type="date" aria-describedby="m-datas-ajuda" {...register('endedAt')} />
                </Field>
              </div>
              <p id="m-datas-ajuda" className="-mt-2 text-body-sm text-fg-soft">
                Não sabe as datas? Pode deixar as duas em branco e preencher depois.
              </p>

              <Field label="Observações" htmlFor="m-notes" error={errors.notes?.message}>
                <Input id="m-notes" {...register('notes')} />
              </Field>
              <Field label="Nº de registro Anvisa (opcional)" htmlFor="m-anvisa">
                <Input id="m-anvisa" value={anvisaReg} onChange={(e) => setAnvisaReg(e.target.value)} placeholder="1.NNNN.NNNN.NNN-N — leva direto à bula" />
              </Field>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-label font-semibold text-fg-soft hover:bg-surface-2"
                >
                  Cancelar
                </button>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Adicionar'}</Button>
              </div>
            </form>
    </Modal>
  );
}
