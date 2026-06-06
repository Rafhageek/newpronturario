import type { FeedComment, FeedPost, ForumSort } from '@vidalog/core';
import type { VidaLogClient } from '../types';

/** Lista tópicos (posts) de um escopo, ordenados conforme a aba do fórum. */
export async function listTopics(
  client: VidaLogClient,
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

export async function getTopic(client: VidaLogClient, id: string): Promise<FeedPost | null> {
  const { data, error } = await client.from('feed_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTopic(
  client: VidaLogClient,
  authorId: string,
  input: { groupId: string | null; title: string; content: string; isAnonymous: boolean },
): Promise<string> {
  const { data, error } = await client
    .from('posts')
    .insert({
      group_id: input.groupId,
      author_id: authorId,
      title: input.title,
      content: input.content,
      is_anonymous: input.isAnonymous,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function listThreadReplies(client: VidaLogClient, postId: string): Promise<FeedComment[]> {
  const { data, error } = await client
    .from('feed_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createReply(
  client: VidaLogClient,
  postId: string,
  authorId: string,
  content: string,
  parentCommentId: string | null,
  isAnonymous: boolean,
): Promise<void> {
  const { error } = await client
    .from('post_comments')
    .insert({ post_id: postId, author_id: authorId, content, parent_comment_id: parentCommentId, is_anonymous: isAnonymous });
  if (error) throw error;
}

/** Marca uma resposta como "útil" (resolve o tópico). Só o autor do tópico (RLS). */
export async function markBestReply(client: VidaLogClient, postId: string, commentId: string | null): Promise<void> {
  const { error } = await client
    .from('posts')
    .update({ best_comment_id: commentId, is_solved: commentId !== null })
    .eq('id', postId);
  if (error) throw error;
}

export async function isFollowingThread(client: VidaLogClient, postId: string, userId: string): Promise<boolean> {
  const { data } = await client.from('thread_follows').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
  return Boolean(data);
}
export async function followThread(client: VidaLogClient, postId: string, userId: string): Promise<void> {
  const { error } = await client.from('thread_follows').insert({ post_id: postId, user_id: userId });
  if (error && error.code !== '23505') throw error;
}
export async function unfollowThread(client: VidaLogClient, postId: string, userId: string): Promise<void> {
  const { error } = await client.from('thread_follows').delete().eq('post_id', postId).eq('user_id', userId);
  if (error) throw error;
}
