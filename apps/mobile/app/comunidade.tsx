import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import {
  MessagesSquare,
  ShieldCheck,
  Search,
  Hash,
  TrendingUp,
  MessageSquare,
  ChevronRight,
  Stethoscope,
  BookText,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useForumCategories, useTrendingTags, useForumSearch } from '@hubpatients/supabase';
import type { FeedPost, ForumCategoryStat } from '@hubpatients/core';
import { Screen, AppHeader, Card, EmptyState, IconCircle } from '@/components/ui';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts } from '@/theme';

export default function ComunidadeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: categories } = useForumCategories();
  const { data: trending } = useTrendingTags();
  const [query, setQuery] = useState('');
  const { data: results, isFetching } = useForumSearch(query);
  const searching = query.trim().length >= 2;

  const { themes, conditions } = useMemo(() => {
    const list = categories ?? [];
    return {
      themes: list.filter((c) => c.kind === 'theme'),
      conditions: list.filter((c) => c.kind === 'condition'),
    };
  }, [categories]);

  const tags = trending ?? [];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Comunidade"
        subtitle="Apoio entre quem vive a mesma condição"
        back
        icon={MessagesSquare}
      />
      <Screen>
        {/* Acessos: Médicos e Regras */}
        <View className="flex-row gap-2.5">
          <HeaderLink
            icon={Stethoscope}
            label="Médicos"
            onPress={() => router.push('/comunidade/medicos' as never)}
          />
          <HeaderLink
            icon={BookText}
            label="Regras"
            onPress={() => router.push('/comunidade/regras' as never)}
          />
        </View>

        {/* Privacidade */}
        <View
          style={{ borderCurve: 'continuous' }}
          className="flex-row items-start gap-2.5 rounded-2xl border border-health-300/40 bg-health-300/10 px-4 py-3"
        >
          <ShieldCheck size={18} color={colors.accent} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
            Sua identidade real nunca é exposta. Você escolhe postar com pseudônimo ou de forma anônima —
            relatos são experiências pessoais, não orientação médica.
          </Text>
        </View>

        {/* Busca */}
        <View
          style={{ borderCurve: 'continuous' }}
          className="h-12 flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3.5"
        >
          <Search size={18} color={colors.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar tópicos por título ou conteúdo…"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            style={{ fontFamily: fonts.regular }}
            className="h-12 flex-1 text-[15px] text-fg"
          />
        </View>

        {searching ? (
          <View className="gap-2.5">
            <Text style={{ fontFamily: fonts.semibold }} className="text-[11px] uppercase tracking-wider text-faint">
              {isFetching ? 'Buscando…' : `${results?.length ?? 0} resultado(s)`}
            </Text>
            {(results ?? []).map((t, i) => (
              <FadeInItem key={t.id} index={i}>
                <TopicRow topic={t} onPress={() => router.push(`/comunidade/t/${t.id}` as never)} />
              </FadeInItem>
            ))}
            {!isFetching && (results?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Search}
                title="Nada encontrado"
                subtitle={`Nenhum tópico para “${query.trim()}”.`}
              />
            ) : null}
          </View>
        ) : (
          <>
            <CategorySection
              title="Temas"
              items={themes}
              onOpen={(slug) => router.push(`/comunidade/${slug}` as never)}
            />
            <CategorySection
              title="Por condição"
              items={conditions}
              onOpen={(slug) => router.push(`/comunidade/${slug}` as never)}
            />

            {/* Em alta */}
            <Card className="gap-2">
              <View className="flex-row items-center gap-1.5">
                <TrendingUp size={16} color={colors.primary} />
                <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
                  Em alta
                </Text>
              </View>
              {tags.length === 0 ? (
                <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                  As tags mais usadas aparecem aqui.
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <View
                      key={t.tag}
                      style={{ borderCurve: 'continuous' }}
                      className="flex-row items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1"
                    >
                      <Hash size={11} color={colors.muted} />
                      <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-fg-soft">
                        {t.tag}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-faint">
                        {t.uses}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}

        {/* Disclaimer permanente */}
        <Text
          style={{ fontFamily: fonts.regular }}
          className="px-2 text-center text-[11px] leading-4 text-faint"
        >
          Espaço de apoio e troca de experiências. Relatos de pessoas não substituem orientação médica.
        </Text>
      </Screen>
    </View>
  );
}

/* ──────────────────────────── Acesso rápido (Médicos/Regras) ──────────────────────────── */

function HeaderLink({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ borderCurve: 'continuous' }}
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-2.5 active:bg-surface-2"
    >
      <Icon size={16} color={colors.primary} />
      <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-fg-soft">
        {label}
      </Text>
    </Pressable>
  );
}

/* ──────────────────────────── Seção de categorias ──────────────────────────── */

function CategorySection({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: ForumCategoryStat[];
  onOpen: (slug: string) => void;
}) {
  const colors = useColors();
  if (items.length === 0) return null;
  return (
    <View className="gap-2">
      <Text style={{ fontFamily: fonts.semibold }} className="text-[11px] uppercase tracking-wider text-faint">
        {title}
      </Text>
      <Card className="gap-0.5">
        {items.map((c, i) => (
          <View key={c.category_id}>
            {i > 0 ? <View className="h-px bg-line" /> : null}
            <Pressable
              onPress={() => onOpen(c.slug)}
              style={{ borderCurve: 'continuous' }}
              className="flex-row items-center gap-3 rounded-2xl px-1 py-2.5 active:bg-surface-2"
            >
              <IconCircle icon={Hash} tone="primary" size={42} />
              <View className="min-w-0 flex-1">
                <Text
                  style={{ fontFamily: fonts.semibold }}
                  numberOfLines={1}
                  className="text-[15px] text-fg"
                >
                  {c.name}
                </Text>
                {c.description ? (
                  <Text
                    style={{ fontFamily: fonts.regular }}
                    numberOfLines={1}
                    className="text-[12px] text-muted"
                  >
                    {c.description}
                  </Text>
                ) : null}
                <View className="mt-0.5 flex-row items-center gap-1">
                  <MessageSquare size={12} color={colors.faint} />
                  <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-faint">
                    {c.topic_count} tópico(s)
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.faint} />
            </Pressable>
          </View>
        ))}
      </Card>
    </View>
  );
}

/* ──────────────────────────── Linha de tópico ──────────────────────────── */

function TopicRow({ topic, onPress }: { topic: FeedPost; onPress: () => void }) {
  const colors = useColors();
  const initial = (topic.author_display.charAt(0) || '?').toUpperCase();
  return (
    <Card onPress={onPress} className="flex-row items-start gap-3">
      <View
        style={{ borderCurve: 'continuous' }}
        className="h-9 w-9 items-center justify-center rounded-2xl bg-trust-100"
      >
        <Text style={{ fontFamily: fonts.bold }} className="text-[14px] text-primary">
          {initial}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text style={{ fontFamily: fonts.semibold }} numberOfLines={1} className="text-[14px] text-fg">
          {topic.title ?? topic.content.slice(0, 80)}
        </Text>
        <Text style={{ fontFamily: fonts.regular }} numberOfLines={1} className="text-[12px] text-muted">
          {topic.content}
        </Text>
        <Text style={{ fontFamily: fonts.regular }} className="mt-0.5 text-[11px] text-faint">
          {topic.author_display}
        </Text>
      </View>
      <View className="flex-row items-center gap-1">
        <MessageSquare size={13} color={colors.faint} />
        <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
          {topic.reply_count}
        </Text>
      </View>
    </Card>
  );
}
