import type {
  CommunityGroup,
  FeedComment,
  FeedPost,
  Poll,
  PollVote,
  PostReaction,
  SocialProfile,
  UpdateRow,
} from '@vidalog/core';
import type { VidaLogClient } from '../types';

// ── Grupos ──────────────────────────────────────────────────────────────────
export async function listGroups(client: VidaLogClient): Promise<CommunityGroup[]> {
  const { data, error } = await client.from('community_groups').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

// ── Feed (via view feed_posts — autor oculto em anônimos) ────────────────────
export async function listFeed(
  client: VidaLogClient,
  groupId: string | null,
  limit = 50,
): Promise<FeedPost[]> {
  let query = client.from('feed_posts').select('*').order('created_at', { ascending: false }).limit(limit);
  query = groupId ? query.eq('group_id', groupId) : query.is('group_id', null);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export interface NewPost {
  groupId: string | null;
  content: string;
  flair: string | null;
  isAnonymous: boolean;
  isAchievement: boolean;
  poll?: { question: string; options: string[] };
}

export async function createPost(client: VidaLogClient, authorId: string, input: NewPost): Promise<string> {
  const { data, error } = await client
    .from('posts')
    .insert({
      group_id: input.groupId,
      author_id: authorId,
      content: input.content,
      flair: input.flair,
      is_anonymous: input.isAnonymous,
      is_achievement: input.isAchievement,
    })
    .select('id')
    .single();
  if (error) throw error;
  if (input.poll && input.poll.options.length >= 2) {
    await client.from('polls').insert({ post_id: data.id, question: input.poll.question, options: input.poll.options });
  }
  return data.id;
}

export async function deletePost(client: VidaLogClient, postId: string): Promise<void> {
  const { error } = await client.from('posts').delete().eq('id', postId);
  if (error) throw error;
}

// ── Reações ─────────────────────────────────────────────────────────────────
export async function listReactionsFor(client: VidaLogClient, postIds: string[]): Promise<PostReaction[]> {
  if (postIds.length === 0) return [];
  const { data, error } = await client.from('post_reactions').select('*').in('post_id', postIds);
  if (error) throw error;
  return data ?? [];
}

export async function toggleReaction(
  client: VidaLogClient,
  postId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const { data: existing } = await client
    .from('post_reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();
  if (existing) {
    await client.from('post_reactions').delete().eq('id', existing.id);
  } else {
    await client.from('post_reactions').insert({ post_id: postId, user_id: userId, emoji });
  }
}

// ── Comentários ─────────────────────────────────────────────────────────────
export async function listComments(client: VidaLogClient, postId: string): Promise<FeedComment[]> {
  // Lê da VIEW feed_comments (oculta author_id em comentários anônimos).
  const { data, error } = await client
    .from('feed_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createComment(
  client: VidaLogClient,
  postId: string,
  authorId: string,
  content: string,
  isAnonymous: boolean,
): Promise<void> {
  const { error } = await client
    .from('post_comments')
    .insert({ post_id: postId, author_id: authorId, content, is_anonymous: isAnonymous });
  if (error) throw error;
}

// ── Enquetes ────────────────────────────────────────────────────────────────
export async function getPolls(client: VidaLogClient, postIds: string[]): Promise<Poll[]> {
  if (postIds.length === 0) return [];
  const { data, error } = await client.from('polls').select('*').in('post_id', postIds);
  if (error) throw error;
  return data ?? [];
}

export async function listPollVotes(client: VidaLogClient, pollIds: string[]): Promise<PollVote[]> {
  if (pollIds.length === 0) return [];
  const { data, error } = await client.from('poll_votes').select('*').in('poll_id', pollIds);
  if (error) throw error;
  return data ?? [];
}

export async function votePoll(
  client: VidaLogClient,
  pollId: string,
  userId: string,
  optionIndex: number,
): Promise<void> {
  const { error } = await client
    .from('poll_votes')
    .upsert({ poll_id: pollId, user_id: userId, option_index: optionIndex }, { onConflict: 'poll_id,user_id' });
  if (error) throw error;
}

// ── Grupos: entrar/sair ─────────────────────────────────────────────────────
export async function joinGroup(client: VidaLogClient, groupId: string, userId: string): Promise<void> {
  const { error } = await client.from('group_members').insert({ group_id: groupId, user_id: userId });
  if (error && error.code !== '23505') throw error; // ignora duplicado
}
export async function leaveGroup(client: VidaLogClient, groupId: string, userId: string): Promise<void> {
  const { error } = await client.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}
export async function listMyGroups(client: VidaLogClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from('group_members').select('group_id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.group_id);
}

// ── Perfil social ───────────────────────────────────────────────────────────
export async function getSocialProfile(client: VidaLogClient, userId: string): Promise<SocialProfile | null> {
  const { data, error } = await client.from('social_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function upsertSocialProfile(
  client: VidaLogClient,
  userId: string,
  patch: UpdateRow<'social_profiles'>,
): Promise<SocialProfile> {
  const { data, error } = await client
    .from('social_profiles')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ── Conexões ────────────────────────────────────────────────────────────────
export async function listFollowing(client: VidaLogClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from('user_connections').select('following_id').eq('follower_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.following_id);
}
export async function follow(client: VidaLogClient, followerId: string, followingId: string): Promise<void> {
  const { error } = await client.from('user_connections').insert({ follower_id: followerId, following_id: followingId });
  if (error && error.code !== '23505') throw error;
}
export async function unfollow(client: VidaLogClient, followerId: string, followingId: string): Promise<void> {
  const { error } = await client
    .from('user_connections')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

// ── Denúncia ────────────────────────────────────────────────────────────────
export async function reportPost(
  client: VidaLogClient,
  reporterId: string,
  postId: string,
  reason: string,
): Promise<void> {
  const { error } = await client.from('user_reports').insert({ reporter_id: reporterId, post_id: postId, reason });
  if (error) throw error;
}
