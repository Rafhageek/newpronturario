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
  IconChip,
  PanelButton,
  Seal,
  PageHeader,
  SectionHeader,
  StatCard,
  StatRow,
  EmptyState,
  QuickActions,
  CHIP_TONES,
  chipToneFor,
} from './primitives';

export type {
  PanelCardProps,
  IconChipProps,
  PanelButtonProps,
  PageHeaderProps,
  SectionHeaderProps,
  StatCardProps,
  EmptyStateProps,
  QuickAction,
  ChipTone,
} from './primitives';

export { MoodScale, MoodFace, MoodMark } from './mood-scale';
export type { MoodScaleProps } from './mood-scale';
