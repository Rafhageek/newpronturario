import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Store, Info, MapPin } from 'lucide-react-native';
import {
  FARMACIA_POPULAR_LABEL,
  FARMACIA_POPULAR_NOTE,
  farmaciaPopularCategoryLabel,
  type FarmaciaPopularItem,
} from '@hubpatients/core';
import { useColors, fonts, useFontScaler } from '@/theme';

const CONTINUOUS = { borderCurve: 'continuous' as const };

/**
 * Etiqueta discreta para medicamentos cujo princípio ativo consta no elenco
 * gratuito do Farmácia Popular. É informativa: não afirma que a pessoa "tem
 * direito", só que o item está no elenco — a retirada depende de receita válida
 * e da autorização no Meu SUS Digital.
 */
export function FarmaciaPopularBadge({
  item,
  onFindPharmacies,
}: {
  item?: FarmaciaPopularItem | null;
  /** Atalho para o mapa de farmácias (`/locais/pharmacy`), quando disponível. */
  onFindPharmacies?: () => void;
}) {
  const colors = useColors();
  const fs = useFontScaler();
  const [open, setOpen] = useState(false);

  return (
    <View className="self-start">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${FARMACIA_POPULAR_LABEL}. Toque para entender o que isso significa.`}
        style={CONTINUOUS}
        className="flex-row items-center gap-1.5 self-start rounded-full border border-health-400/40 bg-health-300/20 px-2.5 py-1 active:opacity-80"
      >
        <Store size={13} color={colors.ok} />
        {/* "Farmácia Popular" = o remédio sai de graça. É informação de acesso
            a tratamento, não enfeite — tinha o mesmo 11px do resto. */}
        <Text style={[{ fontFamily: fonts.semibold, flexShrink: 1 }, fs(11, 15)]} className="text-health-600">
          {FARMACIA_POPULAR_LABEL}
        </Text>
        <Info size={11} color={colors.ok} />
      </Pressable>

      {open ? (
        <View
          style={CONTINUOUS}
          className="mt-2 rounded-2xl border border-health-400/30 bg-health-300/10 p-3"
        >
          {item ? (
            <Text style={[{ fontFamily: fonts.semibold }, fs(12, 16)]} className="mb-1 text-health-600">
              {item.activeIngredient} · {farmaciaPopularCategoryLabel(item)}
            </Text>
          ) : null}
          <Text style={[{ fontFamily: fonts.regular }, fs(12, 18)]} className="text-fg-soft">
            {FARMACIA_POPULAR_NOTE}
          </Text>
          {item?.note ? (
            // Apresentações cobertas pelo programa: concentração e forma.
            <Text style={[{ fontFamily: fonts.regular }, fs(11, 16)]} className="mt-1.5 text-muted">
              {`Apresentações no elenco: ${item.note}.`}
            </Text>
          ) : null}
          {onFindPharmacies ? (
            <Pressable
              onPress={onFindPharmacies}
              accessibilityRole="button"
              accessibilityLabel="Ver farmácias credenciadas perto de mim"
              style={CONTINUOUS}
              className="mt-2.5 flex-row items-center gap-1.5 self-start rounded-lg active:opacity-70"
            >
              <MapPin size={14} color={colors.primary} />
              <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-primary">
                Farmácias credenciadas perto de mim
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
