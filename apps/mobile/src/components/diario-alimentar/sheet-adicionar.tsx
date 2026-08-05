/**
 * Folha de "Adicionar alimento" (mobile).
 *
 * Três portas, todas as que já existiam, agora num lugar só:
 *   · CÓDIGO DE BARRAS → Open Food Facts, com consentimento e conferência;
 *   · BUSCA na Tabela TACO (597 alimentos brasileiros, offline);
 *   · CRIAR à mão, com os valores do rótulo.
 *
 * O que cada porta grava em `source` é o ponto sério: 'openfoodfacts', 'taco' e
 * 'manual', respectivamente. Antes tudo saía sem procedência e a tela assinava
 * "Tabela TACO" embaixo de qualquer número — o app afirmando o que não
 * conferiu, num documento que a pessoa leva ao médico.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Search, X, Plus, Barcode, Info, Star } from 'lucide-react-native';
import {
  MEAL_TYPES_DO_DIA,
  MEAL_TYPE_LABELS,
  searchFoods,
  nutritionForGrams,
  numeroBR,
  type MealType,
  type TacoFood,
} from '@hubpatients/core';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
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
import { useColors, useType, useFontScaler, useTapTarget, fonts } from '@/theme';

const CONTINUOUS = { borderCurve: 'continuous' as const };

export interface AlimentoParaRegistrar {
  meal_type: MealType;
  food_name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  source: 'taco' | 'openfoodfacts' | 'manual';
  source_ref: string | null;
}

export interface AlimentoParaBiblioteca {
  food_name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  default_grams: number | null;
  source: 'taco' | 'openfoodfacts' | 'manual';
  source_ref: string | null;
  is_favorite: boolean;
}

/**
 * Rascunho editável. Tudo texto de propósito: são campos que a pessoa CONFERE
 * antes de salvar — a Open Food Facts é colaborativa e erra, e rótulo se lê
 * com o olho. Nada daqui vai ao banco sem confirmação.
 */
interface Rascunho {
  origem: 'openfoodfacts' | 'manual';
  ean: string | null;
  nome: string;
  /** Por 100 g, como está no rótulo. */
  kcal: string;
  proteina: string;
  carboidrato: string;
  gordura: string;
  fibra: string;
}

