import {
  Activity,
  Baby,
  Brain,
  CircleHelp,
  HeartPulse,
  MessagesSquare,
  Pill,
  Salad,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  Activity,
  HeartPulse,
  Brain,
  Baby,
  Users,
  Pill,
  Salad,
  CircleHelp,
  Stethoscope,
};

/** Mapeia o nome do ícone (forum_categories.icon) para o componente lucide. */
export function categoryIcon(name?: string | null): LucideIcon {
  return (name && MAP[name]) || MessagesSquare;
}
