'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Link2,
  QrCode,
  ShieldCheck,
  Stethoscope,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useAccessTokens,
  useIssueAccessToken,
  useRevokeAccessToken,
  PatMfaRequiredError,
  SHARE_SCOPES,
  CONSULTATION_SCOPES,
  SHARE_PRESETS,
  DEFAULT_SHARE_SCOPES,
  DEFAULT_SHARE_PRESET,
  buildShareUrl,
  formatTimeLeft,
  isShareActive,
  shareScopeLabel,
  type IssuedAccess,
  type SharePresetId,
  type ShareScope,
} from '@hubpatients/supabase';

/**
 * O que a tela oferece: apenas os escopos que `issue_consultation_access_token`
 * aceita. `SHARE_SCOPES` é a lista do token de API, mais larga — oferecer
 * "Identificação" aqui era uma armadilha: a caixa marcava e o banco derrubava a
 * emissão inteira. Derivado (não redigitado) para as legendas seguirem uma
 * fonte só.
 */
const ESCOLHAS = SHARE_SCOPES.filter((s) =>
  (CONSULTATION_SCOPES as readonly string[]).includes(s.key),
);

import { DISCLAIMERS } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { ListSkeleton } from '@/components/ui/skeleton';

/**
 * Modo Consulta — "Mostrar ao meu médico".
 *
 * Gera um acesso TEMPORÁRIO e de leitura ao resumo de saúde. O médico abre o
 * link (ou lê o QR) sem criar conta. Padrões seguros: 1 hora de validade,
 * escopo mínimo e revogação imediata a qualquer momento.
 */
