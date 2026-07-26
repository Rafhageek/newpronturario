import type {
  FeedComment,
  FeedPost,
  ForumSort,
  ForumCategory,
  ForumCategoryStat,
  ForumTrendingTag,
  UsefulMark,
} from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

/** Lista tópicos (posts) de um escopo, ordenados conforme a aba do fórum. */
export async function listTopics(
  client: HubPatientsClient,
  groupId: string | null,
  sort: ForumSort,
  limit = 50,
): Promise<FeedPost[]> {
  let q = client.from('feed_posts').select('*').limit(limit);
  q = groupId ? q.eq('group_id', groupId) : q.is('group_id', null);
  if (sort === 'unanswered') q = q.eq('reply_count', 0);
  if (sort === 'solved') q = q.eq('is_solved', true);
  q = q.order('is_pinned', { ascending: false });
  if (sort === 'hot') q = q.order('reply_count', { ascending: false });
  q = q.order('last_activity_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getTopic(client: HubPatientsClient, id: string): Promise<FeedPost | null> {
  const { data, error } = await client.from('feed_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTopic(
  client: HubPatientsClient,
  authorId: string,
  input: {
    groupId?: string | null;
    categoryId?: string | null;
    title: string;
    content: string;
    isAnonymous: boolean;
    tags?: string[];
    needsReview?: boolean;
    reviewReason?: string | null;
  },
): Promise<string> {
  const { data, error } = await client
    .from('posts')
    .insert({
      group_id: input.groupId ?? null,
      category_id: input.categoryId ?? null,
      author_id: authorId,
      title: input.title,
      content: input.content,
      is_anonymous: input.isAnonymous,
      tags: input.tags ?? [],
      needs_review: input.needsReview ?? false,
      review_reason: input.reviewReason ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ── Categorias ────────────────────────────────────────────────────────────────

/** Categorias com contadores (tópicos + última atividade), ordenadas. */
export async function listCategories(client: HubPatientsClient): Promise<ForumCategoryStat[]> {
  const { data, error } = await client
    .from('forum_category_stats')
    .select('*')
    .order('sort', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCategoryBySlug(
  client: HubPatientsClient,
  slug: string,
): Promise<ForumCategory | null> {
  const { data, error } = await client
    .from('forum_categories')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Tópicos de uma categoria, ordenados pela aba do fórum. */
export async function listTopicsByCategory(
  client: HubPatientsClient,
  categoryId: string,
  sort: ForumSort,
  limit = 50,
): Promise<FeedPost[]> {
  let q = client.from('feed_posts').select('*').eq('category_id', categoryId).limit(limit);
  if (sort === 'unanswered') q = q.eq('reply_count', 0);
  if (sort === 'solved') q = q.eq('is_solved', true);
  q = q.order('is_pinned', { ascending: false });
  if (sort === 'hot') q = q.order('reply_count', { ascending: false });
  q = q.order('last_activity_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Busca full-text (português) por título e corpo dos tópicos. */
export async function searchTopics(
  client: HubPatientsClient,
  query: string,
  limit = 30,
): Promise<FeedPost[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await client.rpc('search_forum_topics', { q, lim: limit });
  if (error) throw error;
  return (data ?? []) as FeedPost[];
}

/** Tags em alta nos últimos 7 dias. */
export async function listTrendingTags(
  client: HubPatientsClient,
  limit = 8,
): Promise<ForumTrendingTag[]> {
  const { data, error } = await client
    .from('forum_trending_tags')
    .select('*')
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Resposta útil (múltipla) ──────────────────────────────────────────────────

export async function listUsefulMarks(
  client: HubPatientsClient,
  topicId: string,
): Promise<UsefulMark[]> {
  const { data, error } = await client
    .from('useful_marks')
    .select('*')
    .eq('topic_id', topicId);
  if (error) throw error;
  return data ?? [];
}

/** Marca uma resposta como útil (+5 reputação ao autor; só o autor do tópico). */
export async function markUseful(
  client: HubPatientsClient,
  topicId: string,
  commentId: string,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('useful_marks')
    .insert({ topic_id: topicId, comment_id: commentId, marked_by: userId });
  if (error && error.code !== '23505') throw error;
}

export async function unmarkUseful(client: HubPatientsClient, commentId: string): Promise<void> {
  const { error } = await client.from('useful_marks').delete().eq('comment_id', commentId);
  if (error) throw error;
}

export async function listThreadReplies(client: HubPatientsClient, postId: string): Promise<FeedComment[]> {
  const { data, error } = await client
    .from('feed_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createReply(
  client: HubPatientsClient,
  postId: string,
  authorId: string,
  content: string,
  parentCommentId: string | null,
  isAnonymous: boolean,
  flag?: { needsReview?: boolean; reviewReason?: string | null },
): Promise<void> {
  const { error } = await client
    .from('post_comments')
    .insert({
      post_id: postId,
      author_id: authorId,
      content,
      parent_comment_id: parentCommentId,
      is_anonymous: isAnonymous,
      needs_review: flag?.needsReview ?? false,
      review_reason: flag?.reviewReason ?? null,
    });
  if (error) throw error;
}

/** Marca uma resposta como "útil" (resolve o tópico). Só o autor do tópico (RLS). */
export async function markBestReply(client: HubPatientsClient, postId: string, commentId: string | null): Promise<void> {
  const { error } = await client
    .from('posts')
    .update({ best_comment_id: commentId, is_solved: commentId !== null })
    .eq('id', postId);
  if (error) throw error;
}

export async function isFollowingThread(client: HubPatientsClient, postId: string, userId: string): Promise<boolean> {
  const { data } = await client.from('thread_follows').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
  return Boolean(data);
}
export async function followThread(client: HubPatientsClient, postId: string, userId: string): Promise<void> {
  const { error } = await client.from('thread_follows').insert({ post_id: postId, user_id: userId });
  if (error && error.code !== '23505') throw error;
}
export async function unfollowThread(client: HubPatientsClient, postId: string, userId: string): Promise<void> {
  const { error } = await client.from('thread_follows').delete().eq('post_id', postId).eq('user_id', userId);
  if (error) throw error;
}
