import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import {
  Activity,
  Check,
  Droplet,
  HeartPulse,
  Moon,
  RefreshCw,
  Scale,
  ShieldCheck,
  Wind,
  Download,
  type LucideIcon,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient, useVitalsAllRange } from '@hubpatients/supabase';
import type { InsertRow, Vital, VitalType } from '@hubpatients/core';
import { Card } from '@/components/ui';
import { toast } from '@/components/toast';
import { logger } from '@/lib/logger';
import { useColors, fonts } from '@/theme';
import {
  getHealthConnectStatus,
  requestHealthPermissions,
  readRecent,
  HEALTH_METRICS,
  HEALTH_METRIC_ORDER,
  type HealthMetric,
  type HealthReading,
} from '@/lib/health-connect';

/**
 * Card "Sincronizar com o Health Connect" (Android).
 *
 * Princípios que o código precisa sustentar:
 *  • SÓ LEITURA — nada é escrito de volta no Health Connect.
 *  • MINIMIZAÇÃO — a permissão é pedida por tipo, com o motivo à vista.
 *  • CONFIRMAÇÃO HUMANA — o que foi encontrado aparece na tela e nada entra no
 *    prontuário sem o usuário confirmar quantos registros serão gravados.
 *  • DEDUPLICAÇÃO — leitura que já existe em `vitals` (mesmo tipo, horário
 *    próximo e mesmo valor) é ignorada, então importar duas vezes não duplica.
 *  • PROCEDÊNCIA — cada linha importada guarda em `note` que veio do Health
 *    Connect (e de qual app), para o usuário e o médico saberem a origem.
 *  • Se o Health Connect não estiver disponível, o card simplesmente some.
 */

const JANELA_DIAS = 30;
/** Teto por importação — evita despejar milhares de linhas de relógio de uma vez. */
const MAX_IMPORT = 500;
/** Duas medições do mesmo tipo a menos de 5 min com o mesmo valor = a mesma. */
const JANELA_DUPLICATA_MS = 5 * 60 * 1000;

/** Tolerância de valor por tipo, na unidade do app. */
const TOLERANCIA: Record<VitalType, number> = {
  weight: 0.15,
  blood_pressure: 1,
  glucose: 1,
  heart_rate: 2,
  temperature: 0.1,
  oxygen_saturation: 0.5,
};

const ICONES: Record<HealthMetric, LucideIcon> = {
  weight: Scale,
  blood_pressure: HeartPulse,
  glucose: Droplet,
  heart_rate: Activity,
  oxygen_saturation: Wind,
  sleep: Moon,
};

const decimal = (n: number, casas: number) => n.toFixed(casas).replace('.', ',');

