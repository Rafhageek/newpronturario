/**
 * Primitivas do Painel (web). Ponto único de import para as rotas:
 *
 *   import { PanelCard, StatCard, PageHeader } from '@/components/ui/painel';
 *
 * O mobile expõe os MESMOS nomes em `@/components/painel`. Divergir a API entre
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
  QuickActions,
  CHIP_TONES,
  chipToneFor,
} from './primitives';

export type {
  Icone,
  PanelCardProps,
  PanelRowProps,
  IconChipProps,
  PanelButtonProps,
  PageHeaderProps,
  SectionHeaderProps,
  StatCardProps,
  EmptyStateProps,
  ErrorStateProps,
  QuickAction,
  ChipTone,
} from './primitives';

export { MoodScale, MoodFace, MoodMark } from './mood-scale';
export type { MoodScaleProps } from './mood-scale';

/**
 * `StatusChip` é REEXPORTADO, não reescrito.
 *
 * O componente de `components/ui/status-chip.tsx` já era o certo — exige
 * `status` E `label`, renderiza glifo + texto (SC 1.4.1: cor nunca sozinha) e
 * usa os três papéis de tinta (`ink`/`mark`/`tint`) que tornam âmbar e vermelho
 * acessíveis. Duplicá-lo dentro do Painel criaria duas fontes da mesma regra, e
 * uma delas ficaria para trás.
 *
 * Ele está aqui porque o DESIGN.md manda usá-lo, e uma peça citada no documento
 * que não aparece no barril empurra cada agente a montar a sua à mão — foi o que
 * aconteceu com o chip "Sem confirmação" no mobile.
 *
 * ⚠️ É a ÚNICA porta de âmbar/vermelho no Painel, e vale só para o SISTEMA
 * (dose atrasada, falha de envio, aviso de segurança). Para dado do corpo do
 * paciente use `<ClinicalRangeChip>` — tinta `neutro` + seta + texto.
 */
export { StatusChip, StatusMark, statusVars, statusLabel } from '@/components/ui/status-chip';
export type { StatusKind, StatusChipProps } from '@/components/ui/status-chip';
