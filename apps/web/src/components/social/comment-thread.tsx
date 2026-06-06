'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useComments } from '@vidalog/supabase';

export function CommentThread({
  postId,
  userId,
  onComment,
}: {
  postId: string;
  userId: string;
  onComment: (content: string, isAnonymous: boolean) => Promise<void> | void;
}) {
  const { data: comments } = useComments(postId, true);
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    await onComment(text.trim(), anon);
    setText('');
  }

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {(comments ?? []).map((c) => {
        const who = c.is_anonymous ? 'Anônimo' : c.author_id === userId ? 'Você' : 'Usuário';
        return (
          <div key={c.id} className="text-sm">
            <span className="font-medium text-fg-soft">{who}</span>
            <span className="ml-2 text-muted">{c.content}</span>
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Comentar…"
          className="h-9 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-muted focus:border-sky-400/50 focus:outline-none"
        />
        <label className="flex items-center gap-1 text-xs text-muted" title="Comentar anonimamente">
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> anônimo
        </label>
        <button onClick={submit} className="rounded-lg bg-sky-500/15 p-2 text-primary hover:bg-sky-500/25"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
