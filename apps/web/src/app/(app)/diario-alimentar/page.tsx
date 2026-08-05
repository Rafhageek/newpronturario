'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * DIÁRIO ALIMENTAR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Duas decisões atravessam a tela inteira e explicam quase todas as escolhas
 * de texto e de cor daqui:
 *
 * 1. NENHUMA COR JULGA O QUE A PESSOA COMEU. Verde/âmbar/vermelho pertencem ao
 *    SISTEMA (dose atrasada, falha de envio) e nunca ao corpo do paciente —
 *    regra dos tokens, travada em `regra-cor-clinica.test.ts`, que passou a
 *    varrer também este arquivo. Progresso aqui é comprimento + número, num
 *    matiz só. Ver `components/diario-alimentar/progresso.tsx`.
 *
 * 2. A TELA NÃO MORALIZA A META. Isto é um prontuário, usado por gente com
 *    doença crônica e por famílias com crianças; contagem de caloria com
 *    gramática de dieta tem risco documentado de alimentar transtorno
 *    alimentar. Então: "1.250 de 2.000 kcal" no lugar de "750 kcal restantes";
 *    a meta é sempre "que você definiu" (o app nunca sugere uma); a semana
 *    conta REGISTRO, não aderência; e não existe sequência, recorde nem elogio.
 *
 * E uma terceira, sobre honestidade de fonte: cada item guarda de onde veio o
 * número (TACO, Open Food Facts, digitado pela pessoa), e o rodapé nomeia as
 * origens que de fato estão no dia. Assinar "Tabela TACO" embaixo de valor que
 * veio de outro lugar seria o app afirmando o que não conferiu.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Utensils,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
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
} from 'lucide-react';
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
  FONTE_CONFIANCA,
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
import { useActiveProfile } from '@/components/profile-context';
import { Button, Input } from '@/components/ui';
import { Tabs, type TabDef } from '@/components/ui/tabs';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/error-state';
import {
  AnelDeProgresso,
  BarraDeNutriente,
  VisaoDaSemana,
} from '@/components/diario-alimentar/progresso';
import {
  ModalAdicionarAlimento,
  type AlimentoParaRegistrar,
} from '@/components/diario-alimentar/adicionar-alimento';
import { toast } from 'sonner';

const ICONE_REFEICAO: Record<MealType, LucideIcon> = {
  breakfast: Coffee,
  lunch: Soup,
  snack: Apple,
  dinner: Moon,
};

