'use client';

import { motion } from 'framer-motion';
import { statusVars, type StatusKind } from '@/components/ui/status-chip';

const dayWord = (n: number) => (n === 1 ? 'dia' : 'dias');

/**
 * Barra de adesão (% de doses confirmadas / previstas na janela), animada.
 *
 * Aqui o semáforo É legítimo: adesão é uma medida do SISTEMA (tomou / não tomou
 * o remédio), não uma leitura do corpo do paciente. O que estava errado eram as
 * cores — `#10B981 / #F59E0B / #EF4444` davam 2,41 / 2,04 / 3,57:1 no percentual
 * em texto. Agora o número usa o `ink` do status e a barra usa o `mark`.
 *
 * LEGIBILIDADE 50+ (correção 2026-08) — esta barra mora no MEIO do cartão de
 * medicamento, que é a queixa literal do idealizador (54 anos): "achei os
 * caracteres do remédio, mg, diariamente, comprimido, Dr. Rafael bem claro e de
 * difícil visualização". A rodada anterior subiu o cartão inteiro para 15px /
 * `fg-soft` e esta barra ficou para trás: o rótulo e o percentual seguiam em
 * `text-xs` (12px) e `text-muted`, abaixo do piso de 13px do projeto, e viraram
 * o texto mais apagado da tela de Medicamentos — o papel que o cartão tinha
 * quando o cliente reclamou. Os dois blocos foram para `text-body-sm` (15px em
 * `rem`, então o Modo Sênior leva a ~19,5px) com tinta mínima `fg-soft`. O
 * `ink`/`mark` do status já é token medido e não mudou.
 *
 * VERACIDADE — a janela vem por prop. O rótulo era "Adesão · 7 dias" fixo,
 * mas o cartão limita a janela à idade do cadastro (remédio de 2 dias não deve
 * os 7): escrever "7 dias" sobre um número de 2 dias descreveria um período que
 * não é o do dado.
 */
export function AdherenceBar({ percent, days = 7 }: { percent: number | null; days?: number }) {
  if (percent == null) {
    /*
     * Sem previsão não há percentual — e a frase não pode culpar o cadastro por
     * isso. "Sem horários definidos" era falso nos casos em que o remédio TEM
     * horário e mesmo assim não há previsão ("se necessário", cadastro feito
     * hoje). O cartão já não renderiza a barra nesses casos; isto aqui é a
     * rede de segurança, e ela precisa dizer só o que é verdade.
     */
    return <p className="text-body-sm text-fg-soft">Ainda não há doses previstas para calcular a adesão.</p>;
  }
  const kind: StatusKind = percent >= 80 ? 'ok' : percent >= 50 ? 'attention' : 'alert';
  const { ink, mark } = statusVars(kind);
  const rotulo = `Adesão · ${days} ${dayWord(days)}`;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-body-sm">
        <span className="text-fg-soft">{rotulo}</span>
        <span className="hp-num font-semibold" style={{ color: ink }}>
          {percent}%
        </span>
      </div>
      {/*
        SC 1.4.11 (contraste não-textual): sem borda, a EXTENSÃO do trilho some
        contra o cartão — quem visse metade preenchida não veria de quanto era a
        metade. Mesma correção já aplicada no painel de doses confirmadas da
        página de Medicamentos.
      */}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rotulo}
        className="h-3 w-full overflow-hidden rounded-full border border-line-strong bg-surface-3"
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: mark }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
