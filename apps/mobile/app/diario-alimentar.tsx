import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Utensils, Search, Plus, Trash2, X, Barcode, Info } from 'lucide-react-native';
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
import { useAuth } from '@/lib/auth';
import { AppHeader, Card, SectionTitle, EmptyState } from '@/components/ui';
import { BarcodeScannerSheet, type ScannedCode } from '@/components/barcode-scanner-sheet';
import {
  lookupFood,
  hasOpenFoodFactsConsent,
  saveOpenFoodFactsConsent,
  OPEN_FOOD_FACTS_DISCLAIMER,
  OPEN_FOOD_FACTS_PRIVACY_NOTICE,
  OPEN_FOOD_FACTS_SOURCE,
} from '@/lib/openfoodfacts';
import { toast } from '@/components/toast';
import { useColors, fonts } from '@/theme';

const CONTINUOUS = { borderCurve: 'continuous' as const };

/**
 * Rascunho vindo do código de barras. Tudo texto de propósito: são campos de
 * formulário que a pessoa CONFERE e corrige antes de salvar — a Open Food Facts
 * é colaborativa e erra. Nada daqui vai para o banco sem confirmação.
 */
type ScanDraft = {
  ean: string;
  name: string;
  /** Por 100 g, como vem da base (e como está no rótulo). */
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
};

