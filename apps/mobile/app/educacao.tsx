import { Fragment, useMemo, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import {
  GraduationCap,
  BookOpen,
  Clock,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from 'lucide-react-native';
import {
  useHealthContent,
  useConditions,
  useReadingList,
  useToggleReadingList,
} from '@hubpatients/supabase';
import { recommendContentByCids, isRelevant, lookupGlossary, GLOSSARY, type HealthContent } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Badge, EmptyState, IconCircle } from '@/components/ui';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts } from '@/theme';

// Regex de todos os termos do glossário (mais longos primeiro p/ casar melhor).
const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const TERM_REGEX = new RegExp(`\\b(${TERMS.map(escapeRegex).join('|')})\\b`, 'gi');

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type Tab = 'feed' | 'saved';

export default function EducacaoScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { data: content, isLoading } = useHealthContent();
  const { data: conditions } = useConditions(user?.id);
  const { data: readingIds } = useReadingList(user?.id);
  const toggleSave = useToggleReadingList(userId);

  const [tab, setTab] = useState<Tab>('feed');

  const userCids = useMemo(
    () => (conditions ?? []).map((c) => c.cid10_code ?? '').filter(Boolean),
    [conditions],
  );
  const ordered = useMemo(
    () => recommendContentByCids(content ?? [], userCids),
    [content, userCids],
  );

  const savedSet = useMemo(() => new Set(readingIds ?? []), [readingIds]);
  const saved = useMemo(() => ordered.filter((c) => savedSet.has(c.id)), [ordered, savedSet]);
  const shown = tab === 'saved' ? saved : ordered;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Educação"
        subtitle="Conteúdo confiável, personalizado para você"
        back
        icon={GraduationCap}
      />
      <Screen>
        {/* Abas */}
        <View
          style={{ borderCurve: 'continuous' }}
          className="flex-row self-start rounded-2xl border border-line bg-surface p-1"
        >
          <TabButton label="Para você" active={tab === 'feed'} onPress={() => setTab('feed')} />
          <TabButton
            label={`Salvos (${saved.length})`}
            active={tab === 'saved'}
            onPress={() => setTab('saved')}
          />
        </View>

        {isLoading ? null : shown.length > 0 ? (
          <View className="gap-3">
            {shown.map((c, i) => (
              <FadeInItem key={c.id} index={i}>
                <ContentCard
                  content={c}
                  saved={savedSet.has(c.id)}
                  relevant={tab === 'feed' && isRelevant(c, userCids)}
                  onToggleSave={() =>
                    toggleSave.mutate({ contentId: c.id, saved: savedSet.has(c.id) })
                  }
                />
              </FadeInItem>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={BookOpen}
            title={tab === 'saved' ? 'Nada salvo ainda' : 'Conteúdo em preparação'}
            subtitle={
              tab === 'saved'
                ? 'Toque no marcador de um conteúdo para salvá-lo e ler depois.'
                : 'Em breve, artigos confiáveis e revisados sobre saúde aqui.'
            }
          />
        )}

        <Text
          style={{ fontFamily: fonts.regular }}
          className="px-2 text-center text-[11px] leading-4 text-faint"
        >
          Conteúdo educativo de fontes confiáveis (MS, SBC, SBD, Fiocruz) — não substitui avaliação
          médica.
        </Text>
      </Screen>
    </View>
  );
}

/* ──────────────────────────── Aba ──────────────────────────── */

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ borderCurve: 'continuous' }}
      className={`rounded-xl px-4 py-1.5 ${active ? 'bg-trust-100' : ''}`}
    >
      <Text
        style={{ fontFamily: fonts.semibold }}
        className={`text-[13px] ${active ? 'text-primary' : 'text-muted'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ──────────────────────────── Card de conteúdo ──────────────────────────── */

function ContentCard({
  content,
  saved,
  relevant,
  onToggleSave,
}: {
  content: HealthContent;
  saved: boolean;
  relevant?: boolean;
  onToggleSave: () => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const tags = content.tags ?? [];

  return (
    <Card className="gap-3">
      <View className="flex-row items-start gap-3">
        <IconCircle icon={BookOpen} tone={relevant ? 'accent' : 'primary'} size={44} />
        <View className="min-w-0 flex-1">
          {relevant ? (
            <View
              style={{ borderCurve: 'continuous' }}
              className="mb-1 flex-row items-center gap-1 self-start rounded-full bg-health-300/30 px-2 py-0.5"
            >
              <Sparkles size={11} color={colors.accent} />
              <Text style={{ fontFamily: fonts.semibold }} className="text-[10px] text-health-600">
                Recomendado para você
              </Text>
            </View>
          ) : null}
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] leading-5 text-fg">
            {content.title}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Clock size={13} color={colors.faint} />
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
              {content.reading_minutes} min · {content.source}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onToggleSave}
          hitSlop={8}
          style={{ borderCurve: 'continuous' }}
          className="h-9 w-9 items-center justify-center rounded-xl active:bg-surface-2"
        >
          {saved ? (
            <BookmarkCheck size={20} color={colors.primary} />
          ) : (
            <Bookmark size={20} color={colors.faint} />
          )}
        </Pressable>
      </View>

      {tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {tags.slice(0, 4).map((t) => (
            <Badge key={t} tone="info">
              {t}
            </Badge>
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={() => setOpen((o) => !o)}
        hitSlop={6}
        className="flex-row items-center gap-1.5 self-start active:opacity-70"
      >
        <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-primary">
          {open ? 'Fechar' : 'Ler'}
        </Text>
        <ChevronDown
          size={16}
          color={colors.primary}
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </Pressable>

      {open ? (
        <FadeInItem>
          <View className="gap-3 border-t border-line pt-3">
            <GlossaryBody text={content.body} />
            {content.source_url ? (
              <Pressable
                onPress={() => {
                  if (content.source_url) Linking.openURL(content.source_url);
                }}
                hitSlop={6}
                className="flex-row items-center gap-1 self-start active:opacity-70"
              >
                <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-primary">
                  Fonte: {content.source}
                </Text>
                <ExternalLink size={12} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
        </FadeInItem>
      ) : null}
    </Card>
  );
}

/* ──────────────────────────── Corpo com glossário ──────────────────────────── */

/** Renderiza o corpo destacando termos do glossário; ao tocar, mostra a definição inline. */
function GlossaryBody({ text }: { text: string }) {
  const colors = useColors();
  const [active, setActive] = useState<string | null>(null);
  const parts = useMemo(() => text.split(TERM_REGEX), [text]);

  return (
    <View className="gap-2">
      <Text
        style={{ fontFamily: fonts.regular }}
        className="text-[14px] leading-6 text-fg-soft"
      >
        {parts.map((part, i) => {
          const def = lookupGlossary(part);
          if (!def) return <Fragment key={i}>{part}</Fragment>;
          const key = part.toLowerCase();
          return (
            <Text
              key={i}
              onPress={() => setActive((a) => (a === key ? null : key))}
              style={{ fontFamily: fonts.semibold }}
              className="text-primary underline"
            >
              {part}
            </Text>
          );
        })}
      </Text>

      {active ? (
        <View
          style={{ borderCurve: 'continuous' }}
          className="flex-row gap-2 rounded-2xl border border-trust-100 bg-trust-50 px-3 py-2"
        >
          <Sparkles size={14} color={colors.primary} style={{ marginTop: 1 }} />
          <Text
            style={{ fontFamily: fonts.regular }}
            className="flex-1 text-[12px] leading-5 text-fg-soft"
          >
            {lookupGlossary(active)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
