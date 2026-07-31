import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronRight, UserRound, UsersRound } from 'lucide-react-native';
import { AppSheet, type AppSheetHandle } from './sheet';
import { useActiveProfile } from '@/lib/active-profile';
import { fonts, shadowRaised, useColors } from '@/theme';

export function ActiveProfileSwitcher() {
  const colors = useColors();
  const router = useRouter();
  const { active, profiles, isViewingDependent, switchProfile, isLoading } = useActiveProfile();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<AppSheetHandle>(null);
  const canSwitch = profiles.length > 1;

  return (
    <>
      <Pressable
        onPress={() => {
          if (canSwitch) {
            setOpen(true);
          } else {
            router.push('/perfil');
          }
        }}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={`Perfil ativo: ${active.name}`}
        accessibilityHint={
          canSwitch
            ? 'Toque duas vezes para escolher outro perfil'
            : 'Toque duas vezes para ver seu perfil'
        }
        accessibilityState={{ disabled: isLoading, expanded: open }}
        style={[{ borderCurve: 'continuous' }, shadowRaised]}
        className="overflow-hidden rounded-3xl active:opacity-90"
      >
        <LinearGradient
          colors={['#0b4fc8', '#086bd4', '#0f7ad8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 142,
            paddingHorizontal: 18,
            paddingVertical: 18,
            justifyContent: 'center',
          }}
        >
          <View
            pointerEvents="none"
            className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/5"
          />
          <View
            pointerEvents="none"
            className="absolute -bottom-24 right-10 h-52 w-52 rounded-full bg-white/5"
          />

          <View className="flex-row items-center gap-4">
            <View className="h-[74px] w-[74px] items-center justify-center rounded-full bg-white">
              {isViewingDependent ? (
                <UsersRound size={34} color="#0b57d0" strokeWidth={2.25} accessible={false} />
              ) : (
                <UserRound size={34} color="#0b57d0" strokeWidth={2.25} accessible={false} />
              )}
            </View>
            <View className="min-w-0 flex-1">
              <Text
                style={{ fontFamily: fonts.medium }}
                className="text-[12px] uppercase tracking-wide text-white/90"
              >
                {isViewingDependent ? 'Perfil sob seus cuidados' : 'Seu perfil de saúde'}
              </Text>
              <Text
                style={{ fontFamily: fonts.bold }}
                className="mt-1 text-[21px] leading-6 text-white"
                numberOfLines={1}
              >
                {active.isSelf ? `${active.name} (você)` : active.name}
              </Text>
              <Text
                style={{ fontFamily: fonts.regular }}
                className="mt-1 text-[13px] leading-[18px] text-white/85"
                numberOfLines={2}
              >
                Acompanhe seus dados e cuide da sua saúde com facilidade.
              </Text>
              <View className="mt-2 flex-row items-center gap-1">
                <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-white">
                  {canSwitch ? 'Trocar perfil' : 'Ver perfil'}
                </Text>
                <ChevronRight size={15} color="#ffffff" accessible={false} />
              </View>
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      {open ? (
        <AppSheet ref={sheetRef} title="Escolher perfil" onClose={() => setOpen(false)}>
          <Text
            style={{ fontFamily: fonts.regular }}
            className="mb-3 text-[13px] leading-5 text-muted"
          >
            Confira o perfil antes de consultar ou registrar informações de saúde.
          </Text>
          <View className="gap-2">
            {profiles.map((profile) => {
              const selected = profile.id === active.id;
              return (
                <Pressable
                  key={profile.id}
                  onPress={() => {
                    switchProfile(profile.id);
                    sheetRef.current?.close();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={profile.isSelf ? `${profile.name}, seu perfil` : profile.name}
                  style={{ borderCurve: 'continuous' }}
                  className={`min-h-14 flex-row items-center gap-3 rounded-2xl border px-4 py-3 active:opacity-75 ${
                    selected ? 'border-trust-300 bg-trust-50' : 'border-line bg-surface'
                  }`}
                >
                  <View className="flex-1">
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                      {profile.name}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                      {profile.isSelf ? 'Seu prontuário' : 'Perfil compartilhado com você'}
                    </Text>
                  </View>
                  {selected ? <Check size={20} color={colors.primary} accessible={false} /> : null}
                </Pressable>
              );
            })}
          </View>
        </AppSheet>
      ) : null}
    </>
  );
}