/** Número do campo de texto; vazio ou inválido conta como zero. */
function toNumber(value: string): number {
  const n = parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Escala o rascunho (valores por 100 g) para a porção informada. */
function draftForGrams(draft: ScanDraft, grams: number) {
  const r = (Number.isFinite(grams) && grams > 0 ? grams : 0) / 100;
  const one = (v: string) => Math.round(toNumber(v) * r * 10) / 10;
  return {
    kcal: Math.round(toNumber(draft.kcal) * r),
    protein: one(draft.protein),
    carbs: one(draft.carbs),
    fat: one(draft.fat),
  };
}

function defaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

export default function DiarioAlimentarScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const uid = user?.id;
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

  // Código de barras
  const [scannerOpen, setScannerOpen] = useState(false);
  const [looking, setLooking] = useState(false);
  const [draft, setDraft] = useState<ScanDraft | null>(null);
  /** Código lido que a Open Food Facts não conhece — vira convite para a TACO. */
  const [notFound, setNotFound] = useState<string | null>(null);
  const searchRef = useRef<TextInput>(null);

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

  /**
   * Abre o leitor — mas só depois de a pessoa saber que o código sai do
   * aparelho (LGPD: transferência a terceiro precisa ser informada, e ela pode
   * dizer não). O "sim" é guardado e não perguntamos de novo; o "não" mantém a
   * pergunta para a próxima vez, já que a busca por nome resolve do mesmo jeito.
   */
  async function openScanner() {
    setNotFound(null);
    if (await hasOpenFoodFactsConsent()) {
      setScannerOpen(true);
      return;
    }
    Alert.alert('Consultar a Open Food Facts?', OPEN_FOOD_FACTS_PRIVACY_NOTICE, [
      {
        text: 'Agora não',
        style: 'cancel',
        onPress: () => {
          // Guarda a recusa, mas volta a perguntar se ela tocar de novo no botão:
          // "não" aqui significa "não agora", nunca um botão morto.
          void saveOpenFoodFactsConsent(false);
          toast.info('Tudo bem — busque o alimento pelo nome na Tabela TACO.');
        },
      },
      {
        text: 'Pode consultar',
        onPress: () => {
          void saveOpenFoodFactsConsent(true);
          setScannerOpen(true);
        },
      },
    ]);
  }

  /** Chega aqui com o código lido (ou digitado). Nunca salva nada sozinho. */
  async function handleScanned({ ean }: ScannedCode) {
    setSelected(null);
    setDraft(null);
    setNotFound(null);
    setLooking(true);
    const food = await lookupFood(ean);
    setLooking(false);

    if (!food) {
      // Sem produto na base: a TACO (offline) resolve pela busca por nome.
      setNotFound(ean);
      searchRef.current?.focus();
      return;
    }

    setGrams('100');
    setDraft({
      ean,
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      kcal: food.kcalPer100g != null ? String(food.kcalPer100g) : '',
      protein: food.protein != null ? String(food.protein) : '',
      carbs: food.carbs != null ? String(food.carbs) : '',
      fat: food.fat != null ? String(food.fat) : '',
    });
  }

  /** Grava o rascunho JÁ CONFERIDO pela pessoa. */
  async function addDraft() {
    if (!uid || !draft || logFood.isPending) return;
    const g = parseFloat(grams.replace(',', '.'));
    if (!Number.isFinite(g) || g <= 0) {
      toast.info('Informe a quantidade em gramas.');
      return;
    }
    const name = draft.name.trim();
    if (!name) {
      toast.info('Dê um nome ao alimento antes de salvar.');
      return;
    }
    const n = draftForGrams(draft, g);
    try {
      await logFood.mutateAsync({
        meal_type: mealType,
        food_name: name,
        grams: g,
        kcal: n.kcal,
        protein_g: n.protein,
        carbs_g: n.carbs,
        fat_g: n.fat,
      });
      setDraft(null);
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
    <View className="flex-1 bg-bg">
      <AppHeader title="Diário alimentar" subtitle="Calorias e nutrientes (TACO)" back />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
        {/* Resumo do dia */}
        <Card className="gap-3">
          <View className="flex-row items-end justify-between">
            <View>
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                Hoje
              </Text>
              <View className="flex-row items-baseline gap-1">
                <Text style={{ fontFamily: fonts.bold }} className="text-[28px] text-fg">
                  {Math.round(totals.kcal)}
                </Text>
                <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-muted">
                  {goalKcal ? `/ ${goalKcal} kcal` : 'kcal'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1.5">
              <TextInput
                value={goalInput}
                onChangeText={setGoalInput}
                onBlur={saveGoal}
                keyboardType="number-pad"
                placeholder="meta"
                placeholderTextColor={colors.faint}
                style={{ fontFamily: fonts.medium, width: 68, borderCurve: 'continuous' }}
                className="rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-[13px] text-fg"
              />
              <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-faint">
                kcal/dia
              </Text>
            </View>
          </View>
          {pct != null ? (
            <View className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <View style={{ width: `${pct * 100}%`, backgroundColor: colors.primary }} className="h-full rounded-full" />
            </View>
          ) : null}
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
            Proteína {totals.protein.toFixed(0)} g · Carboidrato {totals.carbs.toFixed(0)} g · Gordura {totals.fat.toFixed(0)} g
          </Text>
        </Card>

        {/* Adicionar alimento */}
        <SectionTitle>Adicionar alimento</SectionTitle>
        <Card className="gap-3">
          <View className="flex-row flex-wrap gap-2">
            {MEAL_TYPES.map((t) => {
              const active = t === mealType;
              return (
                <Pressable
                  key={t}
                  onPress={() => setMealType(t)}
                  style={{ borderCurve: 'continuous' }}
                  className={`rounded-full border px-3 py-1.5 ${active ? 'border-primary bg-primary/10' : 'border-line bg-surface'}`}
                >
                  <Text
                    style={{ fontFamily: active ? fonts.semibold : fonts.regular }}
                    className={`text-[13px] ${active ? 'text-primary' : 'text-fg-soft'}`}
                  >
                    {MEAL_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {looking ? (
            <View
              accessibilityLiveRegion="polite"
              className="flex-row items-center gap-2 rounded-2xl border border-line bg-surface-2 p-3"
              style={CONTINUOUS}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] text-fg-soft">
                Procurando esse código na {OPEN_FOOD_FACTS_SOURCE}…
              </Text>
            </View>
          ) : null}

          {draft ? (
            /* Rascunho do código de barras — EDITÁVEL, confirmado antes de salvar */
            <View className="gap-3 rounded-2xl border border-line bg-surface-2 p-3" style={CONTINUOUS}>
              <View className="flex-row items-start gap-2">
                <Barcode size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">
                  Confira antes de salvar
                </Text>
                <Pressable
                  onPress={() => setDraft(null)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Descartar o que veio do código de barras"
                >
                  <X size={16} color={colors.muted} />
                </Pressable>
              </View>

              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-4 text-muted">
                {`Código ${draft.ean} · dados encontrados na ${OPEN_FOOD_FACTS_SOURCE}. Compare com o rótulo da embalagem e corrija o que estiver diferente.`}
              </Text>

              <View>
                <Text style={{ fontFamily: fonts.medium }} className="mb-1 text-[12px] text-muted">
                  Nome do alimento
                </Text>
                <TextInput
                  value={draft.name}
                  onChangeText={(v) => setDraft((d) => (d ? { ...d, name: v } : d))}
                  placeholder="Como você quer ver no diário"
                  placeholderTextColor={colors.faint}
                  accessibilityLabel="Nome do alimento"
                  maxFontSizeMultiplier={1.4}
                  style={[{ fontFamily: fonts.regular, minHeight: 48 }, CONTINUOUS]}
                  className="rounded-xl border border-line bg-surface px-3 text-[15px] text-fg"
                />
              </View>

              <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
                Por 100 g (ou 100 ml), como está no rótulo
              </Text>
              <View className="flex-row flex-wrap" style={{ justifyContent: 'space-between', rowGap: 12 }}>
                <NutrientField
                  label="Calorias (kcal)"
                  value={draft.kcal}
                  onChangeText={(v) => setDraft((d) => (d ? { ...d, kcal: v } : d))}
                />
                <NutrientField
                  label="Proteína (g)"
                  value={draft.protein}
                  onChangeText={(v) => setDraft((d) => (d ? { ...d, protein: v } : d))}
                />
                <NutrientField
                  label="Carboidrato (g)"
                  value={draft.carbs}
                  onChangeText={(v) => setDraft((d) => (d ? { ...d, carbs: v } : d))}
                />
                <NutrientField
                  label="Gordura (g)"
                  value={draft.fat}
                  onChangeText={(v) => setDraft((d) => (d ? { ...d, fat: v } : d))}
                />
              </View>

              <View className="flex-row items-end gap-2">
                <View style={{ width: 110 }}>
                  <Text style={{ fontFamily: fonts.medium }} className="mb-1 text-[12px] text-muted">
                    Quanto você comeu (g)
                  </Text>
                  <TextInput
                    value={grams}
                    onChangeText={setGrams}
                    keyboardType="decimal-pad"
                    placeholder="gramas"
                    placeholderTextColor={colors.faint}
                    accessibilityLabel="Quantidade em gramas"
                    maxFontSizeMultiplier={1.4}
                    style={[{ fontFamily: fonts.regular, minHeight: 48 }, CONTINUOUS]}
                    className="rounded-xl border border-line bg-surface px-3 text-[15px] text-fg"
                  />
                </View>
                <Text style={{ fontFamily: fonts.regular }} className="flex-1 pb-3 text-[13px] text-muted">
                  {`= ${draftForGrams(draft, parseFloat(grams.replace(',', '.')) || 0).kcal} kcal`}
                </Text>
              </View>

              <Pressable
                onPress={addDraft}
                disabled={logFood.isPending}
                accessibilityRole="button"
                accessibilityLabel="Conferi os dados e quero adicionar ao diário"
                style={[
                  { backgroundColor: colors.primary, minHeight: 56 },
                  CONTINUOUS,
                  logFood.isPending ? { opacity: 0.6 } : null,
                ]}
                className="flex-row items-center justify-center gap-2 rounded-2xl px-4 active:opacity-80"
              >
                {logFood.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Plus size={18} color="#fff" />
                )}
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={{ fontFamily: fonts.semibold }}
                  className="text-[15px] text-white"
                >
                  Conferi — adicionar ao diário
                </Text>
              </Pressable>

              <View className="flex-row items-start gap-1.5">
                <Info size={13} color={colors.muted} style={{ marginTop: 2 }} />
                <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[11px] leading-4 text-muted">
                  {OPEN_FOOD_FACTS_DISCLAIMER}
                </Text>
              </View>
            </View>
          ) : selected ? (
            /* Passo da quantidade */
            <View className="gap-2.5 rounded-2xl border border-line bg-surface-2 p-3" style={{ borderCurve: 'continuous' }}>
              <View className="flex-row items-start justify-between gap-2">
                <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">
                  {selected.name}
                </Text>
                <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                  <X size={16} color={colors.muted} />
                </Pressable>
              </View>
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={grams}
                  onChangeText={setGrams}
                  keyboardType="decimal-pad"
                  placeholder="gramas"
                  placeholderTextColor={colors.faint}
                  style={{ fontFamily: fonts.regular, width: 90, borderCurve: 'continuous' }}
                  className="rounded-xl border border-line bg-surface px-3 py-2 text-[15px] text-fg"
                />
                <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
                  g · {preview ? preview.kcal : 0} kcal
                </Text>
                <Pressable
                  onPress={addSelected}
                  disabled={logFood.isPending}
                  style={{ backgroundColor: colors.primary, borderCurve: 'continuous', minHeight: 40 }}
                  className="ml-auto flex-row items-center gap-1.5 rounded-xl px-3 active:opacity-80"
                >
                  {logFood.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Plus size={15} color="#fff" />
                  )}
                  <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-white">
                    Adicionar
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {/* Atalho pelo código de barras — alternativa à digitação. */}
              <Pressable
                onPress={() => void openScanner()}
                disabled={looking}
                accessibilityRole="button"
                accessibilityLabel="Escanear o código de barras da embalagem"
                accessibilityHint="Abre a câmera para ler o código; você confere os dados antes de salvar"
                style={[{ minHeight: 56 }, CONTINUOUS, looking ? { opacity: 0.6 } : null]}
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-primary bg-primary/10 px-4 active:opacity-80"
              >
                <Barcode size={20} color={colors.primary} />
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={{ fontFamily: fonts.semibold, color: colors.primary }}
                  className="text-[15px]"
                >
                  Escanear código
                </Text>
              </Pressable>

              {notFound ? (
                <View
                  accessibilityLiveRegion="polite"
                  className="gap-1 rounded-2xl border border-line bg-surface-2 p-3"
                  style={CONTINUOUS}
                >
                  <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-fg">
                    {`Código ${notFound} não encontrado`}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-4 text-muted">
                    {`A ${OPEN_FOOD_FACTS_SOURCE} não tem esse produto cadastrado — é uma base colaborativa e muitos itens brasileiros faltam. Busque pelo nome na Tabela TACO abaixo.`}
                  </Text>
                </View>
              ) : null}

              <View className="flex-row items-center gap-2 rounded-xl border border-line bg-surface px-3" style={{ borderCurve: 'continuous' }}>
                <Search size={16} color={colors.faint} />
                <TextInput
                  ref={searchRef}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar alimento (ex.: arroz, frango)…"
                  placeholderTextColor={colors.faint}
                  style={{ fontFamily: fonts.regular, flex: 1, paddingVertical: 10 }}
                  className="text-[15px] text-fg"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <X size={16} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
              {results.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    setSelected(f);
                    setGrams('100');
                  }}
                  className="flex-row items-center justify-between border-t border-line py-2 active:opacity-70"
                >
                  <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] text-fg" numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
                    {Math.round(f.kcal)} kcal/100g
                  </Text>
                </Pressable>
              ))}
              {query.trim().length >= 2 && results.length === 0 ? (
                <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                  Nenhum alimento encontrado.
                </Text>
              ) : null}
            </>
          )}
          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">
            {NUTRITION_DISCLAIMER}
          </Text>
        </Card>

        {/* Itens de hoje, por refeição */}
        <SectionTitle>Refeições de hoje</SectionTitle>
        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : entries.length === 0 ? (
          <EmptyState icon={Utensils} title="Nada registrado hoje" subtitle="Busque um alimento acima para começar." />
        ) : (
          MEAL_TYPES.filter((mt) => entries.some((e) => e.meal_type === mt)).map((mt) => {
            const items = entries.filter((e) => e.meal_type === mt);
            const sub = items.reduce((s, e) => s + e.kcal, 0);
            return (
              <Card key={mt} className="gap-1">
                <View className="flex-row items-center justify-between pb-1">
                  <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                    {MEAL_TYPE_LABELS[mt]}
                  </Text>
                  <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
                    {Math.round(sub)} kcal
                  </Text>
                </View>
                {items.map((e, i) => (
                  <View key={e.id} className={`flex-row items-center gap-3 py-2 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <View className="flex-1">
                      <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-fg" numberOfLines={1}>
                        {e.food_name}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
                        {e.grams.toFixed(0)} g · {Math.round(e.kcal)} kcal · P {e.protein_g.toFixed(0)} C {e.carbs_g.toFixed(0)} G {e.fat_g.toFixed(0)}
                      </Text>
                    </View>
                    <Pressable onPress={() => delFood.mutate(e.id)} hitSlop={8} className="p-1 active:opacity-60">
                      <Trash2 size={16} color={colors.faint} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            );
          })
        )}
      </ScrollView>

      {scannerOpen ? (
        <BarcodeScannerSheet
          title="Código do alimento"
          helpText="Aponte a câmera para o código de barras da embalagem, dentro da moldura."
          privacyNote={`Só o número do código é enviado para a ${OPEN_FOOD_FACTS_SOURCE}. Nenhum dado seu vai junto.`}
          onScanned={(code) => void handleScanned(code)}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}
    </View>
  );
}

/* ──────────────────────────── Campo de nutriente ──────────────────────────── */

/** Campo numérico do rascunho: rótulo em cima, meia largura, alvo confortável. */
function NutrientField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ width: '47%' }}>
      <Text style={{ fontFamily: fonts.medium }} className="mb-1 text-[12px] text-muted">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.faint}
        accessibilityLabel={label}
        maxFontSizeMultiplier={1.4}
        style={[{ fontFamily: fonts.regular, minHeight: 48 }, CONTINUOUS]}
        className="rounded-xl border border-line bg-surface px-3 text-[15px] text-fg"
      />
    </View>
  );
}
