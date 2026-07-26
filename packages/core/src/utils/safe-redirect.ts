// ============================================================================
// Proteção contra open redirect. Só aceita caminhos INTERNOS conhecidos.
// Usado no login (?next=) e no callback de OAuth.
// ============================================================================

/** Prefixos internos permitidos como destino de redirecionamento. */
export const SAFE_REDIRECT_PREFIXES = [
  '/dashboard',
  '/perfil',
  '/medicamentos',
  '/diario',
  '/exames',
  '/analise',
  '/consultas',
  '/gestacao',
  '/ciclo',
  '/criancas',
  '/familia',
  '/comunidade',
  '/rede-social',
  '/educacao',
  '/consentimento',
  '/configuracoes',
  '/planos',
  '/assinatura',
  '/moderacao',
  '/admin',
] as const;

/**
 * Devolve um caminho interno seguro a partir de um valor não confiável (ex.:
 * `?next=`). Rejeita URLs absolutas, protocol-relative (`//host`), backslash
 * (`/\\host`), esquemas (`javascript:`) e caracteres de controle. Cai no
 * `fallback` se o destino não estiver na allowlist de prefixos.
 */
export function getSafeNextPath(
  value: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  if (!v.startsWith('/')) return fallback; // precisa ser caminho interno
  if (v.startsWith('//') || v.startsWith('/\\')) return fallback; // protocol-relative
  for (const ch of v) {
    if (ch.charCodeAt(0) < 0x20) return fallback; // caracteres de controle
  }
  const lower = v.toLowerCase();
  if (lower.includes('://') || lower.includes('javascript:') || lower.includes('\\')) {
    return fallback;
  }
  const path = v.split(/[?#]/)[0] ?? v;
  const allowed = SAFE_REDIRECT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  return allowed ? v : fallback;
}
