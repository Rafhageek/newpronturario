'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ForumSort } from '@vidalog/core';
import { useVidaLogClient } from './context';
import { queryKeys } from './keys';
import {
  listTopics, getTopic, createTopic, listThreadReplies, createReply, markBestReply,
  isFollowingThread, followThread, unfollowThread,
} from '../queries/forum';

const scopeKey = (groupId: string | null) => groupId ?? 'social';

export function useTopics(groupId: string | null, sort: ForumSort) {
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.topics(scopeKey(groupId), sort),
    queryFn: () => listTopics(client, groupId, sort),
  });
}

export function useTopic(id: string | undefined) {
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.topic(id ?? ''),
    queryFn: () => getTopic(client, id as string),
    enabled: Boolean(id),
  });
}

export function useThreadReplies(postId: string | undefined) {
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.threadReplies(postId ?? ''),
    queryFn: () => listThreadReplies(client, postId as string),
    enabled: Boolean(postId),
  });
}

export function useIsFollowingThread(postId: string | undefined, userId: string | undefined) {
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.threadFollow(postId ?? ''),
    queryFn: () => isFollowingThread(client, postId as string, userId as string),
    enabled: Boolean(postId && userId),
  });
}

export function useForumMutations(userId: string, postId?: string) {
  const client = useVidaLogClient();
  const qc = useQueryClient();
  const invalidateThread = () => {
    if (postId) {
      qc.invalidateQueries({ queryKey: queryKeys.threadReplies(postId) });
      qc.invalidateQueries({ queryKey: queryKeys.topic(postId) });
    }
    qc.invalidateQueries({ queryKey: ['topics'] });
  };
  return {
    createTopic: useMutation({
      mutationFn: (input: { groupId: string | null; title: string; content: string; isAnonymous: boolean }) =>
        createTopic(client, userId, input),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }),
    }),
    reply: useMutation({
      mutationFn: (input: { content: string; parentCommentId: string | null; isAnonymous: boolean }) =>
        createReply(client, postId as string, userId, input.content, input.parentCommentId, input.isAnonymous),
      onSuccess: invalidateThread,
    }),
    markBest: useMutation({
      mutationFn: (commentId: string | null) => markBestReply(client, postId as string, commentId),
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
  const client = useVidaLogClient();
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
