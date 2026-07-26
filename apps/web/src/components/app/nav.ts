import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  User,
  NotebookPen,
  Pill,
  CalendarDays,
  FlaskConical,
  LineChart,
  Users,
  Share2,
  UsersRound,
  GraduationCap,
  ShieldCheck,
  Settings,
  Baby,
  Blocks,
  Droplets,
  Gavel,
  MapPin,
  Building2,
  Wind,
  Scale,
  Ruler,
  Utensils,
  Target,
  History,
  QrCode,
} from 'lucide-react';

/** Seções temáticas do menu, na ordem de exibição. */
export type NavSection =
  | 'Meu prontuário'
  | 'Bem-estar'
  | 'Jornadas de cuidado'
  | 'Comunidade e serviços'
  | 'Conta e privacidade'
  | 'Equipe';
export const NAV_SECTIONS: NavSection[] = [
  'Meu prontuário',
  'Bem-estar',
  'Jornadas de cuidado',
  'Comunidade e serviços',
  'Conta e privacidade',
  'Equipe',
];
export const PRIMARY_NAV_SECTION: NavSection = 'Meu prontuário';

/** Estado real do módulo (reflete o que de fato funciona, não o roteiro). */
export type NavStatus = 'stable' | 'beta' | 'planned';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: NavSection;
  /** 'stable' = pronto · 'beta' = funciona, em evolução · 'planned' = em breve. */
  status: NavStatus;
  /** Marca de recurso Plus. */
  plus?: boolean;
  /** Exibição condicional. Filtrado na sidebar conforme o perfil/papel. */
  gate?: 'pregnancy' | 'cycle' | 'staff';
}

export const NAV: NavItem[] = [
  // Meu prontuário: tarefas clínicas mais frequentes ficam sempre visíveis.
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard, section: 'Meu prontuário', status: 'stable' },
  { href: '/linha-do-tempo', label: 'Linha do tempo', icon: History, section: 'Meu prontuário', status: 'stable' },
  { href: '/diario', label: 'Diário clínico', icon: NotebookPen, section: 'Meu prontuário', status: 'stable' },
  { href: '/medicamentos', label: 'Medicamentos', icon: Pill, section: 'Meu prontuário', status: 'stable' },
  { href: '/exames', label: 'Exames', icon: FlaskConical, section: 'Meu prontuário', status: 'stable' },
  { href: '/consultas', label: 'Consultas', icon: CalendarDays, section: 'Meu prontuário', status: 'stable' },
  { href: '/compartilhar', label: 'Mostrar ao médico', icon: QrCode, section: 'Meu prontuário', status: 'beta' },

  // Bem-estar
  { href: '/analise', label: 'Indicadores', icon: LineChart, section: 'Bem-estar', status: 'beta' },
  { href: '/composicao-corporal', label: 'Composição corporal', icon: Scale, section: 'Bem-estar', status: 'beta' },
  { href: '/circunferencias', label: 'Circunferências', icon: Ruler, section: 'Bem-estar', status: 'beta' },
  { href: '/diario-alimentar', label: 'Diário alimentar', icon: Utensils, section: 'Bem-estar', status: 'beta' },
  { href: '/metas', label: 'Metas', icon: Target, section: 'Bem-estar', status: 'beta' },
  { href: '/respirar', label: 'Respirar', icon: Wind, section: 'Bem-estar', status: 'stable' },

  // Jornadas de cuidado
  { href: '/gestacao', label: 'Gestação', icon: Baby, section: 'Jornadas de cuidado', status: 'stable', gate: 'pregnancy' },
  { href: '/ciclo', label: 'Ciclo', icon: Droplets, section: 'Jornadas de cuidado', status: 'stable', gate: 'cycle' },
  { href: '/criancas', label: 'Crianças', icon: Blocks, section: 'Jornadas de cuidado', status: 'stable' },

  // Comunidade e serviços
  { href: '/locais/pharmacy', label: 'Locais de saúde', icon: MapPin, section: 'Comunidade e serviços', status: 'stable' },
  { href: '/familia', label: 'Família', icon: UsersRound, section: 'Comunidade e serviços', status: 'stable' },
  { href: '/comunidade', label: 'Comunidade', icon: Users, section: 'Comunidade e serviços', status: 'stable' },
  { href: '/rede-social', label: 'Rede social', icon: Share2, section: 'Comunidade e serviços', status: 'beta' },
  { href: '/educacao', label: 'Conteúdos de saúde', icon: GraduationCap, section: 'Comunidade e serviços', status: 'beta' },

  // Conta e privacidade
  { href: '/perfil', label: 'Perfil', icon: User, section: 'Conta e privacidade', status: 'stable' },
  { href: '/consentimento', label: 'Dados e privacidade', icon: ShieldCheck, section: 'Conta e privacidade', status: 'stable' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, section: 'Conta e privacidade', status: 'stable' },
  /*
   * Plano e Assinatura estão OCULTOS, não removidos: o app inteiro foi liberado
   * (migração 0043 — `has_plus_access()` devolve true). As rotas continuam
   * existindo e funcionando; para voltar a cobrar, descomentar aqui e restaurar
   * a função no banco (o passo a passo está no cabeçalho da 0043).
   * { href: '/planos', label: 'Plano e benefícios', icon: Sparkles, section: 'Conta e privacidade', status: 'stable', plus: true },
   * { href: '/assinatura', label: 'Assinatura e cobrança', icon: CreditCard, section: 'Conta e privacidade', status: 'beta' },
   * (ao restaurar, reimportar `Sparkles` e `CreditCard` de lucide-react)
   */

  // Equipe
  { href: '/moderacao', label: 'Moderação', icon: Gavel, section: 'Equipe', status: 'stable', gate: 'staff' },
  { href: '/admin/locais', label: 'Locais (admin)', icon: Building2, section: 'Equipe', status: 'stable', gate: 'staff' },
];
