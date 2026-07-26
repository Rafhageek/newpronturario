import { View, Text, ActivityIndicator } from 'react-native';
import { Stethoscope, BadgeCheck } from 'lucide-react-native';
import { useCommunityDoctors, type CommunityDoctor } from '@hubpatients/supabase';
import { PROFESSIONAL_DISCLAIMER } from '@hubpatients/core';
import { Screen, AppHeader, Card, Badge, EmptyState } from '@/components/ui';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts } from '@/theme';

export default function CommunityDoctorsScreen() {
  const colors = useColors();
  const { data: doctors, isLoading } = useCommunityDoctors();
  const list = doctors ?? [];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Médicos"
        subtitle="Profissionais com registro verificado"
        back
        icon={Stethoscope}
      />
      <Screen>
        {/* Aviso ético da badge médica */}
        <View
          style={{ borderCurve: 'continuous' }}
          className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3"
        >
          <BadgeCheck size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <Text
            style={{ fontFamily: fonts.regular }}
            className="flex-1 text-[12px] leading-5 text-fg-soft"
          >
            {PROFESSIONAL_DISCLAIMER}
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="Nenhum médico em destaque ainda"
            subtitle="Médicos verificados que optarem por aparecer publicamente vão aparecer aqui."
          />
        ) : (
          <View className="gap-2.5">
            {list.map((d, i) => (
              <FadeInItem key={d.userId} index={i}>
                <DoctorRow doctor={d} />
              </FadeInItem>
            ))}
          </View>
        )}
      </Screen>
    </View>
  );
}

/* ──────────────────────────── Linha de médico ──────────────────────────── */

function DoctorRow({ doctor }: { doctor: CommunityDoctor }) {
  const initial = (doctor.displayName.charAt(0) || '?').toUpperCase();
  return (
    <Card className="flex-row items-center gap-3">
      <View
        style={{ borderCurve: 'continuous' }}
        className="h-11 w-11 items-center justify-center rounded-full bg-health-300/40"
      >
        <Text style={{ fontFamily: fonts.bold }} className="text-[16px] text-accent">
          {initial}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {/* Sem link: a rota /comunidade/u/[id] ainda não existe (outro agente cria). */}
          <Text
            style={{ fontFamily: fonts.semibold }}
            numberOfLines={1}
            className="flex-1 text-[15px] text-fg"
          >
            {doctor.displayName}
          </Text>
        </View>
        {doctor.registry ? (
          <Text
            style={{ fontFamily: fonts.regular }}
            numberOfLines={1}
            className="text-[12px] text-muted"
          >
            {doctor.registry}
          </Text>
        ) : null}
        {doctor.bio ? (
          <Text
            style={{ fontFamily: fonts.regular }}
            numberOfLines={1}
            className="mt-0.5 text-[12px] text-muted"
          >
            {doctor.bio}
          </Text>
        ) : null}
        <View className="mt-1.5">
          <Badge tone="ok">Médico verificado</Badge>
        </View>
      </View>
    </Card>
  );
}
