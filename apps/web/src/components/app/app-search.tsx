'use client';

/**
 * Busca da barra do topo.
 *
 * O atalho `Ctrl + K` é ANUNCIADO na tela (a tecla aparece à direita do campo) e
 * FUNCIONA: atalho escrito que não faz nada é pior que atalho nenhum. No macOS o
 * rótulo troca para `⌘ K` depois da montagem — a plataforma só é conhecida no
 * cliente, e trocar antes disso daria erro de hidratação.
 *
 * A borda usa `line-strong` (≥3:1) e não `line`: `line` tem contraste de
 * separador decorativo, não de controle de formulário (WCAG SC 1.4.11).
 */

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
  const [ehMac, setEhMac] = useState(false);

  useEffect(() => {
    setEhMac(/mac/i.test(window.navigator.platform || window.navigator.userAgent));
  }, []);

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

  /** Ctrl + K (⌘ K no macOS) leva o foco para a busca, de qualquer lugar do app. */
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      // `hidden` no telefone: `focus()` vira no-op, então não roubamos a tecla.
      const campo = inputRef.current;
      if (!campo || campo.offsetParent === null) return;
      event.preventDefault();
      campo.focus();
      campo.select();
      setOpen(true);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function navigateTo(index: number) {
    const item = results[index];
    if (!item) return;
    setOpen(false);
    setQuery('');
    router.push(item.href);
  }

  return (
    <div ref={rootRef} className="relative hidden w-full max-w-[520px] md:block">
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
        aria-keyshortcuts={ehMac ? 'Meta+K' : 'Control+K'}
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
        className="min-h-11 w-full rounded-chip border border-line-strong bg-surface-2 py-2 pl-10 pr-24 text-body-sm text-fg outline-none transition-colors placeholder:text-hint focus:border-primary focus:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
          className="absolute right-2 top-1/2 z-10 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-chip text-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        /* Dica de atalho. `aria-hidden` porque o mesmo dado já vai ao leitor de
           tela por `aria-keyshortcuts` no campo — dito duas vezes vira ruído. */
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 font-sans text-caption font-semibold text-hint lg:inline-flex"
        >
          {ehMac ? '⌘' : 'Ctrl'} + K
        </kbd>
      )}

      {open ? (
        <div
          id="app-search-results"
          role="listbox"
          aria-label="Resultados da busca"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-card border border-line bg-surface p-2 shadow-raised"
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
                  className={`flex min-h-11 w-full items-center gap-3 rounded-chip px-3 py-2 text-left transition-colors ${
                    active ? 'bg-nav-active-tint text-nav-active-ink' : 'text-fg hover:bg-surface-2'
                  }`}
                >
                  <Icon className="h-[1.15em] w-[1.15em] shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold">{item.label}</span>
                    <span className="block truncate text-caption text-muted">{item.section}</span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-5 text-center text-body-sm text-muted">
              Nenhuma área encontrada.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
