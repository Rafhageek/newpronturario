import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  User,
  LineChart,
  CalendarHeart,
  FlaskConical,
  Users,
  MessagesSquare,
  Settings,
  CreditCard,
  ShieldCheck,
  GraduationCap,
  Baby,
  HeartPulse,
  Droplets,
  Share2,
  Ticket,
  MapPin,
  Gavel,
  LogOut,
  ChevronDown,
  ChevronRight,
  Search,
  Wind,
  Scale,
  Ruler,
  Utensils,
  Target,
  Lock,
  History,
  QrCode,
  type LucideIcon,
} from 'lucide-react-native';
import { useProfile, useCommunityMember } from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Button, EmptyState } from '@/components/ui';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts, gradients, cardShadow, type Palette } from '@/theme';

type Tone = 'primary' | 'accent' | 'attention' | 'alert' | 'neutral';
type Item = { icon: LucideIcon; title: string; subtitle: string; route?: string; tone?: Tone };
type Group = { grupo: string; itens: Item[] };

const GRUPOS: Group[] = [
  {
    grupo: 'Meu prontuário',
    itens: [
      { icon: History, title: 'Linha do tempo', subtitle: 'Histórico clínico unificado', route: '/linha-do-tempo', tone: 'primary' },
      { icon: FlaskConical, title: 'Exames', subtitle: 'Resultados e laudos', route: '/exames', tone: 'primary' },
      { icon: CalendarHeart, title: 'Consultas', subtitle: 'Atendimentos de saúde', route: '/consultas', tone: 'accent' },
      { icon: LineChart, title: 'Indicadores', subtitle: 'Tendências dos seus dados', route: '/analise', tone: 'primary' },
      { icon: CreditCard, title: 'Plano de saúde', subtitle: 'Carteirinha, mensalidades e reembolsos', route: '/plano-saude', tone: 'primary' },
      { icon: QrCode, title: 'Mostrar ao médico', subtitle: 'Compartilhar por tempo limitado', route: '/compartilhar', tone: 'accent' },
    ],
  },
  {
    grupo: 'Bem-estar',
    itens: [
      { icon: Scale, title: 'Composição corporal', subtitle: 'Peso, gordura, massa muscular', route: '/composicao-corporal', tone: 'primary' },
      { icon: Ruler, title: 'Circunferências', subtitle: 'Cintura, quadril e mais', route: '/circunferencias', tone: 'accent' },
      { icon: Utensils, title: 'Diário alimentar', subtitle: 'O que você comeu', route: '/diario-alimentar', tone: 'attention' },
      { icon: Target, title: 'Metas', subtitle: 'Peso, passos e água', route: '/metas', tone: 'primary' },
      { icon: Wind, title: 'Respirar', subtitle: 'Um momento de calma', route: '/respirar', tone: 'primary' },
    ],
  },
  {
    grupo: 'Jornadas de cuidado',
    itens: [
      { icon: HeartPulse, title: 'Gestação', subtitle: 'Acompanhar a gravidez', route: '/gestacao', tone: 'alert' },
      { icon: Baby, title: 'Criança', subtitle: 'Crescimento e vacinas', route: '/criancas', tone: 'accent' },
      { icon: Droplets, title: 'Ciclo', subtitle: 'Ciclo menstrual', route: '/ciclo', tone: 'alert' },
    ],
  },
  {
    grupo: 'Pessoas e comunidade',
    itens: [
      { icon: Users, title: 'Família', subtitle: 'Compartilhar cuidado', route: '/familia', tone: 'accent' },
      { icon: MessagesSquare, title: 'Comunidade', subtitle: 'Apoio entre pessoas', route: '/comunidade', tone: 'primary' },
      { icon: Share2, title: 'Rede social', subtitle: 'Fórum aberto e perfil', route: '/rede-social', tone: 'accent' },
    ],
  },
  {
    grupo: 'Serviços e conteúdo',
    itens: [
      { icon: GraduationCap, title: 'Conteúdos de saúde', subtitle: 'Aprenda sobre sua saúde', route: '/educacao', tone: 'primary' },
      { icon: MapPin, title: 'Locais de saúde', subtitle: 'Farmácias, clínicas e mais', route: '/locais/pharmacy', tone: 'accent' },
    ],
  },
  {
    grupo: 'Conta e privacidade',
    itens: [
      { icon: ShieldCheck, title: 'Dados e privacidade', subtitle: 'Controles de privacidade e LGPD', route: '/consentimento', tone: 'accent' },
      { icon: Settings, title: 'Configurações', subtitle: 'Notificações e idioma', route: '/configuracoes', tone: 'neutral' },
      /*
       * "Plano" está OCULTO, não removido: o app inteiro foi liberado (migração
       * 0043 — `has_plus_access()` devolve true). A rota `/planos` continua
       * existindo e funcionando; para voltar a cobrar, é só descomentar aqui e
       * restaurar a função no banco.
       * { icon: CreditCard, title: 'Plano', subtitle: 'Plano e benefícios', route: '/planos', tone: 'attention' },
       * (ao restaurar, reimportar `CreditCard` de lucide-react-native)
       */
    ],
  },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function toneColor(tone: Tone | undefined, c: Palette): string {
  switch (tone) {
    case 'accent':
      return c.accent;
    case 'attention':
      return c.attention;
    case 'alert':
      return c.alert;
    case 'neutral':
      return c.muted;
    default:
      return c.primary;
  }
}

export default function MaisScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: member } = useCommunityMember(user?.id);
  const isAdmin = member?.staff_role === 'admin';
  const canModerate = isAdmin || member?.staff_role === 'moderator';
  const [query, setQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Meu prontuário']);

  const equipeItens: Item[] = [
    ...(isAdmin ? [{ icon: Ticket, title: 'Vouchers', subtitle: 'Gerar e gerenciar', route: '/admin/vouchers', tone: 'attention' } as Item] : []),
    ...(isAdmin ? [{ icon: MapPin, title: 'Locais (admin)', subtitle: 'Farmácias e clínicas', route: '/admin/locais', tone: 'primary' } as Item] : []),
    ...(canModerate ? [{ icon: Gavel, title: 'Moderação', subtitle: 'Denúncias e revisão', route: '/moderacao', tone: 'alert' } as Item] : []),
  ];

  const grupos = equipeItens.length > 0
    ? [...GRUPOS, { grupo: 'Ferramentas da equipe', itens: equipeItens }]
    : GRUPOS;

  const q = norm(query);
  const searching = q.length > 0;
  const results = searching
    ? grupos
        .flatMap((group) => group.itens)
        .filter((item) => norm(item.title).includes(q) || norm(item.subtitle).includes(q))
    : [];

  function open(item: Item) {
    if (item.route) router.push(item.route as never);
    else toast.info(`🚧 A tela "${item.title}" chega numa próxima atualização do app.`);
  }

  function toggleGroup(group: string) {
    setExpandedGroups((current) =>
      current.includes(group)
        ? current.filter((candidate) => candidate !== group)
        : [...current, group],
    );
  }

  let idx = 0;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Mais" subtitle="Prontuário, bem-estar e configurações" />
      <Screen>
        {/* Identidade — cartão-gradiente da marca */}
        <FadeInItem index={idx++}>
          <Pressable
            onPress={() => router.push('/perfil')}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil e dados pessoais"
            className="active:opacity-90"
          >
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[{ borderRadius: 24, borderCurve: 'continuous', padding: 18 }, cardShadow]}
            >
              <View className="flex-row items-center gap-3.5">
                <View style={{ borderCurve: 'continuous' }} className="h-14 w-14 items-center justify-center rounded-3xl bg-white/20">
                  <User size={26} color="#ffffff" />
                </View>
                <View className="flex-1">
                  <Text style={{ fontFamily: fonts.displayX }} className="text-[19px] text-white" numberOfLines={1}>
                    {profile?.full_name ?? 'Meu perfil'}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-white/80" numberOfLines={1}>
                    {user?.email ?? 'Ver e editar seus dados'}
                  </Text>
                </View>
                <ChevronRight size={20} color="rgba(255,255,255,0.85)" />
              </View>
            </LinearGradient>
          </Pressable>
        </FadeInItem>

        {/* Busca */}
        <View
          className="flex-row items-center gap-2.5 rounded-2xl border border-line bg-surface px-4"
          style={{ height: 52, borderCurve: 'continuous' }}
        >
          <Search size={18} color={colors.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar função…"
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            accessibilityLabel="Buscar função"
            accessibilityHint="Busca em todas as áreas desta tela"
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.fg }}
          />
        </View>

        {searching ? (
          results.length > 0 ? (
            <ListCard items={results} onOpen={open} colors={colors} />
          ) : (
            <EmptyState icon={Search} title="Nada encontrado" subtitle="Confira o termo e tente novamente." />
          )
        ) : (
          grupos.map((g) => (
            <FadeInItem key={g.grupo} index={idx++}>
              <DisclosureGroup
                group={g}
                expanded={expandedGroups.includes(g.grupo)}
                onToggle={() => toggleGroup(g.grupo)}
                onOpen={open}
                colors={colors}
              />
            </FadeInItem>
          ))
        )}

        {!searching && (
          <View className="flex-row items-start gap-2 px-1 pt-1">
            <Lock size={13} color={colors.faint} style={{ marginTop: 2 }} />
            <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-4 text-faint">
              Seus dados de saúde são criptografados e você controla o compartilhamento.
            </Text>
          </View>
        )}

        <FadeInItem index={idx++}>
          <Button label="Sair da conta" variant="outline" icon={LogOut} onPress={() => signOut()} />
        </FadeInItem>
      </Screen>
    </View>
  );
}