export default function CompartilharPage() {
  const { user } = useAuth();
  const userId = user?.id;

  /*
   * `isError` importa tanto quanto `isLoading`: "Ninguém está vendo seus dados
   * agora" é uma afirmação sobre a privacidade da pessoa, e a lista vazia da
   * falha escrevia justamente essa frase — ela se dá por segura enquanto um
   * link segue aberto. Mesmo tratamento do mobile (`app/compartilhar.tsx`).
   */
  const {
    data: accesses,
    isLoading,
    isError: accessesFailed,
    refetch: refetchAccesses,
  } = useAccessTokens(userId);
  const issue = useIssueAccessToken(userId);
  const revoke = useRevokeAccessToken(userId);

  const [preset, setPreset] = useState<SharePresetId>(DEFAULT_SHARE_PRESET);
  const [scopes, setScopes] = useState<ShareScope[]>(DEFAULT_SHARE_SCOPES);
  const [issued, setIssued] = useState<IssuedAccess | null>(null);
  const [issuedUrl, setIssuedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);

  // Relógio de 1 s para a contagem regressiva. Começa em 0 para não divergir
  // entre o HTML do servidor e a primeira pintura do cliente.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const nowMs = now === 0 ? Date.now() : now;

  const toggleScope = useCallback((key: ShareScope) => {
    setScopes((current) =>
      current.includes(key) ? current.filter((s) => s !== key) : [...current, key],
    );
  }, []);

  async function handleGenerate() {
    if (scopes.length === 0) {
      toast.error('Escolha ao menos uma informação para compartilhar.');
      return;
    }
    setNeedsMfa(false);
    try {
      const result = await issue.mutateAsync({ scopes, preset });
      // O segredo nunca sai daqui para o servidor do Next: o link é montado no
      // navegador e só existe enquanto esta tela estiver aberta.
      setIssued(result);
      setIssuedUrl(buildShareUrl(window.location.origin, result.token));
      setCopied(false);
      toast.success('Acesso criado. Mostre o QR ao seu médico.');
    } catch (error) {
      if (error instanceof PatMfaRequiredError) {
        setNeedsMfa(true);
        toast.error('Ative a verificação em duas etapas para gerar um acesso.');
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o acesso.');
    }
  }

  async function handleCopy() {
    if (!issuedUrl) return;
    try {
      await navigator.clipboard.writeText(issuedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Não foi possível copiar. Selecione o link manualmente.');
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revoke.mutateAsync(id);
      if (issued?.id === id) {
        setIssued(null);
        setIssuedUrl('');
      }
      toast.success('Acesso encerrado. O link parou de funcionar agora.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível encerrar.');
    }
  }

  const active = useMemo(
    () => (accesses ?? []).filter((a) => isShareActive(a, nowMs)),
    [accesses, nowMs],
  );

  const issuedExpiresMs = issued ? Date.parse(issued.expiresAt) : Number.NaN;
  const issuedLeft = Number.isFinite(issuedExpiresMs) ? issuedExpiresMs - nowMs : 0;
  const issuedExpired = issued != null && issuedLeft <= 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5 hp-page">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Início
      </Link>

      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-primary">
          <Stethoscope className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Mostrar ao meu médico
          </h1>
          <p className="text-sm text-muted">
            Um acesso temporário e só de leitura ao seu resumo. Ele não precisa criar conta.
          </p>
        </div>
      </header>

      <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-fg-soft">
          {DISCLAIMERS.dataSharing} O acesso expira sozinho e mostra apenas o que você marcar —
          nunca permite alterar nada nos seus registros.
        </p>
      </div>

      {/* ── Acesso recém-criado: QR + link + contagem regressiva ───────── */}
      {issued && (
        <section
          className={`rounded-2xl border p-5 ${
            issuedExpired
              ? 'border-line bg-surface-2'
              : 'border-emerald-400/30 bg-emerald-500/[0.06]'
          }`}
          aria-live="polite"
        >
          {issuedExpired ? (
            <p className="text-sm font-semibold text-fg">
              Este acesso expirou. Gere outro quando precisar.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-fg">Pronto! Mostre este código.</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-fg-soft">
                  <Clock className="h-3.5 w-3.5" />
                  {now === 0 ? '—' : `expira em ${formatTimeLeft(issuedLeft)}`}
                </span>
              </div>

              <div className="mt-4 flex justify-center">
                <QrCodeSvg
                  value={issuedUrl}
                  size={228}
                  label="QR code do acesso temporário ao seu resumo de saúde"
                />
              </div>

              <p className="mt-3 text-center text-xs text-muted">
                Peça para o médico apontar a câmera. Ou envie o link abaixo.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 text-xs text-fg">
                  {issuedUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-fg-soft hover:bg-surface-2"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-status-ok-ink" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-faint">
                  O link aparece só agora — ao sair desta tela, gere um novo se precisar.
                </p>
                <button
                  type="button"
                  onClick={() => void handleRevoke(issued.id)}
                  disabled={revoke.isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Encerrar agora
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Gerar acesso ───────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div>
          <h2 className="text-sm font-semibold text-fg">Por quanto tempo?</h2>
          <p className="text-xs text-muted">Quanto menor, mais seguro.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {SHARE_PRESETS.map((p) => {
              const selected = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  aria-pressed={selected}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    selected
                      ? 'border-sky-400/60 bg-sky-500/10'
                      : 'border-line bg-surface-2 hover:border-sky-400/30'
                  }`}
                >
                  <span className="block text-sm font-semibold text-fg">{p.label}</span>
                  <span className="block text-[11px] leading-snug text-muted">{p.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-fg">O que o médico verá?</h2>
          <p className="text-xs text-muted">Marque só o necessário para esta consulta.</p>
          <div className="mt-2 space-y-1.5">
            {ESCOLHAS.map((s) => (
              <label
                key={s.key}
                className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(s.key)}
                  onChange={() => toggleScope(s.key)}
                  className="mt-0.5 h-5 w-5 rounded"
                />
                <span className="text-sm text-fg">
                  {s.label}
                  <span className="block text-[11px] text-muted">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {needsMfa && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] px-3 py-2.5">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-attention-ink" />
            <p className="text-xs leading-relaxed text-fg-soft">
              Para criar um acesso é preciso ter a verificação em duas etapas (2FA) ativa e
              concluída nesta sessão — é ela que protege quem pode abrir seus dados.{' '}
              <Link href="/configuracoes" className="font-medium text-primary underline">
                Ativar agora
              </Link>
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={issue.isPending || scopes.length === 0}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-base font-semibold text-white disabled:opacity-60"
        >
          <QrCode className="h-5 w-5" />
          {issue.isPending ? 'Gerando…' : 'Gerar acesso para o médico'}
        </button>
      </section>

      {/* ── Acessos ativos ─────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Acessos ativos</h2>
        {isLoading ? (
          <ListSkeleton rows={2} />
        ) : accessesFailed ? (
          <ErrorState
            message="Não foi possível carregar seus acessos. Esta lista não prova que ninguém está vendo seus dados: pode haver acesso ativo que não aparece aqui."
            onRetry={() => {
              void refetchAccesses();
            }}
          />
        ) : active.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-muted">
            Nenhum acesso ativo. Ninguém está vendo seus dados agora.
          </p>
        ) : (
          <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
            {active.map((a) => {
              const left = a.expires_at ? Date.parse(a.expires_at) - nowMs : 0;
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted" />
                      {a.name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.scopes.map((sc) => (
                        <Badge key={sc} tone="info">
                          {shareScopeLabel(sc)}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-faint">
                      {now === 0 ? '—' : `Expira em ${formatTimeLeft(left)}`}
                      {' · '}
                      {a.last_used_at ? 'Já foi aberto' : 'Ainda não aberto'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRevoke(a.id)}
                    disabled={revoke.isPending}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revogar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] leading-relaxed text-faint">
          Registros informados por você — não constituem laudo médico. {DISCLAIMERS.notDiagnosis}
        </p>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * QR code em SVG — implementação própria, sem dependência nova.
 *
 * Não usamos nenhuma API pública de geração de QR: o link é um segredo de
 * saúde e não pode sair do dispositivo. Tudo é calculado aqui no navegador.
 *
 * Escopo: modo byte (UTF-8), nível de correção M, versões 1..10 (até 213
 * bytes — folga larga para `https://<host>/consulta/vlk_<64 hex>`).
 * Validado módulo a módulo contra o pacote `qrcode` (600 entradas aleatórias,
 * versões 1..10, as 8 máscaras): saída idêntica.
 * ═══════════════════════════════════════════════════════════════════════ */

function QrCodeSvg({ value, size, label }: { value: string; size: number; label: string }) {
  const qr = useMemo(() => {
    try {
      return encodeQr(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!qr) {
    return (
      <div className="flex h-40 w-40 items-center justify-center rounded-2xl border border-dashed border-line bg-surface-2 text-center text-[11px] text-muted">
        Não foi possível montar o QR. Use o link abaixo.
      </div>
    );
  }

  const QUIET = 4;
  const total = qr.size + QUIET * 2;

  // Um único path com todos os módulos escuros: bem mais leve que N <rect>.
  let path = '';
  for (let r = 0; r < qr.size; r += 1) {
    for (let c = 0; c < qr.size; c += 1) {
      if (qr.get(r, c) === 1) path += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="rounded-2xl border border-line"
    >
      {/* Fundo branco fixo: leitores precisam de contraste real, inclusive no tema escuro. */}
      <rect width={total} height={total} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}

interface QrMatrix {
  size: number;
  get: (row: number, col: number) => number;
}

interface QrVersionSpec {
  /** Codewords de correção por bloco. */
  ec: number;
  /** Grupos [quantidade de blocos, codewords de dados por bloco]. */
  groups: ReadonlyArray<readonly [number, number]>;
  /** Centros dos padrões de alinhamento. */
  align: readonly number[];
  /** Bits de resto (zeros) após os codewords. */
  remainder: number;
}

/** Tabelas do nível M (ISO/IEC 18004), versões 1..10. */
const QR_SPEC: Readonly<Record<number, QrVersionSpec>> = {
  1: { ec: 10, groups: [[1, 16]], align: [], remainder: 0 },
  2: { ec: 16, groups: [[1, 28]], align: [6, 18], remainder: 7 },
  3: { ec: 26, groups: [[1, 44]], align: [6, 22], remainder: 7 },
  4: { ec: 18, groups: [[2, 32]], align: [6, 26], remainder: 7 },
  5: { ec: 24, groups: [[2, 43]], align: [6, 30], remainder: 7 },
  6: { ec: 16, groups: [[4, 27]], align: [6, 34], remainder: 7 },
  7: { ec: 18, groups: [[4, 31]], align: [6, 22, 38], remainder: 0 },
  8: { ec: 22, groups: [[2, 38], [2, 39]], align: [6, 24, 42], remainder: 0 },
  9: { ec: 22, groups: [[3, 36], [2, 37]], align: [6, 26, 46], remainder: 0 },
  10: { ec: 26, groups: [[4, 43], [1, 44]], align: [6, 28, 50], remainder: 0 },
};

const QR_MAX_VERSION = 10;

// ── Aritmética em GF(256), polinômio primitivo 0x11d ────────────────────
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255] ?? 0;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] ?? 0) + (GF_LOG[b] ?? 0)] ?? 0;
}

function rsGenerator(degree: number): number[] {
  let poly: number[] = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      const coeff = poly[j] ?? 0;
      next[j] = (next[j] ?? 0) ^ coeff;
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(coeff, GF_EXP[i] ?? 0);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: readonly number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const buffer = new Uint8Array(data.length + ecLen);
  buffer.set(data, 0);
  for (let i = 0; i < data.length; i += 1) {
    const factor = buffer[i] ?? 0;
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j += 1) {
      buffer[i + j] = (buffer[i + j] ?? 0) ^ gfMul(gen[j] ?? 0, factor);
    }
  }
  return Array.from(buffer.subarray(data.length));
}

function qrDataCodewords(spec: QrVersionSpec): number {
  return spec.groups.reduce((sum, [count, len]) => sum + count * len, 0);
}

function qrPickVersion(byteLength: number): number {
  for (let v = 1; v <= QR_MAX_VERSION; v += 1) {
    const spec = QR_SPEC[v];
    if (!spec) continue;
    const countBits = v < 10 ? 8 : 16;
    if (4 + countBits + byteLength * 8 <= qrDataCodewords(spec) * 8) return v;
  }
  throw new Error('Conteúdo longo demais para o QR.');
}

/** Bitstream -> codewords, com terminador, padding e intercalação de blocos. */
function qrCodewords(bytes: Uint8Array, version: number, spec: QrVersionSpec): number[] {
  const totalData = qrDataCodewords(spec);
  const capacityBits = totalData * 8;
  const countBits = version < 10 ? 8 : 16;

  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(0b0100, 4); // modo byte
  push(bytes.length, countBits);
  for (const byte of bytes) push(byte, 8);

  const terminator = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < terminator; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (bits[i + j] ?? 0);
    codewords.push(byte);
  }
  // O padding alterna a partir do PRIMEIRO byte de preenchimento (0xEC), não da
  // paridade do índice absoluto.
  const PAD = [0xec, 0x11] as const;
  let padIndex = 0;
  while (codewords.length < totalData) {
    codewords.push(PAD[padIndex % 2] ?? 0xec);
    padIndex += 1;
  }

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (const [count, length] of spec.groups) {
    for (let b = 0; b < count; b += 1) {
      const block = codewords.slice(offset, offset + length);
      offset += length;
      dataBlocks.push(block);
      ecBlocks.push(rsEncode(block, spec.ec));
    }
  }

  const out: number[] = [];
  const maxLen = dataBlocks.reduce((m, b) => Math.max(m, b.length), 0);
  for (let i = 0; i < maxLen; i += 1) {
    for (const block of dataBlocks) {
      const cw = block[i];
      if (cw !== undefined) out.push(cw);
    }
  }
  for (let i = 0; i < spec.ec; i += 1) {
    for (const block of ecBlocks) out.push(block[i] ?? 0);
  }
  return out;
}

function qrMask(id: number, r: number, c: number): boolean {
  switch (id) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function qrPenalty(size: number, get: (r: number, c: number) => number): number {
  let score = 0;

  const runScore = (read: (i: number) => number) => {
    let color = read(0);
    let run = 1;
    for (let i = 1; i < size; i += 1) {
      const v = read(i);
      if (v === color) {
        run += 1;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        color = v;
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
  };
  for (let r = 0; r < size; r += 1) runScore((i) => get(r, i));
  for (let c = 0; c < size; c += 1) runScore((i) => get(i, c));

  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const v = get(r, c);
      if (v === get(r, c + 1) && v === get(r + 1, c) && v === get(r + 1, c + 1)) score += 3;
    }
  }

  const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const findPattern = (read: (i: number) => number, start: number) => {
    let a = true;
    let b = true;
    for (let i = 0; i < 11; i += 1) {
      const v = read(start + i);
      if (v !== P1[i]) a = false;
      if (v !== P2[i]) b = false;
    }
    return (a ? 1 : 0) + (b ? 1 : 0);
  };
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c + 11 <= size; c += 1) score += 40 * findPattern((i) => get(r, i), c);
  }
  for (let c = 0; c < size; c += 1) {
    for (let r = 0; r + 11 <= size; r += 1) score += 40 * findPattern((i) => get(i, c), r);
  }

  let dark = 0;
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) dark += get(r, c);
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return score;
}

function encodeQr(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const version = qrPickVersion(bytes.length);
  const spec = QR_SPEC[version];
  if (!spec) throw new Error('Versão de QR não suportada.');

  const size = version * 4 + 17;
  const idx = (r: number, c: number) => r * size + c;
  const base = new Uint8Array(size * size);
  const reserved = new Uint8Array(size * size);

  const setFn = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    base[idx(r, c)] = dark ? 1 : 0;
    reserved[idx(r, c)] = 1;
  };

  // Padrões de temporização.
  for (let i = 0; i < size; i += 1) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  // Localizadores + separadores (bloco 8x8 em cada canto).
  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const ring =
          r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setFn(row + r, col + c, ring || core);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Padrões de alinhamento (pulando os que colidem com os localizadores).
  const last = size - 7;
  for (const ar of spec.align) {
    for (const ac of spec.align) {
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === last) || (ar === last && ac === 6)) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          setFn(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // Módulo sempre escuro.
  setFn(size - 8, 8, true);

  // Reserva das áreas de formato e de versão.
  for (let i = 0; i <= 8; i += 1) {
    reserved[idx(8, i)] = 1;
    reserved[idx(i, 8)] = 1;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[idx(8, size - 1 - i)] = 1;
    reserved[idx(size - 1 - i, 8)] = 1;
  }
  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      reserved[idx(b, a)] = 1;
      reserved[idx(a, b)] = 1;
    }
  }

  // Fluxo de bits dos codewords + bits de resto.
  const codewords = qrCodewords(bytes, version, spec);
  const stream: number[] = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i -= 1) stream.push((cw >> i) & 1);
  for (let i = 0; i < spec.remainder; i += 1) stream.push(0);

  let best: { modules: Uint8Array; score: number } | null = null;

  for (let maskId = 0; maskId < 8; maskId += 1) {
    const modules = Uint8Array.from(base);

    // Colocação em ziguezague: pares de colunas da direita para a esquerda,
    // pulando a coluna 6 (temporização vertical).
    let cursor = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      const colRight = right <= 6 ? right - 1 : right;
      for (let step = 0; step < size; step += 1) {
        const r = upward ? size - 1 - step : step;
        for (let k = 0; k < 2; k += 1) {
          const c = colRight - k;
          if (reserved[idx(r, c)] === 1) continue;
          modules[idx(r, c)] = stream[cursor] ?? 0;
          cursor += 1;
        }
      }
      upward = !upward;
    }

    // Máscara (nunca sobre os padrões funcionais).
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (reserved[idx(r, c)] === 0 && qrMask(maskId, r, c)) {
          modules[idx(r, c)] = (modules[idx(r, c)] ?? 0) ^ 1;
        }
      }
    }

    // Informação de formato: nível M (00) + máscara, BCH(15,5) e XOR 0x5412.
    const formatData = (0b00 << 3) | maskId;
    let rem = formatData;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const formatBits = (((formatData << 10) | rem) ^ 0x5412) & 0x7fff;
    const fBit = (i: number) => (formatBits >> i) & 1;
    for (let i = 0; i <= 5; i += 1) modules[idx(i, 8)] = fBit(i);
    modules[idx(7, 8)] = fBit(6);
    modules[idx(8, 8)] = fBit(7);
    modules[idx(8, 7)] = fBit(8);
    for (let i = 9; i < 15; i += 1) modules[idx(8, 14 - i)] = fBit(i);
    for (let i = 0; i < 8; i += 1) modules[idx(8, size - 1 - i)] = fBit(i);
    for (let i = 8; i < 15; i += 1) modules[idx(size - 15 + i, 8)] = fBit(i);

    // Informação de versão (>= 7): BCH(18,6) com gerador 0x1f25.
    if (version >= 7) {
      let vRem = version;
      for (let i = 0; i < 12; i += 1) vRem = (vRem << 1) ^ ((vRem >>> 11) * 0x1f25);
      const versionBits = ((version << 12) | vRem) & 0x3ffff;
      for (let i = 0; i < 18; i += 1) {
        const bit = (versionBits >> i) & 1;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        modules[idx(b, a)] = bit;
        modules[idx(a, b)] = bit;
      }
    }

    const score = qrPenalty(size, (r, c) => modules[idx(r, c)] ?? 0);
    if (!best || score < best.score) best = { modules, score };
  }

  if (!best) throw new Error('Falha ao montar o QR.');
  const finalModules = best.modules;
  return { size, get: (r, c) => finalModules[idx(r, c)] ?? 0 };
}
