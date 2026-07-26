import { useMemo, useState, type ComponentType } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  MessagesSquare,
  Send,
  CheckCircle2,
  CornerDownRight,
  Stethoscope,
  Hash,
  Bell,
  BellOff,
  Star,
  Shield,
  ShieldCheck,
  Crown,
} from 'lucide-react-native';
import {
  useTopic,
  useThreadReplies,
  useFeedReactions,
  useForumMutations,
  useSocialMutations,
  useIsFollowingThread,
  useRealtimeThread,
} from '@hubpatients/supabase';
import {
  REACTIONS,
  CRISIS_NOTICE,
  STAFF_ROLE_LABELS,
  PROFESSIONAL_BADGE_LABELS,
} from '@hubpatients/core';
import type { FeedComment, FeedPost, PostReaction } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Input, Button, EmptyState } from '@/components/ui';
import { FadeInItem } from '@/components/motion';
import { Markdown } from '@/components/markdown';
import { useColors, fonts, type Palette } from '@/theme';

export default function RedeSocialTopicScreen() {
  const colors = useColors();
  const { id: topicId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { data: topic, isLoading } = useTopic(topicId);
  const { data: replies } = useThreadReplies(topicId);
  const { data: reactions } = useFeedReactions(null, topic ? [topic.id] : []);
  const forum = useForumMutations(userId, topicId);
  const social = useSocialMutations(userId, null);
  const { data: following } = useIsFollowingThread(topicId, user?.id);
  useRealtimeThread(topicId);

  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; who: string } | null>(null);

  // Árvore de respostas (1 nível): raízes + filhos por parent_comment_id.
  const { roots, childrenOf } = useMemo(() => {
    const items = replies ?? [];
    const childMap = new Map<string, FeedComment[]>();
    const top: FeedComment[] = [];
    for (const r of items) {
      if (r.parent_comment_id) {
        const arr = childMap.get(r.parent_comment_id) ?? [];
        arr.push(r);
        childMap.set(r.parent_comment_id, arr);
      } else {
        top.push(r);
      }
    }
    return { roots: top, childrenOf: childMap };
  }, [replies]);

  const canReply = Boolean(text.trim()) && !forum.reply.isPending;
  const canMarkBest = Boolean(topic && topic.author_id && topic.author_id === userId);
  const isFollowing = following ?? false;

  function toggleBest(commentId: string, makeBest: boolean) {
    forum.markBest.mutate(makeBest ? commentId : null);
  }

  async function submitReply() {
    if (!text.trim()) return;
    await forum.reply.mutateAsync({
      content: text.trim(),
      parentCommentId: replyTo?.id ?? null,
      isAnonymous: anon,
    });
    setText('');
    setReplyTo(null);
    setAnon(false);
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Tópico" subtitle="Fórum" back icon={MessagesSquare} />
      <Screen>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !topic ? (
          <EmptyState
            icon={MessagesSquare}
            title="Tópico não encontrado"
            subtitle="Ele pode ter sido removido. Volte ao fórum."
          />
        ) : (
          <>
            {/* Seguir tópico */}
            <View className="flex-row justify-end">
              <Pressable
                onPress={() => forum.follow.mutate(isFollowing)}
                disabled={forum.follow.isPending || !userId}
                accessibilityRole="button"
                accessibilityState={{ selected: isFollowing, disabled: forum.follow.isPending || !userId }}
                accessibilityLabel={isFollowing ? 'Seguindo este tópico. Toque para deixar de seguir.' : 'Seguir este tópico'}
                style={{ borderCurve: 'continuous' }}
                className={`flex-row items-center gap-1.5 rounded-xl border px-3 py-1.5 active:opacity-70 ${
                  isFollowing ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface'
                }`}
              >
                {isFollowing ? (
                  <BellOff size={14} color={colors.primary} />
                ) : (
                  <Bell size={14} color={colors.muted} />
                )}
                <Text
                  style={{ fontFamily: fonts.semibold }}
                  className={`text-[12px] ${isFollowing ? 'text-primary' : 'text-muted'}`}
                >
                  {isFollowing ? 'Seguindo' : 'Seguir tópico'}
                </Text>
              </Pressable>
            </View>

            <PostCard topic={topic} />

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
                      isBest={topic.best_comment_id === r.id}
                      canMarkBest={canMarkBest}
                      onReply={() => setReplyTo({ id: r.id, who: r.author_display })}
                      onToggleBest={toggleBest}
                    />
                    {(childrenOf.get(r.id) ?? []).map((c) => (
                      <View key={c.id} className="ml-5 mt-2 border-l border-line pl-3">
                        <ReplyCard
                          reply={c}
                          isBest={topic.best_comment_id === c.id}
                          canMarkBest={canMarkBest}
                          onReply={() => setReplyTo({ id: r.id, who: c.author_display })}
                          onToggleBest={toggleBest}
                        />
                      </View>
                    ))}
                  </FadeInItem>
                ))}
              </View>
            )}

            {/* Composer de resposta */}
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

