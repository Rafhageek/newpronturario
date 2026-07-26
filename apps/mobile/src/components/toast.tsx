import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, AlertTriangle, Info, X, type LucideIcon } from 'lucide-react-native';
import { colors, useColors, fonts, cardShadow } from '@/theme';

/**
 * Toast global — feedback não-intrusivo que substitui o Alert.alert de sucesso.
 * Emissor a nível de módulo: qualquer tela chama `toast.success('Salvo!')` sem
 * precisar de Provider/context. O <ToastHost/> (montado uma vez no _layout)
 * escuta e renderiza. Some sozinho; toque dispensa antes.
 */

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string; duration: number };
type Listener = (t: ToastItem) => void;

let counter = 0;
const listeners = new Set<Listener>();

function emit(kind: ToastKind, message: string, duration: number) {
  counter += 1;
  // Vibração curta de confirmação — sucesso/erro têm padrões distintos (tátil
  // ajuda quem não está olhando a tela). Info não vibra: evita "dobrar" com o
  // haptic de toque que já dispara no botão que originou a mensagem.
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'error') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  const item: ToastItem = { id: counter, kind, message, duration };
  listeners.forEach((l) => l(item));
}

export const toast = {
  success: (message: string, duration = 2800) => emit('success', message, duration),
  error: (message: string, duration = 4200) => emit('error', message, duration),
  info: (message: string, duration = 3000) => emit('info', message, duration),
};

const KIND_META: Record<ToastKind, { icon: LucideIcon; tint: string }> = {
  success: { icon: CheckCircle2, tint: colors.accent },
  error: { icon: AlertTriangle, tint: colors.alert },
  info: { icon: Info, tint: colors.primary },
};

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const colors = useColors();
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(t);
  }, [item.id, item.duration, onDismiss]);

  return (
    <Animated.View entering={FadeInUp.springify().damping(18).mass(0.7)} exiting={FadeOutUp.duration(220)} layout={LinearTransition}>
      <Pressable
        onPress={() => onDismiss(item.id)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={item.message}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: colors.line,
            borderLeftWidth: 4,
            borderLeftColor: meta.tint,
            paddingVertical: 12,
            paddingHorizontal: 14,
          },
          cardShadow,
        ]}
      >
        <Icon size={20} color={meta.tint} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.fg, flex: 1 }} numberOfLines={3}>
          {item.message}
        </Text>
        <X size={16} color={colors.faint} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ToastItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const listener: Listener = (item) => {
      // No máx. 3 visíveis — empurra o mais antigo se exceder.
      setItems((prev) => [...prev.slice(-2), item]);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  if (items.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, gap: 8, zIndex: 9999 }}
    >
      {items.map((item) => (
        <ToastRow key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </View>
  );
}
