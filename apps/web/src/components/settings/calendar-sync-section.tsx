'use client';

import { useState } from 'react';
import { CalendarClock, Check, Copy, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useCalendarSubscription, useSetCalendarSync, useRotateCalendarToken } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { confirmAction } from '@/lib/confirm';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

const INSTRUCTIONS: { platform: string; steps: string[] }[] = [
  {
    platform: 'Google Calendar',
    steps: [
      'No computador, abra o Google Calendar.',
      'Em "Outras agendas", clique em + → "De um URL".',
      'Cole a URL acima e clique em "Adicionar agenda".',
    ],
  },
  {
    platform: 'Apple Calendar (iPhone/Mac)',
    steps: [
      'iPhone: Ajustes → Calendário → Contas → Adicionar conta → Outra → Adicionar calendário assinado.',
      'Cole a URL e confirme.',
    ],
  },
  {
    platform: 'Outlook',
    steps: ['Calendário → Adicionar calendário → Assinar pela Web → cole a URL.'],
  },
];

export function CalendarSyncSection() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: sub } = useCalendarSubscription(user?.id, SUPABASE_URL);
  const setSync = useSetCalendarSync(userId);
  const rotate = useRotateCalendarToken(userId);
  const [copied, setCopied] = useState(false);

  const enabled = sub?.enabled ?? false;

  function copy() {
    if (!sub?.feedUrl) return;
    navigator.clipboard.writeText(sub.feedUrl);
    setCopied(true);
    toast.success('URL copiada.');
  }

  async function onRotate() {
    if (!confirmAction('Gerar uma nova URL invalida a anterior. Os calendários já adicionados pararão de atualizar até você adicionar a nova URL. Continuar?')) return;
    try {
      await rotate.mutateAsync();
      setCopied(false);
      toast.success('Nova URL gerada.');
    } catch {
      toast.error('Não foi possível gerar a nova URL.');
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
          Calendário externo
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        Veja suas consultas no Google Calendar, Apple Calendar ou Outlook — atualiza sozinho.
      </p>

      <label className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-fg">Sincronizar com calendário externo</span>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Sincronizar com calendário externo"
          onClick={() => setSync.mutate(!enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? 'bg-primary' : 'bg-muted/40'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </label>

      {enabled && sub?.feedUrl && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-attention-ink" />
            <p className="text-xs text-fg-soft">
              Esta URL dá acesso ao seu calendário de consultas. Compartilhe apenas com seus próprios
              dispositivos. Os eventos contêm só a logística (médico, horário, local) — nunca diagnósticos.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2">
            <input
              readOnly
              value={sub.feedUrl}
              aria-label="URL do feed de calendário"
              className="min-w-0 flex-1 bg-transparent px-2 text-xs text-fg-soft outline-none"
            />
            <button
              onClick={copy}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-sky-500/15 px-3 text-xs font-semibold text-primary hover:bg-sky-500/25"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <details className="rounded-xl border border-line">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-fg-soft">
              Como adicionar no meu celular/computador
            </summary>
            <div className="space-y-3 border-t border-line p-3">
              {INSTRUCTIONS.map((g) => (
                <div key={g.platform}>
                  <p className="text-xs font-semibold text-fg">{g.platform}</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-muted">
                    {g.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </details>

          <button
            onClick={onRotate}
            disabled={rotate.isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3.5 text-sm font-medium text-fg-soft hover:bg-surface-2"
          >
            <RefreshCw className="h-4 w-4" /> Gerar nova URL
          </button>
        </div>
      )}
    </section>
  );
}
