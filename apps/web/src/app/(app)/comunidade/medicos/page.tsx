'use client';

import Link from 'next/link';
import { ArrowLeft, Stethoscope } from 'lucide-react';
import { useCommunityDoctors } from '@hubpatients/supabase';
import { PROFESSIONAL_DISCLAIMER } from '@hubpatients/core';
import { UserBadge } from '@/components/community/user-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';

export default function CommunityDoctorsPage() {
  const { data: doctors, isLoading } = useCommunityDoctors();

  return (
    <div className="mx-auto max-w-2xl space-y-5 hp-page hp-page--community">
      <Link href="/comunidade" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Comunidade
      </Link>

      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-status-ok-ink">
          <Stethoscope className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Médicos da comunidade
          </h1>
          <p className="text-sm text-muted">Profissionais com registro verificado que participam por aqui.</p>
        </div>
      </header>

      <Alert tone="info">{PROFESSIONAL_DISCLAIMER}</Alert>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : !doctors || doctors.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="Nenhum médico em destaque ainda"
          description="Médicos verificados que optarem por aparecer publicamente vão aparecer aqui."
        />
      ) : (
        <ul className="space-y-2">
          {doctors.map((d) => (
            <li key={d.userId}>
              <Link
                href={`/comunidade/u/${d.userId}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-primary/40"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 text-base font-bold text-white">
                  {d.displayName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-fg">
                    {d.displayName}
                    <UserBadge professionalBadge="doctor" professionalRegistry={d.registry} />
                  </p>
                  {d.bio && <p className="truncate text-xs text-muted">{d.bio}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
