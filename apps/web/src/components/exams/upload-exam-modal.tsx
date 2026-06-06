'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { examSchema, EXAM_CATEGORY_LABELS, type ExamCategory } from '@vidalog/core';
import { useCreateExam, useVidaLogClient, uploadExamFile, type NewExamMetric } from '@vidalog/supabase';
import { Button, Field, Input } from '@/components/ui';

type MetricRow = { name: string; value: string; unit: string; refMin: string; refMax: string };
const emptyRow: MetricRow = { name: '', value: '', unit: '', refMin: '', refMax: '' };

export function UploadExamModal({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId: string }) {
  const client = useVidaLogClient();
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
    try {
      let storagePath: string | null = null;
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
    } catch {
      toast.error('Não foi possível salvar o exame.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setName(''); setCategory('lab'); setLabName(''); setExamDate(''); setDoctorName(''); setRawText('');
    setFile(null); setRows([{ ...emptyRow }]);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl"
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
            <h2 className="mb-4 text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Adicionar exame</h2>

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
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-fg-soft hover:bg-surface-2">
                <Upload className="h-4 w-4 text-primary" />
                {file ? file.name : 'Anexar arquivo (PDF ou imagem)'}
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>

              {category === 'lab' ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-fg-soft">Resultados</p>
                  <div className="space-y-2">
                    {rows.map((r, i) => (
                      <div key={i} className="grid grid-cols-[1fr_70px_70px_70px_70px_auto] gap-2">
                        <input value={r.name} onChange={(e) => setRows((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Métrica" className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-xs text-fg" />
                        <input value={r.value} onChange={(e) => setRows((a) => a.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="Valor" className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-xs text-fg" />
                        <input value={r.unit} onChange={(e) => setRows((a) => a.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} placeholder="Un." className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-xs text-fg" />
                        <input value={r.refMin} onChange={(e) => setRows((a) => a.map((x, j) => (j === i ? { ...x, refMin: e.target.value } : x)))} placeholder="Mín" className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-xs text-fg" />
                        <input value={r.refMax} onChange={(e) => setRows((a) => a.map((x, j) => (j === i ? { ...x, refMax: e.target.value } : x)))} placeholder="Máx" className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-xs text-fg" />
                        <button type="button" onClick={() => setRows((a) => a.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-muted hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
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

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">Cancelar</button>
                <Button onClick={onSubmit} disabled={saving}>{saving ? 'Salvando…' : 'Salvar exame'}</Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
