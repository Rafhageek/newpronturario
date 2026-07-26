import { View, Text } from 'react-native';
import {
  BookText,
  HeartHandshake,
  Stethoscope,
  Ban,
  MessageCircle,
  Lock,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { CRISIS_NOTICE } from '@hubpatients/core';
import { Screen, AppHeader, Card } from '@/components/ui';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts } from '@/theme';

type Rule = { icon: LucideIcon; title: string; text: string };

const RULES: Rule[] = [
  {
    icon: HeartHandshake,
    title: 'Respeito sempre',
    text: 'Acolhemos experiências e dúvidas sem julgamento. Nada de ataques, preconceito ou exposição de outras pessoas.',
  },
  {
    icon: Stethoscope,
    title: 'Sem prescrição',
    text: 'Compartilhe o que viveu — mas recomendações de dose, troca ou suspensão de remédio só vêm do seu médico.',
  },
  {
    icon: Ban,
    title: 'Sem venda de remédios',
    text: 'Compra, venda, troca ou doação de medicamentos é proibida por lei no Brasil e não é permitida aqui.',
  },
  {
    icon: MessageCircle,
    title: 'Sem desinformação',
    text: 'Evite “curas milagrosas” e informações falsas de saúde. Na dúvida, traga a fonte e fale com seu médico.',
  },
  {
    icon: Lock,
    title: 'Privacidade',
    text: 'Não publique dados de terceiros. Você pode postar com pseudônimo ou de forma anônima a qualquer momento.',
  },
  {
    icon: ShieldCheck,
    title: 'Moderação',
    text: 'Conteúdos que violam as regras podem ser ocultados. Advertências repetidas suspendem a publicação por um período (a leitura continua).',
  },
];

export default function CommunityRulesScreen() {
  const colors = useColors();

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Regras"
        subtitle="Um espaço seguro de apoio entre quem vive desafios de saúde parecidos"
        back
        icon={BookText}
      />
      <Screen>
        <View className="gap-2.5">
          {RULES.map((r, i) => (
            <FadeInItem key={r.title} index={i}>
              <Card className="flex-row items-start gap-3">
                <View
                  style={{ borderCurve: 'continuous' }}
                  className="h-9 w-9 items-center justify-center rounded-xl bg-trust-100"
                >
                  <r.icon size={18} color={colors.primary} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    style={{ fontFamily: fonts.semibold }}
                    className="text-[14px] text-fg"
                  >
                    {r.title}
                  </Text>
                  <Text
                    style={{ fontFamily: fonts.regular }}
                    className="mt-0.5 text-[12px] leading-5 text-muted"
                  >
                    {r.text}
                  </Text>
                </View>
              </Card>
            </FadeInItem>
          ))}
        </View>

        {/* Aviso de apoio emocional (crise) */}
        <View
          style={{ borderCurve: 'continuous' }}
          className="flex-row items-start gap-2.5 rounded-2xl border border-health-300/40 bg-health-300/10 px-4 py-3"
        >
          <HeartHandshake size={18} color={colors.accent} style={{ marginTop: 1 }} />
          <Text
            style={{ fontFamily: fonts.regular }}
            className="flex-1 text-[12px] leading-5 text-fg-soft"
          >
            {CRISIS_NOTICE}
          </Text>
        </View>
      </Screen>
    </View>
  );
}
