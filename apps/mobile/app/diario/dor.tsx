import { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Activity, Info, TrendingUp } from 'lucide-react-native';
import {
  PAIN_DISCLAIMER,
  bodyRegion,
  bodyRegionLabel,
  summarizePainHistory,
  painMigrationDetection,
  type PainPointLike,
} from '@hubpatients/core';
import { usePainHistory } from '@hubpatients/supabase';
import { useActiveProfile } from '@/lib/active-profile';
import { Screen, AppHeader, Card, Badge, EmptyState } from '@/components/ui';
import { BodyPainMap, type BodyPainMapPoint } from '@/components/body-pain-map';
import { useColors, fonts } from '@/theme';

const PERIODS = [
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
] as const;

function sinceDateISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function HistoricoDorScreen() {
  const colors = useColors();
  const { patientId, active: activeProfile } = useActiveProfile();
  const [days, setDays] = useState<number>(30);

  const since = useMemo(() => sinceDateISO(days), [days]);
  const { data: points, isLoading, isError } = usePainHistory(patientId || undefined, since);

  const list = useMemo(() => (points ?? []) as PainPointLike[], [points]);

  // Ranking/resumo descritivo (helpers puros do core — nunca interpretativos).
  const summary = useMemo(() => summarizePainHistory(list, days), [list, days]);
  const migration = useMemo(() => painMigrationDetection(list), [list]);

  // Heatmap: cada região colorida pela intensidade MÁXIMA registrada no período.
  const heatmapPoints: BodyPainMapPoint[] = useMemo(
    () => summary.map((s) => ({ bodyRegion: s.region, intensity: s.maxIntensity })),
    [summary],
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Histórico de dor"
        subtitle={activeProfile.isSelf ? 'Mapa corporal acumulado' : `Dados de ${activeProfile.name}`}
        icon={Activity}
        back
      />
      <Screen>
        {/* Seletor de período */}
        <View
          style={{ borderCurve: 'continuous' }}
          className="flex-row gap-1 self-start rounded-2xl border border-line bg-surface-2 p-1"
        >
          {PERIODS.map((p) => (
            <Pressable
              key={p.days}
              onPress={() => setDays(p.days)}
              style={{ borderCurve: 'continuous' }}
              className={`rounded-xl px-4 py-2 ${days === p.days ? 'bg-trust-100' : ''}`}
            >
              <Text
                style={{ fontFamily: fonts.semibold }}
                className={`text-[12px] ${days === p.days ? 'text-primary' : 'text-muted'}`}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isError ? (
          <Card>
            <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-rose-700">
              Não foi possível carregar seu histórico de dor. Tente novamente mais tarde.
            </Text>
          </Card>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Nenhum registro de dor neste período"
            subtitle="Marque a dor ao criar um novo registro no diário para ver o mapa aqui."
          />
        ) : (
          <>
            {/* Migração de dor (factual, sem interpretar) */}
            {migration ? (
              <View className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3">
                <TrendingUp size={16} color={colors.primary} style={{ marginTop: 1 }} />
                <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
                  Sua dor mais registrada mudou de{' '}
                  <Text style={{ fontFamily: fonts.semibold }} className="text-fg">
                    {bodyRegionLabel(migration.from)}
                  </Text>{' '}
                  para{' '}
                  <Text style={{ fontFamily: fonts.semibold }} className="text-fg">
                    {bodyRegionLabel(migration.to)}
                  </Text>{' '}
                  no período.
                </Text>
              </View>
            ) : null}

            {/* Mapa corporal (heatmap) */}
            <Card className="gap-1">
              <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
                Mapa acumulado
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="mb-2 text-[12px] text-muted">
                Cada região é colorida pela maior intensidade registrada no período.
              </Text>
              <BodyPainMap points={heatmapPoints} />
            </Card>

            {/* Ranking textual */}
            <Card className="gap-3">
              <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
                Regiões mais registradas
              </Text>
              <View className="gap-2">
                {summary.map((s) => {
                  const known = bodyRegion(s.region) != null;
                  return (
                    <View
                      key={s.region}
                      style={{ borderCurve: 'continuous' }}
                      className="flex-row items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-3 py-2.5"
                    >
                      <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">
                        {known ? bodyRegionLabel(s.region) : s.region}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                          {s.count} {s.count === 1 ? 'registro' : 'registros'}
                        </Text>
                        <Badge tone="alert">{`média ${s.avgIntensity}/10`}</Badge>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </>
        )}

        {/* Disclaimer permanente */}
        <View className="mb-4 flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3">
          <Info size={16} color={colors.primary} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
            {PAIN_DISCLAIMER}
          </Text>
        </View>
      </Screen>
    </View>
  );
}
