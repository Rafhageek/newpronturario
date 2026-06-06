'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeartPulse, ChevronLeft, X } from 'lucide-react';
import { NAV } from './nav';

export function AppSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Backdrop (só mobile, quando o drawer está aberto) */}
      {mobileOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] shrink-0 flex-col border-r border-line bg-surface transition-transform duration-300 lg:static lg:z-20 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-[76px]' : 'lg:w-[244px]'}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 shadow-lg shadow-sky-500/20">
            <HeartPulse className="h-5 w-5 text-white" strokeWidth={2.4} />
          </span>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-fg" style={{ fontFamily: 'var(--font-display)' }}>
              Vida<span className="text-primary">Log</span>
            </span>
          )}
          {/* Recolher (desktop) */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto hidden rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg-soft lg:block"
            aria-label="Recolher menu"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          {/* Fechar (mobile) */}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg-soft lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-sky-500/15 text-primary ring-1 ring-inset ring-sky-400/20'
                    : 'text-muted hover:bg-surface-2 hover:text-fg'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-primary' : ''}`} />
                {!collapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.plus && (
                      <span className="ml-auto rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Plus
                      </span>
                    )}
                    {!item.ready && !item.plus && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400/60" title="Em breve" />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé */}
        {!collapsed && (
          <div className="border-t border-line px-5 py-4">
            <p className="text-xs font-semibold text-fg-soft">VidaLog</p>
            <p className="text-[11px] text-muted">MVP · v0.1.0</p>
          </div>
        )}
      </aside>
    </>
  );
}
