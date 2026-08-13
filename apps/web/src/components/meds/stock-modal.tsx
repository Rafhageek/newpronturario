'use client';

import { useId, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Medication } from '@hubpatients/core';
import { formatStockStatus } from '@hubpatients/core';
import { useUpdateStock, useMarkRefill } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONTROLE DE ESTOQUE DO MEDICAMENTO
 * ════════════════════════════════════════════════════════════════════════════
 *
 * LEGIBILIDADE 50+ e ALVOS DE TOQUE (correção 2026-08) — dívida da rodada
 * anterior. O cartão do remédio subiu para o piso de 15px na semana passada, e
 * o modal que ele ABRE ficou a 12/14px: quem tocava em "Comprei mais" saía de
 * um cartão legível e caía numa tela menor que a de origem.
 *
 * Piso aplicado, o mesmo de `medication-card.tsx` / `adherence-bar.tsx`: nada
 * abaixo de `text-body-sm` (15px em `rem`, ~19,5px no Modo Sênior), nome do
 * remédio e campo numérico em `text-body` (17px), e tinta mínima `fg-soft` no
 * lugar de `muted`.
 *
 * CONTRASTES MEDIDOS (WCAG 2.x; o painel do modal é `--surface`, a caixa de
 * reposição é `--surface-2`):
 *
 *   nome do remédio  fg      sobre surface     claro 17,16:1 · escuro 14,90:1
 *   status estoque   fg-soft sobre surface     claro 10,40:1 · escuro 12,05:1
 *                    (era muted a 12px:        claro  5,90:1 · escuro  7,84:1)
 *   "Ou quantidade"  fg-soft sobre surface-2   claro  9,80:1 · escuro 10,82:1
 *   botão "1 caixa"  primary sobre sky/15      claro  6,77:1 · escuro  5,53:1
 *   botões neutros   fg-soft sobre surface(-2) claro ≥9,80:1 · escuro ≥10,82:1
 *
 * ALVOS: os botões já tinham `h-11`, mas `h-` FIXO corta o rótulo quando a
 * fonte cresce — viraram `min-h-11`, que é o padrão do cartão. O interruptor de
 * "acompanhar estoque" tinha 24px de altura e era o menor alvo da tela.
 */
