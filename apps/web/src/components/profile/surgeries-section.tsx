'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { FileText, Paperclip, Trash2, X } from 'lucide-react';
import {
  surgerySchema,
  type SurgeryInput,
  SURGERY_REPORT_ACCEPT,
  validateSurgeryReportUpload,
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
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{s.procedure}</p>
                <p className="text-xs text-muted">
                  {s.performed_at ? new Date(s.performed_at).toLocaleDateString('pt-BR') : 'Data não informada'}
                  {s.hospital ? ` · ${s.hospital}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                {s.report_path ? (
                  <>
                    <button
                      onClick={() => void openReport(s.report_path as string)}
                      disabled={reportUrl.isPending}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                      aria-label={`Ver laudo em PDF da cirurgia ${s.procedure}`}
                      title="Ver laudo (PDF)"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void onRemoveReport(s.id, s.report_path as string)}
                      disabled={removeReport.isPending}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface"
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
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface"
                    aria-label={`Anexar laudo em PDF à cirurgia ${s.procedure}`}
                    title="Anexar laudo (PDF, até 10 MB)"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => { if (confirmAction(`Remover a cirurgia "${s.procedure}" do prontuário?`)) remove.mutate(s.id); }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-status-alert-ink"
                  aria-label={`Remover cirurgia ${s.procedure}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : isSuccess ? (
        <p className="text-sm text-muted">Nenhuma cirurgia registrada.</p>
      ) : (
        <p className="text-sm text-muted">
          {isError
            ? 'Não foi possível carregar esta seção. O prontuário pode ter registros que não aparecem aqui.'
            : 'Carregando suas cirurgias…'}
        </p>
      )}

      <form onSubmit={handleSubmit(onAdd)} className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2" noValidate>
        <Field label="Procedimento" htmlFor="su-proc" error={errors.procedure?.message}>
          <Input id="su-proc" autoComplete="off" autoCorrect="off" spellCheck={false} {...register('procedure')} placeholder="Ex.: Apendicectomia" />
        </Field>
        <Field label="Data" htmlFor="su-date"><Input id="su-date" type="date" {...register('performedAt')} /></Field>
        <Field label="Hospital" htmlFor="su-hosp"><Input id="su-hosp" autoComplete="off" {...register('hospital')} /></Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adicionando…' : 'Adicionar cirurgia'}</Button>
        </div>
      </form>
    </div>
  );
}
