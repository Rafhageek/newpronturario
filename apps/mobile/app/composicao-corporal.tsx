import { useState } from 'react';
import { View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Scale, TrendingUp, TrendingDown } from 'lucide-react-native';
import {
  BODY_COMPOSITION_FIELDS,
  formatBodyValue,
  BODY_DISCLAIMER,
  type BodyField,
} from '@hubpatients/core';
import { useBodyComposition, useLogBodyComposition, type BodyCompositionInput } from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { AppHeader, Card, SectionTitle, EmptyState, Button } from '@/components/ui';
import { toast } from '@/components/toast';
import { useColors, fonts } from '@/theme';

const INT_FIELDS = new Set(['bmr_kcal']);

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function ComposicaoCorporalScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const uid = user?.id;
  const { data: history = [], isLoading } = useBodyComposition(uid);
  const logBody = useLogBodyComposition(uid);

  const [values, setValues] = useState<Record<string, string>>({});
  const setField = (key: string, v: string) => setValues((s) => ({ ...s, [key]: v }));

  const latest = history[0] ?? null;
  const prev = history[1] ?? null;

  async function handleSave() {
    if (!uid || logBody.isPending) return;
    const input: BodyCompositionInput = {};
    let any = false;
    for (const f of BODY_COMPOSITION_FIELDS) {
      const raw = values[f.key]?.trim();
      if (!raw) continue;
      const n = parseFloat(raw.replace(',', '.'));
      if (Number.isFinite(n)) {
        (input as Record<string, number>)[f.key] = INT_FIELDS.has(f.key) ? Math.round(n) : n;
        any = true;
      }
    }
    if (!any) {
      toast.info('Preencha ao menos um campo.');
      return;
    }
    try {
      await logBody.mutateAsync(input);
      setValues({});
      toast.success('Medição registrada.');
    } catch {
      toast.error('Não foi possível registrar agora.');
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Composição corporal" subtitle="Do que sua balança indica" back />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
      >
        {/* Snapshot mais recente */}
        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : latest ? (
          <Card className="gap-3">
            <View className="flex-row items-center gap-2">
              <Scale size={16} color={colors.primary} />
              <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">
                Última medição
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                {fmtDate(latest.measured_at)}
              </Text>
            </View>
            <View className="flex-row flex-wrap" style={{ justifyContent: 'space-between', rowGap: 12 }}>
              {BODY_COMPOSITION_FIELDS.map((f) => (
                <SnapshotCell
                  key={f.key}
                  field={f}
                  value={(latest as unknown as Record<string, number | null>)[f.key]}
                  prevValue={prev ? (prev as unknown as Record<string, number | null>)[f.key] : null}
                  colors={colors}
                />
              ))}
            </View>
          </Card>
        ) : (
          <EmptyState
            icon={Scale}
            title="Nada registrado ainda"
            subtitle="Preencha os campos abaixo com o que sua balança mostra."
          />
        )}

        {/* Formulário de nova medição */}
        <SectionTitle>Registrar medição</SectionTitle>
        <Card className="gap-3">
          <View className="flex-row flex-wrap" style={{ justifyContent: 'space-between', rowGap: 12 }}>
            {BODY_COMPOSITION_FIELDS.map((f) => (
              <View key={f.key} style={{ width: '47%' }}>
                <Text style={{ fontFamily: fonts.medium }} className="mb-1 text-[12px] text-muted">
                  {f.label}
                  {f.unit ? ` (${f.unit})` : ''}
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
            label={logBody.isPending ? 'Salvando…' : 'Salvar medição'}
            icon={Scale}
            variant="primary"
            onPress={handleSave}
            disabled={logBody.isPending}
          />
          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">
            {BODY_DISCLAIMER}
          </Text>
        </Card>

        {/* Histórico */}
        {history.length > 1 ? (
          <>
            <SectionTitle>Histórico</SectionTitle>
            <Card className="gap-1">
              {history.slice(0, 12).map((row, i) => (
                <View
                  key={row.id}
                  className={`flex-row items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}
                >
                  <View className="flex-1">
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                      {fmtDate(row.measured_at)}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                      {[
                        row.weight_kg != null ? `${row.weight_kg.toFixed(1).replace('.', ',')} kg` : null,
                        row.body_fat_pct != null ? `${row.body_fat_pct.toFixed(1).replace('.', ',')}% gordura` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Medição registrada'}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Célula do snapshot: valor + variação (fato, sem cor de bom/ruim). */
function SnapshotCell({
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
        {delta != null && Math.abs(delta) >= (field.decimals === 0 ? 1 : 0.1) ? (
          <View className="flex-row items-center">
            {delta > 0 ? (
              <TrendingUp size={12} color={colors.faint} />
            ) : (
              <TrendingDown size={12} color={colors.faint} />
            )}
            <Text style={{ fontFamily: fonts.medium }} className="text-[10px] text-faint">
              {Math.abs(delta).toFixed(field.decimals).replace('.', ',')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