/** Refeição provável pelo horário — só um palpite de conveniência, editável. */
function refeicaoPeloRelogio(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

type AbaBusca = 'recentes' | 'favoritos' | 'meus';

export default function DiarioAlimentarPage() {
  const { ownId, isPatientKnown } = useActiveProfile();
  const uid = ownId || undefined;
  const sujeitoConhecido = isPatientKnown && ownId !== '';

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

  const [modalAberto, setModalAberto] = useState(false);
  const [abaModal, setAbaModal] = useState<'buscar' | 'criar'>('buscar');
  const [refeicaoAlvo, setRefeicaoAlvo] = useState<MealType>(refeicaoPeloRelogio());
  const [modalMeta, setModalMeta] = useState(false);
  const [modalSalvas, setModalSalvas] = useState(false);
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

  async function adicionar(item: AlimentoParaRegistrar) {
    if (!uid) return;
    try {
      await registrar.mutateAsync({
        ...item,
        // Registrar num dia passado grava no meio-dia daquele dia: hora
        // inventada seria pior que hora aproximada, e a tela não pede hora.
        logged_at: dia === hoje ? undefined : `${dia}T12:00:00`,
      });
      toast.success('Adicionado ao diário.');
    } catch {
      toast.error('Não foi possível adicionar agora. Nada foi salvo.');
    }
  }

  /** Um toque: registra o alimento da busca rápida na porção que já se conhece. */
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
        logged_at: dia === hoje ? undefined : `${dia}T12:00:00`,
      });
      toast.success(`${item.food_name} · ${MEAL_TYPE_LABELS[refeicaoAlvo]}`);
    } catch {
      toast.error('Não foi possível adicionar agora.');
    }
  }

  /** Um toque a partir de um item já registrado antes (aba Recentes). */
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
        logged_at: dia === hoje ? undefined : `${dia}T12:00:00`,
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
          logged_at: dia === hoje ? undefined : `${dia}T12:00:00`,
        })),
      );
      toast.success(`${doOntem.length} itens copiados de ${rotuloDoDia(ontem, hoje)}.`);
    } catch {
      toast.error('Não foi possível copiar agora. Nada foi salvo.');
    }
  }

  /* ─────────────────────── Estados da página inteira ─────────────────────── */

  if (estadoDia === 'sujeito-indefinido' || estadoDia === 'carregando') {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        role="status"
        aria-label="Carregando o diário alimentar"
      >
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const semRegistroNoDia = podeAfirmarAusencia(estadoDia) && itens.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      {/* ─────────────────────────── Cabeçalho ─────────────────────────── */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Utensils className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1
              className="text-2xl font-bold text-fg"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Diário alimentar
            </h1>
            <p className="mt-1 text-sm text-muted">
              Registre suas refeições e acompanhe seus nutrientes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setDia(somarDias(dia, -1))}
              aria-label="Dia anterior"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[11rem] px-2 text-center text-sm font-semibold text-fg">
              {rotuloDoDia(dia, hoje)}
            </span>
            <button
              type="button"
              onClick={() => setDia(somarDias(dia, 1))}
              disabled={dia >= hoje}
              aria-label="Próximo dia"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Escolher uma data</span>
              <input
                type="date"
                value={dia}
                max={hoje}
                onChange={(e) => e.target.value && setDia(e.target.value)}
                className="sr-only"
              />
            </label>
          </div>

          <Button
            onClick={() => {
              setAbaModal('buscar');
              setRefeicaoAlvo(refeicaoPeloRelogio());
              setModalAberto(true);
            }}
          >
            <Plus className="h-4 w-4" /> Adicionar alimento
          </Button>
        </div>
      </header>

      {estadoDia === 'falhou' && (
        <ErrorState
          message="Não foi possível carregar o que você registrou neste dia. O que aparece abaixo pode estar incompleto — não trate a ausência como &ldquo;não comi&rdquo;."
          onRetry={() => void itensQ.refetch()}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ══════════════════════ Coluna principal ══════════════════════ */}
        <div className="space-y-5 lg:col-span-2">
          {/* ─────────────────────── Resumo do dia ─────────────────────── */}
          <section
            className="vl-rise rounded-2xl border border-line bg-surface p-5"
            aria-labelledby="resumo-titulo"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="resumo-titulo" className="text-sm font-semibold text-fg-soft">
                Resumo de {dia === hoje ? 'hoje' : rotuloDoDia(dia, hoje).toLowerCase()}
              </h2>
              <button
                type="button"
                onClick={() => setModalMeta(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary transition hover:bg-primary/10"
              >
                <PencilLine className="h-4 w-4" aria-hidden="true" />
                {metaKcal ? 'Editar meta' : 'Definir meta'}
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <AnelDeProgresso progresso={progressoKcal} unidade="kcal" />

              <div className="w-full min-w-0 flex-1">
                <p className="hp-num text-lg font-semibold text-fg">{progressoKcal.texto}</p>
                <p className="mt-0.5 text-sm text-muted">{descricaoProgresso(progressoKcal)}</p>

                {metaKcal == null && (
                  <p className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-xs leading-5 text-muted">
                    Você pode registrar sem meta nenhuma — o diário funciona igual. Se quiser
                    uma, defina o número com sua equipe de saúde: o app não sugere metas de
                    energia.
                  </p>
                )}

                <div className="mt-4 space-y-3">
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
                </div>

                {metasMacro && (
                  <p className="mt-3 text-xs leading-5 text-muted">{METAS_DE_MACRO_NOTA}</p>
                )}
              </div>
            </div>

            {/* Rodapé de origem: nomeia as bases que REALMENTE estão no dia. */}
            <p className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-xs leading-5 text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{fraseDeOrigem(origens)}</span>
            </p>
          </section>

          {/* ──────────────────── Refeições do dia ──────────────────── */}
          <section className="space-y-3" aria-labelledby="refeicoes-titulo">
            <h2 id="refeicoes-titulo" className="text-sm font-semibold text-fg-soft">
              Refeições de {dia === hoje ? 'hoje' : rotuloDoDia(dia, hoje).toLowerCase()}
            </h2>

            {grupos.map((g) => {
              const Icone = ICONE_REFEICAO[g.tipo];
              return (
                <div
                  key={g.tipo}
                  className="vl-rise rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg-soft">
                      <Icone className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-fg">
                        {MEAL_TYPE_LABELS[g.tipo]}
                      </p>
                      <p className="hp-num text-xs text-muted">
                        {g.itens.length === 0
                          ? '—'
                          : `${numeroBR(g.kcal)} kcal · ${g.itens.length} ${
                              g.itens.length === 1 ? 'item' : 'itens'
                            }`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRefeicaoAlvo(g.tipo);
                        setAbaModal('buscar');
                        setModalAberto(true);
                      }}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-fg-soft transition hover:border-primary/40 hover:text-primary"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
                    </button>
                  </div>

                  {g.itens.length > 0 ? (
                    <>
                    <ul className="mt-3 divide-y divide-line border-t border-line pt-1">
                      {g.itens.map((e) => {
                        const fonte = normalizarFonte(e.source);
                        return (
                          <li key={e.id} className="flex items-center gap-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-fg">{e.food_name}</p>
                              <p className="hp-num text-xs text-muted">
                                {numeroBR(e.grams)} g · {numeroBR(e.kcal)} kcal
                                <span className="ml-2 font-sans" title={FONTE_CONFIANCA[fonte]}>
                                  {FONTE_ROTULO[fonte]}
                                </span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => excluir.mutate(e.id)}
                              aria-label={`Excluir ${e.food_name}`}
                              className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {/* Guardar a combinação: é o que alimenta o atalho
                        "Adicionar refeição salva" da coluna lateral. */}
                    <button
                      type="button"
                      onClick={() => setASalvar({ tipo: g.tipo, itens: g.itens })}
                      className="mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-xs font-medium text-muted transition hover:text-primary"
                    >
                      <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
                      Salvar esta combinação para reusar
                    </button>
                    </>
                  ) : (
                    <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
                      {podeAfirmarAusencia(estadoDia)
                        ? 'Nenhum alimento registrado.'
                        : 'Não foi possível conferir esta refeição.'}
                    </p>
                  )}
                </div>
              );
            })}

            {semRegistroNoDia && (
              <p className="px-1 text-sm text-muted">
                Este dia ainda não tem nada anotado. Nada de errado nisso — o diário serve para
                os dias em que você quiser registrar.
              </p>
            )}
          </section>
        </div>

        {/* ══════════════════════ Coluna lateral ══════════════════════ */}
        <div className="space-y-5">
          {/* ─────────────────────────── Atalhos ─────────────────────────── */}
          <section
            className="vl-rise rounded-2xl border border-line bg-surface p-5"
            aria-labelledby="atalhos-titulo"
          >
            <h2 id="atalhos-titulo" className="text-sm font-semibold text-fg-soft">
              Atalhos
            </h2>
            <div className="mt-3 space-y-2">
              <BotaoAtalho
                icone={RotateCcw}
                titulo={`Repetir ${rotuloDoDia(ontem, hoje).toLowerCase()}`}
                descricao={descricaoRepetir(ontemQ, sujeitoConhecido)}
                onClick={() => void repetirDiaAnterior()}
                desabilitado={
                  !podeAfirmarAusencia(
                    estadoSecao({
                      sujeitoConhecido,
                      isSuccess: ontemQ.isSuccess,
                      isError: ontemQ.isError,
                    }),
                  ) ||
                  (ontemQ.data ?? []).length === 0 ||
                  registrarVarios.isPending
                }
              />
              <BotaoAtalho
                icone={BookMarked}
                titulo="Adicionar refeição salva"
                descricao={descricaoSalvas(salvasQ, sujeitoConhecido)}
                onClick={() => setModalSalvas(true)}
              />
              <BotaoAtalho
                icone={PencilLine}
                titulo="Criar alimento personalizado"
                descricao="Para o que a Tabela TACO não tem — com os valores do rótulo."
                onClick={() => {
                  setAbaModal('criar');
                  setModalAberto(true);
                }}
              />
            </div>
          </section>

          {/* ───────────────────────── Busca rápida ───────────────────────── */}
          <section
            className="vl-rise rounded-2xl border border-line bg-surface p-5"
            aria-labelledby="busca-titulo"
          >
            <h2 id="busca-titulo" className="text-sm font-semibold text-fg-soft">
              Busca rápida
            </h2>
            <p className="mt-1 text-xs text-muted">
              Um clique registra no{' '}
              <strong className="font-semibold text-fg-soft">
                {MEAL_TYPE_LABELS[refeicaoAlvo]}
              </strong>
              .
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {MEAL_TYPES_DO_DIA.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRefeicaoAlvo(t)}
                  aria-pressed={t === refeicaoAlvo}
                  className={`min-h-9 rounded-full border px-2.5 text-xs transition ${
                    t === refeicaoAlvo
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'border-line bg-surface-2 text-muted hover:border-primary/40'
                  }`}
                >
                  {MEAL_TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <Tabs<AbaBusca>
                tabs={ABAS_BUSCA}
                value={abaBusca}
                onChange={setAbaBusca}
                ariaLabel="Origem dos alimentos da busca rápida"
              />
            </div>

            <div className="mt-3">
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
                    detalhe: `${numeroBR(e.kcal)} kcal · ${numeroBR(e.grams)} g`,
                    fonte: normalizarFonte(e.source),
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
                    .filter((i) =>
                      abaBusca === 'favoritos' ? i.is_favorite : i.source === 'manual',
                    )
                    .map((i) => ({
                      chave: i.id,
                      nome: i.food_name,
                      detalhe: `${numeroBR(i.kcal)} kcal/100 g · porção ${numeroBR(
                        i.default_grams ?? 100,
                      )} g`,
                      fonte: normalizarFonte(i.source),
                      favorito: i.is_favorite,
                      onFavoritar: () =>
                        marcarFavorito.mutate({ id: i.id, favorito: !i.is_favorite }),
                      onAdicionar: () => void adicionarDaBiblioteca(i),
                    }))}
                />
              )}
            </div>
          </section>

          {/* ──────────────────────── Visão da semana ──────────────────────── */}
          <section
            className="vl-rise rounded-2xl border border-line bg-surface p-5"
            aria-labelledby="semana-titulo"
          >
            <h2 id="semana-titulo" className="text-sm font-semibold text-fg-soft">
              Visão da semana
            </h2>
            {semanaQ.isError ? (
              <p className="mt-3 text-sm text-muted">
                Não foi possível conferir os dias desta semana.
              </p>
            ) : (
              <div className="mt-3">
                <VisaoDaSemana
                  dias={resumoSemana.dias}
                  texto={resumoSemana.texto}
                  iniciais={SEMANA_CURTA_SEG_PRIMEIRO}
                  diaAtual={dia}
                  hoje={hoje}
                  onEscolherDia={setDia}
                />
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ─────────────────────────────── Modais ─────────────────────────────── */}
      <ModalAdicionarAlimento
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        refeicaoInicial={refeicaoAlvo}
        abaInicial={abaModal}
        salvando={registrar.isPending || guardarNaBiblioteca.isPending}
        onAdicionar={adicionar}
        onSalvarNaBiblioteca={async (item) => {
          try {
            await guardarNaBiblioteca.mutateAsync(item);
          } catch {
            toast.error('O item entrou no diário, mas não foi possível salvá-lo na sua lista.');
          }
        }}
      />

      <ModalSalvarRefeicao
        alvo={aSalvar}
        salvando={criarRefeicaoSalva.isPending}
        onClose={() => setASalvar(null)}
        onSalvar={async (nome) => {
          if (!aSalvar) return;
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
            setASalvar(null);
          } catch {
            toast.error('Não foi possível salvar. Talvez já exista uma com esse nome.');
          }
        }}
      />

      <ModalMeta
        open={modalMeta}
        onClose={() => setModalMeta(false)}
        metaAtual={metaKcal}
        salvando={definirMeta.isPending}
        onSalvar={async (valor) => {
          try {
            await definirMeta.mutateAsync({ goalType: 'calories', target: valor });
            toast.success('Meta salva.');
            setModalMeta(false);
          } catch {
            toast.error('Não foi possível salvar a meta.');
          }
        }}
      />

      <Modal
        open={modalSalvas}
        onClose={() => setModalSalvas(false)}
        title="Refeições salvas"
        description="Combinações que você guardou, para registrar de uma vez."
      >
        {salvasQ.isError ? (
          <p className="text-sm text-muted">
            Não foi possível carregar suas refeições salvas.
          </p>
        ) : (salvasQ.data ?? []).length === 0 ? (
          <p className="text-sm leading-6 text-muted">
            {podeAfirmarAusencia(
              estadoSecao({
                sujeitoConhecido,
                isSuccess: salvasQ.isSuccess,
                isError: salvasQ.isError,
              }),
            )
              ? 'Você ainda não salvou nenhuma refeição.'
              : 'Conferindo suas refeições salvas…'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {(salvasQ.data ?? []).map((m) => {
              const kcal = m.saved_meal_items.reduce((s, i) => s + Number(i.kcal || 0), 0);
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{m.name}</p>
                    <p className="hp-num text-xs text-muted">
                      {m.saved_meal_items.length} itens · {numeroBR(kcal)} kcal
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      void registrarVarios
                        .mutateAsync(
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
                            logged_at: dia === hoje ? undefined : `${dia}T12:00:00`,
                          })),
                        )
                        .then(() => {
                          toast.success(`${m.name} registrada.`);
                          setModalSalvas(false);
                        })
                        .catch(() => toast.error('Não foi possível registrar agora.'));
                    }}
                    loading={registrarVarios.isPending}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" /> Registrar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </div>
  );
}

/* ══════════════════════════════ Peças da tela ══════════════════════════════ */

const ABAS_BUSCA: TabDef<AbaBusca>[] = [
  { key: 'recentes', label: 'Recentes' },
  { key: 'favoritos', label: 'Favoritos' },
  { key: 'meus', label: 'Meus alimentos' },
];

interface ConsultaSimples<T> {
  data?: T[];
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Rótulo do atalho "repetir o dia anterior".
 * Repare que "não há nada em ontem" só é dito quando a consulta CONFIRMOU isso.
 * Consulta em curso ou que falhou diz que não sabe — a mesma regra de
 * `podeAfirmarAusencia`, aplicada a um botão.
 */
function descricaoRepetir(q: ConsultaSimples<FoodEntry>, sujeitoConhecido: boolean): string {
  const estado = estadoSecao({
    sujeitoConhecido,
    isSuccess: q.isSuccess,
    isError: q.isError,
  });
  if (estado === 'falhou') return 'Não foi possível conferir o dia anterior.';
  if (!podeAfirmarAusencia(estado)) return 'Conferindo o dia anterior…';
  const n = (q.data ?? []).length;
  if (n === 0) return 'O dia anterior não tem registro para copiar.';
  return `Copia os ${n} itens do dia anterior para este dia.`;
}

function descricaoSalvas(
  q: ConsultaSimples<{ id: string }>,
  sujeitoConhecido: boolean,
): string {
  const estado = estadoSecao({
    sujeitoConhecido,
    isSuccess: q.isSuccess,
    isError: q.isError,
  });
  if (estado === 'falhou') return 'Não foi possível carregar suas refeições salvas.';
  if (!podeAfirmarAusencia(estado)) return 'Conferindo suas refeições salvas…';
  const n = (q.data ?? []).length;
  return n === 0 ? 'Você ainda não salvou nenhuma refeição.' : `${n} guardadas.`;
}

function BotaoAtalho({
  icone: Icone,
  titulo,
  descricao,
  onClick,
  desabilitado,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  onClick: () => void;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 text-left transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-line"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-fg-soft">
        <Icone className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{titulo}</span>
        <span className="block text-xs leading-5 text-muted">{descricao}</span>
      </span>
    </button>
  );
}

interface LinhaDeAlimento {
  chave: string;
  nome: string;
  detalhe: string;
  fonte: ReturnType<typeof normalizarFonte>;
  favorito?: boolean;
  onFavoritar?: () => void;
  onAdicionar: () => void;
}

/**
 * Lista da busca rápida.
 *
 * O motivo de ela receber `estado` em vez de só `itens`: lista vazia por falha
 * de rede não pode virar "você não tem favoritos". Vazio só é afirmado quando o
 * servidor respondeu vazio (`podeAfirmarAusencia`).
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
  if (estado === 'falhou') {
    return (
      <div className="rounded-xl border border-line bg-surface-2 p-3">
        <p className="text-sm text-fg-soft">{falhou}</p>
        <button
          type="button"
          onClick={onTentar}
          className="mt-2 min-h-9 text-sm font-semibold text-primary hover:underline"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!podeAfirmarAusencia(estado)) {
    return <p className="py-2 text-sm text-muted">Carregando…</p>;
  }

  if (itens.length === 0) {
    return <p className="py-2 text-sm leading-6 text-muted">{vazio}</p>;
  }

  return (
    <ul className="max-h-80 divide-y divide-line overflow-y-auto">
      {itens.map((i) => (
        <li key={i.chave} className="flex items-center gap-1 py-1">
          <button
            type="button"
            onClick={i.onAdicionar}
            className="min-w-0 flex-1 rounded-lg px-1 py-1.5 text-left transition hover:bg-surface-2"
          >
            <span className="block truncate text-sm text-fg">{i.nome}</span>
            <span className="hp-num block truncate text-xs text-muted">
              {i.detalhe}
              <span className="ml-2 font-sans">{FONTE_ROTULO[i.fonte]}</span>
            </span>
          </button>
          {i.onFavoritar && (
            <button
              type="button"
              onClick={i.onFavoritar}
              aria-pressed={i.favorito}
              aria-label={
                i.favorito ? `Tirar ${i.nome} dos favoritos` : `Marcar ${i.nome} como favorito`
              }
              className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <Star
                className={`h-4 w-4 ${i.favorito ? 'fill-current text-primary' : ''}`}
                aria-hidden="true"
              />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Guardar uma combinação do dia como "refeição salva".
 *
 * Uma fotografia do prato: os valores dos itens vão como estão (já
 * multiplicados pela porção), e não por 100 g. A origem de cada item viaja
 * junto — uma refeição salva com item da Open Food Facts continua dizendo isso
 * quando for registrada de novo daqui a três meses.
 */
function ModalSalvarRefeicao({
  alvo,
  salvando,
  onClose,
  onSalvar,
}: {
  alvo: { tipo: MealType; itens: FoodEntry[] } | null;
  salvando: boolean;
  onClose: () => void;
  onSalvar: (nome: string) => Promise<void>;
}) {
  const [nome, setNome] = useState('');

  useEffect(() => {
    if (alvo) setNome('');
  }, [alvo]);

  const kcal = (alvo?.itens ?? []).reduce((s, i) => s + Number(i.kcal || 0), 0);

  return (
    <Modal
      open={alvo != null}
      onClose={onClose}
      title="Salvar esta combinação"
      description="Para registrar tudo de uma vez em outro dia."
    >
      {alvo && (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <p className="hp-num text-sm text-fg-soft">
              {MEAL_TYPE_LABELS[alvo.tipo]} · {alvo.itens.length}{' '}
              {alvo.itens.length === 1 ? 'item' : 'itens'} · {numeroBR(kcal)} kcal
            </p>
            <p className="mt-1 truncate text-xs text-muted">
              {alvo.itens.map((i) => i.food_name).join(', ')}
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-fg-soft">Nome</span>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex.: Meu café da manhã"
              maxLength={80}
              className="mt-1.5"
              autoFocus
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void onSalvar(nome.trim())}
              loading={salvando}
              disabled={!nome.trim()}
            >
              Salvar
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium text-fg-soft transition hover:bg-surface-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Edição da meta de energia.
 *
 * O texto é a parte importante: o app não propõe número nenhum, e diz isso.
 * Uma sugestão automática (do tipo "2.000 kcal para você") seria o aplicativo
 * estabelecendo o padrão contra o qual a pessoa se mede — exatamente o que um
 * prontuário não deve fazer.
 */
function ModalMeta({
  open,
  onClose,
  metaAtual,
  salvando,
  onSalvar,
}: {
  open: boolean;
  onClose: () => void;
  metaAtual: number | null;
  salvando: boolean;
  onSalvar: (valor: number) => Promise<void>;
}) {
  const [valor, setValor] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Meta diária de energia"
      description="Um número seu, para comparar com o que registrou. Opcional."
    >
      <div className="space-y-4">
        <p className="rounded-xl border border-line bg-surface-2 p-3 text-sm leading-6 text-muted">
          O HubPatients não calcula nem sugere meta de energia. Quem define esse número é você,
          idealmente com seu médico ou nutricionista — necessidade calórica depende de idade,
          composição corporal, condições de saúde e medicamentos em uso.
        </p>

        <label className="block">
          <span className="text-sm font-medium text-fg-soft">Meta (kcal por dia)</span>
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="numeric"
            placeholder={metaAtual ? String(metaAtual) : 'ex.: 2000'}
            className="mt-1.5"
            autoFocus
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const v = parseInt(valor.replace(/\D/g, ''), 10);
              if (Number.isFinite(v) && v > 0) void onSalvar(v);
            }}
            loading={salvando}
            disabled={!valor.trim()}
          >
            Salvar meta
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium text-fg-soft transition hover:bg-surface-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
