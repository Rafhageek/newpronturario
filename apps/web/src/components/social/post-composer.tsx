'use client';

import { useState } from 'react';
import { BarChart3, Plus, Send, Trophy, X } from 'lucide-react';
import { toast } from 'sonner';
import { postSchema, POST_FLAIRS } from '@hubpatients/core';

export interface ComposerSubmit {
  content: string;
  flair: string | null;
  isAnonymous: boolean;
  isAchievement: boolean;
  poll?: { question: string; options: string[] };
}

export function PostComposer({
  onSubmit,
  pending,
  allowFlair = true,
}: {
  onSubmit: (input: ComposerSubmit) => Promise<void> | void;
  pending?: boolean;
  allowFlair?: boolean;
}) {
  const [content, setContent] = useState('');
  const [flair, setFlair] = useState('');
  const [anon, setAnon] = useState(false);
  const [achievement, setAchievement] = useState(false);
  const [pollOn, setPollOn] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState<string[]>(['', '']);

  async function submit() {
    const options = pollOpts.map((o) => o.trim()).filter(Boolean);
    const parsed = postSchema.safeParse({ content, flair, isAnonymous: anon, isAchievement: achievement });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Escreva algo.');
      return;
    }
    if (pollOn && (pollQ.trim() === '' || options.length < 2)) {
      toast.error('A enquete precisa de pergunta e ao menos 2 opções.');
      return;
    }
    await onSubmit({
      content: parsed.data.content,
      flair: flair || null,
      isAnonymous: anon,
      isAchievement: achievement,
      poll: pollOn ? { question: pollQ.trim(), options } : undefined,
    });
    setContent(''); setFlair(''); setAnon(false); setAchievement(false);
    setPollOn(false); setPollQ(''); setPollOpts(['', '']);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Compartilhe uma dúvida, dica ou conquista… (nada de dados clínicos sensíveis)"
        className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-muted focus:border-sky-400/50 focus:outline-none"
      />

      {pollOn && (
        <div className="mt-2 space-y-2 rounded-xl border border-line bg-surface-2 p-3">
          <input value={pollQ} onChange={(e) => setPollQ(e.target.value)} placeholder="Pergunta da enquete" className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg" />
          {pollOpts.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input value={o} onChange={(e) => setPollOpts((a) => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Opção ${i + 1}`} className="h-9 flex-1 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg" />
              {pollOpts.length > 2 && <button onClick={() => setPollOpts((a) => a.filter((_, j) => j !== i))} className="text-muted hover:text-status-alert-ink"><X className="h-4 w-4" /></button>}
            </div>
          ))}
          {pollOpts.length < 6 && <button onClick={() => setPollOpts((a) => [...a, ''])} className="inline-flex items-center gap-1 text-xs text-primary"><Plus className="h-3.5 w-3.5" /> opção</button>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {allowFlair && (
          <select value={flair} onChange={(e) => setFlair(e.target.value)} className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs text-fg">
            <option value="">Etiqueta…</option>
            {POST_FLAIRS.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
        )}
        <Toggle on={anon} onClick={() => setAnon((v) => !v)} label="Anônimo" />
        <Toggle on={achievement} onClick={() => setAchievement((v) => !v)} icon={<Trophy className="h-3.5 w-3.5" />} label="Conquista" />
        <Toggle on={pollOn} onClick={() => setPollOn((v) => !v)} icon={<BarChart3 className="h-3.5 w-3.5" />} label="Enquete" />
        <button onClick={submit} disabled={pending} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white disabled:opacity-60">
          <Send className="h-4 w-4" /> Publicar
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, label, icon }: { on: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${on ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted hover:bg-surface-2'}`}>
      {icon}{label}
    </button>
  );
}
