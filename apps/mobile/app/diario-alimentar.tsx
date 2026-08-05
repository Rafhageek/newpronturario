/**
 * ════════════════════════════════════════════════════════════════════════════
 * DIÁRIO ALIMENTAR (mobile)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Paridade com `apps/web/src/app/(app)/diario-alimentar/page.tsx`, incluindo as
 * três decisões que atravessam as duas telas:
 *
 * 1. NENHUMA COR JULGA O QUE A PESSOA COMEU. Progresso é comprimento + número,
 *    num matiz só (ver `components/diario-alimentar/progresso.tsx`). A regra
 *    está nos tokens e travada em `regra-cor-clinica.test.ts`, que varre este
 *    arquivo.
 *
 * 2. A TELA NÃO MORALIZA A META. "1.250 de 2.000 kcal", nunca "750 restantes";
 *    a meta é sempre "que você definiu"; a semana conta REGISTRO, não
 *    aderência; não existe sequência, recorde nem elogio.
 *
 * 3. CADA NÚMERO DIZ DE ONDE VEIO (TACO, Open Food Facts, digitado pela
 *    pessoa). O rodapé nomeia as origens que estão mesmo no dia.
 *
 * Sem `Intl` em lugar nenhum: o Hermes derruba o app. Datas e números passam
 * por `datas-pt.ts` e `numeroBR()`, no core.
 */

import { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Star,
  Coffee,
  Soup,
  Apple,
  Moon,
  RotateCcw,
  BookMarked,
  PencilLine,
  Info,
  type LucideIcon,
} from 'lucide-react-native';
import {
  MEAL_TYPES_DO_DIA,
  MEAL_TYPE_LABELS,
  MACROS,
  MACRO_ROTULO,
  METAS_DE_MACRO_NOTA,
  agruparPorRefeicao,
  diaLocal,
  somarDias,
  rotuloDoDia,
  semanaDe,
  SEMANA_CURTA_SEG_PRIMEIRO,
  resumoDaSemana,
  totaisDoDia,
  progressoNutriente,
  descricaoProgresso,
  metasDeMacro,
  numeroBR,
  fraseDeOrigem,
  origensPresentes,
  normalizarFonte,
  FONTE_ROTULO,
  estadoSecao,
  podeAfirmarAusencia,
  type EstadoSecao,
  type MealType,
} from '@hubpatients/core';
import {
  useFoodEntriesForDay,
  useFoodLoggedDays,
  useRecentFoods,
  useFoodLibrary,
  useSavedMeals,
  useLogFoodEntry,
  useLogFoodEntries,
  useDeleteFoodEntry,
  useUpsertFoodLibraryItem,
  useSetFoodFavorite,
  useCreateSavedMeal,
  useGoals,
  useSetGoal,
  type FoodEntry,
  type FoodLibraryItem,
} from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { AppHeader, Card, SectionTitle, Button, Input } from '@/components/ui';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
import { toast } from '@/components/toast';
import { useColors, useType, useFontScaler, useTapTarget, fonts } from '@/theme';
import {
  AnelDeProgresso,
  BarraDeNutriente,
  VisaoDaSemana,
} from '@/components/diario-alimentar/progresso';
import {
  SheetAdicionarAlimento,
  type AlimentoParaRegistrar,
  type AlimentoParaBiblioteca,
} from '@/components/diario-alimentar/sheet-adicionar';

const CONTINUOUS = { borderCurve: 'continuous' as const };

const ICONE_REFEICAO: Record<MealType, LucideIcon> = {
  breakfast: Coffee,
  lunch: Soup,
  snack: Apple,
  dinner: Moon,
};