function paraNumero(valor: string): number {
  const n = parseFloat(valor.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function rascunhoVazio(origem: Rascunho['origem'], nome = ''): Rascunho {
  return { origem, ean: null, nome, kcal: '', proteina: '', carboidrato: '', gordura: '', fibra: '' };
}

export function SheetAdicionarAlimento({
  refeicaoInicial,
  abrirEmCriar = false,
  salvando,
  onAdicionar,
  onSalvarNaBiblioteca,
  onClose,
}: {
  refeicaoInicial: MealType;
  abrirEmCriar?: boolean;
  salvando: boolean;
  onAdicionar: (item: AlimentoParaRegistrar) => Promise<boolean>;
  onSalvarNaBiblioteca: (item: AlimentoParaBiblioteca) => Promise<void>;
  onClose: () => void;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const sheetRef = useRef<AppSheetHandle>(null);
  const buscaRef = useRef<TextInput>(null);

  const [refeicao, setRefeicao] = useState<MealType>(refeicaoInicial);
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<TacoFood | null>(null);
  const [gramas, setGramas] = useState('100');
  const [rascunho, setRascunho] = useState<Rascunho | null>(
    abrirEmCriar ? rascunhoVazio('manual') : null,
  );
  const [favoritar, setFavoritar] = useState(false);

  const [scannerAberto, setScannerAberto] = useState(false);
  const [procurando, setProcurando] = useState(false);
  const [naoEncontrado, setNaoEncontrado] = useState<string | null>(null);

  const resultados = useMemo(
    () => (busca.trim().length >= 2 ? searchFoods(busca, 25) : []),
    [busca],
  );
  const gramasNum = paraNumero(gramas);
  const previa = escolhido ? nutritionForGrams(escolhido, gramasNum) : null;

  useEffect(() => {
    if (!abrirEmCriar) {
      const t = setTimeout(() => buscaRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [abrirEmCriar]);

  /**
   * O leitor só abre depois de a pessoa saber que o código sai do aparelho
   * (LGPD: transferência a terceiro precisa ser informada, e ela pode recusar).
   * O "sim" fica guardado; o "não" mantém a pergunta para a próxima vez, já que
   * a busca por nome resolve do mesmo jeito.
   */
  async function abrirLeitor() {
    setNaoEncontrado(null);
    if (await hasOpenFoodFactsConsent()) {
      setScannerAberto(true);
      return;
    }
    Alert.alert('Consultar a Open Food Facts?', OPEN_FOOD_FACTS_PRIVACY_NOTICE, [
      {
        text: 'Agora não',
        style: 'cancel',
        onPress: () => {
          void saveOpenFoodFactsConsent(false);
          toast.info('Tudo bem — busque o alimento pelo nome na Tabela TACO.');
        },
      },
      {
        text: 'Pode consultar',
        onPress: () => {
          void saveOpenFoodFactsConsent(true);
          setScannerAberto(true);
        },
      },
    ]);
  }

  async function aoLerCodigo({ ean }: ScannedCode) {
    setEscolhido(null);
    setRascunho(null);
    setNaoEncontrado(null);
    setProcurando(true);
    const achado = await lookupFood(ean);
    setProcurando(false);

    if (!achado) {
      setNaoEncontrado(ean);
      buscaRef.current?.focus();
      return;
    }

    setGramas('100');
    setRascunho({
      origem: 'openfoodfacts',
      ean,
      nome: achado.brand ? `${achado.name} (${achado.brand})` : achado.name,
      kcal: achado.kcalPer100g != null ? String(achado.kcalPer100g) : '',
      proteina: achado.protein != null ? String(achado.protein) : '',
      carboidrato: achado.carbs != null ? String(achado.carbs) : '',
      gordura: achado.fat != null ? String(achado.fat) : '',
      // A Open Food Facts não devolve fibra de forma confiável: fica em branco
      // para a pessoa preencher olhando o rótulo, em vez de virar zero mentiroso.
      fibra: '',
    });
  }

  async function confirmar(item: AlimentoParaRegistrar, biblioteca: AlimentoParaBiblioteca | null) {
    const ok = await onAdicionar(item);
    if (!ok) return;
    if (biblioteca) {
      try {
        await onSalvarNaBiblioteca(biblioteca);
      } catch {
        toast.info('Entrou no diário, mas não foi possível guardar na sua lista.');
      }
    }
    sheetRef.current?.close();
  }

  async function adicionarDaTaco() {
    if (!escolhido || !previa || gramasNum <= 0) {
      toast.info('Informe a quantidade em gramas.');
      return;
    }
    await confirmar(
      {
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
      },
      favoritar
        ? {
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
          }
        : null,
    );
  }

  async function adicionarRascunho() {
    if (!rascunho) return;
    const nome = rascunho.nome.trim();
    if (!nome) {
      toast.info('Dê um nome ao alimento antes de salvar.');
      return;
    }
    if (gramasNum <= 0) {
      toast.info('Informe a quantidade em gramas.');
      return;
    }
    const r = gramasNum / 100;
    const uma = (v: string) => Math.round(paraNumero(v) * r * 10) / 10;
    await confirmar(
      {
        meal_type: refeicao,
        food_name: nome,
        grams: gramasNum,
        kcal: Math.round(paraNumero(rascunho.kcal) * r),
        protein_g: uma(rascunho.proteina),
        carbs_g: uma(rascunho.carboidrato),
        fat_g: uma(rascunho.gordura),
        fiber_g: uma(rascunho.fibra),
        source: rascunho.origem,
        source_ref: rascunho.ean,
      },
      favoritar
        ? {
            food_name: nome,
            kcal: paraNumero(rascunho.kcal),
            protein_g: paraNumero(rascunho.proteina),
            carbs_g: paraNumero(rascunho.carboidrato),
            fat_g: paraNumero(rascunho.gordura),
            fiber_g: paraNumero(rascunho.fibra),
            default_grams: gramasNum,
            source: rascunho.origem,
            source_ref: rascunho.ean,
            is_favorite: true,
          }
        : null,
    );
  }

  const txt = (cor: string, familia: string = fonts.regular, escala: { fontSize: number; lineHeight: number } = type.bodySm) => [
    { fontFamily: familia, color: cor },
    fs(escala.fontSize, escala.lineHeight),
  ];

  return (
    <>
      <AppSheet ref={sheetRef} onClose={onClose} title="Adicionar alimento">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
          {/* Refeição */}
          <View style={{ gap: 8 }}>
            <Text style={txt(colors.fgSoft, fonts.medium, type.label)}>Refeição</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MEAL_TYPES_DO_DIA.map((t) => {
                const ativo = t === refeicao;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setRefeicao(t)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: ativo }}
                    style={[
                      {
                        minHeight: tap,
                        justifyContent: 'center',
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: ativo ? colors.primary : colors.line,
                        backgroundColor: ativo ? `${colors.primary}1A` : colors.surface,
                      },
                      CONTINUOUS,
                    ]}
                  >
                    <Text
                      maxFontSizeMultiplier={1.4}
                      style={txt(ativo ? colors.primary : colors.fgSoft, ativo ? fonts.semibold : fonts.regular)}
                    >
                      {MEAL_TYPE_LABELS[t]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {procurando ? (
            <View
              accessibilityLiveRegion="polite"
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.surface2,
                },
                CONTINUOUS,
              ]}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[txt(colors.fgSoft), { flex: 1 }]}>
                {`Procurando esse código na ${OPEN_FOOD_FACTS_SOURCE}…`}
              </Text>
            </View>
          ) : null}

          {rascunho ? (
            /* ─── Rascunho editável (código de barras ou criado à mão) ─── */
            <View
              style={[
                {
                  gap: 12,
                  padding: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.surface2,
                },
                CONTINUOUS,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                {rascunho.origem === 'openfoodfacts' ? (
                  <Barcode size={16} color={colors.primary} style={{ marginTop: 2 }} />
                ) : null}
                <Text style={[txt(colors.fg, fonts.semibold, type.label), { flex: 1 }]}>
                  {rascunho.origem === 'openfoodfacts' ? 'Confira antes de salvar' : 'Novo alimento'}
                </Text>
                <Pressable
                  onPress={() => setRascunho(null)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Descartar este alimento"
                >
                  <X size={18} color={colors.muted} />
                </Pressable>
              </View>

              <Text style={txt(colors.muted, fonts.regular, type.caption)}>
                {rascunho.origem === 'openfoodfacts'
                  ? `Código ${rascunho.ean} · dados encontrados na ${OPEN_FOOD_FACTS_SOURCE}. Compare com o rótulo e corrija o que estiver diferente.`
                  : 'Copie os valores do rótulo, na coluna de 100 g (ou 100 ml). Fica marcado como informado por você — o app não confere nada.'}
              </Text>

              <CampoTexto
                rotulo="Nome do alimento"
                valor={rascunho.nome}
                onChange={(v) => setRascunho((d) => (d ? { ...d, nome: v } : d))}
                placeholder="Como você quer ver no diário"
              />

              <Text style={txt(colors.muted, fonts.medium, type.caption)}>
                Por 100 g (ou 100 ml), como está no rótulo
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
                <CampoNumero
                  rotulo="Calorias (kcal)"
                  valor={rascunho.kcal}
                  onChange={(v) => setRascunho((d) => (d ? { ...d, kcal: v } : d))}
                />
                <CampoNumero
                  rotulo="Proteínas (g)"
                  valor={rascunho.proteina}
                  onChange={(v) => setRascunho((d) => (d ? { ...d, proteina: v } : d))}
                />
                <CampoNumero
                  rotulo="Carboidratos (g)"
                  valor={rascunho.carboidrato}
                  onChange={(v) => setRascunho((d) => (d ? { ...d, carboidrato: v } : d))}
                />
                <CampoNumero
                  rotulo="Gorduras (g)"
                  valor={rascunho.gordura}
                  onChange={(v) => setRascunho((d) => (d ? { ...d, gordura: v } : d))}
                />
                <CampoNumero
                  rotulo="Fibras (g)"
                  valor={rascunho.fibra}
                  onChange={(v) => setRascunho((d) => (d ? { ...d, fibra: v } : d))}
                />
                <CampoNumero rotulo="Quanto você comeu (g)" valor={gramas} onChange={setGramas} />
              </View>

              <Favoritar valor={favoritar} onChange={setFavoritar} rotulo="Guardar em Meus alimentos" />

              <Pressable
                onPress={() => void adicionarRascunho()}
                disabled={salvando}
                accessibilityRole="button"
                accessibilityLabel="Conferi os dados e quero adicionar ao diário"
                style={[
                  {
                    minHeight: tap + 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    backgroundColor: colors.primary,
                    opacity: salvando ? 0.6 : 1,
                  },
                  CONTINUOUS,
                ]}
              >
                {salvando ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Plus size={18} color={colors.white} />
                )}
                <Text maxFontSizeMultiplier={1.4} style={txt(colors.white, fonts.semibold, type.label)}>
                  {rascunho.origem === 'openfoodfacts'
                    ? 'Conferi — adicionar'
                    : `Adicionar ao ${MEAL_TYPE_LABELS[refeicao]}`}
                </Text>
              </Pressable>

              {rascunho.origem === 'openfoodfacts' ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <Info size={13} color={colors.muted} style={{ marginTop: 2 }} />
                  <Text style={[txt(colors.muted, fonts.regular, type.caption), { flex: 1 }]}>
                    {OPEN_FOOD_FACTS_DISCLAIMER}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : escolhido ? (
            /* ─── Passo da quantidade (item da TACO) ─── */
            <View
              style={[
                {
                  gap: 12,
                  padding: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.surface2,
                },
                CONTINUOUS,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={txt(colors.fg, fonts.semibold, type.label)}>{escolhido.name}</Text>
                  <Text style={txt(colors.muted, fonts.regular, type.caption)}>
                    {escolhido.category} · Tabela TACO
                  </Text>
                </View>
                <Pressable
                  onPress={() => setEscolhido(null)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Escolher outro alimento"
                >
                  <X size={18} color={colors.muted} />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                <View style={{ width: 130 }}>
                  <CampoNumero rotulo="Quantidade (g)" valor={gramas} onChange={setGramas} cheio />
                </View>
                {previa ? (
                  <Text style={[txt(colors.muted, fonts.num, type.caption), { flex: 1, paddingBottom: 14 }]}>
                    {`${numeroBR(previa.kcal)} kcal · P ${numeroBR(previa.protein, 1)} · C ${numeroBR(previa.carbs, 1)} · G ${numeroBR(previa.fat, 1)} · F ${numeroBR(previa.fiber, 1)}`}
                  </Text>
                ) : null}
              </View>

              <Favoritar valor={favoritar} onChange={setFavoritar} rotulo="Salvar nos favoritos com esta porção" />

              <Pressable
                onPress={() => void adicionarDaTaco()}
                disabled={salvando}
                accessibilityRole="button"
                style={[
                  {
                    minHeight: tap + 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 16,
                    backgroundColor: colors.primary,
                    opacity: salvando ? 0.6 : 1,
                  },
                  CONTINUOUS,
                ]}
              >
                {salvando ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Plus size={18} color={colors.white} />
                )}
                <Text maxFontSizeMultiplier={1.4} style={txt(colors.white, fonts.semibold, type.label)}>
                  {`Adicionar ao ${MEAL_TYPE_LABELS[refeicao]}`}
                </Text>
              </Pressable>
            </View>
          ) : (
            /* ─── Porta de entrada: código de barras ou busca ─── */
            <>
              <Pressable
                onPress={() => void abrirLeitor()}
                disabled={procurando}
                accessibilityRole="button"
                accessibilityLabel="Escanear o código de barras da embalagem"
                accessibilityHint="Abre a câmera; você confere os dados antes de salvar"
                style={[
                  {
                    minHeight: tap + 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    backgroundColor: `${colors.primary}1A`,
                    opacity: procurando ? 0.6 : 1,
                  },
                  CONTINUOUS,
                ]}
              >
                <Barcode size={20} color={colors.primary} />
                <Text maxFontSizeMultiplier={1.4} style={txt(colors.primary, fonts.semibold, type.label)}>
                  Escanear código de barras
                </Text>
              </Pressable>

              {naoEncontrado ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={[
                    {
                      gap: 4,
                      padding: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.line,
                      backgroundColor: colors.surface2,
                    },
                    CONTINUOUS,
                  ]}
                >
                  <Text style={txt(colors.fg, fonts.semibold, type.caption)}>
                    {`Código ${naoEncontrado} não encontrado`}
                  </Text>
                  <Text style={txt(colors.muted, fonts.regular, type.caption)}>
                    {`A ${OPEN_FOOD_FACTS_SOURCE} não tem esse produto cadastrado — é uma base colaborativa e muitos itens brasileiros faltam. Busque pelo nome abaixo, ou cadastre pelo rótulo.`}
                  </Text>
                </View>
              ) : null}

              <View
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: colors.surface,
                  },
                  CONTINUOUS,
                ]}
              >
                <Search size={18} color={colors.faint} />
                <TextInput
                  ref={buscaRef}
                  value={busca}
                  onChangeText={setBusca}
                  placeholder="Buscar na Tabela TACO (ex.: arroz)…"
                  placeholderTextColor={colors.faint}
                  accessibilityLabel="Buscar alimento na Tabela TACO"
                  maxFontSizeMultiplier={1.4}
                  style={[{ fontFamily: fonts.regular, flex: 1, minHeight: Math.max(48, tap), color: colors.fg }, fs(type.body.fontSize)]}
                />
                {busca ? (
                  <Pressable onPress={() => setBusca('')} hitSlop={12} accessibilityLabel="Limpar busca">
                    <X size={18} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>

              {resultados.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    setEscolhido(f);
                    setGramas('100');
                  }}
                  accessibilityRole="button"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    minHeight: tap,
                    borderTopWidth: 1,
                    borderTopColor: colors.line,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={txt(colors.fg)}>
                      {f.name}
                    </Text>
                    <Text numberOfLines={1} style={txt(colors.muted, fonts.regular, type.caption)}>
                      {f.category}
                    </Text>
                  </View>
                  <Text style={txt(colors.muted, fonts.num, type.caption)}>
                    {`${numeroBR(f.kcal)} kcal/100 g`}
                  </Text>
                </Pressable>
              ))}

              {busca.trim().length >= 2 && resultados.length === 0 ? (
                <View
                  style={[
                    { gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface2 },
                    CONTINUOUS,
                  ]}
                >
                  <Text style={txt(colors.fg, fonts.medium)}>A Tabela TACO não tem esse alimento.</Text>
                  <Text style={txt(colors.muted, fonts.regular, type.caption)}>
                    Ela cobre 597 alimentos brasileiros básicos — produtos de marca e pratos prontos
                    costumam faltar.
                  </Text>
                  <Pressable
                    onPress={() => setRascunho(rascunhoVazio('manual', busca.trim()))}
                    accessibilityRole="button"
                    style={[
                      {
                        minHeight: tap,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.primary,
                      },
                      CONTINUOUS,
                    ]}
                  >
                    <Text style={txt(colors.primary, fonts.semibold)}>
                      {`Cadastrar "${busca.trim()}" pelo rótulo`}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </AppSheet>

      {scannerAberto ? (
        <BarcodeScannerSheet
          title="Código do alimento"
          helpText="Aponte a câmera para o código de barras da embalagem, dentro da moldura."
          privacyNote={`Só o número do código é enviado para a ${OPEN_FOOD_FACTS_SOURCE}. Nenhum dado seu vai junto.`}
          onScanned={(code) => void aoLerCodigo(code)}
          onClose={() => setScannerAberto(false)}
        />
      ) : null}
    </>
  );
}

/* ──────────────────────────────── Campos ──────────────────────────────── */

function CampoTexto({
  rotulo,
  valor,
  onChange,
  placeholder,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  return (
    <View>
      <Text
        maxFontSizeMultiplier={1.4}
        style={[{ fontFamily: fonts.medium, color: colors.muted, marginBottom: 4 }, fs(type.caption.fontSize, type.caption.lineHeight)]}
      >
        {rotulo}
      </Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        accessibilityLabel={rotulo}
        maxFontSizeMultiplier={1.4}
        style={[
          {
            fontFamily: fonts.regular,
            minHeight: Math.max(48, tap),
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
            color: colors.fg,
          },
          fs(type.body.fontSize),
          CONTINUOUS,
        ]}
      />
    </View>
  );
}

function CampoNumero({
  rotulo,
  valor,
  onChange,
  cheio,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  cheio?: boolean;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  return (
    <View style={{ width: cheio ? '100%' : '47%' }}>
      <Text
        maxFontSizeMultiplier={1.4}
        style={[{ fontFamily: fonts.medium, color: colors.muted, marginBottom: 4 }, fs(type.caption.fontSize, type.caption.lineHeight)]}
      >
        {rotulo}
      </Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.faint}
        accessibilityLabel={rotulo}
        maxFontSizeMultiplier={1.4}
        style={[
          {
            fontFamily: fonts.regular,
            minHeight: Math.max(48, tap),
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
            color: colors.fg,
          },
          fs(type.body.fontSize),
          CONTINUOUS,
        ]}
      />
    </View>
  );
}

function Favoritar({
  valor,
  onChange,
  rotulo,
}: {
  valor: boolean;
  onChange: (v: boolean) => void;
  rotulo: string;
}) {
  const colors = useColors();
  const type = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  return (
    <Pressable
      onPress={() => onChange(!valor)}
      accessibilityRole="switch"
      accessibilityState={{ checked: valor }}
      accessibilityLabel={rotulo}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: tap }}
    >
      <View
        style={[
          {
            width: 24,
            height: 24,
            borderRadius: 7,
            borderWidth: 1.5,
            borderColor: valor ? colors.primary : colors.lineStrong,
            backgroundColor: valor ? colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          },
          CONTINUOUS,
        ]}
      >
        {valor ? <Star size={13} color={colors.white} fill={colors.white} /> : null}
      </View>
      <Text
        maxFontSizeMultiplier={1.4}
        style={[{ fontFamily: fonts.regular, color: colors.fgSoft, flex: 1 }, fs(type.bodySm.fontSize, type.bodySm.lineHeight)]}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}
