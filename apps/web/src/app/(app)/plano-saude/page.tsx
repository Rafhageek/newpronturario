'use client';

import { useMemo, useState } from 'react';
import { CreditCard, ExternalLink, Info, Phone, Plus, Check, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  useInsurance,
  useInsurancePayments,
  useInsurancePaymentMutations,
  useInsuranceClaims,
  useInsuranceClaimMutations,
} from '@hubpatients/supabase';
import {
  CLAIM_KIND_LABELS,
  CLAIM_STATUS_LABELS,
  INSURANCE_DISCLAIMER,
  PAYMENT_METHOD_LABELS,
  PAYMENT_SITUATION_LABELS,
  formatBRL,
  parseBRLToCents,
  paymentSituation,
  totalPaidCents,
  type InsuranceClaimKind,
  type InsuranceClaimStatus,
  type InsurancePaymentMethod,
} from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { Button, Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

const hoje = () => new Date().toISOString().slice(0, 10);

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'. Manual, para não depender de locale do runtime. */
function dataBR(iso: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export default function PlanoSaudePage() {
  const { user } = useAuth();
  const pid = user?.id ?? '';
  const { data: insuranceData } = useInsurance(user?.id);
  const plano = Array.isArray(insuranceData) ? insuranceData[0] : insuranceData;

  const { data: payments } = useInsurancePayments(user?.id);
  const { data: claims } = useInsuranceClaims(user?.id);
  const payMut = useInsurancePaymentMutations(pid);
  const claimMut = useInsuranceClaimMutations(pid);

  const [payOpen, setPayOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  const lista = payments ?? [];
  const emAberto = lista.filter((p) => !p.paid_at);
  /* Total pago no ano corrente — é o número que serve para a declaração do IR,
     onde plano de saúde é despesa dedutível. */
  const anoAtual = new Date().getFullYear();
  const totalAno = useMemo(
    () => totalPaidCents(lista.filter((p) => p.paid_at?.startsWith(String(anoAtual)))),
    [lista, anoAtual],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-primary">
          <CreditCard className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Plano de saúde
          </h1>
          <p className="mt-1 text-sm text-muted">
            Carteirinha, mensalidades e requerimentos, reunidos num lugar só.
          </p>
        </div>
      </header>

      {/* Carteirinha */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-fg-soft">Seu plano</h2>
        {plano ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Dado rotulo="Operadora" valor={plano.operator} />
              <Dado rotulo="Carteirinha" valor={plano.card_number ?? '—'} />
              <Dado rotulo="Validade" valor={dataBR(plano.valid_until)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {plano.support_phone && (
                <a
                  href={`tel:${plano.support_phone}`}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-fg-soft transition hover:bg-surface-2"
                >
                  <Phone className="h-4 w-4" /> Ligar para a central
                </a>
              )}
              {plano.portal_url && (
                <a
                  href={plano.portal_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <ExternalLink className="h-4 w-4" /> Abrir portal da operadora
                </a>
              )}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Nenhum plano cadastrado ainda. Você pode informar operadora e carteirinha no seu Perfil.
          </p>
        )}
      </section>

      {/* Resumo financeiro */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Resumo
          titulo={`Pago em ${anoAtual}`}
          valor={formatBRL(totalAno)}
          nota="Some com o comprovante para a declaração do IR."
        />
        <Resumo
          titulo="Em aberto"
          valor={String(emAberto.length)}
          nota={emAberto.length === 1 ? '1 cobrança sem baixa' : `${emAberto.length} cobranças sem baixa`}
        />
      </div>

      {/* Pagamentos */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-fg-soft">Mensalidades</h2>
          <Button onClick={() => setPayOpen(true)} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" /> Registrar
          </Button>
        </div>

        {lista.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nenhuma cobrança registrada. Anote os boletos e PIX aqui para ter o histórico completo.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {lista.map((p) => {
              const sit = paymentSituation(p);
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-fg">
                      {formatBRL(p.amount_cents)}
                      {p.method ? (
                        <span className="ml-2 text-xs font-normal text-muted">
                          {PAYMENT_METHOD_LABELS[p.method]}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      Vence {dataBR(p.due_date)}
                      {p.paid_at ? ` · pago em ${dataBR(p.paid_at)}` : ''}
                    </p>
                  </div>
                  <SituacaoBadge situacao={sit} />
                  {!p.paid_at && (
                    <button
                      onClick={() =>
                        payMut.setPaid.mutate(
                          { id: p.id, paidAt: hoje() },
                          { onSuccess: () => toast.success('Pagamento registrado.') },
                        )
                      }
                      className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
                      aria-label={`Marcar ${formatBRL(p.amount_cents)} como pago`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => payMut.remove.mutate(p.id)}
                    className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
                    aria-label="Remover cobrança"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Requerimentos */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-fg-soft">Requerimentos</h2>
          <Button onClick={() => setClaimOpen(true)} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" /> Registrar
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted">
          Reembolsos e autorizações. Guarde o número do protocolo — é ele que dá força na hora de cobrar.
        </p>

        {(claims?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum requerimento registrado.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {claims!.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{c.title}</p>
                  <p className="text-xs text-muted">
                    {CLAIM_KIND_LABELS[c.kind]} · {dataBR(c.requested_at)}
                    {c.protocol ? ` · protocolo ${c.protocol}` : ''}
                    {c.amount_cents ? ` · ${formatBRL(c.amount_cents)}` : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-fg-soft">
                  {CLAIM_STATUS_LABELS[c.status]}
                </span>
                <button
                  onClick={() => claimMut.remove.mutate(c.id)}
                  className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
                  aria-label="Remover requerimento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Transparência: o app não fala com a operadora. */}
      <p
        role="note"
        className="flex items-start gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-fg-soft"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        {INSURANCE_DISCLAIMER}
      </p>

      <PagamentoModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onSave={(input) =>
          payMut.add.mutate(input, {
            onSuccess: () => {
              toast.success('Cobrança registrada.');
              setPayOpen(false);
            },
            onError: () => toast.error('Não foi possível registrar.'),
          })
        }
      />
      <RequerimentoModal
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        onSave={(input) =>
          claimMut.add.mutate(input, {
            onSuccess: () => {
              toast.success('Requerimento registrado.');
              setClaimOpen(false);
            },
            onError: () => toast.error('Não foi possível registrar.'),
          })
        }
      />
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{rotulo}</p>
      <p className="text-sm font-semibold text-fg">{valor}</p>
    </div>
  );
}

function Resumo({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{titulo}</p>
      <p className="mt-0.5 text-xl font-bold text-fg">{valor}</p>
      <p className="mt-1 text-xs text-muted">{nota}</p>
    </div>
  );
}

/** Situação em texto + cor. O texto vem primeiro: cor sozinha não informa (SC 1.4.1). */
function SituacaoBadge({ situacao }: { situacao: keyof typeof PAYMENT_SITUATION_LABELS }) {
  const tom =
    situacao === 'pago'
      ? 'bg-emerald-500/15 text-status-ok-ink'
      : situacao === 'atrasado'
        ? 'bg-rose-500/15 text-status-alert-ink'
        : 'bg-surface-2 text-fg-soft';
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tom}`}>
      {PAYMENT_SITUATION_LABELS[situacao]}
    </span>
  );
}

function PagamentoModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: {
    due_date: string;
    amount_cents: number;
    method: InsurancePaymentMethod | null;
    paid_at: string | null;
  }) => void;
}) {
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [metodo, setMetodo] = useState<InsurancePaymentMethod>('boleto');
  const [jaPago, setJaPago] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    const cents = parseBRLToCents(valor);
    if (!cents || cents <= 0) return setErro('Informe o valor.');
    if (!vencimento) return setErro('Informe o vencimento.');
    setErro(null);
    onSave({
      due_date: vencimento,
      amount_cents: cents,
      method: metodo,
      paid_at: jaPago ? hoje() : null,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar mensalidade" className="max-w-md">
      <div className="space-y-4">
        <Field label="Valor" htmlFor="valor">
          <Input id="valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 890,10" />
        </Field>
        <Field label="Vencimento" htmlFor="venc">
          <Input id="venc" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </Field>
        <Field label="Forma de pagamento" htmlFor="metodo">
          <select
            id="metodo"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as InsurancePaymentMethod)}
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
          >
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2.5 text-sm text-fg-soft">
          <input type="checkbox" checked={jaPago} onChange={(e) => setJaPago(e.target.checked)} className="h-4 w-4" />
          Já está pago
        </label>
        {erro && <p role="alert" className="text-xs text-status-alert-ink">{erro}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">
            Cancelar
          </button>
          <Button onClick={salvar}>Registrar</Button>
        </div>
      </div>
    </Modal>
  );
}

function RequerimentoModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: {
    kind: InsuranceClaimKind;
    title: string;
    requested_at: string;
    protocol: string | null;
    status: InsuranceClaimStatus;
    amount_cents: number | null;
  }) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<InsuranceClaimKind>('reembolso');
  const [data, setData] = useState('');
  const [protocolo, setProtocolo] = useState('');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    if (titulo.trim().length < 2) return setErro('Descreva o requerimento.');
    if (!data) return setErro('Informe a data do pedido.');
    setErro(null);
    onSave({
      kind: tipo,
      title: titulo.trim(),
      requested_at: data,
      protocol: protocolo.trim() || null,
      status: 'aberto',
      amount_cents: parseBRLToCents(valor),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar requerimento" className="max-w-md">
      <div className="space-y-4">
        <Field label="Do que se trata" htmlFor="titulo">
          <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reembolso consulta cardiologista" />
        </Field>
        <Field label="Tipo" htmlFor="tipo">
          <select
            id="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as InsuranceClaimKind)}
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
          >
            {Object.entries(CLAIM_KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Data do pedido" htmlFor="data">
          <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Protocolo (opcional)" htmlFor="protocolo">
          <Input id="protocolo" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} placeholder="Número que a operadora informou" />
        </Field>
        <Field label="Valor pedido (opcional)" htmlFor="vlr">
          <Input id="vlr" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 350,00" />
        </Field>
        {erro && <p role="alert" className="text-xs text-status-alert-ink">{erro}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">
            Cancelar
          </button>
          <Button onClick={salvar}>Registrar</Button>
        </div>
      </div>
    </Modal>
  );
}
