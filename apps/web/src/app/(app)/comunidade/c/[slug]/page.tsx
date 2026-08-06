'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Info, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useForumCategory, useCategoryTopics, useForumMutations } from '@hubpatients/supabase';
import { FORUM_SORTS, CATEGORY_DISCLAIMER, detectContentRisk, type ForumSort } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { ForumTopicRow } from '@/components/social/forum-topic-row';
import { MarkdownEditor } from '@/components/community/markdown-editor';
import { ContentGuardNotice } from '@/components/community/content-guard-notice';

const STALE_MS = 48 * 60 * 60 * 1000;

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: category, isLoading } = useForumCategory(slug);
  const [sort, setSort] = useState<ForumSort>('recent');
  const { data: topics } = useCategoryTopics(category?.id, sort);
  const forum = useForumMutations(userId);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [anon, setAnon] = useState(false);

  const risk = detectContentRisk(`${title}\n${body}`);

  async function submit() {
    if (!category || !title.trim() || !body.trim()) return;
    if (risk.medSale) {
      toast.error('Não é permitido anunciar compra, venda, troca ou doação de medicamentos.');
      return;
    }
    await forum.createTopic.mutateAsync({
      categoryId: category.id,
      groupId: category.group_id,
      title: title.trim(),
      content: body.trim(),
      isAnonymous: anon,
      tags: tags
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean)
        .slice(0, 5),
      needsReview: risk.posology || risk.crisis,
      reviewReason: risk.posology ? 'posologia' : risk.crisis ? 'crise' : null,
    });
    setTitle('');
    setBody('');
    setTags('');
    setAnon(false);
    setOpen(false);
    if (risk.posology || risk.crisis) {
      toast.info('Publicado. Sua mensagem pode passar por revisão da moderação.');
    }
  }

  if (isLoading) {
    return <div className="mx-auto max-w-2xl"><div className="h-40 animate-pulse rounded-2xl bg-surface-2" /></div>;
  }
  if (!category) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm text-muted">Categoria não encontrada.</p>
        <Link href="/comunidade" className="mt-2 inline-block text-sm text-primary hover:underline">Voltar à Comunidade</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 hp-page hp-page--community">
      <Link href="/comunidade" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Comunidade
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>{category.name}</h1>
        {category.description && <p className="text-sm text-muted">{category.description}</p>}
      </header>

      {/* Disclaimer fixo da categoria */}
      <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-fg-soft">{category.disclaimer ?? CATEGORY_DISCLAIMER}</p>
      </div>

      {/* Novo tópico */}
      {open ? (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do tópico"
            className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-fg placeholder:text-faint focus:border-sky-400/50 focus:outline-none"
          />
          <MarkdownEditor value={body} onChange={setBody} placeholder="Compartilhe sua experiência, dúvida ou conquista…" />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (separe por vírgula) — ex.: reabilitação, alimentação"
            className="h-9 w-full rounded-xl border border-line bg-surface-2 px-3 text-xs text-fg placeholder:text-faint focus:border-sky-400/50 focus:outline-none"
          />
          <ContentGuardNotice risk={risk} />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setAnon((v) => !v)}
              className={`h-9 rounded-lg border px-3 text-xs ${anon ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted'}`}
            >
              {anon ? 'Anônimo' : 'Anônimo?'}
            </button>
            <button onClick={() => setOpen(false)} className="h-9 rounded-lg px-3 text-xs text-muted hover:bg-surface-2">Cancelar</button>
            <button
              onClick={submit}
              disabled={forum.createTopic.isPending || !title.trim() || !body.trim() || risk.medSale}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> Publicar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Novo tópico
        </button>
      )}

      {/* Ordenação */}
      <div className="flex flex-wrap gap-1.5">
        {FORUM_SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${sort === s.key ? 'bg-sky-500/15 text-primary' : 'text-muted hover:bg-surface-2'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Tópicos */}
      <div className="space-y-2">
        {topics && topics.length > 0 ? (
          topics.map((t) => (
            <ForumTopicRow
              key={t.id}
              topic={t}
              basePath="/comunidade/t"
              stale={t.reply_count === 0 && Date.now() - new Date(t.last_activity_at).getTime() > STALE_MS}
            />
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">
            Nenhum tópico ainda. Seja o primeiro a iniciar a conversa.
          </p>
        )}
      </div>
    </div>
  );
}
