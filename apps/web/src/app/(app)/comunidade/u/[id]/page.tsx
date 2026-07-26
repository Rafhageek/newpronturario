'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Award, CheckCircle2, MessageSquare, UserX } from 'lucide-react';
import { usePublicForumProfile } from '@hubpatients/supabase';
import { reputationLevel } from '@hubpatients/core';
import { UserBadge } from '@/components/community/user-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicForumProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: profile, isLoading } = usePublicForumProfile(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/comunidade" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Comunidade
        </Link>
        <EmptyState
          icon={UserX}
          title="Perfil indisponível"
          description="Este perfil é privado ou não existe. Cada pessoa escolhe se quer aparecer publicamente."
        />
      </div>
    );
  }

  const level = reputationLevel(profile.reputationPoints);
  const pct = level.next ? Math.min(100, Math.round((profile.reputationPoints / level.next) * 100)) : 100;
  const memberSince = new Date(profile.memberSince).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/comunidade" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Comunidade
      </Link>

      {/* Cartão do perfil */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-2xl font-bold text-white">
            {profile.displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
                {profile.displayName}
              </h1>
              <UserBadge
                staffRole={profile.staffRole}
                professionalBadge={profile.professionalBadge}
                professionalRegistry={profile.professionalRegistry}
                memberTier={profile.memberTier}
                size="md"
              />
            </div>
            {profile.bio && <p className="mt-1 text-sm text-fg-soft">{profile.bio}</p>}
            <p className="mt-1 text-xs text-muted">Membro desde {memberSince}</p>
          </div>
        </div>

        {/* Nível de reputação */}
        <div className="mt-5 rounded-xl border border-line bg-surface-2 p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
              <Award className="h-4 w-4 text-status-attention-ink" /> {level.label}
            </span>
            <span className="text-xs text-muted">{profile.reputationPoints} pts</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400" style={{ width: `${pct}%` }} />
          </div>
          {level.next != null && (
            <p className="mt-1.5 text-[11px] text-muted">Faltam {level.toNext} pts para o próximo nível.</p>
          )}
        </div>
      </section>

      {/* Contribuições */}
      <div className="grid grid-cols-2 gap-4">
        <Stat icon={MessageSquare} value={profile.topicCount} label="Tópicos criados" />
        <Stat icon={CheckCircle2} value={profile.usefulCount} label="Respostas úteis" />
      </div>

      <p className="text-center text-xs text-faint">
        Este perfil mostra apenas a atividade pública na comunidade. Nenhum dado de saúde é exibido aqui.
      </p>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof MessageSquare; value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 text-center">
      <Icon className="mx-auto h-5 w-5 text-primary" aria-hidden />
      <p className="mt-1.5 text-2xl font-bold text-fg">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
