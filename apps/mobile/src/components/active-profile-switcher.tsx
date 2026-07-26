import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronDown, UserRound, UsersRound } from 'lucide-react-native';
import { AppSheet, type AppSheetHandle } from './sheet';
import { useActiveProfile } from '@/lib/active-profile';
import { fonts, useColors } from '@/theme';

export function ActiveProfileSwitcher() {
  const colors = useColors();
  const { active, profiles, isViewingDependent, switchProfile, isLoading } = useActiveProfile();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<AppSheetHandle>(null);
  const canSwitch = profiles.length > 1;

  return (
    <>
      <Pressable
        onPress={() => canSwitch && setOpen(true)}
        disabled={!canSwitch || isLoading}
        accessibilityRole="button"
        accessibilityLabel={`Perfil ativo: ${active.name}`}
        accessibilityHint={canSwitch ? 'Toque duas vezes para escolher outro perfil' : 'Este é o único perfil disponível'}
        accessibilityState={{ disabled: !canSwitch || isLoading, expanded: open }}
        style={{ borderCurve: 'continuous' }}
        className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 active:opacity-75"
      >
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-trust-50">
          {isViewingDependent ? (
            <UsersRound size={20} color={colors.primary} accessible={false} />
          ) : (
            <UserRound size={20} color={colors.primary} accessible={false} />
          )}
        </View>
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.medium }} className="text-[11px] uppercase tracking-wide text-muted">
            Dados de saúde de
          </Text>
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg" numberOfLines={1}>
            {active.isSelf ? `${active.name} (você)` : active.name}
          </Text>
        </View>
        {canSwitch ? <ChevronDown size={19} color={colors.muted} accessible={false} /> : null}
      </Pressable>

      {open ? (
        <AppSheet ref={sheetRef} title="Escolher perfil" onClose={() => setOpen(false)}>
          <Text style={{ fontFamily: fonts.regular }} className="mb-3 text-[13px] leading-5 text-muted">
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
