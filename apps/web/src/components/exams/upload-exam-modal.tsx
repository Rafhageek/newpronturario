'use client';

import { useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  examSchema,
  EXAM_CATEGORY_LABELS,
  DISCLAIMERS,
  EXAM_UPLOAD_ACCEPT,
  validateExamUpload,
  type ExamCategory,
} from '@hubpatients/core';
import {
  ExamRecordPersistedError,
  useCreateExam,
  useHubPatientsClient,
  uploadExamFile,
  removeExamFile,
  type NewExamMetric,
} from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

type MetricRow = { name: string; value: string; unit: string; refMin: string; refMax: string };
const emptyRow: MetricRow = { name: '', value: '', unit: '', refMin: '', refMax: '' };

export function UploadExamModal({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId: string }) {
  const client = useHubPatientsClient();
  const createExam = useCreateExam(patientId);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExamCategory>('lab');
  const [labName, setLabName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<MetricRow[]>([{ ...emptyRow }]);
  const [saving, setSaving] = useState(false);

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function onSubmit() {
    const parsed = examSchema.safeParse({ name, category, labName, examDate: examDate || undefined, doctorName, rawText });
    if (!parsed.success) {
      toast.error('Informe ao menos o nome do exame.');
      return;
    }
    setSaving(true);
    let storagePath: string | null = null;
    try {
      let fileMime: string | null = null;
      if (file) {
        storagePath = await uploadExamFile(client, patientId, file);
        fileMime = file.type;
      }
      const metrics: NewExamMetric[] =
        category === 'lab'
          ? rows
              .filter((r) => r.name.trim() !== '')
              .map((r) => ({
                name: r.name.trim(),
                value: num(r.value),
                unit: r.unit || null,
                reference_min: num(r.refMin),
                reference_max: num(r.refMax),
              }))
          : [];

      await createExam.mutateAsync({
        exam: {
          title: parsed.data.name,
          category,
          lab_name: parsed.data.labName || null,
          exam_date: examDate || null,
          doctor_name: parsed.data.doctorName || null,
          raw_text: category !== 'lab' ? parsed.data.rawText || null : null,
          storage_path: storagePath,
          file_mime: fileMime,
          status: 'processed',
        },
        metrics,
      });
      toast.success('Exame salvo.');
      reset();
      onClose();
    } catch (error) {
      if (storagePath && !(error instanceof ExamRecordPersistedError)) {
        try {
          await removeExamFile(client, storagePath);
        } catch {
          // A falha de limpeza não substitui o erro principal; monitoração
          // server-side deve reconciliar raros objetos órfãos remanescentes.
        }
      }
      toast.error(
        error instanceof ExamRecordPersistedError
          ? 'O exame foi salvo, mas os resultados não. Revise o registro antes de continuar.'
          : 'Não foi possível salvar o exame.',
      );
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setName(''); setCategory('lab'); setLabName(''); setExamDate(''); setDoctorName(''); setRawText('');
    setFile(null); setRows([{ ...emptyRow }]);
  }

  function onFileChange(nextFile: File | null) {
    if (!nextFile) {
      setFile(null);
      return;
    }
    const validation = validateExamUpload(nextFile);
    if (!validation.valid) {
      setFile(null);
      toast.error(validation.message);
      return;
    }
    setFile(nextFile);
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar exame" className="max-w-2xl">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome do exame" htmlFor="e-name"><Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Hemograma completo" /></Field>
                <Field label="Tipo" htmlFor="e-cat">
                  <select id="e-cat" value={category} onChange={(e) => setCategory(e.target.value as ExamCategory)} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
                    {Object.entries(EXAM_CATEGORY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </Field>
                <Field label="Laboratório" htmlFor="e-lab"><Input id="e-lab" value={labName} onChange={(e) => setLabName(e.target.value)} /></Field>
                <Field label="Data" htmlFor="e-date"><Input id="e-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} /></Field>
                <Field label="Médico" htmlFor="e-doc"><Input id="e-doc" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} /></Field>
              </div>

              {/* Arquivo */}
              <label className="block rounded-xl border border-dashed border-line px-4 py-3 text-sm text-fg-soft focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
                <span className="mb-2 flex items-center gap-2 font-medium text-fg">
                  <Upload aria-hidden="true" className="h-4 w-4 text-primary" />
                  Anexar laudo
                </span>
                <input
                  type="file"
                  accept={EXAM_UPLOAD_ACCEPT}
                  className="block w-full cursor-pointer text-xs text-muted file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:font-semibold file:text-primary"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    onFileChange(nextFile);
                    if (nextFile && !validateExamUpload(nextFile).valid) {
                      event.currentTarget.value = '';
                    }
                  }}
                />
                <span className="mt-2 block text-xs text-muted">
                  PDF ou imagem compatível, até 10 MB.
                </span>
              </label>

              {category === 'lab' ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-fg-soft">Resultados</p>
                  <div className="space-y-2">
                    {rows.map((r, i) => (
                      <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
                        <input aria-label={`Métrica do resultado ${i + 1}`} value={r.name} onChange={(e) => setRows((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Métrica" className="h-11 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:col-span-2" />
                        <input aria-label={`Valor do resultado ${i + 1}`} value={r.value} onChange={(e) => setRows((a) => a.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="Valor" inputMode="decimal" className="h-11 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                        <input aria-label={`Unidade do resultado ${i + 1}`} value={r.unit} onChange={(e) => setRows((a) => a.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} placeholder="Unidade" className="h-11 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                        <input aria-label={`Referência mínima do resultado ${i + 1}`} value={r.refMin} onChange={(e) => setRows((a) => a.map((x, j) => (j === i ? { ...x, refMin: e.target.value } : x)))} placeholder="Referência mínima" inputMode="decimal" className="h-11 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                        <input aria-label={`Referência máxima do resultado ${i + 1}`} value={r.refMax} onChange={(e) => setRows((a) => a.map((x, j) => (j === i ? { ...x, refMax: e.target.value } : x)))} placeholder="Referência máxima" inputMode="decimal" className="h-11 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                        <button type="button" aria-label={`Remover resultado ${i + 1}`} onClick={() => setRows((a) => a.filter((_, j) => j !== i))} className="min-h-11 rounded-lg border border-line px-3 text-sm text-muted hover:border-rose-400 hover:text-status-alert-ink sm:col-span-2"><Trash2 aria-hidden="true" className="mr-2 inline h-4 w-4" /> Remover resultado</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setRows((a) => [...a, { ...emptyRow }])} className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <Plus className="h-3.5 w-3.5" /> Adicionar resultado
                  </button>
                </div>
              ) : (
                <Field label="Texto do laudo" htmlFor="e-raw">
                  <textarea id="e-raw" value={rawText} onChange={(e) => setRawText(e.target.value)} rows={4} className="w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-muted focus:border-sky-400/50 focus:outline-none" placeholder="Cole o texto do laudo (não interpretamos imagens com IA)." />
                </Field>
              )}

              <p className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-[11px] text-muted">
                {DISCLAIMERS.notDiagnosis}
              </p>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">Cancelar</button>
                <Button onClick={onSubmit} disabled={saving}>{saving ? 'Salvando…' : 'Salvar exame'}</Button>
              </div>
            </div>
    </Modal>
  );
}
