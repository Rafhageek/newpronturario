'use client';

import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGroups, useFeed, useFeedReactions, useFeedPolls, useSocialMutations, useRealtimeFeed,
} from '@vidalog/supabase';
import { useAuth } from '@/components/auth-provider';
import { SocialDisclaimer } from '@/components/social/bits';
import { PostComposer } from '@/components/social/post-composer';
import { PostCard, type PostActions } from '@/components/social/post-card';

export default function ComunidadePage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: groups } = useGroups();
  const [groupId, setGroupId] = useState<string | null>(null);
  const active = groupId ?? groups?.[0]?.id ?? null;

  const { data: feed } = useFeed(active, Boolean(active));
  const postIds = useMemo(() => (feed ?? []).map((p) => p.id), [feed]);
  const { data: reactions } = useFeedReactions(active, postIds);
  const { data: pollData } = useFeedPolls(active, postIds);
  const mut = useSocialMutations(userId, active);
  useRealtimeFeed(active);

  const reactionsByPost = useMemo(() => {
    const m = new Map<string, typeof reactions>();
    (reactions ?? []).forEach((r) => { const a = m.get(r.post_id) ?? []; a!.push(r); m.set(r.post_id, a); });
    return m;
  }, [reactions]);
  const pollByPost = useMemo(() => {
    const m = new Map<string, NonNullable<typeof pollData>['polls'][number]>();
    (pollData?.polls ?? []).forEach((p) => m.set(p.post_id, p));
    return m;
  }, [pollData]);

  const actions: PostActions = {
    onReact: (postId, emoji) => mut.react.mutate({ postId, emoji }),
    onComment: (postId, content, isAnonymous) => mut.comment.mutateAsync({ postId, content, isAnonymous }),
    onVote: (pollId, optionIndex) => mut.vote.mutate({ pollId, optionIndex }),
    onReport: (postId, reason) => { mut.report.mutate({ postId, reason }); toast.success('Denúncia enviada. Obrigado por ajudar a moderar.'); },
    onDelete: (postId) => mut.deletePost.mutate(postId),
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[220px_1fr]">
      {/* Grupos */}
      <aside className="space-y-1">
        <h1 className="mb-2 text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Comunidade</h1>
        {(groups ?? []).map((g) => (
          <button key={g.id} onClick={() => setGroupId(g.id)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${active === g.id ? 'bg-sky-500/15 text-primary ring-1 ring-inset ring-sky-400/20' : 'text-muted hover:bg-surface-2'}`}>
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">{g.name}</span>
            {g.cid10_code && <span className="ml-auto text-[10px] text-faint">{g.cid10_code}</span>}
          </button>
        ))}
      </aside>

      {/* Feed */}
      <div className="space-y-4">
        <SocialDisclaimer />
        <PostComposer onSubmit={async (input) => { await mut.createPost.mutateAsync({ groupId: active, ...input }); }} pending={mut.createPost.isPending} />
        {feed && feed.length > 0 ? (
          feed.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              reactions={reactionsByPost.get(p.id) ?? []}
              poll={pollByPost.get(p.id)}
              pollVotes={(pollData?.votes ?? []).filter((v) => v.poll_id === pollByPost.get(p.id)?.id)}
              userId={userId}
              actions={actions}
            />
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">Seja o primeiro a postar neste grupo.</p>
        )}
      </div>
    </div>
  );
}
