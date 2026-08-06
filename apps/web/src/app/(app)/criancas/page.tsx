'use client';

import { useState } from 'react';
import { Blocks, Plus } from 'lucide-react';
import { useChildren } from '@hubpatients/supabase';
import { ChildCard } from '@/components/child/child-card';
import { ChildDisclaimer } from '@/components/child/child-disclaimer';
import { AddChildModal } from '@/components/child/add-child-modal';
import { Button } from '@/components/ui';
import { ListSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function CriancasPage() {
  const { data: children, isLoading, isError, refetch } = useChildren();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-5 hp-page hp-page--journey">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Crianças
          </h1>
          <p className="text-sm text-muted">Caderneta de saúde da criança: crescimento, vacinas e marcos.</p>
        </div>
        {(children?.length ?? 0) > 0 && (
          <Button onClick={() => setModalOpen(true)} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar criança
          </Button>
        )}
      </div>

      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : isError ? (
        <ErrorState message="Não foi possível carregar as crianças." onRetry={() => refetch()} />
      ) : (children?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-400 text-white">
            <Blocks className="h-8 w-8" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Nenhuma criança cadastrada
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Adicione seu filho ou filha para acompanhar o crescimento, o calendário de vacinas e os marcos do desenvolvimento.
          </p>
          <Button onClick={() => setModalOpen(true)} className="mt-5">
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar primeiro filho
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {children!.map((child) => (
            <ChildCard key={child.id} child={child} />
          ))}
        </div>
      )}

      <ChildDisclaimer />

      <AddChildModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
