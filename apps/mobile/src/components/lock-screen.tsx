import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { HeartPulse, ScanFace, Fingerprint, LockKeyhole } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { fonts, gradients, useColors } from '@/theme';
import { Button } from '@/components/ui';
import { authenticateBiometric, getBiometricLabel } from '@/lib/biometric';

/**
 * Tela de bloqueio por biometria. Tenta autenticar ao montar; em caso de falha,
 * oferece tentar de novo ou "Entrar com senha" (sai e refaz o login).
 */
export function LockScreen({ onUnlock, onUsePassword }: { onUnlock: () => void; onUsePassword: () => void }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [label, setLabel] = useState('Biometria');
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);

  async function tryAuth() {
    setBusy(true);
    setFailed(false);
    const ok = await authenticateBiometric('Desbloqueie o HubPatients');
    if (ok) {
      onUnlock();
      return;
    }
    setBusy(false);
    setFailed(true);
  }

  useEffect(() => {
    void getBiometricLabel().then(setLabel);
    void tryAuth();
  }, []);

  const isFace = label.toLowerCase().includes('face') || label.toLowerCase().includes('facial');
  const BioIcon = isFace ? ScanFace : Fingerprint;

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{
            height: 88,
            width: 88,
            borderRadius: 28,
            borderCurve: 'continuous',
            overflow: 'hidden',
          }}
        >
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <HeartPulse size={42} color="#ffffff" />
          </LinearGradient>
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(120).springify().damping(16)} style={{ fontFamily: fonts.displayX, fontSize: 30, color: colors.fg, marginTop: 20, letterSpacing: 0.5 }}>
          HubPatients
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(220).springify().damping(16)} className="mt-3 flex-row items-center gap-1.5">
          <LockKeyhole size={14} color={colors.muted} />
          <Text style={{ fontFamily: fonts.regular, color: colors.muted, fontSize: 13 }}>App bloqueado</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(320).springify().damping(16)} className="mt-10 items-center">
          <View
            style={{ borderCurve: 'continuous' }}
            className="h-20 w-20 items-center justify-center rounded-3xl border border-line bg-surface-2"
          >
            <BioIcon size={36} color={colors.primary} />
          </View>
          <Text style={{ fontFamily: fonts.regular, color: colors.muted, fontSize: 13 }} className="mt-4 text-center">
            {failed ? 'Não foi possível confirmar. Tente novamente.' : `Use ${label} para entrar.`}
          </Text>
        </Animated.View>
      </View>

      <View className="gap-3 px-6">
        <Button label={`Desbloquear com ${label}`} icon={BioIcon} onPress={tryAuth} loading={busy} />
        <Pressable
          onPress={onUsePassword}
          accessibilityRole="button"
          accessibilityLabel="Entrar com senha"
          hitSlop={8}
          className="items-center py-2 active:opacity-70"
        >
          <Text style={{ fontFamily: fonts.semibold, color: colors.primary, fontSize: 14 }}>Entrar com senha</Text>
        </Pressable>
      </View>
    </View>
  );
}
