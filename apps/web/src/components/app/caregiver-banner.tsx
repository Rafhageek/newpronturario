'use client';

import { Eye } from 'lucide-react';
import { useActiveProfile } from '@/components/profile-context';

/**
 * Aviso de MODO CUIDADOR — "você está vendo o prontuário de outra pessoa".
 *
 * Cor de SISTEMA (contexto de quem você está olhando), não avaliação de nenhum
 * dado do corpo. Usa os tokens `status-attention-*`, que separam `ink` (texto,
 * ≥4,5:1 sobre o `tint`) de `mark` (traço) — o `text-amber-100` que estava aqui
 * era quase invisível no tema claro e não tinha versão escura.
 */
export function CaregiverBanner() {
  const { isViewingDependent, active, switchProfile, ownId } = useActiveProfile();
  if (!isViewingDependent) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2.5 border-b border-line bg-status-attention-tint px-4 py-2 sm:px-6"
    >
      <Eye className="h-4 w-4 shrink-0 text-status-attention-ink" aria-hidden />
      <p className="min-w-0 flex-1 text-body-sm text-status-attention-ink">
        Você está vendo o prontuário de{' '}
        <span className="font-semibold">{active.name}</span> (modo cuidador).
      </p>
      <button
        type="button"
        onClick={() => switchProfile(ownId)}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line-strong bg-surface px-4 text-label font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Voltar ao meu perfil
      </button>
    </div>
  );
}