export function StockModal({
  open,
  onClose,
  medication,
  patientId,
}: {
  open: boolean;
  onClose: () => void;
  medication: Medication;
  patientId: string;
}) {
  const update = useUpdateStock(patientId, medication.id);
  const refill = useMarkRefill(patientId, medication.id);
  const trackingLabelId = useId();

  const [tracking, setTracking] = useState(medication.stock_count != null);
  const [count, setCount] = useState(medication.stock_count?.toString() ?? '');
  const [unit, setUnit] = useState(medication.stock_unit ?? 'comprimidos');
  const [packageSize, setPackageSize] = useState(medication.package_size?.toString() ?? '');
  const [threshold, setThreshold] = useState(String(medication.stock_low_threshold_days ?? 5));
  const [refillQty, setRefillQty] = useState('');

  async function save() {
    try {
      await update.mutateAsync({
        stockCount: tracking ? Number(count || 0) : null,
        stockUnit: unit || 'comprimidos',
        packageSize: packageSize ? Number(packageSize) : null,
        stockLowThresholdDays: Number(threshold || 5),
      });
      toast.success(tracking ? 'Estoque atualizado.' : 'Controle de estoque desativado.');
      onClose();
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  async function doRefill(units: number) {
    if (!units || units <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }
    try {
      await refill.mutateAsync(units);
      toast.success('Estoque reposto. 👍');
      onClose();
    } catch {
      toast.error('Não foi possível repor.');
    }
  }

  const pkg = Number(packageSize) || 0;

  return (
    <Modal open={open} onClose={onClose} title="Controle de estoque" className="max-w-md">
      <p className="-mt-1 text-body font-semibold text-fg">{medication.name}</p>
      {/* Quantos dias ainda dão: é o número que a pessoa veio conferir. Estava a
          12px em `muted` — o dado mais apagado do modal era o assunto dele. */}
      <p className="mt-0.5 text-body-sm text-fg-soft">{formatStockStatus(medication)}</p>

      {/* Reposição rápida (só quando já rastreia) */}
      {medication.stock_count != null && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-body-sm font-semibold text-fg">
            <Package className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> Comprei mais
          </p>
          <div className="flex flex-wrap items-end gap-2">
            {pkg > 0 && (
              // `min-h-11` no lugar de `h-11`: com a fonte ampliada o botão
              // cresce em vez de espremer "1 caixa (30)" contra a borda.
              <button
                type="button"
                onClick={() => doRefill(pkg)}
                disabled={refill.isPending}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-sky-500/15 px-3.5 text-body-sm font-semibold text-primary hover:bg-sky-500/25"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{' '}
                {/* A quantidade é número clínico: `hp-num` (tabular) para 0/O e
                    1/l ficarem inconfundíveis, igual ao cartão do remédio. */}
                1 caixa (<span className="hp-num">{pkg}</span>)
              </button>
            )}
            <label className="text-body-sm text-fg-soft">
              Ou quantidade
              <input
                type="number"
                inputMode="numeric"
                value={refillQty}
                onChange={(e) => setRefillQty(e.target.value)}
                className="hp-num mt-1 block min-h-11 w-28 rounded-xl border border-line bg-surface px-3 py-2 text-body text-fg"
              />
            </label>
            <button
              type="button"
              onClick={() => doRefill(Number(refillQty))}
              disabled={refill.isPending}
              className="inline-flex min-h-11 items-center rounded-xl border border-line px-3.5 text-body-sm font-semibold text-fg-soft hover:bg-surface-2"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Configuração do estoque */}
      <div className="mt-4 space-y-4">
        {/*
         * Era um <label> envolvendo um <button role="switch">. Envolver não
         * associa nada: <label> só nomeia controles de formulário nativos, então
         * o leitor de tela anunciava "alternar, não marcado" sem dizer alternar
         * O QUÊ. Virou um <div> com `aria-labelledby` apontando para o texto —
         * a mesma frase que se lê na tela é a que o leitor anuncia.
         */}
        <div className="flex items-center justify-between gap-3">
          <span id={trackingLabelId} className="text-body-sm font-semibold text-fg">
            Acompanhar o estoque deste medicamento
          </span>
          {/*
           * ALVO E CONTRASTE DO INTERRUPTOR — era o pior de ambos no modal.
           *
           * Alvo: `h-6 w-11` = 24px de altura, contra o piso de 44. O trilho
           * continua com 24px (é a forma reconhecível de um interruptor), mas o
           * BOTÃO passa a `min-h-11` com o trilho centrado dentro — a área
           * clicável cresce sem o desenho engordar.
           *
           * SC 1.4.11 pede 3:1 no estado de um controle. Medido:
           *   desligado  bg-muted/40   sobre surface  claro 1,81:1 · escuro 2,32:1  ← REPROVA
           *              bg-line-strong                claro 3,73:1 · escuro 3,87:1
           *   ligado     bg-primary                    claro 8,28:1 · escuro 7,73:1
           * O botão branco fixo também reprovava no escuro (2,32:1 contra o
           * trilho ligado `#7caaff`); virou `bg-surface`, que acompanha o tema:
           *   botão vs trilho desligado  claro 3,73:1 · escuro 3,87:1
           *   botão vs trilho ligado     claro 8,28:1 · escuro 7,73:1
           * Desligado ficava indistinguível do fundo: quem não enxergasse o
           * cinza-claro não sabia se o controle de estoque estava ou não ativo.
           */}
          <button
            type="button"
            role="switch"
            aria-checked={tracking}
            aria-labelledby={trackingLabelId}
            onClick={() => setTracking((t) => !t)}
            className="relative flex min-h-11 w-11 shrink-0 items-center rounded-lg"
          >
            <span
              className={`block h-6 w-11 rounded-full transition ${tracking ? 'bg-primary' : 'bg-line-strong'}`}
            />
            <span
              className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-surface transition ${
                tracking ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {tracking && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantos você tem agora?" htmlFor="st-count">
              <Input id="st-count" type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Ex.: 30" />
            </Field>
            <Field label="Unidade" htmlFor="st-unit">
              <Input id="st-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="comprimidos" />
            </Field>
            <Field label="Quantos vêm na caixa?" htmlFor="st-pkg">
              <Input id="st-pkg" type="number" inputMode="numeric" value={packageSize} onChange={(e) => setPackageSize(e.target.value)} placeholder="Ex.: 30" />
            </Field>
            <Field label="Avisar faltando quantos dias?" htmlFor="st-th">
              <Input id="st-th" type="number" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-body-sm font-semibold text-fg-soft hover:bg-surface-2"
        >
          Fechar
        </button>
        <Button onClick={save} disabled={update.isPending}>{update.isPending ? 'Salvando…' : 'Salvar'}</Button>
      </div>
    </Modal>
  );
}
