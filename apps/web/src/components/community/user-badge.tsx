'use client';

import { Shield, ShieldCheck, Stethoscope, Crown } from 'lucide-react';
import {
  STAFF_ROLE_LABELS,
  PROFESSIONAL_BADGE_LABELS,
  PROFESSIONAL_DISCLAIMER,
  reputationLevel,
} from '@hubpatients/core';

type Size = 'sm' | 'md';

export interface UserBadgeProps {
  staffRole?: string | null;
  professionalBadge?: string | null;
  professionalRegistry?: string | null;
  memberTier?: string | null;
  reputationPoints?: number | null;
  /** Mostra o nível de reputação discretamente ao lado (não é badge principal). */
  showLevel?: boolean;
  size?: Size;
  className?: string;
}

interface Chip {
  key: string;
  label: string;
  icon: typeof Shield;
  classes: string;
  /** aria-label completo (cor nunca é o único sinal). */
  aria: string;
  title?: string;
}

/**
 * Identificação combinada do usuário no fórum. Regra de precedência num ÚNICO
 * lugar: no máx. 2 badges, na ordem 1) staff 2) profissional 3) VIP.
 * Acessível: cada badge tem texto + ícone + aria-label (não depende só de cor).
 */
export function UserBadge({
  staffRole,
  professionalBadge,
  professionalRegistry,
  memberTier,
  reputationPoints,
  showLevel = false,
  size = 'sm',
  className = '',
}: UserBadgeProps) {
  const chips: Chip[] = [];

  // 1) Cargo de equipe
  if (staffRole === 'admin') {
    chips.push({
      key: 'admin',
      label: STAFF_ROLE_LABELS.admin,
      icon: Shield,
      classes: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
      aria: 'Administrador da comunidade',
    });
  } else if (staffRole === 'moderator') {
    chips.push({
      key: 'moderator',
      label: STAFF_ROLE_LABELS.moderator,
      icon: ShieldCheck,
      classes: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
      aria: 'Moderador da comunidade',
    });
  }

  // 2) Verificação profissional (UI exibe só 'doctor' por enquanto)
  if (professionalBadge === 'doctor') {
    const label = professionalRegistry
      ? `${PROFESSIONAL_BADGE_LABELS.doctor} · ${professionalRegistry}`
      : PROFESSIONAL_BADGE_LABELS.doctor;
    chips.push({
      key: 'doctor',
      label,
      icon: Stethoscope,
      classes: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      aria: `${label}. ${PROFESSIONAL_DISCLAIMER}`,
      title: PROFESSIONAL_DISCLAIMER,
    });
  }

  // 3) Membro VIP
  if (memberTier === 'vip') {
    chips.push({
      key: 'vip',
      label: 'VIP',
      icon: Crown,
      classes: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      aria: 'Membro VIP',
    });
  }

  const visible = chips.slice(0, 2); // no máx. 2 badges
  const level =
    showLevel && reputationPoints != null ? reputationLevel(reputationPoints) : null;

  if (visible.length === 0 && !level) return null;

  const pad = size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[10px]';
  const icon = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 align-middle ${className}`}>
      {visible.map((c) => {
        const Icon = c.icon;
        return (
          <span
            key={c.key}
            title={c.title}
            aria-label={c.aria}
            className={`inline-flex items-center gap-1 rounded-full font-semibold ${pad} ${c.classes}`}
          >
            <Icon className={icon} aria-hidden />
            {c.label}
          </span>
        );
      })}
      {level && (
        <span className="text-[10px] font-medium text-faint" aria-label={`Nível: ${level.label}`}>
          {level.label}
        </span>
      )}
    </span>
  );
}
