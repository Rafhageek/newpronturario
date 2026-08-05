'use client';

/**
 * Modal de "Adicionar alimento".
 *
 * Duas portas, porque as duas existem na vida real:
 *   · BUSCAR na Tabela TACO (597 alimentos brasileiros, offline);
 *   · CRIAR um alimento com os valores do rótulo, quando a TACO não tem.
 *
 * O que a segunda porta obriga: o item criado é gravado com `source: 'manual'`.
 * A tela não pode depois assinar "Tabela TACO" embaixo de um número que a
 * própria pessoa digitou — é a mesma família de defeito de qualquer afirmação
 * que o app não conferiu.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Plus, Star, BookMarked } from 'lucide-react';
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  searchFoods,
  nutritionForGrams,
  numeroBR,
  type MealType,
  type TacoFood,
} from '@hubpatients/core';
import { Modal } from '@/components/ui/modal';
import { Button, Input, Field } from '@/components/ui';
import { Tabs, type TabDef } from '@/components/ui/tabs';

export interface AlimentoParaRegistrar {
  meal_type: MealType;
  food_name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  source: 'taco' | 'manual';
  source_ref: string | null;
}

/** Composição por 100 g de um alimento criado à mão. */
interface RascunhoManual {
  nome: string;
  kcal: string;
  proteina: string;
  carboidrato: string;
  gordura: string;
  fibra: string;
}

const RASCUNHO_VAZIO: RascunhoManual = {
  nome: '',
  kcal: '',
  proteina: '',
  carboidrato: '',
  gordura: '',
  fibra: '',
};

