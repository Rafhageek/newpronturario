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
  Sparkles,
  CreditCard,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Disponível na Fase 1 (funcional). Caso contrário, é stub "em breve". */
  ready?: boolean;
  /** Fase do roteiro (para o stub). */
  phase?: number;
  /** Marca de recurso Plus. */
  plus?: boolean;
}

export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard, ready: true },
  { href: '/perfil', label: 'Perfil', icon: User, ready: true },
  { href: '/diario', label: 'Diário clínico', icon: NotebookPen, ready: true },
  { href: '/medicamentos', label: 'Medicamentos', icon: Pill, ready: true },
  { href: '/consentimento', label: 'Consentimento', icon: ShieldCheck, ready: true },
  { href: '/consultas', label: 'Consultas', icon: CalendarDays, phase: 5 },
  { href: '/exames', label: 'Exames', icon: FlaskConical, phase: 3 },
  { href: '/analise', label: 'Análise', icon: LineChart, phase: 3 },
  { href: '/educacao', label: 'Educação', icon: GraduationCap, phase: 3 },
  { href: '/familia', label: 'Família', icon: UsersRound, phase: 5 },
  { href: '/comunidade', label: 'Comunidade', icon: Users, phase: 6 },
  { href: '/rede-social', label: 'Rede Social', icon: Share2, phase: 6 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, phase: 2 },
  { href: '/planos', label: 'Planos', icon: Sparkles, phase: 2, plus: true },
  { href: '/assinatura', label: 'Assinatura', icon: CreditCard, phase: 2 },
];