/* ──────────────────────────── UserBadge ──────────────────────────── */
// Espelha apps/web <UserBadge>: precedência num único lugar — no máx. 2 chips,
// na ordem 1) staff 2) profissional 3) VIP. Cada chip = ícone + texto + label
// de acessibilidade (cor nunca é o único sinal).

type BadgeChip = {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  color: string;
  bg: string;
  aria: string;
};

function buildChips(
  c: Palette,
  staffRole?: string | null,
  professionalBadge?: string | null,
  professionalRegistry?: string | null,
  memberTier?: string | null,
): BadgeChip[] {
  const chips: BadgeChip[] = [];

  // 1) Cargo de equipe
  if (staffRole === 'admin') {
    chips.push({
      key: 'admin',
      label: STAFF_ROLE_LABELS.admin,
      icon: Shield,
      color: c.alert,
      bg: 'rgba(239,68,68,0.12)',
      aria: 'Administrador da comunidade',
    });
  } else if (staffRole === 'moderator') {
    chips.push({
      key: 'moderator',
      label: STAFF_ROLE_LABELS.moderator,
      icon: ShieldCheck,
      color: c.primary,
      bg: 'rgba(2,132,199,0.12)',
      aria: 'Moderador da comunidade',
    });
  }

  // 2) Verificação profissional (UI exibe só 'doctor' por enquanto)
  if (professionalBadge === 'doctor') {
    const label = professionalRegistry
      ? `${PROFESSIONAL_BADGE_LABELS.doctor} · ${professionalRegistry}`
      : PROFESSIONAL_BADGE_LABELS.doctor;
    chips.push({
      key: 'doctor',
      label,
      icon: Stethoscope,
      color: c.accent,
      bg: 'rgba(5,150,105,0.12)',
      aria: `${label}. Profissional com registro verificado — não substitui consulta.`,
    });
  }

  // 3) Membro VIP
  if (memberTier === 'vip') {
    chips.push({
      key: 'vip',
      label: 'VIP',
      icon: Crown,
      color: c.attention,
      bg: 'rgba(245,158,11,0.14)',
      aria: 'Membro VIP',
    });
  }

  return chips.slice(0, 2); // no máx. 2 badges
}

function UserBadge({
  staffRole,
  professionalBadge,
  professionalRegistry,
  memberTier,
}: {
  staffRole?: string | null;
  professionalBadge?: string | null;
  professionalRegistry?: string | null;
  memberTier?: string | null;
}) {
  const colors = useColors();
  const chips = buildChips(colors, staffRole, professionalBadge, professionalRegistry, memberTier);
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <View
            key={chip.key}
            accessible
            accessibilityLabel={chip.aria}
            style={{ backgroundColor: chip.bg, borderCurve: 'continuous' }}
            className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
          >
            <Icon size={11} color={chip.color} />
            <Text style={{ fontFamily: fonts.semibold, color: chip.color }} className="text-[10px]">
              {chip.label}
            </Text>
          </View>
        );
      })}
    </>
  );
}

