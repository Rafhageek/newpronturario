'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ForumSort } from '@hubpatients/core';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  listTopics, getTopic, createTopic, listThreadReplies, createReply, markBestReply,
  isFollowingThread, followThread, unfollowThread,
  listCategories, getCategoryBySlug, listTopicsByCategory, searchTopics,
  listTrendingTags, listUsefulMarks, markUseful, unmarkUseful,
} from '../queries/forum';

const scopeKey = (groupId: string | null) => groupId ?? 'social';

// ── Categorias / busca / trending ───────────────────────────────────────────
export function useForumCategories() {
  const client = useHubPatientsClient();
  return useQuery({ queryKey: queryKeys.forumCategories(), queryFn: () => listCategories(client) });
}

export function useForumCategory(slug: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.forumCategory(slug ?? ''),
    queryFn: () => getCategoryBySlug(client, slug as string),
    enabled: Boolean(slug),
  });
}

export function useCategoryTopics(categoryId: string | undefined, sort: ForumSort) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.categoryTopics(categoryId ?? '', sort),
    queryFn: () => listTopicsByCategory(client, categoryId as string, sort),
    enabled: Boolean(categoryId),
  });
}

export function useForumSearch(query: string) {
  const client = useHubPatientsClient();
  const q = query.trim();
  return useQuery({
    queryKey: queryKeys.forumSearch(q),
    queryFn: () => searchTopics(client, q),
    enabled: q.length >= 2,
  });
}

export function useTrendingTags() {
  const client = useHubPatientsClient();
  return useQuery({ queryKey: queryKeys.trendingTags(), queryFn: () => listTrendingTags(client) });
}

export function useUsefulMarks(topicId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.usefulMarks(topicId ?? ''),
    queryFn: () => listUsefulMarks(client, topicId as string),
    enabled: Boolean(topicId),
  });
}

export function useTopics(groupId: string | null, sort: ForumSort) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.topics(scopeKey(groupId), sort),
    queryFn: () => listTopics(client, groupId, sort),
  });
}

export function useTopic(id: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.topic(id ?? ''),
    queryFn: () => getTopic(client, id as string),
    enabled: Boolean(id),
  });
}

export function useThreadReplies(postId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.threadReplies(postId ?? ''),
    queryFn: () => listThreadReplies(client, postId as string),
    enabled: Boolean(postId),
  });
}

export function useIsFollowingThread(postId: string | undefined, userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.threadFollow(postId ?? ''),
    queryFn: () => isFollowingThread(client, postId as string, userId as string),
    enabled: Boolean(postId && userId),
  });
}

export function useForumMutations(userId: string, postId?: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const invalidateThread = () => {
    if (postId) {
      qc.invalidateQueries({ queryKey: queryKeys.threadReplies(postId) });
      qc.invalidateQueries({ queryKey: queryKeys.topic(postId) });
      qc.invalidateQueries({ queryKey: queryKeys.usefulMarks(postId) });
    }
    qc.invalidateQueries({ queryKey: ['topics'] });
    qc.invalidateQueries({ queryKey: ['category-topics'] });
  };
  return {
    createTopic: useMutation({
      mutationFn: (input: {
        groupId?: string | null;
        categoryId?: string | null;
        title: string;
        content: string;
        isAnonymous: boolean;
        tags?: string[];
        needsReview?: boolean;
        reviewReason?: string | null;
      }) => createTopic(client, userId, input),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['topics'] });
        qc.invalidateQueries({ queryKey: ['category-topics'] });
        qc.invalidateQueries({ queryKey: queryKeys.forumCategories() });
      },
    }),
    reply: useMutation({
      mutationFn: (input: {
        content: string;
        parentCommentId: string | null;
        isAnonymous: boolean;
        needsReview?: boolean;
        reviewReason?: string | null;
      }) =>
        createReply(client, postId as string, userId, input.content, input.parentCommentId, input.isAnonymous, {
          needsReview: input.needsReview,
          reviewReason: input.reviewReason,
        }),
      onSuccess: invalidateThread,
    }),
    markBest: useMutation({
      mutationFn: (commentId: string | null) => markBestReply(client, postId as string, commentId),
      onSuccess: invalidateThread,
    }),
    markUseful: useMutation({
      mutationFn: (commentId: string) => markUseful(client, postId as string, commentId, userId),
      onSuccess: invalidateThread,
    }),
    unmarkUseful: useMutation({
      mutationFn: (commentId: string) => unmarkUseful(client, commentId),
      onSuccess: invalidateThread,
    }),
    follow: useMutation({
      mutationFn: (following: boolean) =>
        following ? unfollowThread(client, postId as string, userId) : followThread(client, postId as string, userId),
      onSuccess: () => postId && qc.invalidateQueries({ queryKey: queryKeys.threadFollow(postId) }),
    }),
  };
}

/** Realtime: novas respostas na thread aparecem sem reload. */
export function useRealtimeThread(postId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  useEffect(() => {
    if (!postId) return;
    const channel = client
      .channel(`thread-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.threadReplies(postId) });
        qc.invalidateQueries({ queryKey: queryKeys.topic(postId) });
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [client, qc, postId]);
}
