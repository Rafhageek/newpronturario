import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown, ChevronUp, Info, ShieldCheck, Sparkles } from 'lucide-react-native';
import {
  AI_DISCLOSURE_BADGE,
  AI_DISCLOSURE_CTA,
  AI_DISCLOSURE_FIELDS,
  AI_DISCLOSURE_FULL,
  AI_DISCLOSURE_HUMAN_OVERSIGHT,
  AI_DISCLOSURE_NO_METADATA,
  AI_DISCLOSURE_NO_SOURCES,
  AI_DISCLOSURE_REFUSAL,
  AI_DISCLOSURE_REGULATION,
  AI_DISCLOSURE_TITLE,
  aiTaskLabel,
  type AiDisclosureMeta,
} from '@hubpatients/core';
import { Card } from '@/components/ui';
import { useColors, fonts } from '@/theme';

// Roxo de "máquina" — distinto do royal da marca e do azul de hidratação, lê
// claramente como "isto veio de um sistema automático".
const AI_ACCENT = '#7C3AED';

/**
 * Selo de transparência de IA (Resolução CFM nº 2.454/2026).
 *
 * Badge discreto + "Como isso foi gerado", que expande um painel com modelo,
 * versão do prompt, fontes citadas, data e o texto completo de disclosure.
 * Funciona SEM metadados: cada campo desconhecido vira "Não registrado" e o
 * texto genérico (estimativa, não é diagnóstico, direito de recusa) continua
 * aparecendo — o disclosure nunca depende de a telemetria ter chegado.
 */
export function AiDisclosure({
  taskType,
  modelId,
  promptVersion,
  sources,
  createdAt,
  note,
  className = '',
}: AiDisclosureMeta & {
  /** Contexto específico da tela (ex.: o que exatamente a IA fez aqui). */
  note?: string;
  className?: string;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const list = (sources ?? []).filter((s) => s.trim().length > 0);

  return (
    <View className={`gap-2 ${className}`}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${AI_DISCLOSURE_BADGE}. ${AI_DISCLOSURE_CTA}`}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        style={{ minHeight: 44 }}
        className="flex-row items-center gap-2 active:opacity-70"
      >
        <View
          style={{ backgroundColor: 'rgba(124,58,237,0.12)', borderCurve: 'continuous' }}
          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
        >
          <Sparkles size={13} color={AI_ACCENT} />
          <Text style={{ fontFamily: fonts.medium, color: AI_ACCENT }} className="text-[11px]">
            {AI_DISCLOSURE_BADGE}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.medium }} className="text-[11px] text-muted">
          {AI_DISCLOSURE_CTA}
        </Text>
        {open ? (
          <ChevronUp size={14} color={colors.faint} />
        ) : (
          <ChevronDown size={14} color={colors.faint} />
        )}
      </Pressable>

      {open ? (
        <Card className="gap-3">
          <View className="flex-row items-center gap-2">
            <Info size={15} color={AI_ACCENT} />
            <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
              {AI_DISCLOSURE_TITLE}
            </Text>
          </View>

          {note ? (
            <Text style={{ fontFamily: fonts.regular }} className="text-[13px] leading-5 text-fg-soft">
              {note}
            </Text>
          ) : null}

          <View className="gap-2 rounded-2xl bg-surface-2 px-3 py-2.5">
            <MetaRow label={AI_DISCLOSURE_FIELDS.task} value={aiTaskLabel(taskType)} />
            <MetaRow label={AI_DISCLOSURE_FIELDS.model} value={clean(modelId)} />
            <MetaRow label={AI_DISCLOSURE_FIELDS.promptVersion} value={clean(promptVersion)} />
            <MetaRow label={AI_DISCLOSURE_FIELDS.createdAt} value={formatDateTime(createdAt)} />
            <View className="gap-0.5">
              <Text
                style={{ fontFamily: fonts.semibold }}
                className="text-[10px] uppercase tracking-wide text-muted"
              >
                {AI_DISCLOSURE_FIELDS.sources}
              </Text>
              {list.length > 0 ? (
                list.map((s, i) => (
                  <View key={`${s}-${i}`} className="flex-row gap-1.5">
                    <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-5 text-primary">
                      •
                    </Text>
                    <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
                      {s}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-5 text-muted">
                  {AI_DISCLOSURE_NO_SOURCES}
                </Text>
              )}
            </View>
          </View>

          <Text style={{ fontFamily: fonts.regular }} className="text-[13px] leading-5 text-fg-soft">
            {AI_DISCLOSURE_FULL}
          </Text>

          <View className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-3 py-2.5">
            <ShieldCheck size={16} color={colors.primary} style={{ marginTop: 1 }} />
            <View className="flex-1 gap-1">
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-5 text-fg-soft">
                {AI_DISCLOSURE_REFUSAL}
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-5 text-fg-soft">
                {AI_DISCLOSURE_HUMAN_OVERSIGHT}
              </Text>
            </View>
          </View>

          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-faint">
            {AI_DISCLOSURE_REGULATION}
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text style={{ fontFamily: fonts.semibold }} className="text-[10px] uppercase tracking-wide text-muted">
        {label}
      </Text>
      <Text
        style={{ fontFamily: fonts.regular }}
        className={`flex-1 text-right text-[12px] ${value ? 'text-fg' : 'text-muted'}`}
      >
        {value ?? AI_DISCLOSURE_NO_METADATA}
      </Text>
    </View>
  );
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Data legível sem Intl relativo (Hermes): entrada inválida degrada para
 * "Não registrado" — nunca "Invalid Date".
 */
function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${date.toLocaleDateString('pt-BR')} às ${time}`;
}
