'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CYCLE_PHASE_COLORS,
  CYCLE_PHASE_LABELS,
  dayInCycleFor,
  findLastPeriodStart,
  phaseForDayInCycle,
  type CyclePhase,
  type MenstrualCycleLog,
} from '@hubpatients/core';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayISO(): string {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Calendário MENSAL navegável com os dias coloridos por fase estimada,
 * projetada a partir do último início de menstruação + cycleLength.
 * Sem histórico, mostra o mês sem cores de fase (apenas os registros).
 * Dias com fluxo registrado recebem um realce. Clicar chama onPickDay(ISO).
 */
export function CycleCalendar({
  logs,
  cycleLength,
  periodDays = 5,
  onPickDay,
}: {
  logs: MenstrualCycleLog[];
  cycleLength: number;
  periodDays?: number;
  onPickDay: (dateISO: string) => void;
}) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const lastPeriodStart = useMemo(() => findLastPeriodStart(logs), [logs]);

  // Datas (ISO) com fluxo > 0 registrado, para realçar.
  const flowDays = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) if (l.flow_level > 0) set.add(l.log_date);
    return set;
  }, [logs]);

  const today = todayISO();

  const grid = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const leading = first.getDay(); // 0=Dom
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const cells: Array<{ day: number; iso: string } | null> = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, iso: toISO(view.year, view.month, d) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  function phaseFor(iso: string): CyclePhase | null {
    if (!lastPeriodStart) return null;
    const dim = dayInCycleFor(iso, lastPeriodStart, cycleLength);
    return phaseForDayInCycle(dim, cycleLength, periodDays);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      const year = v.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => shiftMonth(-1)}
          aria-label="Mês anterior"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-fg-soft transition hover:bg-surface-2"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p
          className="text-sm font-bold text-fg"
          style={{ fontFamily: 'var(--font-display)' }}
          aria-live="polite"
        >
          {MONTHS[view.month]} de {view.year}
        </p>
        <button
          onClick={() => shiftMonth(1)}
          aria-label="Próximo mês"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-fg-soft transition hover:bg-surface-2"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="py-1 text-center text-xs font-medium text-faint">
            {w}
          </div>
        ))}

        {grid.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} aria-hidden />;
          const phase = phaseFor(cell.iso);
          const isToday = cell.iso === today;
          const hasFlow = flowDays.has(cell.iso);
          const bg = phase ? CYCLE_PHASE_COLORS[phase] : undefined;
          const label = phase
            ? `${cell.day} — ${CYCLE_PHASE_LABELS[phase]}${hasFlow ? ', fluxo registrado' : ''}`
            : `${cell.day}${hasFlow ? ' — fluxo registrado' : ''}`;
          return (
            <button
              key={cell.iso}
              onClick={() => onPickDay(cell.iso)}
              aria-label={label}
              aria-current={isToday ? 'date' : undefined}
              className={`relative flex h-11 min-h-[44px] items-center justify-center rounded-xl text-sm transition hover:ring-2 hover:ring-fuchsia-400/40 ${
                isToday ? 'font-bold ring-2 ring-fuchsia-500' : 'font-medium'
              }`}
              style={
                bg
                  ? { backgroundColor: bg, color: '#1f2937' }
                  : undefined
              }
            >
              <span
                className={bg ? '' : 'text-fg'}
              >
                {cell.day}
              </span>
              {hasFlow && (
                <span
                  aria-hidden
                  className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-rose-600"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda das fases */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {(Object.keys(CYCLE_PHASE_LABELS) as CyclePhase[]).map((p) => (
          <li key={p} className="flex items-center gap-1.5 text-xs text-fg-soft">
            <span
              aria-hidden
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: CYCLE_PHASE_COLORS[p] }}
            />
            {CYCLE_PHASE_LABELS[p]}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-xs text-fg-soft">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rose-600" />
          Fluxo registrado
        </li>
      </ul>

      {!lastPeriodStart && (
        <p className="mt-3 text-xs leading-relaxed text-faint">
          As cores de fase aparecem depois que você registrar ao menos um dia de
          menstruação. Toque em um dia para registrar.
        </p>
      )}
    </section>
  );
}
