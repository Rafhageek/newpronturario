import { useState } from 'react';
import { View, Text } from 'react-native';
import { Sparkles, Check, Shield, Crown } from 'lucide-react-native';
import { PLANS } from '@hubpatients/core';
import { useHasPlusAccess, useRedeemVoucher } from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Input, Button, Badge, IconCircle } from '@/components/ui';
import { toast } from '@/components/toast';
import { useColors, fonts } from '@/theme';

const FREE_BENEFITS = [
  'Registro de saúde e sinais vitais',
  'Lembretes de medicamentos',
  'Alertas de possíveis interações medicamentosas',
  'Diário de sintomas e humor',
  'Cartão de emergência',
  'Comunidade e segurança — sempre grátis',
];
const PLUS_BENEFITS = [
  'Leitura de exames por IA (OCR)',
  'Lembretes por WhatsApp',
  'Relatórios em PDF para o médico',
  'Assistente de IA do seu prontuário',
  'Histórico ampliado e recursos avançados de organização',
];

export default function PlanosScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const isPlus = useHasPlusAccess(user?.id).data ?? false;
  const [code, setCode] = useState('');
  const redeem = useRedeemVoucher(user?.id ?? '');

  function onRedeem() {
    if (!code.trim()) {
      toast.info('Digite o código do voucher.');
      return;
    }
    redeem.mutate(code.trim().toUpperCase(), {
      onSuccess: () => {
        setCode('');
        toast.success('🎉 Voucher resgatado com sucesso.');
      },
      onError: () => toast.error('Confira o código — pode estar errado, usado ou expirado.'),
    });
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Plano" subtitle="Seu plano e benefícios" back />
      <Screen>
        {/* Plano atual */}
        <Card className="flex-row items-center gap-3">
          <IconCircle icon={isPlus ? Crown : Shield} tone={isPlus ? 'attention' : 'accent'} size={48} />
          <View className="flex-1">
            <Text className="text-[13px] text-muted">Seu plano atual</Text>
            <Text className="text-[18px] font-bold text-fg">
              {isPlus ? PLANS.plus.name : PLANS.free.name}
            </Text>
          </View>
          <Badge tone={isPlus ? 'attention' : 'ok'}>{isPlus ? 'Plus ativo' : 'Grátis'}</Badge>
        </Card>

        {/* Free */}
        <PlanCard
          name={PLANS.free.name}
          price="Grátis para sempre"
          description={PLANS.free.description}
          benefits={FREE_BENEFITS}
          tone="accent"
          current={!isPlus}
        />

        {/* Plus */}
        <PlanCard
          name={PLANS.plus.name}
          price={`R$ ${PLANS.plus.priceMonthlyBRL.toFixed(2).replace('.', ',')}/mês`}
          description={PLANS.plus.description}
          benefits={PLUS_BENEFITS}
          tone="attention"
          highlight
          current={isPlus}
        />

        {/* Resgatar voucher */}
        {!isPlus ? (
          <Card className="gap-3">
            <View className="flex-row items-center gap-2">
              <Sparkles size={18} color={colors.attention} />
              <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">Tenho um voucher</Text>
            </View>
            <Input label="Código" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="VIDA-XXXX" />
            <Button label="Resgatar" icon={Sparkles} loading={redeem.isPending} onPress={onRedeem} />
          </Card>
        ) : null}
      </Screen>
    </View>
  );
}

function PlanCard({
  name,
  price,
  description,
  benefits,
  tone,
  highlight,
  current,
  cta,
}: {
  name: string;
  price: string;
  description: string;
  benefits: string[];
  tone: 'accent' | 'attention';
  highlight?: boolean;
  current?: boolean;
  cta?: React.ReactNode;
}) {
  const colors = useColors();
  const checkColor = tone === 'attention' ? colors.attention : colors.accent;
  return (
    <Card className={`gap-3 ${highlight ? 'border-amber-300' : ''}`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[17px] font-bold text-fg">{name}</Text>
        {current ? <Badge tone="info">Atual</Badge> : null}
      </View>
      <Text className="text-[20px] font-extrabold text-fg">{price}</Text>
      <Text className="text-[13px] text-muted">{description}</Text>
      <View className="mt-1 gap-2">
        {benefits.map((b) => (
          <View key={b} className="flex-row items-start gap-2">
            <Check size={17} color={checkColor} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-[14px] text-fg-soft">{b}</Text>
          </View>
        ))}
      </View>
      {cta}
    </Card>
  );
}
