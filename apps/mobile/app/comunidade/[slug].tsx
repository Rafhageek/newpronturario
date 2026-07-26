import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MessagesSquare,
  Info,
  Plus,
  Send,
  MessageSquare,
  CheckCircle2,
  Pin,
} from 'lucide-react-native';
import { useForumCategory, useCategoryTopics, useForumMutations } from '@hubpatients/supabase';
import { FORUM_SORTS, CATEGORY_DISCLAIMER, detectContentRisk, type ForumSort } from '@hubpatients/core';
import type { FeedPost } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Input, Button, EmptyState, IconCircle } from '@/components/ui';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts } from '@/theme';

export default function CategoryScreen() {
  const colors = useColors();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { data: category, isLoading } = useForumCategory(slug);
  const [sort, setSort] = useState<ForumSort>('recent');
  const { data: topics } = useCategoryTopics(category?.id, sort);
  const forum = useForumMutations(userId);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [anon, setAnon] = useState(false);

  const risk = detectContentRisk(`${title}\n${body}`);
  const canSubmit = Boolean(title.trim() && body.trim()) && !risk.medSale;

  async function submit() {
    if (!category || !canSubmit) return;
    await forum.createTopic.mutateAsync({
      categoryId: category.id,
      groupId: category.group_id,
      title: title.trim(),
      content: body.trim(),
      isAnonymous: anon,
      tags: tags
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean)
        .slice(0, 5),
      needsReview: risk.posology || risk.crisis,
      reviewReason: risk.posology ? 'posologia' : risk.crisis ? 'crise' : null,
    });
    setTitle('');
    setBody('');
    setTags('');
    setAnon(false);
    setOpen(false);
  }

  const list = topics ?? [];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title={category?.name ?? 'Categoria'}
        subtitle="Comunidade"
        back
        icon={MessagesSquare}
      />
      <Screen>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !category ? (
          <EmptyState
            icon={MessagesSquare}
            title="Categoria não encontrada"
            subtitle="Volte à Comunidade e escolha outra categoria."
          />
        ) : (
          <>
            {category.description ? (
              <Text style={{ fontFamily: fonts.regular }} className="text-[13px] leading-5 text-muted">
                {category.description}
              </Text>
            ) : null}

            {/* Disclaimer da categoria (ContentGuardNotice) */}
            <View
              style={{ borderCurve: 'continuous' }}
              className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3"
            >
              <Info size={16} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
                {category.disclaimer ?? CATEGORY_DISCLAIMER}
              </Text>
            </View>

            {/* Novo tópico */}
            <Button
              label={open ? 'Fechar' : 'Novo tópico'}
              icon={Plus}
              onPress={() => setOpen((o) => !o)}
            />

            {open ? (
              <Card className="gap-3">
                <Input
                  label="Título"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Título do tópico"
                />
                <View className="gap-1.5">
                  <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
                    Mensagem
                  </Text>
                  <Input
                    value={body}
                    onChangeText={setBody}
                    placeholder="Compartilhe sua experiência, dúvida ou conquista…"
                    multiline
                    style={{ fontFamily: fonts.regular, minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }}
                    className="rounded-2xl border border-line bg-surface px-4 text-[15px] text-fg"
                  />
                </View>
                <Input
                  label="Tags"
                  value={tags}
                  onChangeText={setTags}
                  placeholder="Separe por vírgula — ex.: reabilitação, alimentação"
                  autoCapitalize="none"
                />

                {risk.messages.length > 0 ? (
                  <View
                    style={{ borderCurve: 'continuous' }}
                    className={`gap-1 rounded-2xl border px-3 py-2.5 ${
                      risk.medSale ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    {risk.messages.map((m, i) => (
                      <Text
                        key={i}
                        style={{ fontFamily: fonts.regular }}
                        className={`text-[12px] leading-5 ${risk.medSale ? 'text-rose-700' : 'text-amber-700'}`}
                      >
                        {m}
                      </Text>
                    ))}
                  </View>
                ) : null}

                <View className="flex-row items-center justify-end gap-2">
                  <Pressable
                    onPress={() => setAnon((v) => !v)}
                    style={{ borderCurve: 'continuous' }}
                    className={`h-10 justify-center rounded-xl border px-3 ${
                      anon ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface'
                    }`}
                  >
                    <Text
                      style={{ fontFamily: fonts.semibold }}
                      className={`text-[12px] ${anon ? 'text-primary' : 'text-muted'}`}
                    >
                      {anon ? 'Anônimo' : 'Anônimo?'}
                    </Text>
                  </Pressable>
                  <View className="flex-1">
                    <Button
                      label="Publicar"
                      icon={Send}
                      loading={forum.createTopic.isPending}
                      disabled={!canSubmit}
                      onPress={submit}
                    />
                  </View>
                </View>
              </Card>
            ) : null}

            {/* Ordenação */}
            <View className="flex-row flex-wrap gap-2">
              {FORUM_SORTS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => setSort(s.key)}
                  style={{ borderCurve: 'continuous' }}
                  className={`rounded-full border px-3 py-1.5 ${
                    sort === s.key ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface'
                  }`}
                >
                  <Text
                    style={{ fontFamily: fonts.semibold }}
                    className={`text-[12px] ${sort === s.key ? 'text-primary' : 'text-muted'}`}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Tópicos */}
            {list.length > 0 ? (
              <View className="gap-2.5">
                {list.map((t, i) => (
                  <FadeInItem key={t.id} index={i}>
                    <TopicRow
                      topic={t}
                      onPress={() => router.push(`/comunidade/t/${t.id}` as never)}
                    />
                  </FadeInItem>
                ))}
              </View>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="Nenhum tópico ainda"
                subtitle="Seja o primeiro a iniciar a conversa nesta categoria."
              />
            )}
          </>
        )}
      </Screen>
    </View>
  );
}

/* ──────────────────────────── Linha de tópico ──────────────────────────── */

function TopicRow({ topic, onPress }: { topic: FeedPost; onPress: () => void }) {
  const colors = useColors();
  return (
    <Card onPress={onPress} className="flex-row items-start gap-3">
      <IconCircle icon={MessageSquare} tone="primary" size={42} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {topic.is_pinned ? <Pin size={13} color={colors.attention} /> : null}
          {topic.is_solved ? <CheckCircle2 size={13} color={colors.accent} /> : null}
          <Text
            style={{ fontFamily: fonts.semibold }}
            numberOfLines={1}
            className="flex-1 text-[14px] text-fg"
          >
            {topic.title ?? topic.content.slice(0, 80)}
          </Text>
        </View>
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
