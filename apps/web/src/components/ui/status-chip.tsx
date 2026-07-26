import type { ReactNode } from 'react';
import { status, statusMeta } from '@hubpatients/ui-tokens';

/**
 * Chip de status — **cor nunca sozinha** (WCAG SC 1.4.1 "Use of Color").
 *
 * Por que este componente existe: um chip só colorido é invisível para daltônico
 * (8% dos homens), para quem lê no sol e para quem imprime o prontuário. Aqui o
 * `status` e o `label` são OBRIGATÓRIOS, e o chip sempre renderiza **glifo +
 * texto**. Se não dá para escrever um rótulo, não é status — é decoração, e
 * decoração não entra em tela clínica.
 *
 * Três papéis de cor (de `status` em @hubpatients/ui-tokens), porque um âmbar
 * vivo nunca chega a 4,5:1 sobre off-white:
 *   `ink`  → texto e glifo (≥4,5:1 sobre o `tint`)
 *   `mark` → borda/traço (≥3:1, SC 1.4.11)
 *   `tint` → fundo do chip
 *
 * REGRA CLÍNICA: vermelho e âmbar pertencem ao SISTEMA (remédio atrasado, falha
 * de upload), NUNCA ao corpo do paciente. Valor de exame fora da faixa usa
 * `neutro` + seta + "acima do intervalo informado pelo laboratório" — nós
 * exibimos e organizamos, quem interpreta é o médico.
 */

export type StatusKind = keyof typeof statusMeta;

/** Fallback estático (tema claro) caso a CSS var ainda não exista no escopo. */
const FALLBACK = status.light;

/** Nomes das CSS vars do status, geradas em `globals.css` a partir dos tokens. */
export function statusVars(kind: StatusKind) {
  return {
    ink: `var(--status-${kind}-ink, ${FALLBACK[kind].ink})`,
    mark: `var(--status-${kind}-mark, ${FALLBACK[kind].mark})`,
    tint: `var(--status-${kind}-tint, ${FALLBACK[kind].tint})`,
  };
}

/** Rótulo padrão do status (texto clínico já revisado, em PT-BR). */
export function statusLabel(kind: StatusKind): string {
  return statusMeta[kind].label;
}

export interface StatusChipProps {
  /** Papel semântico. Obrigatório: não existe chip "sem status". */
  status: StatusKind;
  /**
   * Texto SEMPRE visível ao lado do glifo. Obrigatório de propósito — é ele que
   * carrega o significado quando a cor não chega (daltonismo, sol, impressão).
   */
  label: ReactNode;
  /** Substitui o glifo padrão (ex.: um ícone do lucide já dimensionado). */
  icon?: ReactNode;
  /** `tint` = fundo preenchido (padrão) · `outline` = só borda, sem fundo. */
  variant?: 'tint' | 'outline';
  /** `sm` = 13px (padrão) · `md` = 15px, para chip isolado em cabeçalho. */
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusChip({
  status: kind,
  label,
  icon,
  variant = 'tint',
  size = 'sm',
  className = '',
}: StatusChipProps) {
  const { ink, mark, tint } = statusVars(kind);
  const glyph = statusMeta[kind].glyph;
  const text = size === 'md' ? 'text-label' : 'text-caption';
  const pad = size === 'md' ? 'px-3 py-1.5' : 'px-2.5 py-1';

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold ${text} ${pad} ${className}`}
      style={{
        color: ink,
        borderColor: mark,
        backgroundColor: variant === 'outline' ? 'transparent' : tint,
      }}
    >
      {/* Glifo é redundante com o texto — por isso fica fora da árvore de
          acessibilidade: o leitor de tela já lê o rótulo. */}
      <span aria-hidden="true" className="shrink-0 leading-none">
        {icon ?? glyph}
      </span>
      <span className="min-w-0 leading-tight">{label}</span>
    </span>
  );
}

/**
 * Marcador inline para uso dentro de frase ou de célula de tabela, quando não
 * cabe um chip inteiro. Continua exigindo rótulo — o glifo sozinho não basta.
 */
export function StatusMark({
  status: kind,
  label,
  className = '',
}: {
  status: StatusKind;
  label: ReactNode;
  className?: string;
}) {
  const { ink } = statusVars(kind);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} style={{ color: ink }}>
      <span aria-hidden="true">{statusMeta[kind].glyph}</span>
      <span>{label}</span>
    </span>
  );
}
