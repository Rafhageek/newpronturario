'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookText, MessageSquare, Search, ShieldCheck, Stethoscope, TrendingUp } from 'lucide-react';
import { useForumCategories, useTrendingTags, useForumSearch } from '@hubpatients/supabase';
import { categoryIcon } from '@/components/community/category-icon';
import { RulesOnboarding } from '@/components/community/rules-onboarding';
import { ForumTopicRow } from '@/components/social/forum-topic-row';
import { timeAgo } from '@/lib/time';

export default function ComunidadePage() {
  const { data: categories } = useForumCategories();
  const { data: trending } = useTrendingTags();
  const [query, setQuery] = useState('');
  const { data: results, isFetching } = useForumSearch(query);
  const searching = query.trim().length >= 2;

  const { themes, conditions } = useMemo(() => {
    const list = categories ?? [];
    return {
      themes: list.filter((c) => c.kind === 'theme'),
      conditions: list.filter((c) => c.kind === 'condition'),
    };
  }, [categories]);

  return (
    <div className="mx-auto grid max-w-5xl gap-5 hp-page hp-page--community lg:grid-cols-[1fr_240px]">
      <RulesOnboarding />
      <div className="space-y-5">
        <header className="hp-page-hero flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
              Comunidade
            </h1>
            <p className="text-sm text-muted">Conecte-se com quem vive a mesma condição que você.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/comunidade/medicos" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs text-fg-soft hover:bg-surface-2">
              <Stethoscope className="h-3.5 w-3.5" /> Médicos
            </Link>
            <Link href="/comunidade/regras" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs text-fg-soft hover:bg-surface-2">
              <BookText className="h-3.5 w-3.5" /> Regras
            </Link>
          </div>
        </header>

        {/* Privacidade */}
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-ok-ink" />
          <p className="text-xs leading-relaxed text-fg-soft">
            Sua identidade real <strong>nunca</strong> é exposta. Você escolhe postar com pseudônimo ou
            de forma anônima — relatos são experiências pessoais, não orientação médica.
          </p>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tópicos por título ou conteúdo…"
            aria-label="Buscar no fórum"
            className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm text-fg placeholder:text-faint focus:border-sky-400/50 focus:outline-none"
          />
        </div>

        {searching ? (
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-faint">
              {isFetching ? 'Buscando…' : `${results?.length ?? 0} resultado(s)`}
            </p>
            {(results ?? []).map((t) => (
              <ForumTopicRow key={t.id} topic={t} basePath="/comunidade/t" />
            ))}
            {!isFetching && (results?.length ?? 0) === 0 && (
              <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
                Nada encontrado para “{query}”.
              </p>
            )}
          </section>
        ) : (
          <>
            <CategorySection title="Temas" items={themes} />
            <CategorySection title="Por condição" items={conditions} />
          </>
        )}
      </div>

      {/* Em alta */}
      <aside className="space-y-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fg">
            <TrendingUp className="h-4 w-4 text-primary" /> Em alta
          </p>
          {(trending ?? []).length === 0 ? (
            <p className="text-xs text-muted">As tags mais usadas aparecem aqui.</p>
          ) : (
            <ul className="space-y-1.5">
              {(trending ?? []).map((t) => (
                <li key={t.tag} className="flex items-center justify-between text-sm">
                  <span className="truncate text-fg-soft">#{t.tag}</span>
                  <span className="text-xs text-faint">{t.uses}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function CategorySection({
  title,
  items,
}: {
  title: string;
  items: NonNullable<ReturnType<typeof useForumCategories>['data']>;
}) {
  if (!items || items.length === 0) return null;
  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{title}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {items.map((c) => {
          const Icon = categoryIcon(c.icon);
          return (
            <Link
              key={c.category_id}
              href={`/comunidade/c/${c.slug}`}
              className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-primary/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg group-hover:text-primary">{c.name}</p>
                {c.description && <p className="line-clamp-2 text-xs text-muted">{c.description}</p>}
                <p className="mt-1 flex items-center gap-2 text-[11px] text-faint">
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {c.topic_count}
                  </span>
                  {c.last_activity_at && <span>· ativo {timeAgo(c.last_activity_at)}</span>}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
