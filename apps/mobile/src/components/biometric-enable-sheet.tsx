import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { AppSheet, type AppSheetHandle } from './sheet';
import { Button } from './ui';
import { toast } from './toast';
import { useAuth } from '@/lib/auth';
import {
  isBiometricSupported,
  getBiometricLabel,
  loadBiometricPref,
  setBiometricPref,
  authenticateBiometric,
} from '@/lib/biometric';
import { useColors, fonts } from '@/theme';

function dismissedKey(userId: string) {
  return `hubpatients.biometric-prompt-dismissed.${userId}`;
}

/**
 * Convite automático pra ativar o desbloqueio por biometria — aparece UMA vez
 * por conta, na Home, só quando o aparelho tem biometria cadastrada E a
 * pessoa ainda não ativou (nem dispensou antes). Sem hardware/cadastro no
 * aparelho, não pergunta nada — a resposta "sem biometria configurada" já é
 * dada aqui, em vez de a pessoa procurar em Configurações e não achar nada
 * explicando por quê.
 *
 * "Agora não" também marca como dispensado — não cobra de novo a cada
 * abertura. Quem mudar de ideia ativa em Configurações → Segurança, que fica
 * disponível sempre (mesmo toggle, mesma função).
 *
 * `onDecided` segue o mesmo contrato do WhatsNewSheet/CreatePasswordSheet:
 * avisa se o convite VAI aparecer, pra sequenciar sem empilhar sheets.
 */
export function BiometricEnableSheet({ onDecided }: { onDecided?: (willShow: boolean) => void }) {
  const { user } = useAuth();
  const colors = useColors();
  const sheetRef = useRef<AppSheetHandle>(null);
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('biometria');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelado = false;
    if (!user) {
      onDecided?.(false);
      return;
    }
    (async () => {
      try {
        const suportado = await isBiometricSupported();
        if (cancelado) return;
        if (!suportado) {
          onDecided?.(false);
          return;
        }
        const [jaAtivo, dispensado, rotulo] = await Promise.all([
          loadBiometricPref(),
          SecureStore.getItemAsync(dismissedKey(user.id)),
          getBiometricLabel(),
        ]);
        if (cancelado) return;
        if (jaAtivo || dispensado) {
          onDecided?.(false);
          return;
        }
        setLabel(rotulo);
        setVisible(true);
        onDecided?.(true);
      } catch {
        onDecided?.(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [user?.id]);

  async function markDismissed() {
    if (user) {
      try {
        await SecureStore.setItemAsync(dismissedKey(user.id), '1');
      } catch {
        // preferência, não bloqueia
      }
    }
  }

  async function dismiss() {
    await markDismissed();
    sheetRef.current?.close();
  }

  async function ativar() {
    setBusy(true);
    const ok = await authenticateBiometric(`Confirme para ativar o desbloqueio com ${label}`);
    if (!ok) {
      setBusy(false);
      toast.info('Não foi possível confirmar a biometria.');
      return;
    }
    await setBiometricPref(true);
    await markDismissed();
    setBusy(false);
    toast.success(`${label} ativado para abrir o app.`);
    sheetRef.current?.close();
  }

  if (!visible) return null;

  const isFace = label.toLowerCase().includes('face') || label.toLowerCase().includes('facial');
  const Icon = isFace ? ScanFace : Fingerprint;

  return (
    <AppSheet ref={sheetRef} onClose={() => setVisible(false)} title="Entrar mais rápido">
      <View className="gap-4 pb-2">
        <View className="flex-row items-center gap-2.5">
          <Icon size={18} color={colors.primary} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] leading-5 text-fg-soft">
            Quer usar {label.toLowerCase()} para abrir o HubPatients, sem digitar senha toda vez?
          </Text>
        </View>
        <Button label={`Ativar ${label}`} loading={busy} onPress={() => void ativar()} />
        <Button label="Agora não" variant="ghost" onPress={() => void dismiss()} />
      </View>
    </AppSheet>
  );
}