function paraNumero(valor: string): number {
  const n = parseFloat(valor.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

type Aba = 'buscar' | 'criar';

export function ModalAdicionarAlimento({
  open,
  onClose,
  refeicaoInicial,
  abaInicial = 'buscar',
  salvando,
  onAdicionar,
  onSalvarNaBiblioteca,
}: {
  open: boolean;
  onClose: () => void;
  refeicaoInicial: MealType;
  abaInicial?: Aba;
  salvando: boolean;
  onAdicionar: (item: AlimentoParaRegistrar) => Promise<void>;
  /** Guarda na biblioteca pessoal, por 100 g, para reaparecer na busca rápida. */
  onSalvarNaBiblioteca: (item: {
    food_name: string;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    default_grams: number | null;
    source: 'taco' | 'manual';
    source_ref: string | null;
    is_favorite: boolean;
  }) => Promise<void>;
}) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [refeicao, setRefeicao] = useState<MealType>(refeicaoInicial);
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<TacoFood | null>(null);
  const [gramas, setGramas] = useState('100');
  const [rascunho, setRascunho] = useState<RascunhoManual>(RASCUNHO_VAZIO);
  const [tambemSalvar, setTambemSalvar] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  // Reabrir é sempre um começo limpo: rascunho antigo aparecendo num registro
  // novo é como um número entra errado no prontuário sem ninguém perceber.
  useEffect(() => {
    if (!open) return;
    setAba(abaInicial);
    setRefeicao(refeicaoInicial);
    setBusca('');
    setEscolhido(null);
    setGramas('100');
    setRascunho(RASCUNHO_VAZIO);
    setTambemSalvar(false);
    const t = setTimeout(() => buscaRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open, abaInicial, refeicaoInicial]);

  const resultados = useMemo(
    () => (busca.trim().length >= 2 ? searchFoods(busca, 30) : []),
    [busca],
  );
  const gramasNum = paraNumero(gramas);
  const previa = escolhido ? nutritionForGrams(escolhido, gramasNum) : null;

  const abas: TabDef<Aba>[] = [
    { key: 'buscar', label: 'Buscar na TACO' },
    { key: 'criar', label: 'Criar alimento' },
  ];

  async function adicionarDaTaco() {
    if (!escolhido || !previa || gramasNum <= 0) return;
    await onAdicionar({
      meal_type: refeicao,
      food_name: escolhido.name,
      grams: gramasNum,
      kcal: previa.kcal,
      protein_g: previa.protein,
      carbs_g: previa.carbs,
      fat_g: previa.fat,
      fiber_g: previa.fiber,
      source: 'taco',
      source_ref: String(escolhido.id),
    });
    if (tambemSalvar) {
      await onSalvarNaBiblioteca({
        food_name: escolhido.name,
        kcal: escolhido.kcal,
        protein_g: escolhido.protein,
        carbs_g: escolhido.carbs,
        fat_g: escolhido.fat,
        fiber_g: escolhido.fiber,
        default_grams: gramasNum,
        source: 'taco',
        source_ref: String(escolhido.id),
        is_favorite: true,
      });
    }
    onClose();
  }

  async function adicionarManual() {
    const nome = rascunho.nome.trim();
    if (!nome || gramasNum <= 0) return;
    const r = gramasNum / 100;
    const uma = (v: string) => Math.round(paraNumero(v) * r * 10) / 10;
    await onAdicionar({
      meal_type: refeicao,
      food_name: nome,
      grams: gramasNum,
      kcal: Math.round(paraNumero(rascunho.kcal) * r),
      protein_g: uma(rascunho.proteina),
      carbs_g: uma(rascunho.carboidrato),
      fat_g: uma(rascunho.gordura),
      fiber_g: uma(rascunho.fibra),
      source: 'manual',
      source_ref: null,
    });
    if (tambemSalvar) {
      await onSalvarNaBiblioteca({
        food_name: nome,
        kcal: paraNumero(rascunho.kcal),
        protein_g: paraNumero(rascunho.proteina),
        carbs_g: paraNumero(rascunho.carboidrato),
        fat_g: paraNumero(rascunho.gordura),
        fiber_g: paraNumero(rascunho.fibra),
        default_grams: gramasNum,
        source: 'manual',
        source_ref: null,
        is_favorite: false,
      });
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar alimento"
      description="Escolha a refeição e informe a quantidade. Nada é salvo até você confirmar."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Refeição */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg-soft">Refeição</legend>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((t) => {
              const ativo = t === refeicao;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRefeicao(t)}
                  aria-pressed={ativo}
                  className={`min-h-11 rounded-full border px-4 text-sm transition ${
                    ativo
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'border-line bg-surface-2 text-fg-soft hover:border-primary/40'
                  }`}
                >
                  {MEAL_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Tabs tabs={abas} value={aba} onChange={setAba} ariaLabel="Como adicionar o alimento" />

        {aba === 'buscar' ? (
          escolhido ? (
            <div className="rounded-xl border border-line bg-surface-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">{escolhido.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {escolhido.category} · Tabela TACO
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEscolhido(null)}
                  aria-label="Escolher outro alimento"
                  className="rounded-lg p-2 text-muted transition hover:bg-surface hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Field label="Quantidade (g)" htmlFor="gramas-taco">
                  <Input
                    id="gramas-taco"
                    value={gramas}
                    onChange={(e) => setGramas(e.target.value)}
                    inputMode="decimal"
                    className="w-28"
                  />
                </Field>
                {previa && (
                  <p className="hp-num pb-2.5 text-sm text-muted">
                    {numeroBR(previa.kcal)} kcal · P {numeroBR(previa.protein, 1)} · C{' '}
                    {numeroBR(previa.carbs, 1)} · G {numeroBR(previa.fat, 1)} · F{' '}
                    {numeroBR(previa.fiber, 1)}
                  </p>
                )}
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm text-fg-soft">
                <input
                  type="checkbox"
                  checked={tambemSalvar}
                  onChange={(e) => setTambemSalvar(e.target.checked)}
                  className="h-4 w-4 rounded border-line-strong accent-[var(--primary)]"
                  data-tap-exempt
                />
                <Star className="h-4 w-4 text-muted" aria-hidden="true" />
                Salvar nos favoritos com esta porção
              </label>

              <Button
                onClick={() => void adicionarDaTaco()}
                loading={salvando}
                disabled={gramasNum <= 0}
                className="mt-4 w-full"
              >
                <Plus className="h-4 w-4" /> Adicionar ao {MEAL_TYPE_LABELS[refeicao]}
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3">
                <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar alimento (ex.: arroz, feijão, banana)…"
                  aria-label="Buscar alimento na Tabela TACO"
                  className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca('')}
                    aria-label="Limpar busca"
                    className="rounded-lg p-1.5 text-muted transition hover:text-fg"
                    data-tap-exempt
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {resultados.length > 0 && (
                <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                  {resultados.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setEscolhido(f);
                          setGramas('100');
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-surface-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-fg">{f.name}</span>
                          <span className="block truncate text-xs text-muted">{f.category}</span>
                        </span>
                        <span className="hp-num shrink-0 text-xs text-muted">
                          {numeroBR(f.kcal)} kcal/100 g
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {busca.trim().length >= 2 && resultados.length === 0 && (
                <div className="mt-3 rounded-xl border border-line bg-surface-2 p-4">
                  <p className="text-sm text-fg">
                    A Tabela TACO não tem esse alimento.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Ela cobre 597 alimentos brasileiros básicos — produtos de marca e pratos
                    prontos costumam faltar. Você pode cadastrá-lo com os valores do rótulo.
                  </p>
                  <Button
                    onClick={() => {
                      setRascunho({ ...RASCUNHO_VAZIO, nome: busca.trim() });
                      setAba('criar');
                    }}
                    className="mt-3"
                  >
                    <BookMarked className="h-4 w-4" /> Criar &ldquo;{busca.trim()}&rdquo;
                  </Button>
                </div>
              )}

              {busca.trim().length < 2 && (
                <p className="mt-3 text-xs leading-5 text-muted">
                  Digite ao menos 2 letras. A busca é offline e sem acento — &ldquo;feijao&rdquo;
                  encontra &ldquo;Feijão&rdquo;.
                </p>
              )}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <p className="rounded-xl border border-line bg-surface-2 p-3 text-xs leading-5 text-muted">
              Copie os valores do rótulo da embalagem, na coluna de <strong>100 g</strong> (ou
              100 ml). Este alimento fica marcado como <strong>informado por você</strong> — o
              app não confere nem completa nada.
            </p>

            <Field label="Nome do alimento" htmlFor="nome-manual">
              <Input
                id="nome-manual"
                value={rascunho.nome}
                onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
                placeholder="Como você quer ver no diário"
                maxLength={120}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Calorias (kcal)" htmlFor="kcal-manual">
                <Input
                  id="kcal-manual"
                  value={rascunho.kcal}
                  onChange={(e) => setRascunho((r) => ({ ...r, kcal: e.target.value }))}
                  inputMode="decimal"
                  placeholder="—"
                />
              </Field>
              <Field label="Proteínas (g)" htmlFor="prot-manual">
                <Input
                  id="prot-manual"
                  value={rascunho.proteina}
                  onChange={(e) => setRascunho((r) => ({ ...r, proteina: e.target.value }))}
                  inputMode="decimal"
                  placeholder="—"
                />
              </Field>
              <Field label="Carboidratos (g)" htmlFor="carb-manual">
                <Input
                  id="carb-manual"
                  value={rascunho.carboidrato}
                  onChange={(e) => setRascunho((r) => ({ ...r, carboidrato: e.target.value }))}
                  inputMode="decimal"
                  placeholder="—"
                />
              </Field>
              <Field label="Gorduras (g)" htmlFor="gord-manual">
                <Input
                  id="gord-manual"
                  value={rascunho.gordura}
                  onChange={(e) => setRascunho((r) => ({ ...r, gordura: e.target.value }))}
                  inputMode="decimal"
                  placeholder="—"
                />
              </Field>
              <Field label="Fibras (g)" htmlFor="fibra-manual">
                <Input
                  id="fibra-manual"
                  value={rascunho.fibra}
                  onChange={(e) => setRascunho((r) => ({ ...r, fibra: e.target.value }))}
                  inputMode="decimal"
                  placeholder="—"
                />
              </Field>
              <Field label="Quanto você comeu (g)" htmlFor="gramas-manual">
                <Input
                  id="gramas-manual"
                  value={gramas}
                  onChange={(e) => setGramas(e.target.value)}
                  inputMode="decimal"
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-fg-soft">
              <input
                type="checkbox"
                checked={tambemSalvar}
                onChange={(e) => setTambemSalvar(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong accent-[var(--primary)]"
                data-tap-exempt
              />
              Guardar em &ldquo;Meus alimentos&rdquo; para reusar
            </label>

            <Button
              onClick={() => void adicionarManual()}
              loading={salvando}
              disabled={!rascunho.nome.trim() || gramasNum <= 0}
              className="w-full"
            >
              <Plus className="h-4 w-4" /> Adicionar ao {MEAL_TYPE_LABELS[refeicao]}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