/** Refeição provável pelo horário — palpite de conveniência, sempre editável. */
function refeicaoPeloRelogio(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

type AbaBusca = 'recentes' | 'favoritos' | 'meus';

export default function DiarioAlimentarScreen() {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const { user, loading: authLoading } = useAuth();
  const uid = user?.id;
  const sujeitoConhecido = !authLoading && Boolean(uid);

  const hoje = diaLocal();
  const [dia, setDia] = useState(hoje);
  const ontem = somarDias(dia, -1);
  const semana = useMemo(() => semanaDe(dia), [dia]);

  const itensQ = useFoodEntriesForDay(uid, dia);
  const ontemQ = useFoodEntriesForDay(uid, ontem);
  const semanaQ = useFoodLoggedDays(uid, semana[0] ?? dia, semana[6] ?? dia);
  const recentesQ = useRecentFoods(uid);
  const bibliotecaQ = useFoodLibrary(uid);
  const salvasQ = useSavedMeals(uid);
  const { data: metas } = useGoals(uid);

  const registrar = useLogFoodEntry(uid);
  const registrarVarios = useLogFoodEntries(uid);
  const excluir = useDeleteFoodEntry(uid);
  const guardarNaBiblioteca = useUpsertFoodLibraryItem(uid);
  const marcarFavorito = useSetFoodFavorite(uid);
  const criarRefeicaoSalva = useCreateSavedMeal(uid);
  const definirMeta = useSetGoal(uid);

  const [sheetAberto, setSheetAberto] = useState(false);
  const [sheetEmCriar, setSheetEmCriar] = useState(false);
  const [refeicaoAlvo, setRefeicaoAlvo] = useState<MealType>(refeicaoPeloRelogio());
  const [sheetMeta, setSheetMeta] = useState(false);
  const [sheetSalvas, setSheetSalvas] = useState(false);
  const [abaBusca, setAbaBusca] = useState<AbaBusca>('recentes');
  /** Refeição do dia que a pessoa quer guardar como combinação reutilizável. */
  const [aSalvar, setASalvar] = useState<{ tipo: MealType; itens: FoodEntry[] } | null>(null);

  const estadoDia = estadoSecao({
    sujeitoConhecido,
    isSuccess: itensQ.isSuccess,
    isError: itensQ.isError,
  });

  const itens = useMemo(() => itensQ.data ?? [], [itensQ.data]);
  const totais = useMemo(() => totaisDoDia(itens), [itens]);
  const metaKcal = metas?.calories ?? null;
  const metasMacro = metasDeMacro(metaKcal);
  const progressoKcal = progressoNutriente(totais.kcal, metaKcal, 'kcal');
  const origens = useMemo(() => origensPresentes(itens), [itens]);
  const grupos = useMemo(() => agruparPorRefeicao(itens, MEAL_TYPES_DO_DIA), [itens]);
  const resumoSemana = resumoDaSemana(semana, semanaQ.data ?? []);

  /** `logged_at` de um dia passado cai ao meio-dia: hora inventada seria pior. */
  const quando = () => (dia === hoje ? undefined : `${dia}T12:00:00`);

  const txt = (cor: string, familia: string = fonts.regular, escala: { fontSize: number; lineHeight: number } = type.bodySm) => [
    { fontFamily: familia, color: cor },
    fs(escala.fontSize, escala.lineHeight),
  ];

  async function adicionar(item: AlimentoParaRegistrar): Promise<boolean> {
    if (!uid) return false;
    try {
      await registrar.mutateAsync({ ...item, logged_at: quando() });
      toast.success('Adicionado ao diário.');
      return true;
    } catch {
      toast.error('Não foi possível adicionar agora. Nada foi salvo.');
      return false;
    }
  }

  /** Um toque: registra o alimento da busca rápida na porção já conhecida. */
  async function adicionarDaBiblioteca(item: FoodLibraryItem) {
    if (!uid) return;
    const g = item.default_grams ?? 100;
    const r = g / 100;
    const uma = (v: number) => Math.round(v * r * 10) / 10;
    try {
      await registrar.mutateAsync({
        meal_type: refeicaoAlvo,
        food_name: item.food_name,
        grams: g,
        kcal: Math.round(item.kcal * r),
        protein_g: uma(item.protein_g),
        carbs_g: uma(item.carbs_g),
        fat_g: uma(item.fat_g),
        fiber_g: uma(item.fiber_g),
        source: item.source,
        source_ref: item.source_ref,
        logged_at: quando(),
      });
      toast.success(`${item.food_name} · ${MEAL_TYPE_LABELS[refeicaoAlvo]}`);
    } catch {
      toast.error('Não foi possível adicionar agora.');
    }
  }

  async function repetirItem(item: FoodEntry) {
    if (!uid) return;
    try {
      await registrar.mutateAsync({
        meal_type: refeicaoAlvo,
        food_name: item.food_name,
        grams: item.grams,
        kcal: item.kcal,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        fiber_g: item.fiber_g ?? 0,
        source: item.source ?? undefined,
        source_ref: item.source_ref ?? null,
        logged_at: quando(),
      });
      toast.success(`${item.food_name} · ${MEAL_TYPE_LABELS[refeicaoAlvo]}`);
    } catch {
      toast.error('Não foi possível adicionar agora.');
    }
  }

  async function repetirDiaAnterior() {
    if (!uid) return;
    const doOntem = ontemQ.data ?? [];
    if (doOntem.length === 0) return;
    try {
      await registrarVarios.mutateAsync(
        doOntem.map((e) => ({
          meal_type: e.meal_type,
          food_name: e.food_name,
          grams: e.grams,
          kcal: e.kcal,
          protein_g: e.protein_g,
          carbs_g: e.carbs_g,
          fat_g: e.fat_g,
          fiber_g: e.fiber_g ?? 0,
          source: e.source ?? undefined,
          source_ref: e.source_ref ?? null,
          logged_at: quando(),
        })),
      );
      toast.success(`${doOntem.length} itens copiados.`);
    } catch {
      toast.error('Não foi possível copiar agora. Nada foi salvo.');
    }
  }

  async function guardar(item: AlimentoParaBiblioteca) {
    await guardarNaBiblioteca.mutateAsync(item);
  }

  if (estadoDia === 'sujeito-indefinido' || estadoDia === 'carregando') {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Diário alimentar" subtitle="Refeições e nutrientes" back />
        <View className="flex-1 items-center justify-center" accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const semRegistroNoDia = podeAfirmarAusencia(estadoDia) && itens.length === 0;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Diário alimentar"
        subtitle="Registre suas refeições e acompanhe seus nutrientes"
        back
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 56, gap: 16 }}
      >
        {/* ────────────────────── Navegação de data ────────────────────── */}
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.surface,
              padding: 4,
            },
            CONTINUOUS,
          ]}
        >
          <Pressable
            onPress={() => setDia(somarDias(dia, -1))}
            accessibilityRole="button"
            accessibilityLabel="Dia anterior"
            style={{ width: tap, height: tap, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={20} color={colors.muted} />
          </Pressable>
          <Text
            maxFontSizeMultiplier={1.4}
            numberOfLines={1}
            style={[txt(colors.fg, fonts.semibold, type.label), { flex: 1, textAlign: 'center' }]}
          >
            {rotuloDoDia(dia, hoje)}
          </Text>
          <Pressable
            onPress={() => setDia(somarDias(dia, 1))}
            disabled={dia >= hoje}
            accessibilityRole="button"
            accessibilityLabel="Próximo dia"
            accessibilityState={{ disabled: dia >= hoje }}
            style={{
              width: tap,
              height: tap,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: dia >= hoje ? 0.35 : 1,
            }}
          >
            <ChevronRight size={20} color={colors.muted} />
          </Pressable>
        </View>

        {estadoDia === 'falhou' ? (
          <Card>
            <Text style={txt(colors.fg, fonts.semibold, type.label)}>
              Não foi possível carregar este dia
            </Text>
            <Text style={[txt(colors.muted, fonts.regular, type.caption), { marginTop: 4 }]}>
              O que aparece abaixo pode estar incompleto — não trate a ausência como &ldquo;não
              comi&rdquo;.
            </Text>
            <View style={{ marginTop: 12 }}>
              <Button label="Tentar de novo" onPress={() => void itensQ.refetch()} variant="outline" size="sm" />
            </View>
          </Card>
        ) : null}

        {/* ──────────────────────── Resumo do dia ──────────────────────── */}
        <Card className="gap-4">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={txt(colors.fgSoft, fonts.semibold, type.label)}>
              {`Resumo de ${dia === hoje ? 'hoje' : rotuloDoDia(dia, hoje).toLowerCase()}`}
            </Text>
            <Pressable
              onPress={() => setSheetMeta(true)}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: tap, paddingHorizontal: 4 }}
            >
              <PencilLine size={15} color={colors.primary} />
              <Text style={txt(colors.primary, fonts.medium, type.caption)}>
                {metaKcal ? 'Editar meta' : 'Definir meta'}
              </Text>
            </Pressable>
          </View>

          <View style={{ alignItems: 'center' }}>
            <AnelDeProgresso progresso={progressoKcal} unidade="kcal" />
          </View>

          <View style={{ gap: 2 }}>
            <Text style={txt(colors.fg, fonts.numBold, type.body)}>{progressoKcal.texto}</Text>
            <Text style={txt(colors.muted, fonts.regular, type.caption)}>
              {descricaoProgresso(progressoKcal)}
            </Text>
          </View>

          {metaKcal == null ? (
            <View
              style={[
                { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface2 },
                CONTINUOUS,
              ]}
            >
              <Text style={txt(colors.muted, fonts.regular, type.caption)}>
                Você pode registrar sem meta nenhuma — o diário funciona igual. Se quiser uma,
                defina o número com sua equipe de saúde: o app não sugere metas de energia.
              </Text>
            </View>
          ) : null}

          <View style={{ gap: 12 }}>
            {MACROS.map((m) => {
              const valor =
                m === 'protein'
                  ? totais.protein
                  : m === 'carbs'
                    ? totais.carbs
                    : m === 'fat'
                      ? totais.fat
                      : totais.fiber;
              return (
                <BarraDeNutriente
                  key={m}
                  rotulo={MACRO_ROTULO[m]}
                  progresso={progressoNutriente(valor, metasMacro?.[m] ?? null, 'g')}
                />
              );
            })}
          </View>

          {metasMacro ? (
            <Text style={txt(colors.muted, fonts.regular, type.caption)}>{METAS_DE_MACRO_NOTA}</Text>
          ) : null}

          {/* Rodapé de origem: nomeia as bases que REALMENTE estão no dia. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              paddingTop: 12,
            }}
          >
            <Info size={14} color={colors.muted} style={{ marginTop: 2 }} />
            <Text style={[txt(colors.muted, fonts.regular, type.caption), { flex: 1 }]}>
              {fraseDeOrigem(origens)}
            </Text>
          </View>
        </Card>

        {/* ─────────────────────── Adicionar alimento ─────────────────────── */}
        <Button
          label="Adicionar alimento"
          icon={Plus}
          onPress={() => {
            setRefeicaoAlvo(refeicaoPeloRelogio());
            setSheetEmCriar(false);
            setSheetAberto(true);
          }}
        />

        {/* ──────────────────────── Refeições do dia ──────────────────────── */}
        <SectionTitle>
          {`Refeições de ${dia === hoje ? 'hoje' : rotuloDoDia(dia, hoje).toLowerCase()}`}
        </SectionTitle>

        {grupos.map((g) => {
          const Icone = ICONE_REFEICAO[g.tipo];
          return (
            <Card key={g.tipo} className="gap-3">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={[
                    {
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surface2,
                    },
                    CONTINUOUS,
                  ]}
                >
                  <Icone size={20} color={colors.fgSoft} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={txt(colors.fg, fonts.semibold, type.label)}>
                    {MEAL_TYPE_LABELS[g.tipo]}
                  </Text>
                  <Text style={txt(colors.muted, fonts.num, type.caption)}>
                    {g.itens.length === 0
                      ? '—'
                      : `${numeroBR(g.kcal)} kcal · ${g.itens.length} ${g.itens.length === 1 ? 'item' : 'itens'}`}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setRefeicaoAlvo(g.tipo);
                    setSheetEmCriar(false);
                    setSheetAberto(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Adicionar alimento ao ${MEAL_TYPE_LABELS[g.tipo]}`}
                  style={[
                    {
                      minHeight: tap,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.line,
                    },
                    CONTINUOUS,
                  ]}
                >
                  <Plus size={16} color={colors.fgSoft} />
                  <Text style={txt(colors.fgSoft, fonts.medium, type.caption)}>Adicionar</Text>
                </Pressable>
              </View>

              {g.itens.length > 0 ? (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
                  {g.itens.map((e, i) => {
                    const fonte = normalizarFonte(e.source);
                    return (
                      <View
                        key={e.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingVertical: 10,
                          borderTopWidth: i > 0 ? 1 : 0,
                          borderTopColor: colors.line,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={txt(colors.fg)}>
                            {e.food_name}
                          </Text>
                          <Text style={txt(colors.muted, fonts.num, type.caption)}>
                            {`${numeroBR(e.grams)} g · ${numeroBR(e.kcal)} kcal · `}
                            <Text style={{ fontFamily: fonts.regular }}>{FONTE_ROTULO[fonte]}</Text>
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => excluir.mutate(e.id)}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel={`Excluir ${e.food_name}`}
                          style={{ width: tap, height: tap, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={17} color={colors.faint} />
                        </Pressable>
                      </View>
                    );
                  })}
                  {/* Guardar a combinação: é o que alimenta o atalho
                      "Adicionar refeição salva". */}
                  <Pressable
                    onPress={() => setASalvar({ tipo: g.tipo, itens: g.itens })}
                    accessibilityRole="button"
                    accessibilityLabel={`Salvar a combinação do ${MEAL_TYPE_LABELS[g.tipo]} para reusar`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: tap,
                      borderTopWidth: 1,
                      borderTopColor: colors.line,
                    }}
                  >
                    <BookMarked size={14} color={colors.muted} />
                    <Text style={txt(colors.muted, fonts.medium, type.caption)}>
                      Salvar esta combinação para reusar
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Text
                  style={[
                    txt(colors.muted, fonts.regular, type.caption),
                    { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
                  ]}
                >
                  {podeAfirmarAusencia(estadoDia)
                    ? 'Nenhum alimento registrado.'
                    : 'Não foi possível conferir esta refeição.'}
                </Text>
              )}
            </Card>
          );
        })}

        {semRegistroNoDia ? (
          <Text style={txt(colors.muted, fonts.regular, type.caption)}>
            Este dia ainda não tem nada anotado. Nada de errado nisso — o diário serve para os dias
            em que você quiser registrar.
          </Text>
        ) : null}

        {/* ─────────────────────────── Atalhos ─────────────────────────── */}
        <SectionTitle>Atalhos</SectionTitle>
        <Card className="gap-2">
          <Atalho
            icone={RotateCcw}
            titulo={`Repetir ${rotuloDoDia(ontem, hoje).toLowerCase()}`}
            descricao={descricaoRepetir(ontemQ, sujeitoConhecido)}
            onPress={() => void repetirDiaAnterior()}
            desabilitado={
              !podeAfirmarAusencia(
                estadoSecao({ sujeitoConhecido, isSuccess: ontemQ.isSuccess, isError: ontemQ.isError }),
              ) ||
              (ontemQ.data ?? []).length === 0 ||
              registrarVarios.isPending
            }
          />
          <Atalho
            icone={BookMarked}
            titulo="Adicionar refeição salva"
            descricao={descricaoSalvas(salvasQ, sujeitoConhecido)}
            onPress={() => setSheetSalvas(true)}
          />
          <Atalho
            icone={PencilLine}
            titulo="Criar alimento personalizado"
            descricao="Para o que a Tabela TACO não tem — com os valores do rótulo."
            onPress={() => {
              setSheetEmCriar(true);
              setSheetAberto(true);
            }}
          />
        </Card>

        {/* ───────────────────────── Busca rápida ───────────────────────── */}
        <SectionTitle>Busca rápida</SectionTitle>
        <Card className="gap-3">
          <Text style={txt(colors.muted, fonts.regular, type.caption)}>
            {'Um toque registra no '}
            <Text style={{ fontFamily: fonts.semibold, color: colors.fgSoft }}>
              {MEAL_TYPE_LABELS[refeicaoAlvo]}
            </Text>
            .
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {MEAL_TYPES_DO_DIA.map((t) => {
              const ativo = t === refeicaoAlvo;
              return (
                <Pressable
                  key={t}
                  onPress={() => setRefeicaoAlvo(t)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  style={[
                    {
                      minHeight: tap,
                      justifyContent: 'center',
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: ativo ? colors.primary : colors.line,
                      backgroundColor: ativo ? `${colors.primary}1A` : colors.surface2,
                    },
                    CONTINUOUS,
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={1.4}
                    style={txt(ativo ? colors.primary : colors.muted, ativo ? fonts.semibold : fonts.regular, type.caption)}
                  >
                    {MEAL_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(
              [
                ['recentes', 'Recentes'],
                ['favoritos', 'Favoritos'],
                ['meus', 'Meus alimentos'],
              ] as [AbaBusca, string][]
            ).map(([chave, rotulo]) => {
              const ativo = chave === abaBusca;
              return (
                <Pressable
                  key={chave}
                  onPress={() => setAbaBusca(chave)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativo }}
                  style={{
                    flex: 1,
                    minHeight: tap,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottomWidth: 2,
                    borderBottomColor: ativo ? colors.primary : 'transparent',
                  }}
                >
                  <Text
                    maxFontSizeMultiplier={1.3}
                    numberOfLines={1}
                    style={txt(ativo ? colors.primary : colors.muted, ativo ? fonts.semibold : fonts.regular, type.caption)}
                  >
                    {rotulo}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {abaBusca === 'recentes' ? (
            <ListaDeAlimentos
              estado={estadoSecao({
                sujeitoConhecido,
                isSuccess: recentesQ.isSuccess,
                isError: recentesQ.isError,
              })}
              vazio="Você ainda não registrou nenhum alimento."
              falhou="Não foi possível carregar seus alimentos recentes."
              onTentar={() => void recentesQ.refetch()}
              itens={(recentesQ.data ?? []).map((e) => ({
                chave: e.id,
                nome: e.food_name,
                detalhe: `${numeroBR(e.kcal)} kcal · ${numeroBR(e.grams)} g · ${FONTE_ROTULO[normalizarFonte(e.source)]}`,
                onAdicionar: () => void repetirItem(e),
              }))}
            />
          ) : (
            <ListaDeAlimentos
              estado={estadoSecao({
                sujeitoConhecido,
                isSuccess: bibliotecaQ.isSuccess,
                isError: bibliotecaQ.isError,
              })}
              vazio={
                abaBusca === 'favoritos'
                  ? 'Nenhum favorito ainda. Marque a estrela ao adicionar um alimento.'
                  : 'Você ainda não criou nenhum alimento.'
              }
              falhou="Não foi possível carregar sua lista de alimentos."
              onTentar={() => void bibliotecaQ.refetch()}
              itens={(bibliotecaQ.data ?? [])
                .filter((i) => (abaBusca === 'favoritos' ? i.is_favorite : i.source === 'manual'))
                .map((i) => ({
                  chave: i.id,
                  nome: i.food_name,
                  detalhe: `${numeroBR(i.kcal)} kcal/100 g · porção ${numeroBR(i.default_grams ?? 100)} g`,
                  favorito: i.is_favorite,
                  onFavoritar: () => marcarFavorito.mutate({ id: i.id, favorito: !i.is_favorite }),
                  onAdicionar: () => void adicionarDaBiblioteca(i),
                }))}
            />
          )}
        </Card>

        {/* ──────────────────────── Visão da semana ──────────────────────── */}
        <SectionTitle>Visão da semana</SectionTitle>
        <Card>
          {semanaQ.isError ? (
            <Text style={txt(colors.muted, fonts.regular, type.caption)}>
              Não foi possível conferir os dias desta semana.
            </Text>
          ) : (
            <VisaoDaSemana
              dias={resumoSemana.dias}
              texto={resumoSemana.texto}
              iniciais={SEMANA_CURTA_SEG_PRIMEIRO}
              diaAtual={dia}
              hoje={hoje}
              onEscolherDia={setDia}
            />
          )}
        </Card>
      </ScrollView>

      {/* ─────────────────────────────── Folhas ─────────────────────────────── */}
      {sheetAberto ? (
        <SheetAdicionarAlimento
          refeicaoInicial={refeicaoAlvo}
          abrirEmCriar={sheetEmCriar}
          salvando={registrar.isPending || guardarNaBiblioteca.isPending}
          onAdicionar={adicionar}
          onSalvarNaBiblioteca={guardar}
          onClose={() => setSheetAberto(false)}
        />
      ) : null}

      {aSalvar ? (
        <SheetSalvarRefeicao
          alvo={aSalvar}
          salvando={criarRefeicaoSalva.isPending}
          onSalvar={async (nome) => {
            try {
              await criarRefeicaoSalva.mutateAsync({
                name: nome,
                meal_type: aSalvar.tipo,
                items: aSalvar.itens.map((i) => ({
                  food_name: i.food_name,
                  grams: i.grams,
                  kcal: i.kcal,
                  protein_g: i.protein_g,
                  carbs_g: i.carbs_g,
                  fat_g: i.fat_g,
                  fiber_g: i.fiber_g ?? 0,
                  source: i.source ?? null,
                  source_ref: i.source_ref ?? null,
                })),
              });
              toast.success(`"${nome}" salva.`);
              return true;
            } catch {
              toast.error('Não foi possível salvar. Talvez já exista uma com esse nome.');
              return false;
            }
          }}
          onClose={() => setASalvar(null)}
        />
      ) : null}

      {sheetMeta ? (
        <SheetMeta
          metaAtual={metaKcal}
          salvando={definirMeta.isPending}
          onSalvar={async (valor) => {
            try {
              await definirMeta.mutateAsync({ goalType: 'calories', target: valor });
              toast.success('Meta salva.');
              return true;
            } catch {
              toast.error('Não foi possível salvar a meta.');
              return false;
            }
          }}
          onClose={() => setSheetMeta(false)}
        />
      ) : null}

      {sheetSalvas ? (
        <SheetRefeicoesSalvas
          refeicoes={salvasQ.data ?? []}
          estado={estadoSecao({
            sujeitoConhecido,
            isSuccess: salvasQ.isSuccess,
            isError: salvasQ.isError,
          })}
          salvando={registrarVarios.isPending}
          onRegistrar={async (m) => {
            try {
              await registrarVarios.mutateAsync(
                m.saved_meal_items.map((i) => ({
                  meal_type: m.meal_type ?? refeicaoAlvo,
                  food_name: i.food_name,
                  grams: i.grams,
                  kcal: i.kcal,
                  protein_g: i.protein_g,
                  carbs_g: i.carbs_g,
                  fat_g: i.fat_g,
                  fiber_g: i.fiber_g,
                  source: i.source ?? undefined,
                  source_ref: i.source_ref,
                  logged_at: quando(),
                })),
              );
              toast.success(`${m.name} registrada.`);
              return true;
            } catch {
              toast.error('Não foi possível registrar agora.');
              return false;
            }
          }}
          onClose={() => setSheetSalvas(false)}
        />
      ) : null}
    </View>
  );
}

/* ══════════════════════════════ Peças da tela ══════════════════════════════ */

interface ConsultaSimples<T> {
  data?: T[];
  isSuccess: boolean;
  isError: boolean;
}

/**
 * "O dia anterior não tem registro" só é dito quando a consulta CONFIRMOU isso.
 * Consulta em curso ou que falhou diz que não sabe — `podeAfirmarAusencia`
 * aplicado ao rótulo de um botão.
 */
function descricaoRepetir(q: ConsultaSimples<FoodEntry>, sujeitoConhecido: boolean): string {
  const estado = estadoSecao({ sujeitoConhecido, isSuccess: q.isSuccess, isError: q.isError });
  if (estado === 'falhou') return 'Não foi possível conferir o dia anterior.';
  if (!podeAfirmarAusencia(estado)) return 'Conferindo o dia anterior…';
  const n = (q.data ?? []).length;
  if (n === 0) return 'O dia anterior não tem registro para copiar.';
  return `Copia os ${n} itens do dia anterior para este dia.`;
}

function descricaoSalvas(q: ConsultaSimples<{ id: string }>, sujeitoConhecido: boolean): string {
  const estado = estadoSecao({ sujeitoConhecido, isSuccess: q.isSuccess, isError: q.isError });
  if (estado === 'falhou') return 'Não foi possível carregar suas refeições salvas.';
  if (!podeAfirmarAusencia(estado)) return 'Conferindo suas refeições salvas…';
  const n = (q.data ?? []).length;
  return n === 0 ? 'Você ainda não salvou nenhuma refeição.' : `${n} guardadas.`;
}

function Atalho({
  icone: Icone,
  titulo,
  descricao,
  onPress,
  desabilitado,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  onPress: () => void;
  desabilitado?: boolean;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${descricao}`}
      accessibilityState={{ disabled: Boolean(desabilitado) }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          minHeight: tap,
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface2,
          opacity: desabilitado ? 0.55 : 1,
        },
        CONTINUOUS,
      ]}
    >
      <View
        style={[
          {
            width: 32,
            height: 32,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
          },
          CONTINUOUS,
        ]}
      >
        <Icone size={16} color={colors.fgSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          maxFontSizeMultiplier={1.4}
          style={[{ fontFamily: fonts.medium, color: colors.fg }, fs(type.bodySm.fontSize, type.bodySm.lineHeight)]}
        >
          {titulo}
        </Text>
        <Text
          maxFontSizeMultiplier={1.4}
          style={[{ fontFamily: fonts.regular, color: colors.muted }, fs(type.caption.fontSize, type.caption.lineHeight)]}
        >
          {descricao}
        </Text>
      </View>
    </Pressable>
  );
}

interface LinhaDeAlimento {
  chave: string;
  nome: string;
  detalhe: string;
  favorito?: boolean;
  onFavoritar?: () => void;
  onAdicionar: () => void;
}

/**
 * Lista da busca rápida. Recebe `estado` e não só `itens` porque lista vazia
 * por falha de rede não pode virar "você não tem favoritos".
 */
function ListaDeAlimentos({
  estado,
  itens,
  vazio,
  falhou,
  onTentar,
}: {
  estado: EstadoSecao;
  itens: LinhaDeAlimento[];
  vazio: string;
  falhou: string;
  onTentar: () => void;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();

  const base = (cor: string, familia: string = fonts.regular, escala: { fontSize: number; lineHeight: number } = type.caption) => [
    { fontFamily: familia, color: cor },
    fs(escala.fontSize, escala.lineHeight),
  ];

  if (estado === 'falhou') {
    return (
      <View style={{ gap: 8 }}>
        <Text style={base(colors.fgSoft, fonts.regular, type.bodySm)}>{falhou}</Text>
        <Pressable
          onPress={onTentar}
          accessibilityRole="button"
          style={{ minHeight: tap, justifyContent: 'center' }}
        >
          <Text style={base(colors.primary, fonts.semibold, type.bodySm)}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  if (!podeAfirmarAusencia(estado)) {
    return <Text style={base(colors.muted)}>Carregando…</Text>;
  }

  if (itens.length === 0) {
    return <Text style={base(colors.muted)}>{vazio}</Text>;
  }

  return (
    <View>
      {itens.map((i, idx) => (
        <View
          key={i.chave}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderTopWidth: idx > 0 ? 1 : 0,
            borderTopColor: colors.line,
          }}
        >
          <Pressable
            onPress={i.onAdicionar}
            accessibilityRole="button"
            accessibilityLabel={`Adicionar ${i.nome}`}
            style={{ flex: 1, minHeight: tap, justifyContent: 'center', paddingVertical: 6 }}
          >
            <Text numberOfLines={1} style={base(colors.fg, fonts.regular, type.bodySm)}>
              {i.nome}
            </Text>
            <Text numberOfLines={1} style={base(colors.muted, fonts.num)}>
              {i.detalhe}
            </Text>
          </Pressable>
          {i.onFavoritar ? (
            <Pressable
              onPress={i.onFavoritar}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: Boolean(i.favorito) }}
              accessibilityLabel={
                i.favorito ? `Tirar ${i.nome} dos favoritos` : `Marcar ${i.nome} como favorito`
              }
              style={{ width: tap, height: tap, alignItems: 'center', justifyContent: 'center' }}
            >
              <Star
                size={17}
                color={i.favorito ? colors.primary : colors.faint}
                fill={i.favorito ? colors.primary : 'transparent'}
              />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Guardar uma combinação do dia como "refeição salva".
 *
 * Uma fotografia do prato: os valores vão como estão (já multiplicados pela
 * porção), e a origem de cada item viaja junto — a refeição salva continua
 * dizendo de onde veio cada número quando for registrada de novo meses depois.
 */
function SheetSalvarRefeicao({
  alvo,
  salvando,
  onSalvar,
  onClose,
}: {
  alvo: { tipo: MealType; itens: FoodEntry[] };
  salvando: boolean;
  onSalvar: (nome: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const [nome, setNome] = useState('');
  const ref = useRef<AppSheetHandle>(null);

  const kcal = alvo.itens.reduce((s, i) => s + Number(i.kcal || 0), 0);

  return (
    <AppSheet ref={ref} onClose={onClose} title="Salvar esta combinação">
      <View style={{ gap: 16, paddingBottom: 16 }}>
        <View
          style={[
            {
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.surface2,
            },
            CONTINUOUS,
          ]}
        >
          <Text
            maxFontSizeMultiplier={1.4}
            style={[
              { fontFamily: fonts.num, color: colors.fgSoft },
              fs(type.bodySm.fontSize, type.bodySm.lineHeight),
            ]}
          >
            {`${MEAL_TYPE_LABELS[alvo.tipo]} · ${alvo.itens.length} ${
              alvo.itens.length === 1 ? 'item' : 'itens'
            } · ${numeroBR(kcal)} kcal`}
          </Text>
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={1.4}
            style={[
              { fontFamily: fonts.regular, color: colors.muted, marginTop: 4 },
              fs(type.caption.fontSize, type.caption.lineHeight),
            ]}
          >
            {alvo.itens.map((i) => i.food_name).join(', ')}
          </Text>
        </View>

        <Input
          label="Nome"
          value={nome}
          onChangeText={setNome}
          placeholder="ex.: Meu café da manhã"
          placeholderTextColor={colors.faint}
          maxLength={80}
        />

        <Button
          label="Salvar"
          loading={salvando}
          disabled={!nome.trim()}
          onPress={() => {
            void onSalvar(nome.trim()).then((ok) => {
              if (ok) ref.current?.close();
            });
          }}
        />
      </View>
    </AppSheet>
  );
}

/**
 * Meta de energia.
 *
 * O texto é a parte importante: o app não propõe número nenhum, e diz isso.
 * Uma sugestão automática seria o aplicativo estabelecendo o padrão contra o
 * qual a pessoa se mede — o que um prontuário não deve fazer.
 */
function SheetMeta({
  metaAtual,
  salvando,
  onSalvar,
  onClose,
}: {
  metaAtual: number | null;
  salvando: boolean;
  onSalvar: (valor: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const [valor, setValor] = useState('');
  const ref = useRef<AppSheetHandle>(null);

  return (
    <AppSheet ref={ref} onClose={onClose} title="Meta diária de energia">
      <View style={{ gap: 16, paddingBottom: 16 }}>
        <Text
          maxFontSizeMultiplier={1.4}
          style={[
            { fontFamily: fonts.regular, color: colors.muted },
            fs(type.bodySm.fontSize, type.bodySm.lineHeight),
          ]}
        >
          O HubPatients não calcula nem sugere meta de energia. Quem define esse número é você,
          idealmente com seu médico ou nutricionista — necessidade calórica depende de idade,
          composição corporal, condições de saúde e medicamentos em uso.
        </Text>

        <Input
          label="Meta (kcal por dia)"
          value={valor}
          onChangeText={setValor}
          keyboardType="number-pad"
          placeholder={metaAtual ? String(metaAtual) : 'ex.: 2000'}
          placeholderTextColor={colors.faint}
        />

        <Button
          label="Salvar meta"
          loading={salvando}
          disabled={!valor.trim()}
          onPress={() => {
            const v = parseInt(valor.replace(/\D/g, ''), 10);
            if (!Number.isFinite(v) || v <= 0) return;
            void onSalvar(v).then((ok) => {
              if (ok) ref.current?.close();
            });
          }}
        />
      </View>
    </AppSheet>
  );
}

function SheetRefeicoesSalvas({
  refeicoes,
  estado,
  salvando,
  onRegistrar,
  onClose,
}: {
  refeicoes: {
    id: string;
    name: string;
    meal_type: MealType | null;
    saved_meal_items: {
      food_name: string;
      grams: number;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      fiber_g: number;
      source: 'taco' | 'openfoodfacts' | 'manual' | null;
      source_ref: string | null;
    }[];
  }[];
  estado: EstadoSecao;
  salvando: boolean;
  onRegistrar: (m: (typeof refeicoes)[number]) => Promise<boolean>;
  onClose: () => void;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const ref = useRef<AppSheetHandle>(null);

  const base = (cor: string, familia: string = fonts.regular, escala: { fontSize: number; lineHeight: number } = type.bodySm) => [
    { fontFamily: familia, color: cor },
    fs(escala.fontSize, escala.lineHeight),
  ];

  return (
    <AppSheet ref={ref} onClose={onClose} title="Refeições salvas">
      <View style={{ gap: 12, paddingBottom: 16 }}>
        {estado === 'falhou' ? (
          <Text style={base(colors.muted)}>Não foi possível carregar suas refeições salvas.</Text>
        ) : !podeAfirmarAusencia(estado) ? (
          <Text style={base(colors.muted)}>Conferindo suas refeições salvas…</Text>
        ) : refeicoes.length === 0 ? (
          <Text style={base(colors.muted)}>Você ainda não salvou nenhuma refeição.</Text>
        ) : (
          refeicoes.map((m) => {
            const kcal = m.saved_meal_items.reduce((s, i) => s + Number(i.kcal || 0), 0);
            return (
              <View
                key={m.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}
              >
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={base(colors.fg, fonts.medium)}>
                    {m.name}
                  </Text>
                  <Text style={base(colors.muted, fonts.num, type.caption)}>
                    {`${m.saved_meal_items.length} itens · ${numeroBR(kcal)} kcal`}
                  </Text>
                </View>
                <Button
                  label="Registrar"
                  size="sm"
                  loading={salvando}
                  onPress={() => {
                    void onRegistrar(m).then((ok) => {
                      if (ok) ref.current?.close();
                    });
                  }}
                />
              </View>
            );
          })
        )}
      </View>
    </AppSheet>
  );
}
