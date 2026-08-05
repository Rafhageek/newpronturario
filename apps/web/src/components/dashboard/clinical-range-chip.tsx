'use client';

import { ArrowUp, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import type { ClinicalZone } from '@hubpatients/core';
import { StatusChip } from '@/components/ui/status-chip';

/**
 * Chip da FAIXA DE REFERÊNCIA de um dado do CORPO (pressão, glicemia, peso…).
 *
 * POR QUE ELE EXISTE — regra dura do design system (`status` em
 * `packages/ui-tokens/src/index.ts`): vermelho e âmbar pertencem ao SISTEMA
 * (remédio atrasado, erro de upload) e NUNCA ao corpo do paciente. Pintar a
 * pressão de vermelho é diagnóstico disfarçado; o HubPatients exibe e organiza,
 * quem interpreta é o médico.
 *
 * O dashboard fazia `<StatusChip tone={bpStatus.zone}>`, o que levava a faixa
 * `alert` direto para o vermelho e a `attention` para o âmbar. Aqui a informação
 * NÃO some — ela troca de canal:
 *   tinta `neutro` (cinza-azulado) + SETA com a direção + texto em palavras.
 *
 * Mesmo raciocínio já aplicado em `trend-chip.tsx` e na função `Trend` de
 * `metric-cards.tsx`.
 */
const ZONE_READING: Record<ClinicalZone, { icon: LucideIcon; text: string }> = {
  ok: { icon: Minus, text: 'Dentro do intervalo de referência' },
  attention: { icon: ArrowUpRight, text: 'No limite do intervalo de referência' },
  alert: { icon: ArrowUp, text: 'Acima do intervalo de referência' },
};

/**
 * A MESMA leitura, só em palavras — para onde não cabe um chip (a dica do
 * `<StatCard>`, um `aria-label`, um resumo impresso). Existe para a frase ser
 * escrita UMA vez: duas redações do mesmo intervalo divergem na primeira
 * revisão de texto, e aí a tela e o leitor de tela passam a dizer coisas
 * diferentes sobre a mesma medida.
 */
export function leituraDaFaixa(zone: ClinicalZone): string {
  return ZONE_READING[zone].text;
}

export function ClinicalRangeChip({
  zone,
  className = '',
}: {
  zone: ClinicalZone;
  className?: string;
}) {
  const { icon: Icon, text } = ZONE_READING[zone];
  return (
    <StatusChip
      status="neutro"
      icon={<Icon className="h-3.5 w-3.5" aria-hidden />}
      label={text}
      className={className}
    />
  );
}
