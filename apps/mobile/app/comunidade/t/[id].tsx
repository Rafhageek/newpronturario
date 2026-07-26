import { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  MessagesSquare,
  Send,
  CheckCircle2,
  CornerDownRight,
  Star,
  Lock,
  Hash,
  Bell,
  BellOff,
} from 'lucide-react-native';
import {
  useTopic,
  useThreadReplies,
  useFeedReactions,
  useUsefulMarks,
  useForumMutations,
  useSocialMutations,
  useIsFollowingThread,
  useRealtimeThread,
} from '@hubpatients/supabase';
import { REACTIONS, CRISIS_NOTICE, PROFESSIONAL_DISCLAIMER, detectContentRisk } from '@hubpatients/core';
import type { FeedComment, FeedPost, PostReaction } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Input, Button, EmptyState, Badge } from '@/components/ui';
import { FadeInItem } from '@/components/motion';
import { Markdown } from '@/components/markdown';
import { toast } from '@/components/toast';
import { useColors, fonts } from '@/theme';
import { UserBadge } from '../u/[id]';

export default function TopicScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id: topicId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { data: topic, isLoading } = useTopic(topicId);
  const { data: replies } = useThreadReplies(topicId);
  const { data: reactions } = useFeedReactions(null, topic ? [topic.id] : []);
  const { data: usefulMarks } = useUsefulMarks(topicId);
  const { data: following } = useIsFollowingThread(topicId, user?.id);
  const forum = useForumMutations(userId, topicId);
  const social = useSocialMutations(userId, null);
  useRealtimeThread(topicId);

  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; who: string } | null>(null);

  const usefulSet = useMemo(
    () => new Set((usefulMarks ?? []).map((m) => m.comment_id)),
    [usefulMarks],
  );

  const { roots, childrenOf } = useMemo(() => {
    const items = replies ?? [];
    const childMap = new Map<string, FeedComment[]>();
    const top: FeedComment[] = [];
    for (const r of items) {
      if (r.parent_comment_id) {
        const a = childMap.get(r.parent_comment_id) ?? [];
        a.push(r);
        childMap.set(r.parent_comment_id, a);
      } else {
        top.push(r);
      }
    }
    return { roots: top, childrenOf: childMap };
  }, [replies]);

  const canMark = Boolean(topic && topic.author_id && topic.author_id === userId);
  const locked = topic?.is_locked ?? false;
  const replyRisk = detectContentRisk(text);
  const canReply = Boolean(text.trim()) && !replyRisk.medSale;

  function toggleUseful(commentId: string, makeUseful: boolean) {
    if (makeUseful) forum.markUseful.mutate(commentId);
    else forum.unmarkUseful.mutate(commentId);
  }

  const isFollowing = following ?? false;
  function toggleFollow() {
    forum.follow.mutate(isFollowing, {
      onSuccess: () =>
        isFollowing ? toast.info('Você deixou de seguir o tópico.') : toast.success('Seguindo o tópico — você será avisado de novas respostas.'),
    });
  }

  function openAuthor(authorId: string | null) {
    if (authorId) router.push(`/comunidade/u/${authorId}` as never);
  }

  async function submitReply() {
    if (!canReply) return;
    await forum.reply.mutateAsync({
      content: text.trim(),
      parentCommentId: replyTo?.id ?? null,
      isAnonymous: anon,
      needsReview: replyRisk.posology || replyRisk.crisis,
      reviewReason: replyRisk.posology ? 'posologia' : replyRisk.crisis ? 'crise' : null,
    });
    setText('');
    setReplyTo(null);
    setAnon(false);
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Tópico"
        subtitle="Comunidade"
        back
        icon={MessagesSquare}
        right={
          topic ? (
            <Pressable
              onPress={toggleFollow}
              disabled={forum.follow.isPending}
              accessibilityRole="button"
              accessibilityLabel={isFollowing ? 'Deixar de seguir o tópico' : 'Seguir tópico'}
              hitSlop={6}
              style={{ borderCurve: 'continuous' }}
              className={`h-10 flex-row items-center gap-1.5 rounded-2xl border px-3 active:opacity-70 ${
                isFollowing ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface'
              }`}
            >
              {isFollowing ? (
                <BellOff size={15} color={colors.primary} />
              ) : (
                <Bell size={15} color={colors.muted} />
              )}
              <Text
                style={{ fontFamily: fonts.semibold }}
                className={`text-[12px] ${isFollowing ? 'text-primary' : 'text-muted'}`}
              >
                {isFollowing ? 'Seguindo' : 'Seguir'}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      <Screen>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !topic ? (
          <EmptyState
            icon={MessagesSquare}
            title="Tópico não encontrado"
            subtitle="Ele pode ter sido removido. Volte à Comunidade."
          />
        ) : (
          <>
            <PostCard topic={topic} onAuthor={openAuthor} />

            {/* Reações */}
            <ReactionBar
              reactions={reactions ?? []}
              userId={userId}
              onReact={(emoji) => social.react.mutate({ postId: topic.id, emoji })}
            />

            {/* Respostas */}
            <Text style={{ fontFamily: fonts.display }} className="mt-1 text-[15px] text-fg">
              Respostas ({topic.reply_count})
            </Text>

            {roots.length === 0 ? (
              <EmptyState
                icon={CornerDownRight}
                title="Sem respostas ainda"
                subtitle="Seja o primeiro a responder com acolhimento."
              />
            ) : (
              <View className="gap-2.5">
                {roots.map((r, i) => (
                  <FadeInItem key={r.id} index={i}>
                    <ReplyCard
                      reply={r}
                      isUseful={usefulSet.has(r.id)}
                      canMark={canMark}
                      onReply={() => setReplyTo({ id: r.id, who: r.author_display })}
                      onToggleUseful={toggleUseful}
                      onAuthor={openAuthor}
                    />
                    {(childrenOf.get(r.id) ?? []).map((c) => (
                      <View key={c.id} className="ml-5 mt-2 border-l border-line pl-3">
                        <ReplyCard
                          reply={c}
                          isUseful={usefulSet.has(c.id)}
                          canMark={canMark}
                          onReply={() => setReplyTo({ id: r.id, who: c.author_display })}
                          onToggleUseful={toggleUseful}
                          onAuthor={openAuthor}
                        />
                      </View>
                    ))}
                  </FadeInItem>
                ))}
              </View>
            )}

            {/* Composer */}
            {locked ? (
              <View
                style={{ borderCurve: 'continuous' }}
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 py-4"
              >
                <Lock size={16} color={colors.muted} />
                <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-muted">
                  Tópico trancado para novas respostas.
                </Text>
              </View>
            ) : (
              <Card className="gap-3">
                {replyTo ? (
                  <View className="flex-row items-center justify-between">
                    <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                      Respondendo a{' '}
                      <Text style={{ fontFamily: fonts.semibold }} className="text-fg">
                        {replyTo.who}
                      </Text>
                    </Text>
                    <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                      <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-primary">
                        cancelar
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <Input
                  value={text}
                  onChangeText={setText}
                  placeholder="Escreva uma resposta…"
                  multiline
                  style={{ fontFamily: fonts.regular, minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }}
                  className="rounded-2xl border border-line bg-surface px-4 text-[15px] text-fg"
                />

                {replyRisk.messages.length > 0 ? (
                  <View
                    style={{ borderCurve: 'continuous' }}
                    className={`gap-1 rounded-2xl border px-3 py-2.5 ${
                      replyRisk.medSale ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    {replyRisk.messages.map((m, i) => (
                      <Text
                        key={i}
                        style={{ fontFamily: fonts.regular }}
                        className={`text-[12px] leading-5 ${replyRisk.medSale ? 'text-rose-700' : 'text-amber-700'}`}
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
                      label="Responder"
                      icon={Send}
                      loading={forum.reply.isPending}
                      disabled={!canReply}
                      onPress={submitReply}
                    />
                  </View>
                </View>
              </Card>
            )}

            <Text
              style={{ fontFamily: fonts.regular }}
              className="px-2 text-center text-[11px] leading-4 text-faint"
            >
              {CRISIS_NOTICE}
            </Text>
          </>
        )}
      </Screen>
    </View>
  );
}

/* ──────────────────────────── Nome do autor ──────────────────────────── */

/**
 * Nome do autor: vira link para o perfil público quando há author_id (não
 * anônimo). Anônimos/sem id ficam como texto simples.
 */
function AuthorName({
  name,
  authorId,
  onAuthor,
}: {
  name: string;
  authorId: string | null;
  onAuthor: (authorId: string | null) => void;
}) {
  if (!authorId) {
    return (
      <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-fg-soft">
        {name}
      </Text>
    );
  }
  return (
    <Pressable
      onPress={() => onAuthor(authorId)}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel={`Ver perfil de ${name}`}
      className="active:opacity-70"
    >
      <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-primary">
        {name}
      </Text>
    </Pressable>
  );
}

/* ──────────────────────────── Post (tópico) ──────────────────────────── */

function PostCard({ topic, onAuthor }: { topic: FeedPost; onAuthor: (authorId: string | null) => void }) {
  const colors = useColors();
  const isDoctor = topic.author_professional_badge === 'doctor';
  const tags = topic.tags ?? [];
  const authorId = topic.author_id;
  return (
    <Card className="gap-3">
      <View className="flex-row items-start gap-2">
        {topic.is_solved ? <CheckCircle2 size={20} color={colors.accent} style={{ marginTop: 2 }} /> : null}
        <Text style={{ fontFamily: fonts.display }} className="flex-1 text-[19px] leading-6 text-fg">
          {topic.title ?? 'Tópico'}
        </Text>
      </View>

      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <AuthorName name={topic.author_display} authorId={authorId} onAuthor={onAuthor} />
        <UserBadge
          inline
          staffRole={topic.author_staff_role}
          professionalBadge={topic.author_professional_badge}
          professionalRegistry={topic.author_professional_registry}
          memberTier={topic.author_member_tier}
        />
        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-faint">
          · {topic.reply_count} resposta(s)
        </Text>
      </View>

      <Markdown>{topic.content}</Markdown>

      {isDoctor ? (
        <Text style={{ fontFamily: fonts.regular }} className="border-t border-line/60 pt-2 text-[11px] leading-4 text-faint">
          {PROFESSIONAL_DISCLAIMER}
        </Text>
      ) : null}

      {tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {tags.map((t) => (
            <View
              key={t}
              style={{ borderCurve: 'continuous' }}
              className="flex-row items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5"
            >
              <Hash size={10} color={colors.muted} />
              <Text style={{ fontFamily: fonts.medium }} className="text-[11px] text-fg-soft">
                {t}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/* ──────────────────────────── Barra de reações ──────────────────────────── */

function ReactionBar({
  reactions,
  userId,
  onReact,
}: {
  reactions: PostReaction[];
  userId: string;
  onReact: (emoji: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {REACTIONS.map((r) => {
        const count = reactions.filter((x) => x.emoji === r.emoji).length;
        const mine = reactions.some((x) => x.emoji === r.emoji && x.user_id === userId);
        return (
          <Pressable
            key={r.emoji}
            onPress={() => onReact(r.emoji)}
            style={{ borderCurve: 'continuous' }}
            className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 active:opacity-70 ${
              mine ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface'
            }`}
          >
            <Text className="text-[14px]">{r.emoji}</Text>
            {count > 0 ? (
              <Text
                style={{ fontFamily: fonts.semibold }}
                className={`text-[12px] ${mine ? 'text-primary' : 'text-muted'}`}
              >
                {count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ──────────────────────────── Resposta ──────────────────────────── */

function ReplyCard({
  reply,
  isUseful,
  canMark,
  onReply,
  onToggleUseful,
  onAuthor,
}: {
  reply: FeedComment;
  isUseful: boolean;
  canMark: boolean;
  onReply: () => void;
  onToggleUseful: (commentId: string, makeUseful: boolean) => void;
  onAuthor: (authorId: string | null) => void;
}) {
  const colors = useColors();
  const isDoctor = reply.author_professional_badge === 'doctor';
  return (
    <View
      style={{ borderCurve: 'continuous' }}
      className={`rounded-3xl border p-4 ${
        isUseful ? 'border-health-300/50 bg-health-300/10' : 'border-line bg-surface'
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row flex-wrap items-center gap-1.5">
          <AuthorName name={reply.author_display} authorId={reply.author_id} onAuthor={onAuthor} />
          <UserBadge
            inline
            staffRole={reply.author_staff_role}
            professionalBadge={reply.author_professional_badge}
            professionalRegistry={reply.author_professional_registry}
            memberTier={reply.author_member_tier}
          />
          {isUseful ? <Badge tone="ok">Útil</Badge> : null}
        </View>
      </View>

      <View className="mt-2">
        <Markdown>{reply.content}</Markdown>
      </View>

      {isDoctor ? (
        <Text style={{ fontFamily: fonts.regular }} className="mt-2 border-t border-line/60 pt-2 text-[11px] leading-4 text-faint">
          {PROFESSIONAL_DISCLAIMER}
        </Text>
      ) : null}

      <View className="mt-2 flex-row items-center gap-4">
        <Pressable onPress={onReply} hitSlop={6} className="flex-row items-center gap-1 active:opacity-70">
          <CornerDownRight size={14} color={colors.muted} />
          <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
            Responder
          </Text>
        </Pressable>
        {canMark ? (
          <Pressable
            onPress={() => onToggleUseful(reply.id, !isUseful)}
            hitSlop={6}
            className="flex-row items-center gap-1 active:opacity-70"
          >
            <Star size={14} color={isUseful ? colors.accent : colors.muted} />
            <Text
              style={{ fontFamily: fonts.medium }}
              className={`text-[12px] ${isUseful ? 'text-accent' : 'text-muted'}`}
            >
              {isUseful ? 'Desmarcar útil' : 'Marcar como útil'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
