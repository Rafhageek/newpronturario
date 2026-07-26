import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ticket, Gift, ShieldX } from 'lucide-react-native';
import { useCommunityMember, useVouchers, useCreateVoucher } from '@hubpatients/supabase';
import type { Voucher } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import {
  Screen,
  AppHeader,
  Card,
  Input,
  Button,
  Badge,
  EmptyState,
  SectionTitle,
  IconCircle,
  Divider,
} from '@/components/ui';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { fonts } from '@/theme';

type VoucherKind = 'plus_trial' | 'plus_full';

const KINDS: { key: VoucherKind; label: string }[] = [
  { key: 'plus_trial', label: 'Plus — trial' },
  { key: 'plus_full', label: 'Plus — completo' },
];

/** Status derivado para badge e rótulo. */
function voucherStatus(v: Voucher): { label: string; tone: 'ok' | 'alert' | 'attention' | 'neutral' } {
  const expired = v.expires_at != null && new Date(v.expires_at).getTime() < Date.now();
  const exhausted = v.uses_count >= v.max_uses;
  if (!v.active) return { label: 'inativo', tone: 'neutral' };
  if (expired) return { label: 'expirado', tone: 'alert' };
  if (exhausted) return { label: 'esgotado', tone: 'attention' };
  return { label: 'ativo', tone: 'ok' };
}

export default function AdminVouchersScreen() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: me, isLoading: loadingMe } = useCommunityMember(userId);
  const isAdmin = me?.staff_role === 'admin';

  const { data: vouchers, isLoading } = useVouchers();
  const create = useCreateVoucher();

  const [code, setCode] = useState('');
  const [kind, setKind] = useState<VoucherKind>('plus_trial');
  const [durationDays, setDurationDays] = useState('90');
  const [maxUses, setMaxUses] = useState('1');

  async function onCreate() {
    const days = Number(durationDays);
    const uses = Number(maxUses);
    if (!Number.isFinite(days) || days < 1) {
      toast.info('A duração precisa ser de pelo menos 1 dia.');
      return;
    }
    if (!Number.isFinite(uses) || uses < 1) {
      toast.info('O máximo de usos precisa ser de pelo menos 1.');
      return;
    }
    try {
      // Código opcional: vazio deixa o RPC gerar automaticamente.
      await create.mutateAsync({
        code: code.trim(),
        kind,
        durationDays: Math.floor(days),
        maxUses: Math.floor(uses),
      });
      setCode('');
      toast.success('Voucher criado com sucesso.');
    } catch (err) {
      const msg = err instanceof Error ? err.message.replace(/^.*:\s*/, '') : 'Falha ao criar voucher.';
      toast.error(msg);
    }
  }

  const list = vouchers ?? [];

  // Guard de acesso: enquanto carrega o membro, não revela a tela; depois exige admin.
  if (!loadingMe && !isAdmin) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Vouchers" subtitle="Área administrativa" back />
        <Screen>
          <EmptyState
            icon={ShieldX}
            title="Acesso restrito"
            subtitle="Esta área é exclusiva de administradores."
          />
        </Screen>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Vouchers" subtitle="Cortesia do Plus para amigos e investidores" back />
      <Screen>
        {loadingMe ? null : (
          <>
            <SectionTitle>Gerar voucher</SectionTitle>
            <Card className="gap-3">
              <Input
                label="Código (opcional)"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="VIDA-AMIGOS · vazio gera automático"
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <View className="gap-1.5">
                <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
                  Tipo de plano
                </Text>
                <View className="flex-row gap-2">
                  {KINDS.map((k) => {
                    const active = kind === k.key;
                    return (
                      <Pressable
                        key={k.key}
                        onPress={() => setKind(k.key)}
                        style={{ borderCurve: 'continuous' }}
                        className={`flex-1 items-center rounded-xl border py-2.5 ${
                          active ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'
                        }`}
                      >
                        <Text
                          style={{ fontFamily: fonts.semibold }}
                          className={`text-[12px] ${active ? 'text-accent' : 'text-muted'}`}
                        >
                          {k.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input
                    label="Duração (dias)"
                    value={durationDays}
                    onChangeText={setDurationDays}
                    placeholder="90"
                    keyboardType="number-pad"
                  />
                </View>
                <View className="flex-1">
                  <Input
                    label="Máximo de usos"
                    value={maxUses}
                    onChangeText={setMaxUses}
                    placeholder="1"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Button label="Gerar voucher" icon={Gift} loading={create.isPending} onPress={onCreate} />
            </Card>

            <SectionTitle
              action={list.length > 0 ? <Text className="text-[12px] text-muted">{list.length}</Text> : undefined}
            >
              Vouchers
            </SectionTitle>

            {isLoading ? null : list.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title="Nenhum voucher ainda"
                subtitle="Gere o primeiro código no formulário acima."
              />
            ) : (
              <Card className="gap-1">
                {list.map((v, i) => {
                  const status = voucherStatus(v);
                  return (
                    <FadeInItem key={v.id} index={i}>
                      {i > 0 ? <Divider /> : null}
                      <View className="flex-row items-center gap-3 py-2.5">
                        <IconCircle icon={Ticket} tone="attention" size={42} />
                        <View className="flex-1">
                          <View className="flex-row flex-wrap items-center gap-2">
                            <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
                              {v.code}
                            </Text>
                            <Badge tone={v.kind === 'plus_full' ? 'info' : 'neutral'}>
                              {v.kind === 'plus_full' ? 'completo' : 'trial'}
                            </Badge>
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </View>
                          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                            {v.duration_days} dias · {v.uses_count}/{v.max_uses} usos
                            {v.expires_at
                              ? ` · até ${new Date(v.expires_at).toLocaleDateString('pt-BR')}`
                              : ''}
                          </Text>
                        </View>
                      </View>
                    </FadeInItem>
                  );
                })}
              </Card>
            )}
          </>
        )}
      </Screen>
    </View>
  );
}
