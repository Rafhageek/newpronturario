import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, AppState } from 'react-native';
import { Footprints } from 'lucide-react-native';
import {
  initialize,
  getSdkStatus,
  requestPermission,
  getGrantedPermissions,
  aggregateRecord,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { Card } from '@/components/ui';
import { fonts } from '@/theme';

// Verde de caminhada — distinto do royal (marca) e do sky (água).
const STEP = '#22C55E';

// Agrupa milhar manualmente (Hermes não tem Intl — ver regra do projeto).
const groupThousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

type State =
  | { kind: 'checking' }
  | { kind: 'unavailable' } // Health Connect ausente/indisponível → card some
  | { kind: 'needs-permission' }
  | { kind: 'ready'; steps: number }
  | { kind: 'error' };

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function readTodaySteps(): Promise<number> {
  const res = await aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: startOfTodayIso(),
      endTime: new Date().toISOString(),
    },
  });
  const total = (res as { COUNT_TOTAL?: number }).COUNT_TOTAL;
  return typeof total === 'number' && Number.isFinite(total) ? total : 0;
}

/**
 * Passos de hoje via Health Connect (Android). SÓ leitura, nunca escreve saúde.
 * Blindado: se o Health Connect não estiver disponível ou algo falhar, o card
 * simplesmente não aparece (nunca derruba o app). Feature de bem-estar (grátis).
 */
export function StepsCard() {
  const [state, setState] = useState<State>({ kind: 'checking' });
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        setState({ kind: 'unavailable' });
        return;
      }
      const ok = await initialize();
      if (!ok) {
        setState({ kind: 'unavailable' });
        return;
      }
      const granted = await getGrantedPermissions();
      const has = granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
      if (!has) {
        setState({ kind: 'needs-permission' });
        return;
      }
      setState({ kind: 'ready', steps: await readTodaySteps() });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
    // Passos mudam ao longo do dia: recarrega quando o app volta ao primeiro plano.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  async function connect() {
    if (connecting) return;
    setConnecting(true);
    try {
      await initialize();
      const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
      const has = granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
      if (has) setState({ kind: 'ready', steps: await readTodaySteps() });
    } catch {
      setState({ kind: 'error' });
    } finally {
      setConnecting(false);
    }
  }

  // Não polui a home enquanto checa, quando indisponível ou em erro.
  if (state.kind === 'checking' || state.kind === 'unavailable' || state.kind === 'error') {
    return null;
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <View
          style={{ backgroundColor: 'rgba(34,197,94,0.12)', borderCurve: 'continuous' }}
          className="h-9 w-9 items-center justify-center rounded-full"
        >
          <Footprints size={18} color={STEP} />
        </View>
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
            Passos de hoje
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
            {state.kind === 'ready'
              ? 'Sincronizado do Health Connect'
              : 'Conecte o Health Connect para ver seus passos'}
          </Text>
        </View>
        {state.kind === 'ready' ? (
          <Text style={{ fontFamily: fonts.bold, color: STEP }} className="text-[18px]">
            {groupThousands(state.steps)}
          </Text>
        ) : null}
      </View>

      {state.kind === 'needs-permission' ? (
        <Pressable
          onPress={connect}
          disabled={connecting}
          accessibilityRole="button"
          accessibilityLabel="Conectar Health Connect para ler seus passos"
          accessibilityState={{ disabled: connecting, busy: connecting }}
          style={{ backgroundColor: STEP, borderCurve: 'continuous', minHeight: 44 }}
          className="flex-row items-center justify-center gap-1.5 rounded-xl px-3 py-3 active:opacity-80"
        >
          {connecting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Footprints size={16} color="#ffffff" />
          )}
          <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-white">
            {connecting ? 'Conectando…' : 'Conectar Health Connect'}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
