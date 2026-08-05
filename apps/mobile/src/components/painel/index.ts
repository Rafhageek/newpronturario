/**
 * Primitivas do Painel (mobile). Ponto único de import para as telas:
 *
 *   import { PanelCard, StatCard, PageHeader } from '@/components/painel';
 *
 * A web expõe os MESMOS nomes em `@/components/ui/painel`. Divergir a API entre
 * as duas plataformas é o começo do fim da paridade — ver docs/DESIGN.md.
 */

export {
  PanelCard,
  PanelRow,
  IconChip,
  PanelButton,
  Seal,
  PageHeader,
  SectionHeader,
  StatCard,
  StatRow,
  EmptyState,
  ErrorState,
  StatusChip,
  QuickActions,
  CHIP_TONES,
  chipToneFor,
} from './primitives';

export type {
  PanelCardProps,
  PanelRowProps,
  IconChipProps,
  PanelButtonProps,
  PageHeaderProps,
  SectionHeaderProps,
  StatCardProps,
  EmptyStateProps,
  ErrorStateProps,
  StatusChipProps,
  StatusKind,
  QuickAction,
  ChipTone,
} from './primitives';

export { MoodScale, MoodFace, MoodMark } from './mood-scale';
export type { MoodScaleProps } from './mood-scale';
