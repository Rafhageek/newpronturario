import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  MessagesSquare,
  ShieldCheck,
  UserCog,
  Globe,
  Send,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react-native';
import {
  useSocialProfile,
  useUpsertSocialProfile,
  useTopics,
  useForumMutations,
} from '@hubpatients/supabase';
import { FORUM_SORTS, CRISIS_NOTICE, type ForumSort } from '@hubpatients/core';
import type { FeedPost } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Input, Button, EmptyState } from '@/components/ui';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts } from '@/theme';

export default function RedeSocialScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { data: profile } = useSocialProfile(user?.id);
  const [sort, setSort] = useState<ForumSort>('recent');
  const { data: topics, isLoading } = useTopics(null, sort);
  const forum = useForumMutations(userId, undefined);

  const list = topics ?? [];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Fórum"
        subtitle="Converse com outras pessoas — dúvidas, dicas e apoio"
        back
        icon={MessagesSquare}
      />
      <Screen>
        {/* Privacidade / disclaimer */}
        <View
          style={{ borderCurve: 'continuous' }}
          className="flex-row items-start gap-2.5 rounded-2xl border border-health-300/40 bg-health-300/10 px-4 py-3"
        >
          <ShieldCheck size={18} color={colors.accent} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
            O conteúdo do fórum vem de outras pessoas e não é orientação médica. Você escolhe como aparecer —
            nada de dados clínicos sensíveis de terceiros.
          </Text>
        </View>

        {/* Perfil público (recolhível) */}
        <ProfileEditor userId={userId} profile={profile ?? null} />

        {/* Novo tópico */}
        <ForumComposer
          pending={forum.createTopic.isPending}
          onSubmit={async (input) => {
            await forum.createTopic.mutateAsync({ groupId: null, ...input });
          }}
        />

        {/* Abas de ordenação */}
        <View className="flex-row flex-wrap gap-1.5">
          {FORUM_SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSort(s.key)}
                style={{ borderCurve: 'continuous' }}
                className={`rounded-full border px-3 py-1.5 ${
                  active ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface'
                }`}
              >
                <Text
                  style={{ fontFamily: fonts.semibold }}
                  className={`text-[12px] ${active ? 'text-primary' : 'text-muted'}`}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Lista de tópicos */}
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title={sort === 'recent' ? 'Nenhum tópico ainda' : 'Nada por aqui'}
            subtitle={
              sort === 'recent'
                ? 'Seja o primeiro a abrir um tópico no fórum.'
                : 'Tente outra ordenação para ver mais tópicos.'
            }
          />
        ) : (
          <View className="gap-2.5">
            {list.map((t, i) => (
              <FadeInItem key={t.id} index={i}>
                <TopicRow
                  topic={t}
                  onPress={() => router.push(`/rede-social/${t.id}` as never)}
                />
              </FadeInItem>
            ))}
          </View>
        )}

        {/* Disclaimer permanente */}
        <Text
          style={{ fontFamily: fonts.regular }}
          className="px-2 text-center text-[11px] leading-4 text-faint"
        >
          {CRISIS_NOTICE}
        </Text>
      </Screen>
    </View>
  );
}

/* ──────────────────────────── Editor de perfil público ──────────────────────────── */

function ProfileEditor({
  userId,
  profile,
}: {
  userId: string;
  profile: { display_name: string | null; bio: string | null } | null;
}) {
  const colors = useColors();
  const upsert = useUpsertSocialProfile(userId);
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');

  const canSave = Boolean(userId) && !upsert.isPending;

  async function save() {
    if (!canSave) return;
    await upsert.mutateAsync({
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
    });
    setOpen(false);
  }

  return (
    <Card className="gap-0">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-2.5 active:opacity-70"
      >
        <UserCog size={18} color={colors.primary} />
        <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg-soft">
          Editar meu perfil público
        </Text>
        {open ? (
          <ChevronUp size={18} color={colors.faint} />
        ) : (
          <ChevronDown size={18} color={colors.faint} />
        )}
      </Pressable>

      {open ? (
        <View className="mt-3 gap-3 border-t border-line pt-3">
          <View className="flex-row items-center gap-2">
            <Globe size={16} color={colors.primary} />
            <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-fg">
              Perfil público
            </Text>
          </View>

          <Input
            label="Nome de exibição"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Como quer aparecer no fórum"
            autoCapitalize="words"
          />
          <Input
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Uma frase sobre você (sem dados de saúde)"
          />

          <Button
            label="Salvar"
            loading={upsert.isPending}
            disabled={!canSave}
            onPress={save}
          />
        </View>
      ) : null}
    </Card>
  );
}

/* ──────────────────────────── Composer de novo tópico ──────────────────────────── */

function ForumComposer({
  onSubmit,
  pending,
}: {
  onSubmit: (input: { title: string; content: string; isAnonymous: boolean }) => Promise<void>;
  pending?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [anon, setAnon] = useState(false);

  const canSubmit = title.trim().length >= 3 && content.trim().length >= 1 && !pending;

  async function submit() {
    if (!canSubmit) return;
    await onSubmit({ title: title.trim(), content: content.trim(), isAnonymous: anon });
    setTitle('');
    setContent('');
    setAnon(false);
  }

  return (
    <Card className="gap-3">
      <Input
        value={title}
        onChangeText={setTitle}
        placeholder="Título do tópico — ex.: Como organizam os horários dos remédios?"
        style={{ fontFamily: fonts.medium }}
      />
      <Input
        value={content}
        onChangeText={setContent}
        placeholder="Compartilhe com cuidado… (nada de dados clínicos sensíveis de terceiros)"
        multiline
        style={{ fontFamily: fonts.regular, minHeight: 84, textAlignVertical: 'top', paddingTop: 12 }}
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
            label="Abrir tópico"
            icon={Send}
            loading={pending}
            disabled={!canSubmit}
            onPress={submit}
          />
        </View>
      </View>
    </Card>
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
