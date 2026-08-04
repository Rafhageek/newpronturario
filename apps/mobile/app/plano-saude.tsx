import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { CreditCard, Plus, Check, Trash2, Phone, ExternalLink, Info, FileText } from 'lucide-react-native';
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
  isoToDateBR,
  type InsuranceClaimKind,
  type InsurancePaymentMethod,
} from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, SectionTitle, Input, Button, EmptyState, Badge } from '@/components/ui';
import { DateInputBR } from '@/components/date-input';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
import { toast } from '@/components/toast';
import { useScreenGuard } from '@/components/screen-guard';
import { useColors, fonts } from '@/theme';

const hojeIso = () => new Date().toISOString().slice(0, 10);

export default function PlanoSaudeScreen() {
  useScreenGuard('plano-saude');
  const colors = useColors();
  const { user } = useAuth();
  const pid = user?.id ?? '';

  const { data: insuranceData } = useInsurance(user?.id);
  const plano = Array.isArray(insuranceData) ? insuranceData[0] : insuranceData;
  const { data: payments } = useInsurancePayments(user?.id);
  const { data: claims } = useInsuranceClaims(user?.id);
  const payMut = useInsurancePaymentMutations(pid);
  const claimMut = useInsuranceClaimMutations(pid);

  const [sheet, setSheet] = useState<'pagamento' | 'requerimento' | null>(null);

  const lista = payments ?? [];
  const emAberto = lista.filter((p) => !p.paid_at).length;
  const anoAtual = new Date().getFullYear();
  // Total pago no ano: é o número que serve para o IR, onde plano é dedutível.
  const totalAno = useMemo(
    () => totalPaidCents(lista.filter((p) => p.paid_at?.startsWith(String(anoAtual)))),
    [lista, anoAtual],
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Plano de saúde" subtitle="Carteirinha, mensalidades e requerimentos" icon={CreditCard} back />
      <Screen>
        {/* Carteirinha */}
        <Card className="gap-2">
          <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">Seu plano</Text>
          {plano ? (
            <>
              <Linha rotulo="Operadora" valor={plano.operator} />
              <Linha rotulo="Carteirinha" valor={plano.card_number ?? '—'} />
              <Linha rotulo="Validade" valor={isoToDateBR(plano.valid_until) || '—'} />
              <View className="mt-2 flex-row flex-wrap gap-2">
                {plano.support_phone ? (
                  <Button
                    label="Ligar para a central"
                    icon={Phone}
                    variant="outline"
                    size="sm"
                    onPress={() => void Linking.openURL(`tel:${plano.support_phone}`)}
                  />
                ) : null}
                {plano.portal_url ? (
                  <Button
                    label="Abrir portal"
                    icon={ExternalLink}
                    size="sm"
                    onPress={() => void Linking.openURL(plano.portal_url as string)}
                  />
                ) : null}
              </View>
            </>
          ) : (
            <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
              Nenhum plano cadastrado. Informe operadora e carteirinha no seu Perfil.
            </Text>
          )}
        </Card>

        {/* Resumo */}
        <View className="flex-row gap-3">
          <Card className="flex-1 gap-0.5">
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">Pago em {anoAtual}</Text>
            <Text style={{ fontFamily: fonts.numBold }} className="text-[18px] text-fg">{formatBRL(totalAno)}</Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">Útil na declaração do IR.</Text>
          </Card>
          <Card className="flex-1 gap-0.5">
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">Em aberto</Text>
            <Text style={{ fontFamily: fonts.numBold }} className="text-[18px] text-fg">{emAberto}</Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">
              {emAberto === 1 ? 'cobrança sem baixa' : 'cobranças sem baixa'}
            </Text>
          </Card>
        </View>

        {/* Mensalidades */}
        <SectionTitle>Mensalidades</SectionTitle>
        <Button label="Registrar mensalidade" icon={Plus} onPress={() => setSheet('pagamento')} />
        {lista.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhuma cobrança registrada"
            subtitle="Anote os boletos e PIX aqui para ter o histórico completo do seu plano."
          />
        ) : (
          <Card className="gap-1">
            {lista.map((p) => {
              const sit = paymentSituation(p);
              return (
                <View key={p.id} className="flex-row items-center gap-2 py-2.5">
                  <View className="flex-1">
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                      {formatBRL(p.amount_cents)}
                      {p.method ? (
                        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                          {'  '}{PAYMENT_METHOD_LABELS[p.method]}
                        </Text>
                      ) : null}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                      Vence {isoToDateBR(p.due_date)}
                      {p.paid_at ? ` · pago em ${isoToDateBR(p.paid_at)}` : ''}
                    </Text>
                  </View>
                  <Badge tone={sit === 'pago' ? 'ok' : sit === 'atrasado' ? 'alert' : 'neutral'}>
                    {PAYMENT_SITUATION_LABELS[sit]}
                  </Badge>
                  {!p.paid_at ? (
                    <Pressable
                      onPress={() =>
                        payMut.setPaid.mutate(
                          { id: p.id, paidAt: hojeIso() },
                          { onSuccess: () => toast.success('Pagamento registrado.') },
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Marcar ${formatBRL(p.amount_cents)} como pago`}
                      hitSlop={8}
                      className="h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
                    >
                      <Check size={18} color={colors.ok} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => payMut.remove.mutate(p.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Remover cobrança"
                    hitSlop={8}
                    className="h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
                  >
                    <Trash2 size={16} color={colors.muted} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}

        {/* Requerimentos */}
        <SectionTitle>Requerimentos</SectionTitle>
        <Text style={{ fontFamily: fonts.regular }} className="-mt-1 text-[12px] leading-4 text-muted">
          Reembolsos e autorizações. Guarde o protocolo — é ele que dá força na hora de cobrar.
        </Text>
        <Button label="Registrar requerimento" icon={Plus} variant="outline" onPress={() => setSheet('requerimento')} />
        {(claims?.length ?? 0) === 0 ? (
          <EmptyState icon={FileText} title="Nenhum requerimento" subtitle="Registre reembolsos e autorizações para acompanhar a resposta." />
        ) : (
          <Card className="gap-1">
            {claims!.map((c) => (
              <View key={c.id} className="flex-row items-center gap-2 py-2.5">
                <View className="flex-1">
                  <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">{c.title}</Text>
                  <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                    {CLAIM_KIND_LABELS[c.kind]} · {isoToDateBR(c.requested_at)}
                    {c.protocol ? ` · ${c.protocol}` : ''}
                    {c.amount_cents ? ` · ${formatBRL(c.amount_cents)}` : ''}
                  </Text>
                </View>
                <Badge tone="neutral">{CLAIM_STATUS_LABELS[c.status]}</Badge>
                <Pressable
                  onPress={() => claimMut.remove.mutate(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Remover requerimento"
                  hitSlop={8}
                  className="h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
                >
                  <Trash2 size={16} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </Card>
        )}

        {/* Transparência: o app não fala com a operadora. */}
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-3">
          <Info size={16} color={colors.muted} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
            {INSURANCE_DISCLAIMER}
          </Text>
        </View>
      </Screen>

      {sheet === 'pagamento' ? (
        <PagamentoSheet
          onClose={() => setSheet(null)}
          onSave={(input) =>
            payMut.add.mutate(input, {
              onSuccess: () => {
                toast.success('Cobrança registrada.');
                setSheet(null);
              },
              onError: () => toast.error('Não foi possível registrar.'),
            })
          }
        />
      ) : null}

      {sheet === 'requerimento' ? (
        <RequerimentoSheet
          onClose={() => setSheet(null)}
          onSave={(input) =>
            claimMut.add.mutate(input, {
              onSuccess: () => {
                toast.success('Requerimento registrado.');
                setSheet(null);
              },
              onError: () => toast.error('Não foi possível registrar.'),
            })
          }
        />
      ) : null}
    </View>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-0.5">
      <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">{rotulo}</Text>
      <Text style={{ fontFamily: fonts.semibold }} className="shrink text-right text-[13px] text-fg" numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

/** Chips de escolha única — mesmo padrão das outras telas do app. */
function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <Pressable
            key={o.v}
            onPress={() => onChange(o.v)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ borderCurve: 'continuous' }}
            className={`rounded-full border px-4 py-2 ${on ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'}`}
          >
            <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${on ? 'text-primary' : 'text-fg-soft'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PagamentoSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: {
    due_date: string;
    amount_cents: number;
    method: InsurancePaymentMethod;
    paid_at: string | null;
  }) => void;
}) {
  const ref = useRef<AppSheetHandle>(null);
  const [valor, setValor] = useState('');
  const [venc, setVenc] = useState('');
  const [metodo, setMetodo] = useState<InsurancePaymentMethod>('boleto');
  const [jaPago, setJaPago] = useState(false);

  function salvar() {
    const cents = parseBRLToCents(valor);
    if (!cents || cents <= 0) return toast.info('Informe o valor.');
    if (!venc) return toast.info('Informe o vencimento.');
    onSave({ due_date: venc, amount_cents: cents, method: metodo, paid_at: jaPago ? hojeIso() : null });
  }

  return (
    <AppSheet ref={ref} onClose={onClose} title="Registrar mensalidade">
      <View className="gap-4 pb-2">
        <Input label="Valor" value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder="Ex.: 890,10" />
        <DateInputBR label="Vencimento" value={venc} onChangeIso={setVenc} />
        <View>
          <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">Forma de pagamento</Text>
          <Chips
            value={metodo}
            onChange={setMetodo}
            options={(Object.keys(PAYMENT_METHOD_LABELS) as InsurancePaymentMethod[]).map((k) => ({
              v: k,
              label: PAYMENT_METHOD_LABELS[k],
            }))}
          />
        </View>
        <Pressable
          onPress={() => setJaPago((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: jaPago }}
          className="flex-row items-center gap-2.5 py-1"
        >
          <View
            style={{ borderCurve: 'continuous' }}
            className={`h-6 w-6 items-center justify-center rounded-lg border ${jaPago ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'}`}
          >
            {jaPago ? <Check size={14} color="#0442bf" /> : null}
          </View>
          <Text style={{ fontFamily: fonts.regular }} className="text-[14px] text-fg-soft">Já está pago</Text>
        </Pressable>
        <Button label="Registrar" onPress={salvar} />
      </View>
    </AppSheet>
  );
}

function RequerimentoSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: {
    kind: InsuranceClaimKind;
    title: string;
    requested_at: string;
    protocol: string | null;
    amount_cents: number | null;
  }) => void;
}) {
  const ref = useRef<AppSheetHandle>(null);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<InsuranceClaimKind>('reembolso');
  const [data, setData] = useState('');
  const [protocolo, setProtocolo] = useState('');
  const [valor, setValor] = useState('');

  function salvar() {
    if (titulo.trim().length < 2) return toast.info('Descreva o requerimento.');
    if (!data) return toast.info('Informe a data do pedido.');
    onSave({
      kind: tipo,
      title: titulo.trim(),
      requested_at: data,
      protocol: protocolo.trim() || null,
      amount_cents: parseBRLToCents(valor),
    });
  }

  return (
    <AppSheet ref={ref} onClose={onClose} title="Registrar requerimento">
      <View className="gap-4 pb-2">
        <Input label="Do que se trata" value={titulo} onChangeText={setTitulo} placeholder="Ex.: Reembolso consulta" />
        <View>
          <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">Tipo</Text>
          <Chips
            value={tipo}
            onChange={setTipo}
            options={(Object.keys(CLAIM_KIND_LABELS) as InsuranceClaimKind[]).map((k) => ({
              v: k,
              label: CLAIM_KIND_LABELS[k],
            }))}
          />
        </View>
        <DateInputBR label="Data do pedido" value={data} onChangeIso={setData} />
        <Input label="Protocolo (opcional)" value={protocolo} onChangeText={setProtocolo} placeholder="Número informado pela operadora" />
        <Input label="Valor pedido (opcional)" value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder="Ex.: 350,00" />
        <Button label="Registrar" onPress={salvar} />
      </View>
    </AppSheet>
  );
}
