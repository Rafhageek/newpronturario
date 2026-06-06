'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

export function ForumComposer({
  onSubmit,
  pending,
}: {
  onSubmit: (input: { title: string; content: string; isAnonymous: boolean }) => Promise<void> | void;
  pending?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [anon, setAnon] = useState(false);

  async function submit() {
    if (title.trim().length < 3) { toast.error('Dê um título ao tópico.'); return; }
    if (content.trim().length < 1) { toast.error('Escreva o conteúdo.'); return; }
    await onSubmit({ title: title.trim(), content: content.trim(), isAnonymous: anon });
    setTitle(''); setContent(''); setAnon(false);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título do tópico — ex.: Como vocês organizam os horários dos remédios?"
        className="mb-2 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-fg placeholder:text-muted focus:border-sky-400/50 focus:outline-none"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Compartilhe com cuidado… (nada de dados clínicos sensíveis de terceiros)"
        className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-muted focus:border-sky-400/50 focus:outline-none"
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setAnon((v) => !v)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${anon ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted hover:bg-surface-2'}`}
        >
          Anônimo
        </button>
        <button onClick={submit} disabled={pending} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white disabled:opacity-60">
          <Send className="h-4 w-4" /> Abrir tópico
        </button>
      </div>
    </div>
  );
}
