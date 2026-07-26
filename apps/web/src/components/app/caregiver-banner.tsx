'use client';

import { Eye } from 'lucide-react';
import { useActiveProfile } from '@/components/profile-context';

export function CaregiverBanner() {
  const { isViewingDependent, active, switchProfile, ownId } = useActiveProfile();
  if (!isViewingDependent) return null;
  return (
    <div className="flex items-center gap-2.5 border-b border-amber-400/20 bg-amber-400/10 px-6 py-2.5">
      <Eye className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
      <p className="flex-1 text-sm text-amber-100">
        Você está vendo o prontuário de <span className="font-semibold">{active.name}</span> (modo cuidador).
      </p>
      <button onClick={() => switchProfile(ownId)} className="rounded-lg border border-amber-400/30 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-400/15">
        Voltar ao meu perfil
      </button>
    </div>
  );
}
