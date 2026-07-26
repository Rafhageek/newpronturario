import { useState } from 'react';
import { View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ruler, TrendingUp, TrendingDown } from 'lucide-react-native';
import {
  BODY_MEASUREMENT_FIELDS,
  formatBodyValue,
  waistHipRatio,
  BODY_DISCLAIMER,
  type BodyField,
} from '@hubpatients/core';
import { useBodyMeasurements, useLogBodyMeasurement, type BodyMeasurementInput } from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { AppHeader, Card, SectionTitle, EmptyState, Button } from '@/components/ui';
import { toast } from '@/components/toast';
import { useColors, fonts } from '@/theme';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const asRec = (r: unknown) => r as Record<string, number | null>;

export default function CircunferenciasScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const uid = user?.id;
  const { data: history = [], isLoading } = useBodyMeasurements(uid);
  const logM = useLogBodyMeasurement(uid);

  const [values, setValues] = useState<Record<string, string>>({});
  const setField = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const latest = history[0] ?? null;
  const prev = history[1] ?? null;
  const whr = latest ? waistHipRatio(latest.waist_cm, latest.hip_cm) : null;

  async function handleSave() {
    if (!uid || logM.isPending) return;
    const input: BodyMeasurementInput = {};
    let any = false;
    for (const f of BODY_MEASUREMENT_FIELDS) {
      const raw = values[f.key]?.trim();
      if (!raw) continue;
      const n = parseFloat(raw.replace(',', '.'));
      if (Number.isFinite(n)) {
        (input as Record<string, number>)[f.key] = n;
        any = true;
      }
    }
    if (!any) {
      toast.info('Preencha ao menos uma medida.');
      return;
    }
    try {
      await logM.mutateAsync(input);
      setValues({});
      toast.success('Medidas registradas.');
    } catch {
      toast.error('Não foi possível registrar agora.');
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Circunferências" subtitle="Fita métrica" back />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
      >
        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : latest ? (
          <Card className="gap-3">
            <View className="flex-row items-center gap-2">
              <Ruler size={16} color={colors.primary} />
              <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">
                Últimas medidas
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                {fmtDate(latest.measured_at)}
              </Text>
            </View>
            {whr != null ? (
              <View className="self-start rounded-full bg-surface-2 px-2.5 py-1">
                <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-fg-soft">
                  Relação cintura/quadril: {whr.toFixed(2).replace('.', ',')}
                </Text>
              </View>
            ) : null}
            <View className="flex-row flex-wrap" style={{ justifyContent: 'space-between', rowGap: 12 }}>
              {BODY_MEASUREMENT_FIELDS.map((f) => (
                <Cell
                  key={f.key}
                  field={f}
                  value={asRec(latest)[f.key]}
                  prevValue={prev ? asRec(prev)[f.key] : null}
                  colors={colors}
                />
              ))}
            </View>
          </Card>
        ) : (
          <EmptyState icon={Ruler} title="Nada registrado ainda" subtitle="Anote suas medidas abaixo." />
        )}

        <SectionTitle>Registrar medidas</SectionTitle>
        <Card className="gap-3">
          <View className="flex-row flex-wrap" style={{ justifyContent: 'space-between', rowGap: 12 }}>
            {BODY_MEASUREMENT_FIELDS.map((f) => (
              <View key={f.key} style={{ width: '47%' }}>
                <Text style={{ fontFamily: fonts.medium }} className="mb-1 text-[12px] text-muted">
                  {f.label} ({f.unit})
                </Text>
                <TextInput
                  value={values[f.key] ?? ''}
                  onChangeText={(v) => setField(f.key, v)}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.faint}
                  style={{ fontFamily: fonts.regular, borderCurve: 'continuous' }}
                  className="rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] text-fg"
                />
              </View>
            ))}
          </View>
          <Button
            label={logM.isPending ? 'Salvando…' : 'Salvar medidas'}
            icon={Ruler}
            variant="primary"
            onPress={handleSave}
            disabled={logM.isPending}
          />
          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">
            {BODY_DISCLAIMER}
          </Text>
        </Card>

        {history.length > 1 ? (
          <>
            <SectionTitle>Histórico</SectionTitle>
            <Card className="gap-1">
              {history.slice(0, 12).map((row, i) => (
                <View
                  key={row.id}
                  className={`flex-row items-center justify-between py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}
                >
                  <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                    {fmtDate(row.measured_at)}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                    {row.waist_cm != null ? `Cintura ${row.waist_cm.toFixed(1).replace('.', ',')} cm` : 'Registrado'}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Cell({
  field,
  value,
  prevValue,
  colors,
}: {
  field: BodyField;
  value: number | null | undefined;
  prevValue: number | null | undefined;
  colors: ReturnType<typeof useColors>;
}) {
  const delta =
    value != null && prevValue != null && Number.isFinite(value) && Number.isFinite(prevValue)
      ? value - prevValue
      : null;
  return (
    <View style={{ width: '47%' }}>
      <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted" numberOfLines={1}>
        {field.label}
      </Text>
      <View className="flex-row items-center gap-1">
        <Text style={{ fontFamily: fonts.bold }} className="text-[16px] text-fg">
          {formatBodyValue(value, field)}
        </Text>
        {delta != null && Math.abs(delta) >= 0.1 ? (
          <View className="flex-row items-center">
            {delta > 0 ? (
              <TrendingUp size={12} color={colors.faint} />
            ) : (
              <TrendingDown size={12} color={colors.faint} />
            )}
            <Text style={{ fontFamily: fonts.medium }} className="text-[10px] text-faint">
              {Math.abs(delta).toFixed(1).replace('.', ',')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
