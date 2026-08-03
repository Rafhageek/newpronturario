'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { NAV } from './nav';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function AppSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return NAV.slice(0, 6);
    return NAV.filter((item) =>
      normalize(`${item.label} ${item.section}`).includes(normalizedQuery),
    ).slice(0, 7);
  }, [query]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  function navigateTo(index: number) {
    const item = results[index];
    if (!item) return;
    setOpen(false);
    setQuery('');
    router.push(item.href);
  }

  return (
    <div ref={rootRef} className="relative hidden w-full max-w-[460px] md:block">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        role="combobox"
        aria-label="Buscar no prontuário"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="app-search-results"
        aria-activedescendant={
          open && results[activeIndex] ? `app-search-option-${activeIndex}` : undefined
        }
        placeholder="Buscar exame, medicamento, consulta…"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            navigateTo(activeIndex);
          } else if (event.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-10 text-sm text-fg shadow-xs outline-none placeholder:text-hint transition focus:border-primary/40 focus:bg-surface focus:ring-2 focus:ring-primary/20"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setActiveIndex(0);
            inputRef.current?.focus();
          }}
          aria-label="Limpar busca"
          className="absolute right-1.5 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-fg"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}

      {open ? (
        <div
          id="app-search-results"
          role="listbox"
          aria-label="Resultados da busca"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-xl"
        >
          {results.length > 0 ? (
            results.map((item, index) => {
              const Icon = item.icon;
              const active = index === activeIndex;
              return (
                <button
                  key={item.href}
                  id={`app-search-option-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => navigateTo(index)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition ${
                    active ? 'bg-status-info-tint text-primary' : 'text-fg hover:bg-surface-2'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className="block truncate text-xs text-muted">{item.section}</span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-5 text-center text-sm text-muted">
              Nenhuma área encontrada.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
