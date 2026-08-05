/**
 * ════════════════════════════════════════════════════════════════════════════
 * ILUSTRAÇÕES DE ESTADO VAZIO — inline, leves, decorativas
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Vão dentro da prop `illustration` do `<EmptyState>` das primitivas do Painel,
 * que já as coloca em `aria-hidden` — o significado está no título e no texto ao
 * lado, nunca no desenho.
 *
 * POR QUE SVG INLINE, E NÃO IMAGEM: um `<img>` externo é mais uma requisição num
 * estado que aparece justamente quando a tela ainda está vazia, não herda o tema
 * (o desenho ficaria claro sobre fundo escuro) e não acompanha `data-senior`.
 * Aqui tudo sai dos tokens: `chip-*-tint` no fundo, `primary` e `line-strong` no
 * traço, `currentColor` onde vale herdar.
 *
 * REGRA DE COR: nenhum destes desenhos usa verde, âmbar ou vermelho. Eles
 * aparecem ao lado de dado do corpo (remédio, consulta, humor) e "vazio" não é
 * um estado bom nem ruim — é só o começo. Trava:
 * `packages/core/src/utils/regra-cor-clinica.test.ts`.
 */

interface IlustracaoProps {
  className?: string;
}

/** Moldura comum: mancha pastel + traço fino. 132×96 cabe em cartão estreito. */
function Moldura({
  children,
  className,
  tint,
}: {
  children: React.ReactNode;
  className?: string;
  tint: string;
}) {
  return (
    <svg
      viewBox="0 0 132 96"
      className={className ?? 'h-24 w-auto'}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="66" cy="78" rx="46" ry="9" fill={tint} />
      {children}
    </svg>
  );
}

/** Frasco de remédio com um comprimido ao lado. */
export function IlustracaoRemedio({ className }: IlustracaoProps) {
  return (
    <Moldura className={className} tint="var(--chip-azul-tint)">
      <rect x="44" y="16" width="34" height="12" rx="4" fill="var(--chip-azul-tint)" stroke="var(--primary)" strokeWidth="2" />
      <path
        d="M47 28h28a5 5 0 0 1 5 5v33a5 5 0 0 1-5 5H47a5 5 0 0 1-5-5V33a5 5 0 0 1 5-5Z"
        fill="var(--surface)"
        stroke="var(--primary)"
        strokeWidth="2"
      />
      <path d="M52 46h18M61 37v18" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="97" cy="58" r="12" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="2" />
      <path d="M89 58h16" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" />
    </Moldura>
  );
}

/** Folha de agenda com um dia marcado. */
export function IlustracaoAgenda({ className }: IlustracaoProps) {
  return (
    <Moldura className={className} tint="var(--chip-indigo-tint)">
      <rect x="30" y="20" width="72" height="52" rx="8" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2" />
      <path d="M30 34h72" stroke="var(--primary)" strokeWidth="2" />
      <path d="M46 14v12M86 14v12" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
      <rect x="40" y="42" width="14" height="10" rx="3" fill="var(--chip-indigo-tint)" />
      <rect x="60" y="42" width="14" height="10" rx="3" fill="var(--chip-azul-tint)" stroke="var(--primary)" strokeWidth="2" />
      <rect x="80" y="42" width="14" height="10" rx="3" fill="var(--chip-indigo-tint)" />
      <rect x="40" y="57" width="14" height="8" rx="3" fill="var(--chip-indigo-tint)" />
      <rect x="60" y="57" width="34" height="8" rx="3" fill="var(--chip-indigo-tint)" />
    </Moldura>
  );
}

/** Caderninho aberto — o diário clínico. */
export function IlustracaoDiario({ className }: IlustracaoProps) {
  return (
    <Moldura className={className} tint="var(--chip-turquesa-tint)">
      <path
        d="M28 26c12-5 24-5 36 2v42c-12-7-24-7-36-2V26Z"
        fill="var(--surface)"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M104 26c-12-5-24-5-36 2v42c12-7 24-7 36-2V26Z"
        fill="var(--surface)"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M66 28v42" stroke="var(--primary)" strokeWidth="2" />
      <path
        d="M38 38h16M38 48h14M78 38h16M78 48h14"
        stroke="var(--line-strong)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Moldura>
  );
}

/** Prancheta com um resultado de exame. */
export function IlustracaoExame({ className }: IlustracaoProps) {
  return (
    <Moldura className={className} tint="var(--chip-violeta-tint)">
      <rect x="36" y="16" width="60" height="56" rx="8" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2" />
      <rect x="54" y="10" width="24" height="12" rx="4" fill="var(--chip-violeta-tint)" stroke="var(--primary)" strokeWidth="2" />
      <path
        d="M46 54l10-12 8 9 7-16 7 19"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M46 64h40" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" />
    </Moldura>
  );
}
