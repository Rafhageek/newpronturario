import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { dataDoDia, diaEMes, diaLocal, DIAS_SEMANA_PT } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import {
  PageHeader,
  PanelCard,
  PanelButton,
  IconChip,
  Seal,
  EmptyState,
  chipToneFor,
  type ChipTone,
} from '@/components/painel';
import { useTabBarSpace } from '@/components/tab-bar';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import {
  useColors,
  useType,
  useFontScaler,
  useTapTarget,
  fonts,
  gradients,
  space,
  radius,
  cardShadow,
} from '@/theme';

/* ════════════════════════════════════════════════════════════════════════════
 * A CASCA — o mapa do app.
 *
 * O que mudou de verdade nesta tela, além da superfície fria:
 *
 * O ícone de cada item era pintado por um `tone` de GRAVIDADE — "Gestação" e
 * "Ciclo" saíam em VERMELHO, "Diário alimentar" em ÂMBAR. Ou seja: o menu
 * classificava assuntos do corpo em graus de alarme antes de a pessoa abrir
 * qualquer um deles. Gravidez não é uma emergência, e ciclo menstrual não é um
 * aviso de risco. Agora a cor vem do `IconChip`, e ela diz DE QUE ASSUNTO é o
 * item — um tom por GRUPO, derivado do nome do grupo por `chipToneFor()`, o
 * mesmo cálculo que a lateral da web usa. A paleta de chips vive entre 165° e
 * 320° de matiz: não existe vermelho nem âmbar ali para escolher por engano.
 * ========================================================================= */

type Item = { icon: LucideIcon; title: string; subtitle: string; route?: string };
type Group = { grupo: string; itens: Item[] };
/** Item já resolvido com o tom do grupo a que pertence (usado na busca). */
type ItemComTom = Item & { tone: ChipTone };

