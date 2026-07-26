/**
 * Catálogo de regiões corporais para o mapa de dor.
 *
 * `code` casa com `data-region-code`/id do path no SVG do <BodyPainMap>.
 * `label_pt` é o `aria-label` (acessibilidade — leitor de tela).
 * Estático no código (não é tabela) por ser referência fixa.
 */

export type BodyView = 'front' | 'back';
export type BodySide = 'left' | 'right' | 'center';

export interface BodyRegion {
  code: string;
  label_pt: string;
  view: BodyView;
  side: BodySide;
}

export const BODY_REGIONS: BodyRegion[] = [
  // ── Frente ──────────────────────────────────────────────────────────────
  { code: 'head_front', label_pt: 'Cabeça', view: 'front', side: 'center' },
  { code: 'neck', label_pt: 'Pescoço', view: 'front', side: 'center' },
  { code: 'chest', label_pt: 'Tórax', view: 'front', side: 'center' },
  { code: 'abdomen_upper', label_pt: 'Abdômen superior', view: 'front', side: 'center' },
  { code: 'abdomen_lower', label_pt: 'Abdômen inferior', view: 'front', side: 'center' },
  { code: 'shoulder_left', label_pt: 'Ombro esquerdo', view: 'front', side: 'left' },
  { code: 'shoulder_right', label_pt: 'Ombro direito', view: 'front', side: 'right' },
  { code: 'upper_arm_left', label_pt: 'Braço esquerdo', view: 'front', side: 'left' },
  { code: 'upper_arm_right', label_pt: 'Braço direito', view: 'front', side: 'right' },
  { code: 'forearm_left', label_pt: 'Antebraço esquerdo', view: 'front', side: 'left' },
  { code: 'forearm_right', label_pt: 'Antebraço direito', view: 'front', side: 'right' },
  { code: 'hand_left', label_pt: 'Mão esquerda', view: 'front', side: 'left' },
  { code: 'hand_right', label_pt: 'Mão direita', view: 'front', side: 'right' },
  { code: 'hip_left', label_pt: 'Quadril esquerdo', view: 'front', side: 'left' },
  { code: 'hip_right', label_pt: 'Quadril direito', view: 'front', side: 'right' },
  { code: 'thigh_left', label_pt: 'Coxa esquerda', view: 'front', side: 'left' },
  { code: 'thigh_right', label_pt: 'Coxa direita', view: 'front', side: 'right' },
  { code: 'knee_left', label_pt: 'Joelho esquerdo', view: 'front', side: 'left' },
  { code: 'knee_right', label_pt: 'Joelho direito', view: 'front', side: 'right' },
  { code: 'shin_left', label_pt: 'Canela esquerda', view: 'front', side: 'left' },
  { code: 'shin_right', label_pt: 'Canela direita', view: 'front', side: 'right' },
  { code: 'foot_left', label_pt: 'Pé esquerdo', view: 'front', side: 'left' },
  { code: 'foot_right', label_pt: 'Pé direito', view: 'front', side: 'right' },
  // ── Costas ──────────────────────────────────────────────────────────────
  { code: 'head_back', label_pt: 'Cabeça (atrás)', view: 'back', side: 'center' },
  { code: 'nape', label_pt: 'Nuca', view: 'back', side: 'center' },
  { code: 'upper_back', label_pt: 'Costas (parte superior)', view: 'back', side: 'center' },
  { code: 'mid_back', label_pt: 'Costas (meio)', view: 'back', side: 'center' },
  { code: 'lower_back', label_pt: 'Lombar', view: 'back', side: 'center' },
  { code: 'buttock_left', label_pt: 'Glúteo esquerdo', view: 'back', side: 'left' },
  { code: 'buttock_right', label_pt: 'Glúteo direito', view: 'back', side: 'right' },
];

const BY_CODE = new Map(BODY_REGIONS.map((r) => [r.code, r]));

/** Rótulo pt-BR de uma região (fallback para o próprio código). */
export function bodyRegionLabel(code: string): string {
  return BY_CODE.get(code)?.label_pt ?? code;
}

export function bodyRegion(code: string): BodyRegion | undefined {
  return BY_CODE.get(code);
}

export const PAIN_TYPES = ['aguda', 'persistente', 'pulsante', 'queimacao'] as const;
export const PAIN_TYPE_LABELS: Record<string, string> = {
  aguda: 'Aguda',
  persistente: 'Persistente',
  pulsante: 'Pulsante',
  queimacao: 'Queimação',
};

/**
 * Cor da intensidade (0–10) — rampa de UM matiz (azul), do claro ao escuro.
 * Dor é dado autorrelatado sobre o próprio corpo do paciente: a regra do
 * design system reserva vermelho/âmbar para o SISTEMA (remédio atrasado,
 * erro de upload) — nunca para colorir o corpo do paciente como um semáforo
 * de gravidade. Mesma rampa de `chart.sequential` em `@hubpatients/ui-tokens`.
 */
export function painIntensityColor(intensity: number): string {
  const i = Math.max(0, Math.min(10, intensity));
  if (i === 0) return '#e5e7eb';
  if (i <= 3) return '#b4cfff';
  if (i <= 6) return '#6991dc';
  if (i <= 8) return '#31559a';
  return '#17397b';
}

/**
 * Cor de texto/ícone sobre o preenchimento de `painIntensityColor` —
 * contrastes WCAG verificados: faixas claras ≥ 5,54:1 com tinta escura,
 * faixas escuras ≥ 7,25:1 com branco. Sempre fixa (não segue o tema do
 * app: o preenchimento também é fixo, então o texto precisa acompanhá-lo).
 */
export function painIntensityTextColor(intensity: number): string {
  const i = Math.max(0, Math.min(10, intensity));
  return i <= 6 ? '#1b1a18' : '#ffffff';
}

export const PAIN_DISCLAIMER =
  'O mapa de dor é um registro pessoal para você comunicar ao seu médico — não interpreta nem diagnostica.';