/* ──────────────────────────── Post (tópico) ──────────────────────────── */

function PostCard({ topic }: { topic: FeedPost }) {
  const colors = useColors();
  const isDoctor = topic.author_professional_badge === 'doctor';
  const tags = topic.tags ?? [];
  return (
    <Card className="gap-3">
      <View className="flex-row items-start gap-2">
        {topic.is_solved ? <CheckCircle2 size={20} color={colors.accent} style={{ marginTop: 2 }} /> : null}
        <Text style={{ fontFamily: fonts.display }} className="flex-1 text-[19px] leading-6 text-fg">
          {topic.title ?? 'Tópico'}
        </Text>
      </View>

      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-fg-soft">
          {topic.author_display}
        </Text>
        <UserBadge
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
        <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-faint">
          Orientação geral de um profissional — não substitui consulta nem cria vínculo médico-paciente.
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
  isBest,
  canMarkBest,
  onReply,
  onToggleBest,
}: {
  reply: FeedComment;
  isBest: boolean;
  canMarkBest: boolean;
  onReply: () => void;
  onToggleBest: (commentId: string, makeBest: boolean) => void;
}) {
  const colors = useColors();
  const isDoctor = reply.author_professional_badge === 'doctor';
  return (
    <View
      style={{
        borderCurve: 'continuous',
        ...(isBest ? { backgroundColor: 'rgba(5,150,105,0.07)', borderColor: colors.accent } : null),
      }}
      className={`rounded-3xl border p-4 ${isBest ? '' : 'border-line bg-surface'}`}
    >
      <View className="flex-row flex-wrap items-center gap-1.5">
        <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-fg">
          {reply.author_display}
        </Text>
        <UserBadge
          staffRole={reply.author_staff_role}
          professionalBadge={reply.author_professional_badge}
          professionalRegistry={reply.author_professional_registry}
          memberTier={reply.author_member_tier}
        />
        {isBest ? (
          <View
            accessible
            accessibilityLabel="Marcada como melhor resposta"
            style={{ backgroundColor: 'rgba(5,150,105,0.12)', borderCurve: 'continuous' }}
            className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
          >
            <CheckCircle2 size={11} color={colors.accent} />
            <Text style={{ fontFamily: fonts.semibold, color: colors.accent }} className="text-[10px]">
              Melhor resposta
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-2">
        <Markdown>{reply.content}</Markdown>
      </View>

      {isDoctor ? (
        <Text style={{ fontFamily: fonts.regular }} className="mt-1 text-[11px] leading-4 text-faint">
          Orientação geral de um profissional — não substitui consulta.
        </Text>
      ) : null}

      <View className="mt-2 flex-row items-center gap-4">
        <Pressable
          onPress={onReply}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Responder a ${reply.author_display}`}
          className="flex-row items-center gap-1 active:opacity-70"
        >
          <CornerDownRight size={14} color={colors.muted} />
          <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
            Responder
          </Text>
        </Pressable>

        {canMarkBest ? (
          <Pressable
            onPress={() => onToggleBest(reply.id, !isBest)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ selected: isBest }}
            accessibilityLabel={isBest ? 'Desmarcar como melhor resposta' : 'Marcar como melhor resposta'}
            className="flex-row items-center gap-1 active:opacity-70"
          >
            <Star size={14} color={isBest ? colors.accent : colors.muted} />
            <Text
              style={{ fontFamily: fonts.medium, ...(isBest ? { color: colors.accent } : null) }}
              className={`text-[12px] ${isBest ? '' : 'text-muted'}`}
            >
              {isBest ? 'Melhor resposta' : 'Marcar como melhor'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
