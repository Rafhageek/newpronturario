'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateRow } from '@hubpatients/core';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  listGroups, listMyGroups, joinGroup, leaveGroup,
  listFeed, createPost, deletePost, type NewPost,
  listReactionsFor, toggleReaction,
  listComments, createComment,
  getPolls, listPollVotes, votePoll,
  getSocialProfile, upsertSocialProfile,
  listFollowing, follow, unfollow,
  reportPost,
} from '../queries/social';

const scope = (groupId: string | null) => groupId ?? 'social';

export function useGroups() {
  const client = useHubPatientsClient();
  return useQuery({ queryKey: queryKeys.groups(), queryFn: () => listGroups(client), staleTime: 30 * 60 * 1000 });
}

export function useMyGroups(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.myGroups(userId ?? ''),
    queryFn: () => listMyGroups(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useFeed(groupId: string | null, enabled = true) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.feed(scope(groupId)),
    queryFn: () => listFeed(client, groupId),
    enabled,
  });
}

export function useFeedReactions(groupId: string | null, postIds: string[]) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.reactions(scope(groupId)),
    queryFn: () => listReactionsFor(client, postIds),
    enabled: postIds.length > 0,
  });
}

export function useFeedPolls(groupId: string | null, postIds: string[]) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.polls(scope(groupId)),
    queryFn: async () => {
      const polls = await getPolls(client, postIds);
      const votes = await listPollVotes(client, polls.map((p) => p.id));
      return { polls, votes };
    },
    enabled: postIds.length > 0,
  });
}

export function useComments(postId: string, enabled: boolean) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.comments(postId),
    queryFn: () => listComments(client, postId),
    enabled,
  });
}

export function useSocialMutations(userId: string, groupId: string | null) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const refreshFeed = () => {
    qc.invalidateQueries({ queryKey: queryKeys.feed(scope(groupId)) });
    qc.invalidateQueries({ queryKey: queryKeys.reactions(scope(groupId)) });
    qc.invalidateQueries({ queryKey: queryKeys.polls(scope(groupId)) });
  };
  return {
    createPost: useMutation({ mutationFn: (input: NewPost) => createPost(client, userId, input), onSuccess: refreshFeed }),
    deletePost: useMutation({ mutationFn: (postId: string) => deletePost(client, postId), onSuccess: refreshFeed }),
    react: useMutation({
      mutationFn: ({ postId, emoji }: { postId: string; emoji: string }) => toggleReaction(client, postId, userId, emoji),
      onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reactions(scope(groupId)) }),
    }),
    comment: useMutation({
      mutationFn: ({ postId, content, isAnonymous }: { postId: string; content: string; isAnonymous: boolean }) =>
        createComment(client, postId, userId, content, isAnonymous),
      onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: queryKeys.comments(v.postId) }),
    }),
    vote: useMutation({
      mutationFn: ({ pollId, optionIndex }: { pollId: string; optionIndex: number }) => votePoll(client, pollId, userId, optionIndex),
      onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.polls(scope(groupId)) }),
    }),
    report: useMutation({ mutationFn: ({ postId, reason }: { postId: string; reason: string }) => reportPost(client, userId, postId, reason) }),
  };
}

export function useJoinGroup(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, joined }: { groupId: string; joined: boolean }) =>
      joined ? leaveGroup(client, groupId, userId) : joinGroup(client, groupId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myGroups(userId) }),
  });
}

// ── Realtime: invalida o feed quando há mudanças ────────────────────────────
export function useRealtimeFeed(groupId: string | null) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  useEffect(() => {
    const channel = client
      .channel(`feed-${scope(groupId)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.feed(scope(groupId)) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.reactions(scope(groupId)) });
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [client, qc, groupId]);
}

// ── Rede social: perfil + conexões ──────────────────────────────────────────
export function useSocialProfile(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.socialProfile(userId ?? ''),
    queryFn: () => getSocialProfile(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useUpsertSocialProfile(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateRow<'social_profiles'>) => upsertSocialProfile(client, userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.socialProfile(userId) }),
  });
}

export function useFollowing(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.following(userId ?? ''),
    queryFn: () => listFollowing(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useFollow(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, following }: { targetId: string; following: boolean }) =>
      following ? unfollow(client, userId, targetId) : follow(client, userId, targetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.following(userId) }),
  });
}
