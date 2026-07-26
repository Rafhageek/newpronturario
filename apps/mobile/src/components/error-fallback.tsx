import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TriangleAlert, RotateCcw } from 'lucide-react-native';
import { useColors, fonts } from '@/theme';
import { logger } from '@/lib/logger';

/**
 * Tela de erro amigável (fallback do ErrorBoundary). Em vez de tela branca,
 * mostra mensagem acolhedora (público idoso) + "Tentar de novo". Registra o
 * erro no logger (que encaminhará ao crash reporting com scrubbing de PHI).
 */
export function ErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  useEffect(() => {
    logger.error(`render boundary: ${error?.message ?? 'erro desconhecido'}`, { stack: error?.stack });
  }, [error]);

  return (
    <View
      className="flex-1 items-center justify-center bg-bg px-8"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View style={{ borderCurve: 'continuous' }} className="h-16 w-16 items-center justify-center rounded-3xl bg-surface-2">
        <TriangleAlert size={30} color={colors.attention} />
      </View>
      <Text style={{ fontFamily: fonts.display }} className="mt-5 text-center text-[19px] text-fg">
        Algo deu errado
      </Text>
      <Text style={{ fontFamily: fonts.regular }} className="mt-2 text-center text-[14px] leading-5 text-muted">
        Tivemos um problema ao mostrar esta tela. Seus dados estão salvos — é só tentar de novo.
      </Text>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Tentar de novo"
        hitSlop={8}
        style={{ borderCurve: 'continuous' }}
        className="mt-7 flex-row items-center gap-2 rounded-2xl bg-primary px-5 py-3 active:opacity-80"
      >
        <RotateCcw size={18} color={colors.white} />
        <Text style={{ fontFamily: fonts.semibold, color: colors.white }} className="text-[15px]">
          Tentar de novo
        </Text>
      </Pressable>
    </View>
  );
}