function DisclosureGroup({
  group,
  expanded,
  onToggle,
  onOpen,
  colors,
}: {
  group: Group;
  expanded: boolean;
  onToggle: () => void;
  onOpen: (item: Item) => void;
  colors: Palette;
}) {
  return (
    <View className="gap-2">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${group.grupo}, ${group.itens.length} opções`}
        className="flex-row items-center justify-between rounded-2xl px-1 active:opacity-70"
        style={{ minHeight: 44 }}
      >
        <Text style={{ fontFamily: fonts.display }} className="text-[16px] text-fg">
          {group.grupo}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
            {group.itens.length}
          </Text>
          <ChevronDown
            size={18}
            color={colors.muted}
            style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
          />
        </View>
      </Pressable>
      {expanded && <ListCard items={group.itens} onOpen={onOpen} colors={colors} />}
    </View>
  );
}

/** Cartão de grupo (inset grouped) com linhas divididas por hairline. */
function ListCard({ items, onOpen, colors }: { items: Item[]; onOpen: (i: Item) => void; colors: Palette }) {
  return (
    <View className="overflow-hidden rounded-3xl border border-line bg-surface" style={{ borderCurve: 'continuous' }}>
      {items.map((item, i) => (
        <View key={item.title}>
          {i > 0 && <View style={{ marginLeft: 66, height: 1, backgroundColor: colors.line }} />}
          <Row item={item} onPress={() => onOpen(item)} colors={colors} />
        </View>
      ))}
    </View>
  );
}

function Row({ item, onPress, colors }: { item: Item; onPress: () => void; colors: Palette }) {
  const color = toneColor(item.tone, colors);
  const Icon = item.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.subtitle}`}
      className="flex-row items-center gap-3 px-4 active:bg-surface-2"
      style={{ minHeight: 62 }}
    >
      <View
        style={{ backgroundColor: `${color}22`, borderCurve: 'continuous' }}
        className="h-10 w-10 items-center justify-center rounded-2xl"
      >
        <Icon size={20} color={color} strokeWidth={2} />
      </View>
      <View className="flex-1 py-3">
        <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
          {item.title}
        </Text>
        <Text style={{ fontFamily: fonts.regular }} numberOfLines={1} className="text-[12px] text-muted">
          {item.subtitle}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.faint} />
    </Pressable>
  );
}
