import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  UserX,
  Award,
  MessageSquare,
  CheckCircle2,
  Shield,
  ShieldCheck,
  Stethoscope,
  Crown,
  type LucideIcon,
} from 'lucide-react-native';
import { usePublicForumProfile } from '@hubpatients/supabase';
import {
  reputationLevel,
  STAFF_ROLE_LABELS,
  PROFESSIONAL_BADGE_LABELS,
  PROFESSIONAL_DISCLAIMER,
} from '@hubpatients/core';
import { Screen, AppHeader, Card, EmptyState } from '@/components/ui';
import { useColors, fonts, gradients } from '@/theme';

/**
 * Perfil público de fórum: badges, nível de reputação e contribuições.
 * Nenhum dado clínico aparece aqui (espelha apps/web/comunidade/u/[id]).
 */
export default function PublicForumProfileScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: profile, isLoading } = usePublicForumProfile(id);

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Perfil" subtitle="Comunidade" back />
      <Screen>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !profile ? (
          <EmptyState
            icon={UserX}
            title="Perfil indisponível"
            subtitle="Este perfil é privado ou não existe. Cada pessoa escolhe se quer aparecer publicamente."
          />
        ) : (
          <ProfileBody profile={profile} />
        )}
      </Screen>
    </View>
  );
}

function ProfileBody({
  profile,
}: {
  profile: NonNullable<ReturnType<typeof usePublicForumProfile>['data']>;
}) {
  const colors = useColors();
  const level = reputationLevel(profile.reputationPoints);
  const pct =
    level.next != null ? Math.min(100, Math.round((profile.reputationPoints / level.next) * 100)) : 100;
  const memberSince = new Date(profile.memberSince).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      {/* Cartão do perfil */}
      <Card className="gap-4">
        <View className="flex-row items-start gap-4">
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ height: 64, width: 64, borderRadius: 20, borderCurve: 'continuous' }}
            className="items-center justify-center"
          >
            <Text style={{ fontFamily: fonts.display }} className="text-[26px] text-white">
              {profile.displayName.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>

          <View className="min-w-0 flex-1">
            <Text style={{ fontFamily: fonts.display }} className="text-[20px] leading-7 text-fg">
              {profile.displayName}
            </Text>
            <UserBadge
              staffRole={profile.staffRole}
              professionalBadge={profile.professionalBadge}
              professionalRegistry={profile.professionalRegistry}
              memberTier={profile.memberTier}
            />
            {profile.bio ? (
              <Text style={{ fontFamily: fonts.regular }} className="mt-1 text-[14px] leading-5 text-fg-soft">
                {profile.bio}
              </Text>
            ) : null}
            <Text style={{ fontFamily: fonts.regular }} className="mt-1 text-[12px] text-muted">
              Membro desde {memberSince}
            </Text>
          </View>
        </View>

        {/* Nível de reputação */}
        <View
          style={{ borderCurve: 'continuous' }}
          className="gap-2 rounded-2xl border border-line bg-surface-2 p-4"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Award size={16} color={colors.attention} />
              <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                {level.label}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
              {profile.reputationPoints} pts
            </Text>
          </View>

          <View className="h-2 overflow-hidden rounded-full bg-line">
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: '100%', width: `${pct}%`, borderRadius: 999 }}
            />
          </View>

          {level.next != null ? (
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
              Faltam {level.toNext} pts para o próximo nível.
            </Text>
          ) : null}
        </View>
      </Card>

      {/* Contribuições */}
      <View className="flex-row gap-3">
        <Stat icon={MessageSquare} value={profile.topicCount} label="Tópicos criados" />
        <Stat icon={CheckCircle2} value={profile.usefulCount} label="Respostas úteis" />
      </View>

      <Text
        style={{ fontFamily: fonts.regular }}
        className="px-2 text-center text-[11px] leading-4 text-faint"
      >
        Este perfil mostra apenas a atividade pública na comunidade. Nenhum dado de saúde é exibido aqui.
      </Text>
    </>
  );
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  const colors = useColors();
  return (
    <View className="flex-1">
      <Card className="items-center gap-1">
        <Icon size={20} color={colors.primary} />
        <Text style={{ fontFamily: fonts.display }} className="text-[24px] text-fg">
          {value}
        </Text>
        <Text style={{ fontFamily: fonts.regular }} className="text-center text-[12px] text-muted">
          {label}
        </Text>
      </Card>
    </View>
  );
}

/* ──────────────────────────── UserBadge ──────────────────────────── */

interface Chip {
  key: string;
  label: string;
  icon: LucideIcon;
  bg: string;
  fg: string;
  iconColor: string;
  aria: string;
}

/**
 * Identificação combinada do usuário (no máx. 2 badges): 1) staff 2) profissional
 * 3) VIP. Espelha apps/web/components/community/user-badge. Cada chip tem ícone +
 * texto + accessibilityLabel — cor nunca é o único sinal.
 */
export function UserBadge({
  staffRole,
  professionalBadge,
  professionalRegistry,
  memberTier,
  inline = false,
}: {
  staffRole: string | null;
  professionalBadge: string | null;
  professionalRegistry: string | null;
  memberTier: string | null;
  /** Quando true, remove o espaçamento superior para alinhar na mesma linha do nome. */
  inline?: boolean;
}) {
  const colors = useColors();
  const chips: Chip[] = [];

  // 1) Cargo de equipe
  if (staffRole === 'admin') {
    chips.push({
      key: 'admin',
      label: STAFF_ROLE_LABELS.admin,
      icon: Shield,
      bg: 'bg-rose-100',
      fg: 'text-rose-700',
      iconColor: colors.alert,
      aria: 'Administrador da comunidade',
    });
  } else if (staffRole === 'moderator') {
    chips.push({
      key: 'moderator',
      label: STAFF_ROLE_LABELS.moderator,
      icon: ShieldCheck,
      bg: 'bg-trust-100',
      fg: 'text-trust-700',
      iconColor: colors.primary,
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
      bg: 'bg-health-300/30',
      fg: 'text-health-600',
      iconColor: colors.accent,
      aria: `${label}. ${PROFESSIONAL_DISCLAIMER}`,
    });
  }

  // 3) Membro VIP
  if (memberTier === 'vip') {
    chips.push({
      key: 'vip',
      label: 'VIP',
      icon: Crown,
      bg: 'bg-amber-100',
      fg: 'text-amber-700',
      iconColor: colors.attention,
      aria: 'Membro VIP',
    });
  }

  const visible = chips.slice(0, 2); // no máx. 2 badges
  if (visible.length === 0) return null;

  return (
    <View className={`flex-row flex-wrap items-center gap-1.5 ${inline ? '' : 'mt-1'}`}>
      {visible.map((c) => {
        const Icon = c.icon;
        return (
          <View
            key={c.key}
            accessibilityLabel={c.aria}
            style={{ borderCurve: 'continuous' }}
            className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${c.bg}`}
          >
            <Icon size={11} color={c.iconColor} />
            <Text style={{ fontFamily: fonts.semibold }} className={`text-[10px] ${c.fg}`}>
              {c.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
