'use client';

import { useEffect, useMemo, useState } from 'react';
import { Utensils, Search, Plus, Trash2, X } from 'lucide-react';
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  searchFoods,
  nutritionForGrams,
  NUTRITION_DISCLAIMER,
  type MealType,
  type TacoFood,
} from '@hubpatients/core';
import {
  useTodayFoodEntries,
  useLogFoodEntry,
  useDeleteFoodEntry,
  useGoals,
  useSetGoal,
} from '@hubpatients/supabase';
import { useActiveProfile } from '@/components/profile-context';
import { toast } from 'sonner';

function defaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

export default function DiarioAlimentarPage() {
  const { ownId } = useActiveProfile();
  const uid = ownId || undefined;
  const { data: entries = [], isLoading } = useTodayFoodEntries(uid);
  const logFood = useLogFoodEntry(uid);
  const delFood = useDeleteFoodEntry(uid);
  const { data: goals } = useGoals(uid);
  const setGoal = useSetGoal(uid);

  const [mealType, setMealType] = useState<MealType>(defaultMeal());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TacoFood | null>(null);
  const [grams, setGrams] = useState('100');
  const [goalInput, setGoalInput] = useState('');

  useEffect(() => {
    if (goals?.calories != null && goalInput === '') setGoalInput(String(goals.calories));
  }, [goals, goalInput]);

  const results = useMemo(() => (query.trim().length >= 2 ? searchFoods(query, 25) : []), [query]);
  const totals = useMemo(
    () =>
      entries.reduce(
        (a, e) => ({
          kcal: a.kcal + e.kcal,
          protein: a.protein + e.protein_g,
          carbs: a.carbs + e.carbs_g,
          fat: a.fat + e.fat_g,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [entries],
  );
  const goalKcal = goals?.calories ?? null;
  const pct = goalKcal ? Math.min(1, totals.kcal / goalKcal) : null;
  const preview = selected ? nutritionForGrams(selected, parseFloat(grams.replace(',', '.')) || 0) : null;

  async function addSelected() {
    if (!uid || !selected || logFood.isPending) return;
    const g = parseFloat(grams.replace(',', '.'));
    if (!Number.isFinite(g) || g <= 0) {
      toast.info('Informe a quantidade em gramas.');
      return;
    }
    const n = nutritionForGrams(selected, g);
    try {
      await logFood.mutateAsync({
        meal_type: mealType,
        food_name: selected.name,
        grams: g,
        kcal: n.kcal,
        protein_g: n.protein,
        carbs_g: n.carbs,
        fat_g: n.fat,
      });
      setSelected(null);
      setQuery('');
      setGrams('100');
      toast.success('Adicionado ao diário.');
    } catch {
      toast.error('Não foi possível adicionar agora.');
    }
  }

  async function saveGoal() {
    const v = parseInt(goalInput.replace(/\D/g, ''), 10);
    if (!uid || !Number.isFinite(v) || v <= 0) return;
    try {
      await setGoal.mutateAsync({ goalType: 'calories', target: v });
      toast.success('Meta de calorias salva.');
    } catch {
      toast.error('Não foi possível salvar a meta.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-status-ok-ink">
          <Utensils className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Diário alimentar
          </h1>
          <p className="text-sm text-muted">Calorias e nutrientes pela Tabela TACO — registro, não dieta.</p>
        </div>
      </div>

      {/* Resumo do dia */}
      <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted">Hoje</p>
            <p className="text-fg">
              <span className="text-3xl font-bold">{Math.round(totals.kcal)}</span>
              <span className="ml-1 text-sm font-medium text-muted">{goalKcal ? `/ ${goalKcal} kcal` : 'kcal'}</span>
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={saveGoal}
              inputMode="numeric"
              placeholder="meta"
              className="w-20 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-center text-sm text-fg outline-none focus:border-primary"
            />
            kcal/dia
          </label>
        </div>
        {pct != null && (
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          Proteína {totals.protein.toFixed(0)} g · Carboidrato {totals.carbs.toFixed(0)} g · Gordura {totals.fat.toFixed(0)} g
        </p>
      </section>

      {/* Adicionar */}
      <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-fg">Adicionar alimento</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {MEAL_TYPES.map((t) => {
            const active = t === mealType;
            return (
              <button
                key={t}
                onClick={() => setMealType(t)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-line bg-surface-2 text-fg-soft hover:border-primary/40'}`}
              >
                {MEAL_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>

        {selected ? (
          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="flex-1 text-sm font-semibold text-fg">{selected.name}</p>
              <button onClick={() => setSelected(null)} aria-label="Cancelar" className="text-muted hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                inputMode="decimal"
                className="w-24 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-primary"
              />
              <span className="text-sm text-muted">g · {preview ? preview.kcal : 0} kcal</span>
              <button
                onClick={addSelected}
                disabled={logFood.isPending}
                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3">
              <Search className="h-4 w-4 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar alimento (ex.: arroz, frango)…"
                className="w-full bg-transparent py-2.5 text-sm text-fg outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Limpar" className="text-muted hover:text-fg">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {results.length > 0 && (
              <ul className="mt-1 max-h-72 divide-y divide-line overflow-y-auto">
                {results.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => {
                        setSelected(f);
                        setGrams('100');
                      }}
                      className="flex w-full items-center justify-between gap-3 py-2 text-left transition hover:opacity-70"
                    >
                      <span className="truncate text-sm text-fg">{f.name}</span>
                      <span className="shrink-0 text-xs text-muted">{Math.round(f.kcal)} kcal/100g</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && results.length === 0 && (
              <p className="mt-2 text-xs text-muted">Nenhum alimento encontrado.</p>
            )}
          </>
        )}
        <p className="mt-3 text-[11px] leading-4 text-muted">{NUTRITION_DISCLAIMER}</p>
      </section>

      {/* Refeições de hoje */}
      <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-fg">Refeições de hoje</h2>
        {isLoading ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted">Nada registrado hoje — busque um alimento acima para começar.</p>
        ) : (
          <div className="space-y-4">
            {MEAL_TYPES.filter((mt) => entries.some((e) => e.meal_type === mt)).map((mt) => {
              const items = entries.filter((e) => e.meal_type === mt);
              const sub = items.reduce((s, e) => s + e.kcal, 0);
              return (
                <div key={mt}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-fg">{MEAL_TYPE_LABELS[mt]}</span>
                    <span className="text-xs text-muted">{Math.round(sub)} kcal</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {items.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-fg">{e.food_name}</p>
                          <p className="text-[11px] text-muted">
                            {e.grams.toFixed(0)} g · {Math.round(e.kcal)} kcal · P {e.protein_g.toFixed(0)} C{' '}
                            {e.carbs_g.toFixed(0)} G {e.fat_g.toFixed(0)}
                          </p>
                        </div>
                        <button
                          onClick={() => delFood.mutate(e.id)}
                          aria-label="Excluir"
                          className="shrink-0 text-muted transition hover:text-status-alert-ink"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
