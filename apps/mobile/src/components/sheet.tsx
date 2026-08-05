import {
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { X } from 'lucide-react-native';
import { useColors, fonts, shadowRaised } from '@/theme';

export type AppSheetHandle = { close: () => void };

/**
 * Bottom sheet arrastável próprio (Reanimated + gesture-handler — roda em Expo
 * Go; o @gorhom/bottom-sheet v5 quebra no SDK 53). Entra deslizando de baixo,
 * fecha arrastando p/ baixo, tocando no fundo ou via ref.close() (ex.: após
 * salvar). Anima a saída ANTES de chamar onClose (o pai desmonta no fim).
 *
 * Monte condicionalmente: {open && <AppSheet onClose={() => setOpen(false)} …/>}
 */
export const AppSheet = forwardRef<AppSheetHandle, { onClose: () => void; title?: string; children: ReactNode }>(
  function AppSheet({ onClose, title, children }, ref) {
    const insets = useSafeAreaInsets();
    const { height: screenH } = useWindowDimensions();
    const reduce = useReducedMotion();
    const colors = useColors();

    const ty = useSharedValue(screenH); // começa fora da tela (embaixo)
    const backdrop = useSharedValue(0);
    const [sheetH, setSheetH] = useState(screenH);

    // Entrada ao montar.
    useEffect(() => {
      backdrop.value = withTiming(1, { duration: reduce ? 1 : 200 });
      ty.value = reduce ? withTiming(0, { duration: 1 }) : withSpring(0, { damping: 24, stiffness: 240, mass: 0.9 });
    }, [backdrop, reduce, ty]);

    const close = useCallback(() => {
      // Fecha o teclado JUNTO com a folha. Sem isso o painel desce enquanto o
      // teclado ainda ocupa a tela, e a saída termina pela metade (o painel
      // "para" em cima do teclado até ele sumir sozinho no desmonte).
      Keyboard.dismiss();
      backdrop.value = withTiming(0, { duration: reduce ? 1 : 180 });
      ty.value = withTiming(sheetH + insets.bottom + 40, { duration: reduce ? 1 : 200 }, (finished) => {
        if (finished) scheduleOnRN(onClose);
      });
    }, [backdrop, insets.bottom, onClose, reduce, sheetH, ty]);

    useImperativeHandle(ref, () => ({ close }), [close]);

    // Fecha com o botão Voltar no Android enquanto o sheet estiver montado.
    useEffect(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      });
      return () => subscription.remove();
    }, [close]);

    // RNGH 2 exige memoização do builder para não reinstalar o recognizer a cada render.
    const pan = useMemo(
      () =>
        Gesture.Pan()
          .onUpdate((e) => {
            ty.value = Math.max(0, e.translationY);
          })
          .onEnd((e) => {
            if (e.translationY > 110 || e.velocityY > 800) {
              backdrop.value = withTiming(0, { duration: reduce ? 1 : 180 });
              ty.value = withTiming(
                sheetH + insets.bottom + 40,
                { duration: reduce ? 1 : 200 },
                (finished) => {
                  if (finished) scheduleOnRN(onClose);
                },
              );
            } else {
              ty.value = reduce
                ? withTiming(0, { duration: 1 })
                : withSpring(0, { damping: 24, stiffness: 240 });
            }
          }),
      [backdrop, insets.bottom, onClose, reduce, sheetH, ty],
    );

    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
    const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fechar" accessibilityRole="button" />
        </Animated.View>

        {/*
          O painel vive dentro de um KeyboardAvoidingView de tela cheia, alinhado
          embaixo — no lugar do antigo `position: absolute; bottom: 0`. Ancorado
          no zero, o teclado simplesmente cobria o fim da folha: nas folhas curtas
          (sem rolagem interna) o botão de salvar ficava INALCANÇÁVEL.
          `box-none` é obrigatório: sem ele esta camada engoliria o toque no vazio
          acima do painel, que é o que fecha a folha pelo fundo.
        */}
        <KeyboardAvoidingView
          // iOS empurra por padding; no Android o ajuste de altura é o que
          // funciona com o edge-to-edge do SDK 54, onde `adjustResize` já não
          // redimensiona a janela sozinho. Nos dois casos o RN parte do frame
          // REAL do componente na tela, então onde a janela ainda encolhe o
          // deslocamento calculado é zero — não há compensação em dobro.
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}
        >
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel={title ? `Painel: ${title}` : 'Painel'}
            onAccessibilityEscape={close}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) setSheetH(h);
            }}
            style={[
              {
                maxHeight: '90%',
                backgroundColor: colors.bg,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderCurve: 'continuous',
                borderTopWidth: 1,
                borderColor: colors.line,
                paddingHorizontal: 16,
                paddingBottom: insets.bottom + 16,
                paddingTop: 8,
              },
              shadowRaised,
              panelStyle,
            ]}
          >
            {/* Alça de arrastar */}
            <GestureDetector gesture={pan}>
              <View
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                style={{ paddingVertical: 8, alignItems: 'center' }}
              >
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
              </View>
            </GestureDetector>

            <View className="mb-3 flex-row items-center justify-between">
              {title ? (
                <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.display }} className="text-[17px] text-fg">
                  {title}
                </Text>
              ) : (
                <View />
              )}
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={title ? `Fechar ${title}` : 'Fechar painel'}
                hitSlop={8}
                style={{ borderCurve: 'continuous' }}
                className="h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 active:opacity-70"
              >
                <X size={18} color={colors.fg} accessible={false} />
              </Pressable>
            </View>

            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    );
  },
);