/** dd/mm — formatação manual: o Hermes não tem Intl (regra do projeto). */
function dataCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}`;
}

function valorFormatado(r: HealthReading): string {
  if (r.metric === 'blood_pressure') return `${Math.round(r.primary)}/${Math.round(r.secondary ?? 0)}`;
  if (r.metric === 'weight' || r.metric === 'sleep') return decimal(r.primary, 1);
  if (r.metric === 'oxygen_saturation') return decimal(r.primary, 0);
  return String(Math.round(r.primary));
}

/** Procedência gravada junto do registro (`vitals.note`). */
function notaDeOrigem(r: HealthReading): string {
  const partes = ['Importado do Health Connect'];
  if (r.origin) partes.push(`app de origem: ${r.origin}`);
  if (r.sampleCount > 1) partes.push(`média de ${r.sampleCount} leituras do mesmo registro`);
  return partes.join(' · ');
}

/** Já existe em `vitals` uma medição do mesmo tipo, horário próximo e mesmo valor? */
function jaExiste(r: HealthReading, tipo: VitalType, existentes: Vital[]): boolean {
  const quando = Date.parse(r.measuredAt);
  if (Number.isNaN(quando)) return true; // sem horário confiável, não grava
  const tol = TOLERANCIA[tipo];
  return existentes.some((v) => {
    if (v.type !== tipo) return false;
    const t = Date.parse(v.measured_at);
    if (Number.isNaN(t) || Math.abs(t - quando) > JANELA_DUPLICATA_MS) return false;
    if (Math.abs(v.value_primary - r.primary) > tol) return false;
    if (r.secondary != null) {
      if (v.value_secondary == null || Math.abs(v.value_secondary - r.secondary) > tol) return false;
    }
    return true;
  });
}

type Fase = 'checking' | 'unavailable' | 'ready';

export function HealthSyncCard({ patientId }: { patientId: string | undefined }) {
  const colors = useColors();
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const { data: vitaisExistentes } = useVitalsAllRange(patientId, JANELA_DIAS);

  const [fase, setFase] = useState<Fase>('checking');
  const [autorizados, setAutorizados] = useState<HealthMetric[]>([]);
  const [pedindo, setPedindo] = useState<HealthMetric | null>(null);
  const [leituras, setLeituras] = useState<HealthReading[]>([]);
  const [falhas, setFalhas] = useState<HealthMetric[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [buscouAlgumaVez, setBuscouAlgumaVez] = useState(false);
  const [selecionados, setSelecionados] = useState<Record<HealthMetric, boolean>>({
    weight: true,
    blood_pressure: true,
    glucose: true,
    heart_rate: true,
    oxygen_saturation: true,
    sleep: false, // o prontuário não guarda sono — exibição apenas
  });

  const buscar = useCallback(async (metricas: HealthMetric[]) => {
    if (metricas.length === 0) {
      setLeituras([]);
      setBuscouAlgumaVez(true);
      return;
    }
    setBuscando(true);
    try {
      const { readings, failed } = await readRecent({ metrics: metricas, days: JANELA_DIAS });
      setLeituras(readings);
      setFalhas(failed);
    } finally {
      setBuscando(false);
      setBuscouAlgumaVez(true);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const status = await getHealthConnectStatus();
      if (!vivo) return;
      if (status.kind === 'unavailable') {
        setFase('unavailable');
        return;
      }
      setFase('ready');
      setAutorizados(status.granted);
      if (status.granted.length > 0) await buscar(status.granted);
    })();
    return () => {
      vivo = false;
    };
  }, [buscar]);

  async function permitir(metrica: HealthMetric) {
    if (pedindo) return;
    setPedindo(metrica);
    try {
      const concedidos = await requestHealthPermissions([metrica]);
      setAutorizados(concedidos);
      if (concedidos.includes(metrica)) {
        await buscar(concedidos);
      } else {
        toast.info('Permissão não concedida. Você pode liberar depois, quando quiser.');
      }
    } finally {
      setPedindo(null);
    }
  }

  // ── O que dá para importar ────────────────────────────────────────────────
  const porMetrica = useMemo(() => {
    const mapa = new Map<HealthMetric, HealthReading[]>();
    for (const r of leituras) {
      const lista = mapa.get(r.metric);
      if (lista) lista.push(r);
      else mapa.set(r.metric, [r]);
    }
    return mapa;
  }, [leituras]);

  const analise = useMemo(() => {
    const existentes = vitaisExistentes ?? [];
    const novos: { linha: InsertRow<'vitals'>; metrica: HealthMetric }[] = [];
    const duplicadosPorMetrica = new Map<HealthMetric, number>();
    // Deduplica também dentro do próprio lote (mesmo dado vindo de 2 apps).
    const lote: HealthReading[] = [];

    for (const r of leituras) {
      const meta = HEALTH_METRICS[r.metric];
      const tipo = meta.vitalType;
      if (!tipo) continue; // sono: sem correspondência no prontuário
      if (!selecionados[r.metric]) continue;

      const duplicado =
        jaExiste(r, tipo, existentes) ||
        lote.some(
          (a) =>
            a.metric === r.metric &&
            Math.abs(Date.parse(a.measuredAt) - Date.parse(r.measuredAt)) <= JANELA_DUPLICATA_MS &&
            Math.abs(a.primary - r.primary) <= TOLERANCIA[tipo],
        );

      if (duplicado) {
        duplicadosPorMetrica.set(r.metric, (duplicadosPorMetrica.get(r.metric) ?? 0) + 1);
        continue;
      }

      lote.push(r);
      if (!patientId) continue;
      novos.push({
        metrica: r.metric,
        linha: {
          patient_id: patientId,
          type: tipo,
          measured_at: r.measuredAt,
          value_primary: r.primary,
          value_secondary: r.secondary,
          unit: meta.unit,
          note: notaDeOrigem(r),
        },
      });
    }

    const duplicados = [...duplicadosPorMetrica.values()].reduce((a, b) => a + b, 0);
    return { novos: novos.slice(0, MAX_IMPORT), total: novos.length, duplicados };
  }, [leituras, selecionados, vitaisExistentes, patientId]);

  function alternar(metrica: HealthMetric) {
    setSelecionados((s) => ({ ...s, [metrica]: !s[metrica] }));
  }

  async function importar() {
    if (importando || analise.novos.length === 0) return;

    const contagem = new Map<HealthMetric, number>();
    for (const n of analise.novos) contagem.set(n.metrica, (contagem.get(n.metrica) ?? 0) + 1);
    const resumo = [...contagem.entries()]
      .map(([m, q]) => `• ${q} de ${HEALTH_METRICS[m].label.toLowerCase()}`)
      .join('\n');
    const cortou = analise.total > analise.novos.length;

    // Confirmação humana explícita: nada entra no prontuário sem este "sim".
    const confirmado = await new Promise<boolean>((resolve) => {
      Alert.alert(
        `Importar ${analise.novos.length} ${analise.novos.length === 1 ? 'registro' : 'registros'}?`,
        `${resumo}\n\nEles entram no seu prontuário marcados como vindos do Health Connect.${
          cortou ? `\n\nSão ${analise.total} no total; nesta vez entram os ${MAX_IMPORT} mais recentes.` : ''
        }`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Importar', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!confirmado) return;

    setImportando(true);
    try {
      const linhas = analise.novos.map((n) => n.linha);
      const { error } = await client.from('vitals').insert(linhas);
      if (error) throw error;
      toast.success(
        `${linhas.length} ${linhas.length === 1 ? 'registro importado' : 'registros importados'} para o seu prontuário.`,
      );
      if (patientId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['vitals', patientId] }),
          qc.invalidateQueries({ queryKey: ['vitals-range', patientId] }),
          qc.invalidateQueries({ queryKey: ['vitals-all', patientId] }),
          qc.invalidateQueries({ queryKey: ['dashboard', patientId] }),
        ]);
      }
    } catch (e) {
      logger.error('health-connect: falha ao importar para vitals', {
        action: 'hc_import',
        table: 'vitals',
        count: analise.novos.length,
        error: e instanceof Error ? e.message : 'desconhecido',
      });
      toast.error('Não foi possível importar agora. Tente de novo em instantes.');
    } finally {
      setImportando(false);
    }
  }

  // Enquanto checa ou quando o aparelho não tem Health Connect, o card some.
  if (fase !== 'ready') return null;

  const nenhumAutorizado = autorizados.length === 0;

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <View
          style={{ backgroundColor: 'rgba(34,197,94,0.12)', borderCurve: 'continuous' }}
          className="h-9 w-9 items-center justify-center rounded-full"
        >
          <ShieldCheck size={18} color="#22C55E" />
        </View>
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
            Sincronizar com o Health Connect
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-4 text-muted">
            Somente leitura. O HubPacientes nunca grava nada de volta no Health Connect.
          </Text>
        </View>
      </View>

      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-5 text-fg-soft">
        {nenhumAutorizado
          ? 'Libere só o que você quiser trazer para o prontuário. Cada tipo é pedido separadamente — o que você não liberar continua fora do alcance do app.'
          : `Mostrando o que o Health Connect tem nos últimos ${JANELA_DIAS} dias. Nada entra no prontuário antes de você confirmar.`}
      </Text>

      <View className="gap-1">
        {HEALTH_METRIC_ORDER.map((metrica) => {
          const meta = HEALTH_METRICS[metrica];
          const Icone = ICONES[metrica];
          const autorizado = autorizados.includes(metrica);
          const encontrados = porMetrica.get(metrica) ?? [];
          const ultimo = encontrados[0];
          const importavel = meta.vitalType != null;
          const marcado = importavel && selecionados[metrica];
          const falhou = falhas.includes(metrica) && autorizado;

          return (
            <View key={metrica} className="flex-row items-center gap-3 border-t border-line/60 py-2">
              <View
                style={{ backgroundColor: colors.surface2, borderCurve: 'continuous' }}
                className="h-9 w-9 items-center justify-center rounded-full"
              >
                <Icone size={17} color={autorizado ? colors.primary : colors.faint} />
              </View>

              <View className="flex-1">
                <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                  {meta.label}
                </Text>
                <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">
                  {!autorizado
                    ? meta.purpose
                    : falhou
                      ? 'Não foi possível ler agora.'
                      : buscando
                        ? 'Buscando…'
                        : encontrados.length === 0
                          ? buscouAlgumaVez
                            ? 'Nenhum registro no período.'
                            : '—'
                          : `${encontrados.length} ${encontrados.length === 1 ? 'registro' : 'registros'}${
                              ultimo
                                ? ` · último ${valorFormatado(ultimo)} ${meta.unit} em ${dataCurta(ultimo.measuredAt)}`
                                : ''
                            }`}
                </Text>
                {autorizado && !importavel ? (
                  <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">
                    Exibição apenas — o prontuário ainda não guarda sono.
                  </Text>
                ) : null}
              </View>

              {!autorizado ? (
                <Pressable
                  onPress={() => void permitir(metrica)}
                  disabled={pedindo != null}
                  accessibilityRole="button"
                  accessibilityLabel={`Permitir leitura de ${meta.label}. ${meta.purpose}`}
                  accessibilityState={{ disabled: pedindo != null, busy: pedindo === metrica }}
                  style={{ minHeight: 56, minWidth: 96, borderCurve: 'continuous' }}
                  className="items-center justify-center rounded-2xl border border-line bg-surface-2 px-3 active:opacity-70"
                >
                  {pedindo === metrica ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={{ fontFamily: fonts.semibold, color: colors.primary }} className="text-[13px]">
                      Permitir
                    </Text>
                  )}
                </Pressable>
              ) : importavel && encontrados.length > 0 ? (
                <Pressable
                  onPress={() => alternar(metrica)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Incluir ${meta.label} na importação`}
                  accessibilityState={{ checked: marcado }}
                  style={{ minHeight: 56, minWidth: 56, borderCurve: 'continuous' }}
                  className="items-center justify-center rounded-2xl active:opacity-70"
                >
                  <View
                    style={{
                      borderCurve: 'continuous',
                      backgroundColor: marcado ? colors.primary : 'transparent',
                      borderColor: marcado ? colors.primary : colors.line,
                    }}
                    className="h-7 w-7 items-center justify-center rounded-lg border-2"
                  >
                    {marcado ? <Check size={16} color={colors.white} /> : null}
                  </View>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {!nenhumAutorizado ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => void buscar(autorizados)}
              disabled={buscando || importando}
              accessibilityRole="button"
              accessibilityLabel="Buscar novamente no Health Connect"
              accessibilityState={{ disabled: buscando || importando, busy: buscando }}
              style={{ minHeight: 56, borderCurve: 'continuous' }}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-3 active:opacity-70"
            >
              {buscando ? (
                <ActivityIndicator size="small" color={colors.fg} />
              ) : (
                <RefreshCw size={16} color={colors.fg} />
              )}
              <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-fg">
                Buscar de novo
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void importar()}
              disabled={importando || buscando || analise.novos.length === 0 || !patientId}
              accessibilityRole="button"
              accessibilityLabel={
                analise.novos.length === 0
                  ? 'Nada novo para importar'
                  : `Importar ${analise.novos.length} registros para o meu prontuário`
              }
              accessibilityState={{
                disabled: importando || buscando || analise.novos.length === 0 || !patientId,
                busy: importando,
              }}
              style={{
                flex: 1.4,
                minHeight: 56,
                borderCurve: 'continuous',
                backgroundColor: colors.primary,
                opacity: analise.novos.length === 0 || importando || buscando || !patientId ? 0.5 : 1,
              }}
              className="flex-row items-center justify-center gap-2 rounded-2xl px-3 active:opacity-80"
            >
              {importando ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Download size={16} color={colors.white} />
              )}
              <Text
                numberOfLines={2}
                style={{ fontFamily: fonts.semibold, color: colors.white }}
                className="text-[13px]"
              >
                {analise.novos.length > 0
                  ? `Importar ${analise.novos.length} para o meu prontuário`
                  : 'Importar para o meu prontuário'}
              </Text>
            </Pressable>
          </View>

          {analise.duplicados > 0 ? (
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">
              {analise.duplicados}{' '}
              {analise.duplicados === 1
                ? 'leitura já estava no prontuário e será ignorada.'
                : 'leituras já estavam no prontuário e serão ignoradas.'}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">
        Importar é registro, não diagnóstico: o app guarda os números como vieram do seu aparelho,
        sem interpretar. Quem avalia é o seu médico. Você pode revogar o acesso a qualquer momento
        no app Health Connect.
      </Text>
    </Card>
  );
}