const GRUPOS: Group[] = [
  {
    grupo: 'Meu prontuário',
    itens: [
      { icon: History, title: 'Linha do tempo', subtitle: 'Histórico clínico unificado', route: '/linha-do-tempo' },
      { icon: FlaskConical, title: 'Exames', subtitle: 'Resultados e laudos', route: '/exames' },
      { icon: CalendarHeart, title: 'Consultas', subtitle: 'Atendimentos de saúde', route: '/consultas' },
      { icon: LineChart, title: 'Indicadores', subtitle: 'Tendências dos seus dados', route: '/analise' },
      { icon: CreditCard, title: 'Plano de saúde', subtitle: 'Carteirinha, mensalidades e reembolsos', route: '/plano-saude' },
      { icon: QrCode, title: 'Mostrar ao médico', subtitle: 'Compartilhar por tempo limitado', route: '/compartilhar' },
    ],
  },
  {
    grupo: 'Bem-estar',
    itens: [
      { icon: Scale, title: 'Composição corporal', subtitle: 'Peso, gordura, massa muscular', route: '/composicao-corporal' },
      { icon: Ruler, title: 'Circunferências', subtitle: 'Cintura, quadril e mais', route: '/circunferencias' },
      { icon: Utensils, title: 'Diário alimentar', subtitle: 'O que você comeu', route: '/diario-alimentar' },
      { icon: Target, title: 'Metas', subtitle: 'Peso, passos e água', route: '/metas' },
      { icon: Wind, title: 'Respirar', subtitle: 'Um momento de calma', route: '/respirar' },
    ],
  },
  {
    grupo: 'Jornadas de cuidado',
    itens: [
      { icon: HeartPulse, title: 'Gestação', subtitle: 'Acompanhar a gravidez', route: '/gestacao' },
      { icon: Baby, title: 'Criança', subtitle: 'Crescimento e vacinas', route: '/criancas' },
      { icon: Droplets, title: 'Ciclo', subtitle: 'Ciclo menstrual', route: '/ciclo' },
    ],
  },
  {
    grupo: 'Pessoas e comunidade',
    itens: [
      { icon: Users, title: 'Família', subtitle: 'Compartilhar cuidado', route: '/familia' },
      { icon: MessagesSquare, title: 'Comunidade', subtitle: 'Apoio entre pessoas', route: '/comunidade' },
      { icon: Share2, title: 'Rede social', subtitle: 'Fórum aberto e perfil', route: '/rede-social' },
    ],
  },
  {
    grupo: 'Serviços e conteúdo',
    itens: [
      { icon: GraduationCap, title: 'Conteúdos de saúde', subtitle: 'Aprenda sobre sua saúde', route: '/educacao' },
      { icon: MapPin, title: 'Locais de saúde', subtitle: 'Farmácias, clínicas e mais', route: '/locais/pharmacy' },
    ],
  },
  {
    grupo: 'Conta e privacidade',
    itens: [
      { icon: ShieldCheck, title: 'Dados e privacidade', subtitle: 'Controles de privacidade e LGPD', route: '/consentimento' },
      { icon: Settings, title: 'Configurações', subtitle: 'Notificações e idioma', route: '/configuracoes' },
      /*
       * "Plano" está OCULTO, não removido: o app inteiro foi liberado (migração
       * 0043 — `has_plus_access()` devolve true). A rota `/planos` continua
       * existindo e funcionando; para voltar a cobrar, é só descomentar aqui.
       * { icon: CreditCard, title: 'Plano', subtitle: 'Plano e benefícios', route: '/planos' },
       */
    ],
  },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** "Quarta-feira, 5 de agosto" — sem `Intl` (Hermes derruba o app com ele). */
function dataDoCabecalho(dia: string): string {
  const d = dataDoDia(dia);
  if (!d) return '';
  const semana = DIAS_SEMANA_PT[d.getDay()] ?? '';
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${diaEMes(dia)}`;
}

export default function MaisScreen() {
  const router = useRouter();
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();

  const { user, signOut } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: member } = useCommunityMember(user?.id);
  const isAdmin = member?.staff_role === 'admin';
  const canModerate = isAdmin || member?.staff_role === 'moderator';
  const [query, setQuery] = useState('');
  const [abertos, setAbertos] = useState<string[]>(['Meu prontuário']);

  const itensDaEquipe: Item[] = [
    ...(isAdmin
      ? [{ icon: Ticket, title: 'Vouchers', subtitle: 'Gerar e gerenciar', route: '/admin/vouchers' } as Item]
      : []),
    ...(isAdmin
      ? [{ icon: MapPin, title: 'Locais (admin)', subtitle: 'Farmácias e clínicas', route: '/admin/locais' } as Item]
      : []),
    ...(canModerate
      ? [{ icon: Gavel, title: 'Moderação', subtitle: 'Denúncias e revisão', route: '/moderacao' } as Item]
      : []),
  ];

  const grupos =
    itensDaEquipe.length > 0
      ? [...GRUPOS, { grupo: 'Ferramentas da equipe', itens: itensDaEquipe }]
      : GRUPOS;

  const q = norm(query);
  const buscando = q.length > 0;
  // O tom do grupo acompanha o item na busca: o mesmo assunto mantém a mesma cor
  // esteja ele na lista agrupada ou no resultado.
  const resultados: ItemComTom[] = buscando
    ? grupos.flatMap((g) =>
        g.itens
          .filter((item) => norm(item.title).includes(q) || norm(item.subtitle).includes(q))
          .map((item) => ({ ...item, tone: chipToneFor(g.grupo) })),
      )
    : [];

  function abrir(item: Item) {
    if (item.route) router.push(item.route as never);
    else toast.info(`A tela "${item.title}" chega numa próxima atualização do app.`);
  }

  function alternarGrupo(grupo: string) {
    setAbertos((atual) =>
      atual.includes(grupo) ? atual.filter((g) => g !== grupo) : [...atual, grupo],
    );
  }

  let idx = 0;

  return (
    // Canvas frio do Painel — desde 2026-08 é o `bg` do app inteiro.
    <View className="flex-1 bg-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: tabBarSpace }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 760,
            alignSelf: 'center',
            paddingTop: insets.top + space[3],
            paddingHorizontal: space[4] + 2,
            gap: space[3],
          }}
        >
          <PageHeader
            eyebrow={dataDoCabecalho(diaLocal())}
            title="Mais"
            subtitle="Prontuário, bem-estar e ajustes da conta."
          />
          <Seal icon={Lock} label="Você controla o que é compartilhado" />
        </View>

        <View
          style={{
            width: '100%',
            maxWidth: 760,
            alignSelf: 'center',
            paddingHorizontal: space[4] + 2,
            paddingTop: space[4],
            gap: space[4],
          }}
        >
          {/* Identidade — o único momento de marca desta tela. */}
          <FadeInItem index={idx++}>
            <Pressable
              onPress={() => router.push('/perfil')}
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil e dados pessoais"
            >
              <LinearGradient
                colors={gradients.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  {
                    borderRadius: radius.xl,
                    borderCurve: 'continuous',
                    padding: space[4] + 2,
                  },
                  cardShadow,
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] + 2 }}>
                  <View
                    style={{
                      minHeight: 56,
                      minWidth: 56,
                      borderRadius: radius.lg,
                      borderCurve: 'continuous',
                      backgroundColor: 'rgba(255,255,255,0.20)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <User size={26} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={[{ fontFamily: fonts.displayX, color: '#ffffff' }, fs(19, 25)]}
                    >
                      {profile?.full_name ?? 'Meu perfil'}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.88)' },
                        fs(13, 18),
                      ]}
                    >
                      {user?.email ?? 'Ver e editar seus dados'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color="rgba(255,255,255,0.9)" />
                </View>
              </LinearGradient>
            </Pressable>
          </FadeInItem>

          {/* Busca. `minHeight` (não `height`) e borda `line-strong`: campo de
              formulário precisa de 3:1 contra o fundo (SC 1.4.11), e a linha
              decorativa não chega perto disso. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[2] + 2,
              minHeight: Math.max(tap + 8, 52),
              paddingHorizontal: space[4],
              borderRadius: radius.md,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: colors.lineStrong,
              backgroundColor: colors.surface,
            }}
          >
            <Search size={18} color={colors.hint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar função…"
              placeholderTextColor={colors.hint}
              returnKeyType="search"
              accessibilityLabel="Buscar função"
              accessibilityHint="Busca em todas as áreas desta tela"
              style={[
                { flex: 1, fontFamily: fonts.regular, color: colors.fg },
                fs(15, 20),
              ]}
            />
          </View>

          {buscando ? (
            resultados.length > 0 ? (
              <CartaoDeLista itens={resultados} onAbrir={abrir} />
            ) : (
              <EmptyState
                icon={Search}
                title="Nada encontrado"
                description={`Nenhuma área com "${query.trim()}". Confira o termo e tente de novo.`}
              />
            )
          ) : (
            grupos.map((g) => (
              <FadeInItem key={g.grupo} index={idx++}>
                <GrupoColapsavel
                  grupo={g}
                  aberto={abertos.includes(g.grupo)}
                  onAlternar={() => alternarGrupo(g.grupo)}
                  onAbrir={abrir}
                />
              </FadeInItem>
            ))
          )}

          {!buscando ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
              <Lock size={14} color={colors.hint} style={{ marginTop: 3 }} />
              <Text style={[t.caption, { color: colors.hint, flex: 1 }]}>
                Seus dados de saúde são criptografados e você controla o compartilhamento.
              </Text>
            </View>
          ) : null}

          <FadeInItem index={idx++}>
            <PanelButton label="Sair da conta" variant="secondary" icon={LogOut} onPress={signOut} />
          </FadeInItem>
        </View>
      </ScrollView>
    </View>
  );
}

function GrupoColapsavel({
  grupo,
  aberto,
  onAlternar,
  onAbrir,
}: {
  grupo: Group;
  aberto: boolean;
  onAlternar: () => void;
  onAbrir: (i: Item) => void;
}) {
  const colors = useColors();
  const fs = useFontScaler();
  const tap = useTapTarget();
  // Um tom por ASSUNTO: todos os itens do grupo compartilham a cor do grupo, e
  // ela é derivada do nome — a lateral da web chega ao mesmo tom sem tabela.
  const tone = chipToneFor(grupo.grupo);
  const itens: ItemComTom[] = grupo.itens.map((item) => ({ ...item, tone }));

  return (
    <View style={{ gap: space[2] }}>
      <Pressable
        onPress={onAlternar}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        accessibilityLabel={`${grupo.grupo}, ${grupo.itens.length} opções`}
        style={{
          minHeight: tap,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[2],
          paddingHorizontal: space[1],
        }}
      >
        <Text
          accessibilityRole="header"
          style={[{ fontFamily: fonts.display, color: colors.fg, flex: 1 }, fs(17, 23)]}
        >
          {grupo.grupo}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Text style={[{ fontFamily: fonts.medium, color: colors.muted }, fs(13, 18)]}>
            {grupo.itens.length}
          </Text>
          <ChevronDown
            size={18}
            color={colors.muted}
            style={{ transform: [{ rotate: aberto ? '180deg' : '0deg' }] }}
          />
        </View>
      </Pressable>
      {aberto ? <CartaoDeLista itens={itens} onAbrir={onAbrir} /> : null}
    </View>
  );
}

/**
 * Cartão de grupo, com as linhas divididas por hairline.
 *
 * A lista é EMBUTIDA no `PanelCard` em vez de sangrar até a borda: o cartão
 * mantém o respiro dele intacto e esta tela não precisa sobrescrever o padding
 * da primitiva. Um cartão que cada tela reconfigura deixa de ser primitiva.
 */
function CartaoDeLista({
  itens,
  onAbrir,
}: {
  itens: ItemComTom[];
  onAbrir: (i: Item) => void;
}) {
  const colors = useColors();
  return (
    <PanelCard>
      {itens.map((item, i) => (
        <View key={item.title}>
          {i > 0 ? (
            // Recuo até a coluna do texto (chip de 40 + folga de 12).
            <View style={{ marginLeft: 52, height: 1, backgroundColor: colors.line }} />
          ) : null}
          <Linha item={item} onPress={() => onAbrir(item)} />
        </View>
      ))}
    </PanelCard>
  );
}

function Linha({ item, onPress }: { item: ItemComTom; onPress: () => void }) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.subtitle}`}
      style={{
        // `minHeight`, nunca `height`: com a fonte ampliada a linha cresce em
        // vez de cortar o subtítulo.
        minHeight: tap,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingVertical: space[3],
      }}
    >
      <IconChip icon={item.icon} tone={item.tone} />
      <View style={{ flex: 1 }}>
        <Text style={[{ fontFamily: fonts.semibold, color: colors.fg }, fs(15, 20)]}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={[t.caption, { color: colors.muted }]}>
          {item.subtitle}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.hint} />
    </Pressable>
  );
}
