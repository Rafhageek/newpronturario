import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Pill, Search, X } from 'lucide-react-native';
import {
  MEDICAMENTOS_BR_DISCLAIMER,
  medicamentoPresentation,
  searchMedicamentos,
  type MedicamentoBr,
  type MedicamentoTarja,
} from '@hubpatients/core';
import { useColors, fonts } from '@/theme';

const CONTINUOUS = { borderCurve: 'continuous' as const };

/** Mínimo de caracteres para começar a sugerir (2 evita listar meia base). */
const MIN_QUERY = 2;

const TARJA_BADGE: Record<MedicamentoTarja, { label: string; tone: 'ok' | 'attention' | 'alert' }> = {
  'sem-tarja': { label: 'Venda livre', tone: 'ok' },
  vermelha: { label: 'Receita', tone: 'attention' },
  'vermelha-retencao': { label: 'Receita retida', tone: 'attention' },
  preta: { label: 'Controle especial', tone: 'alert' },
};

/**
 * Campo de busca com sugestões da base embarcada de medicamentos (Anvisa) —
 * equivalente RN do componente da web.
 *
 * É um input controlado: o texto digitado continua valendo mesmo sem escolher
 * sugestão. A lista AJUDA a achar o nome, não obriga a usar um item da base
 * (manipulado, importado ou fora do recorte tem que caber).
 *
 * O que este componente NÃO faz: prescrever, sugerir dose, dizer que o
 * medicamento serve para a pessoa. Só completa nome.
 *
 * Dica de uso: quando estiver dentro de ScrollView, use
 * `keyboardShouldPersistTaps="handled"` no scroll de fora — senão o primeiro
 * toque na sugestão só fecha o teclado.
 */
export function MedicationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Ex.: Losartana, Puran T4, AAS…',
  limit = 8,
  editable = true,
  autoFocus,
  showDisclaimer = true,
}: {
  /** Texto do campo (controlado). */
  value: string;
  /** Chamado a cada tecla — é isto que o formulário deve salvar. */
  onChange: (value: string) => void;
  /** Chamado quando a pessoa escolhe uma sugestão (para preencher dose/forma). */
  onSelect?: (med: MedicamentoBr) => void;
  placeholder?: string;
  /** Quantas sugestões mostrar. */
  limit?: number;
  editable?: boolean;
  autoFocus?: boolean;
  /** Nota de procedência sob o campo. Só desligue se já houver aviso na tela. */
  showDisclaimer?: boolean;
}) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  // Fecha a lista depois de escolher, sem apagar o texto do campo.
  const [dismissed, setDismissed] = useState(false);

  const query = value.trim();
  const results = useMemo(
    () => (query.length >= MIN_QUERY ? searchMedicamentos(query, limit) : []),
    [query, limit],
  );
  const showList = focused && !dismissed && results.length > 0;
  const showEmpty = focused && !dismissed && query.length >= MIN_QUERY && results.length === 0;

  function choose(med: MedicamentoBr) {
    onChange(med.activeIngredient);
    onSelect?.(med);
    setDismissed(true);
  }

  const toneColor = { ok: colors.ok, attention: colors.attention, alert: colors.alert };

  return (
    <View>
      <View
        style={CONTINUOUS}
        className="flex-row items-center gap-2 rounded-xl border border-line bg-surface px-3"
      >
        <Search size={16} color={colors.faint} />
        <TextInput
          value={value}
          onChangeText={(text) => {
            onChange(text);
            setDismissed(false);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={editable}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="words"
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          accessibilityLabel="Nome do medicamento"
          accessibilityHint="Digite e escolha uma sugestão, ou escreva do seu jeito"
          style={{ fontFamily: fonts.regular, flex: 1, paddingVertical: 11 }}
          className="text-[15px] text-fg"
        />
        {value.length > 0 && editable ? (
          <Pressable
            onPress={() => {
              onChange('');
              setDismissed(false);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Limpar"
          >
            <X size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {showList ? (
        <View
          style={CONTINUOUS}
          className="mt-1.5 max-h-72 overflow-hidden rounded-2xl border border-line bg-surface"
        >
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {results.map((med, i) => {
              const badge = TARJA_BADGE[med.tarja];
              return (
                <Pressable
                  key={med.id}
                  onPress={() => choose(med)}
                  accessibilityRole="button"
                  accessibilityLabel={`${med.activeIngredient}. ${medicamentoPresentation(med)}. ${badge.label}.`}
                  className={`flex-row items-start gap-2.5 px-3 py-2.5 active:opacity-70 ${
                    i > 0 ? 'border-t border-line' : ''
                  }`}
                >
                  <Pill size={16} color={colors.primary} style={{ marginTop: 2 }} />
                  <View className="flex-1">
                    <Text
                      style={{ fontFamily: fonts.medium }}
                      className="text-[14px] text-fg"
                      numberOfLines={1}
                    >
                      {med.activeIngredient}
                      {med.brand ? (
                        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                          {`  (${med.brand})`}
                        </Text>
                      ) : null}
                    </Text>
                    <Text
                      style={{ fontFamily: fonts.regular }}
                      className="mt-0.5 text-[11px] text-muted"
                      numberOfLines={1}
                    >
                      {medicamentoPresentation(med)}
                    </Text>
                  </View>
                  <Text
                    style={{ fontFamily: fonts.semibold, color: toneColor[badge.tone] }}
                    className="mt-0.5 text-[10px]"
                  >
                    {badge.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {showEmpty ? (
        <Text style={{ fontFamily: fonts.regular }} className="mt-1.5 text-[12px] text-muted">
          Não achamos esse nome na nossa lista — pode digitar do seu jeito e salvar mesmo assim.
        </Text>
      ) : null}

      {showDisclaimer ? (
        <Text style={{ fontFamily: fonts.regular }} className="mt-1.5 text-[11px] leading-4 text-muted">
          {MEDICAMENTOS_BR_DISCLAIMER}
        </Text>
      ) : null}
    </View>
  );
}
