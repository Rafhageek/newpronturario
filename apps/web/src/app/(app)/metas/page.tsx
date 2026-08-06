'use client';

import { useEffect, useRef, useState } from 'react';
import { Target, Scale, Footprints, Droplets, type LucideIcon } from 'lucide-react';
import { useGoals, useSetGoal, useTodayWater, useBodyComposition } from '@hubpatients/supabase';
import { useActiveProfile } from '@/components/profile-context';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

const oneDec = (n: number) => n.toFixed(1).replace('.', ',');

export default function MetasPage() {
  const { ownId } = useActiveProfile();
  const uid = ownId || undefined;
  const { data: goals } = useGoals(uid);
  const setGoal = useSetGoal(uid);
  const { data: todayWaterMl = 0 } = useTodayWater(uid);
  const { data: bodyHistory = [] } = useBodyComposition(uid);
  const currentWeight = bodyHistory[0]?.weight_kg ?? null;

  const [vals, setVals] = useState({ weight: '', steps: '', water: '' });
  const prefilled = useRef(false);
  useEffect(() => {
    if (goals && !prefilled.current) {
      prefilled.current = true;
      setVals({
        weight: goals.weight != null ? String(goals.weight).replace('.', ',') : '',
        steps: goals.steps != null ? String(goals.steps) : '',
        water: goals.water != null ? String(goals.water / 1000).replace('.', ',') : '',
      });
    }
  }, [goals]);

  async function save() {
    if (setGoal.isPending) return;
    const tasks: Promise<void>[] = [];
    const w = parseFloat(vals.weight.replace(',', '.'));
    if (Number.isFinite(w) && w > 0) tasks.push(setGoal.mutateAsync({ goalType: 'weight', target: w }));
    const s = parseInt(vals.steps.replace(/\D/g, ''), 10);
    if (Number.isFinite(s) && s > 0) tasks.push(setGoal.mutateAsync({ goalType: 'steps', target: s }));
    const l = parseFloat(vals.water.replace(',', '.'));
    if (Number.isFinite(l) && l > 0) tasks.push(setGoal.mutateAsync({ goalType: 'water', target: Math.round(l * 1000) }));
    if (!tasks.length) {
      toast.info('Defina ao menos uma meta.');
      return;
    }
    try {
      await Promise.all(tasks);
      toast.success('Metas salvas.');
    } catch {
      toast.error('Não foi possível salvar agora.');
    }
  }

  const waterPct = goals?.water ? Math.min(1, todayWaterMl / goals.water) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 hp-page hp-page--wellbeing">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-status-info-ink">
          <Target className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Minhas metas
          </h1>
          <p className="text-sm text-muted">Um incentivo pessoal, no seu ritmo — sem cobrança.</p>
        </div>
      </div>

      <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-fg">Como você está hoje</h2>
        <div className="space-y-4">
          <ProgressRow
            icon={Droplets}
            color="#0EA5E9"
            label="Água hoje"
            current={`${oneDec(todayWaterMl / 1000)} L`}
            target={goals?.water ? `${oneDec(goals.water / 1000)} L` : null}
            pct={waterPct}
          />
          <ProgressRow
            icon={Scale}
            color="#0442BF"
            label="Peso"
            current={currentWeight != null ? `${oneDec(currentWeight)} kg` : '—'}
            target={goals?.weight ? `${oneDec(goals.weight)} kg` : null}
            pct={null}
          />
          <ProgressRow
            icon={Footprints}
            color="#22C55E"
            label="Passos / dia"
            current="ver no app"
            target={goals?.steps ? String(goals.steps) : null}
            pct={null}
          />
        </div>
      </section>

      <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-fg">Definir metas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Peso (kg)" value={vals.weight} onChange={(v) => setVals((s) => ({ ...s, weight: v }))} />
          <Field label="Passos por dia" value={vals.steps} onChange={(v) => setVals((s) => ({ ...s, steps: v }))} />
          <Field label="Água por dia (litros)" value={vals.water} onChange={(v) => setVals((s) => ({ ...s, water: v }))} />
        </div>
        <button
          onClick={save}
          disabled={setGoal.isPending}
          aria-busy={setGoal.isPending || undefined}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {setGoal.isPending ? <Spinner className="h-4 w-4" /> : <Target className="h-4 w-4" />}
          {setGoal.isPending ? 'Salvando…' : 'Salvar metas'}
        </button>
        <p className="mt-3 text-[11px] leading-4 text-muted">
          Metas são um incentivo pessoal, não uma recomendação clínica. Converse com sua equipe de saúde sobre o que é ideal para você.
        </p>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none transition focus:border-primary"
      />
    </label>
  );
}

function ProgressRow({
  icon: Icon,
  color,
  label,
  current,
  target,
  pct,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  current: string;
  target: string | null;
  pct: number | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="flex-1 text-sm font-semibold text-fg">{label}</span>
        <span className="text-xs text-muted">
          {current}
          {target ? ` · meta ${target}` : ''}
        </span>
      </div>
      {pct != null ? (
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
        </div>
      ) : target == null ? (
        <p className="text-[11px] text-muted">Defina uma meta abaixo</p>
      ) : null}
    </div>
  );
}
