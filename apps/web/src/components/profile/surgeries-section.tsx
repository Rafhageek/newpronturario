'use client';

import { useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { FileText, Paperclip, Trash2, X } from 'lucide-react';
import {
  surgerySchema,
  type SurgeryInput,
  SURGERY_REPORT_ACCEPT,
  validateSurgeryReportUpload,
  isoToDateBR,
} from '@hubpatients/core';
import { useSurgeries, useSurgeryMutations } from '@hubpatients/supabase';
import { confirmAction } from '@/lib/confirm';
import { Button, Field, Input } from '@/components/ui';

export function SurgeriesSection({ patientId }: { patientId: string }) {
  // Mesma regra das alergias: lista vazia só vira "nenhuma" com `isSuccess`.
  const { data: surgeries, isSuccess, isError } = useSurgeries(patientId);
  const { create, remove, attachReport, removeReport, reportUrl } = useSurgeryMutations(patientId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SurgeryInput>({
    resolver: zodResolver(surgerySchema),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachTarget, setAttachTarget] = useState<{ id: string; previousPath: string | null } | null>(null);

  /**
   * Rede de segurança: reprovar não pode virar silêncio. Cada campo já mostra
   * a própria mensagem, mas o aviso alcança quem não estava olhando para a
   * parte do formulário que reprovou.
   */
  function onInvalid(erros: FieldErrors<SurgeryInput>) {
    const primeira = Object.values(erros).find(
      (e) => typeof e?.message === 'string' && e.message.length > 0,
    )?.message;
    toast.error(
      typeof primeira === 'string'
        ? `Não foi possível adicionar: ${primeira}`
        : 'Não foi possível adicionar. Confira os campos com aviso e tente de novo.',
    );
  }

  async function onAdd(values: SurgeryInput) {
    try {
      await create.mutateAsync({
        patient_id: patientId,
        procedure: values.procedure,
        performed_at: values.performedAt ? values.performedAt.toISOString().slice(0, 10) : null,
        hospital: values.hospital || null,
        notes: values.notes || null,
      });
      reset({ procedure: '', hospital: '' });
      toast.success('Cirurgia adicionada.');
    } catch {
      toast.error('Não foi possível adicionar.');
    }
  }

  function pickReport(surgeryId: string, previousPath: string | null) {
    setAttachTarget({ id: surgeryId, previousPath });
    fileInputRef.current?.click();
  }

  async function onFileChosen(fileList: FileList | null) {
    const file = fileList?.[0];
    const target = attachTarget;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setAttachTarget(null);
    if (!file || !target) return;
    const validation = validateSurgeryReportUpload(file);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }
    try {
      await attachReport.mutateAsync({ surgeryId: target.id, file, previousPath: target.previousPath });
      toast.success('Laudo anexado.');
    } catch {
      toast.error('Não foi possível anexar o laudo. Tente de novo.');
    }
  }

  async function openReport(reportPath: string) {
    try {
      const url = await reportUrl.mutateAsync(reportPath);
      if (!url) throw new Error('sem URL');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Não foi possível abrir o laudo. Tente de novo.');
    }
  }

  async function onRemoveReport(surgeryId: string, reportPath: string) {
    if (!confirmAction('Remover o laudo anexado? A cirurgia continua registrada.')) return;
    try {
      await removeReport.mutateAsync({ surgeryId, reportPath });
      toast.success('Laudo removido.');
    } catch {
      toast.error('Não foi possível remover o laudo.');
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={SURGERY_REPORT_ACCEPT}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => void onFileChosen(e.target.files)}
      />

      {surgeries && surgeries.length > 0 ? (
        <ul className="space-y-2">
          {surgeries.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              {/*
               * LEGIBILIDADE 50+ — é esta a linha que o cliente sublinhou
               * ("31/10/2024 - São Marcos"): 12px pintados de `--muted`, ao
               * lado de três botões de 40px. Ela sobe para o mesmo piso das
               * telas já revisadas: nome do procedimento em `text-body` (17px)
               * e a linha de data/hospital em `text-body-sm` (15px).
               *
               * Tinta medida (WCAG 2.x) sobre o fundo REAL do item, que é
               * `--surface-2`, e sobre `--surface` caso o item mude de cartão:
               *
               *              claro (#f7f8fc / #ffffff)  escuro (#212121 / #171717)
               *   muted       5,56 / 5,90               7,04 / 7,84    (ANTES)
               *   fg-soft     9,80 / 10,40             10,82 / 12,05   (DEPOIS)
               *
               * O `truncate` do nome do procedimento saiu junto: "Colecistec…"
               * não é meio nome de cirurgia, é cirurgia nenhuma. O item é um
               * flex de altura livre, então a linha quebra e ele cresce.
               */}
              <div className="min-w-0">
                <p className="text-body font-medium leading-tight text-fg [overflow-wrap:anywhere]">
                  {s.procedure}
                </p>
                {/*
                 * `new Date('2024-10-31')` é lido como MEIA-NOITE EM UTC, e
                 * `toLocaleDateString` devolve isso no fuso de quem está
                 * olhando: em Brasília (UTC-3) a cirurgia de 31/10 aparecia
                 * como 30/10. Data errada em prontuário é pior que data
                 * ausente, então a conversão é textual — `isoToDateBR` recorta
                 * 'AAAA-MM-DD' sem passar pelo relógio, e devolve '' (e não
                 * lixo) quando não reconhece o formato.
                 */}
                <p className="mt-0.5 text-body-sm leading-snug text-fg-soft [overflow-wrap:anywhere]">
                  {(s.performed_at && isoToDateBR(s.performed_at)) || 'Data não informada'}
                  {s.hospital ? ` · ${s.hospital}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                {s.report_path ? (
                  <>
                    <button
                      onClick={() => void openReport(s.report_path as string)}
                      disabled={reportUrl.isPending}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                      aria-label={`Ver laudo em PDF da cirurgia ${s.procedure}`}
                      title="Ver laudo (PDF)"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void onRemoveReport(s.id, s.report_path as string)}
                      disabled={removeReport.isPending}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface"
                      aria-label={`Remover laudo da cirurgia ${s.procedure}`}
                      title="Remover laudo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => pickReport(s.id, s.report_path)}
                    disabled={attachReport.isPending}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface"
                    aria-label={`Anexar laudo em PDF à cirurgia ${s.procedure}`}
                    title="Anexar laudo (PDF, até 10 MB)"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => { if (confirmAction(`Remover a cirurgia "${s.procedure}" do prontuário?`)) remove.mutate(s.id); }}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-status-alert-ink"
                  aria-label={`Remover cirurgia ${s.procedure}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : isSuccess ? (
        <p className="text-body-sm text-fg-soft">Nenhuma cirurgia registrada.</p>
      ) : (
        <p className="text-body-sm text-fg-soft">
          {isError
            ? 'Não foi possível carregar esta seção. O prontuário pode ter registros que não aparecem aqui.'
            : 'Carregando suas cirurgias…'}
        </p>
      )}

      <form onSubmit={handleSubmit(onAdd, onInvalid)} className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2" noValidate>
        <Field label="Procedimento" htmlFor="su-proc" error={errors.procedure?.message}>
          <Input id="su-proc" autoComplete="off" autoCorrect="off" spellCheck={false} {...register('procedure')} placeholder="Ex.: Apendicectomia" />
        </Field>
        {/* A data é opcional, mas uma data que não existe ("31/02") reprova de
            propósito. Sem esta mensagem o clique em "Adicionar" volta a ser o
            silêncio que gerou a queixa do cliente. */}
        <Field label="Data" htmlFor="su-date" error={errors.performedAt?.message}>
          <Input id="su-date" type="date" {...register('performedAt')} />
        </Field>
        <Field label="Hospital" htmlFor="su-hosp" error={errors.hospital?.message}>
          <Input id="su-hosp" autoComplete="off" {...register('hospital')} />
        </Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adicionando…' : 'Adicionar cirurgia'}</Button>
        </div>
      </form>
    </div>
  );
}
