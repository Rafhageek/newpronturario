'use client';

import { useState } from 'react';
import { MessagesSquare, UserCog } from 'lucide-react';
import { useSocialProfile, useTopics, useForumMutations } from '@hubpatients/supabase';
import { FORUM_SORTS, type ForumSort, CRISIS_NOTICE } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { SocialDisclaimer } from '@/components/social/bits';
import { ProfileEditor } from '@/components/social/profile-editor';
import { ForumComposer } from '@/components/social/forum-composer';
import { ForumTopicRow } from '@/components/social/forum-topic-row';

export default function RedeSocialForumPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: profile } = useSocialProfile(user?.id);

  const [sort, setSort] = useState<ForumSort>('recent');
  const { data: topics, isLoading } = useTopics(null, sort);
  const { createTopic } = useForumMutations(userId);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center gap-2.5">
        <MessagesSquare className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Fórum</h1>
          <p className="text-xs text-muted">Converse com outras pessoas — dúvidas, dicas e apoio.</p>
        </div>
      </header>

      <SocialDisclaimer />

      {/* Perfil público (recolhível) */}
      <details className="rounded-2xl border border-line bg-surface-2">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm text-fg-soft">
          <UserCog className="h-4 w-4 text-primary" /> Editar meu perfil público
        </summary>
        <div className="border-t border-line p-3">
          <ProfileEditor userId={userId} profile={profile ?? null} />
        </div>
      </details>

      {/* Novo tópico */}
      <ForumComposer
        onSubmit={async (input) => { await createTopic.mutateAsync({ groupId: null, ...input }); }}
        pending={createTopic.isPending}
      />

      {/* Abas de ordenação */}
      <div className="flex w-fit rounded-xl border border-line bg-surface p-1">
        {FORUM_SORTS.map((s) => (
          <button key={s.key} onClick={() => setSort(s.key)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${sort === s.key ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Lista de tópicos */}
      {isLoading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : topics && topics.length > 0 ? (
        <div className="space-y-2">
          {topics.map((t) => <ForumTopicRow key={t.id} topic={t} basePath="/rede-social" />)}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">
          {sort === 'recent' ? 'Seja o primeiro a abrir um tópico.' : 'Nada por aqui ainda.'}
        </p>
      )}

      <p className="text-center text-xs text-muted">{CRISIS_NOTICE}</p>
    </div>
  );
}
