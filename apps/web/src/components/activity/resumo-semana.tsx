'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * RESUMO DA SEMANA — um total factual, e uma citação com fonte
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Este cartão é o lugar da tela onde é mais fácil escorregar, então vale
 * escrever o que ele NÃO faz — e por quê.
 *
 * 1. NÃO EXISTE BARRA QUE ENCHE. Nem anel, nem porcentagem, nem "faltam 30
 *    minutos". Desenhar progresso contra os 150 min/semana transformaria uma
 *    referência de saúde pública num ALVO que este app teria definido para a
 *    pessoa — e o app não define meta de esforço para quem tem revascularização
 *    do miocárdio e hipertensão. Isso é conversa de consulta, não de interface.
 *    A referência aparece como FRASE COM FONTE (`OMS_REFERENCIA_TEXTO`), do
 *    mesmo jeito que a citação de sódio no diário alimentar.
 *
 * 2. NÃO EXISTE SEQUÊNCIA, OFENSIVA, RECORDE NEM ELOGIO. É a decisão tomada no
 *    diário alimentar em 05/08/2026 e documentada em `utils/diario-alimentar.ts`
 *    e em `constants/activity.ts`: diário que pontua assiduidade vira
 *    obrigação, e obrigação em registro de saúde faz a pessoa parar de
 *    registrar — ou registrar o que fica bonito. A semana aqui conta REGISTRO
 *    ("120 minutos registrados nesta semana"), nunca aderência.
 *
 * 3. NENHUMA COR JULGA O ESFORÇO. Verde/âmbar/vermelho pertencem ao SISTEMA e
 *    nunca ao corpo do paciente (regra dos tokens, travada em
 *    `regra-cor-clinica.test.ts`). Uma semana de 20 minutos e uma de 300 saem
 *    exatamente com a mesma tinta.
 *
 * 4. O TOTAL SÓ APARECE QUANDO FOI LIDO. Enquanto a consulta não confirmou,
 *    "0 minutos registrados" seria o app afirmando uma ausência que ninguém
 *    conferiu — regra de veracidade, `utils/estado-secao.ts`. Falha vira frase
 *    dizendo que o número NÃO É zero: ele só não foi lido.
 */

import { CalendarRange } from 'lucide-react';
import {
  ACTIVITY_SEM_META_TEXTO,
  OMS_REFERENCIA_TEXTO,
  diaEMes,
  formatarDuracao,
  podeAfirmarAusencia,
  resumoSemanaAtividade,
  type EstadoSecao,
} from '@hubpatients/core';
import { PanelCard, SectionHeader } from '@/components/ui/painel';

export interface ResumoSemanaProps {
  estado: EstadoSecao;
  /** Sessões da semana corrente, já filtradas por quem chama. */
  sessoes: readonly { duration_min: number | null | undefined }[];
  /** Primeiro dia da semana (`AAAA-MM-DD`, segunda-feira). */
  inicio: string;
  /** Último dia da semana (`AAAA-MM-DD`, domingo). */
  fim: string;
}

export function ResumoSemana({ estado, sessoes, inicio, fim }: ResumoSemanaProps) {
  const resumo = resumoSemanaAtividade(sessoes);
  const confirmado = podeAfirmarAusencia(estado);
  const periodo = inicio && fim ? `De ${diaEMes(inicio)} a ${diaEMes(fim)}` : '';

  return (
    <PanelCard as="section" aria-labelledby="semana-titulo" className="p-5">
      <SectionHeader
        id="semana-titulo"
        title="Esta semana"
        icon={CalendarRange}
        tone="ardosia"
      />

      {periodo ? <p className="mt-1 text-body-sm text-fg-soft">{periodo}</p> : null}

      <div className="mt-4">
        {confirmado ? (
          <>
            {/* O número vai ESCRITO na tela, não só em tooltip — mesma regra do
                diário alimentar. `hp-num` é a fonte tabular do app. */}
            <p className="hp-num text-body font-semibold text-fg">{resumo.texto}</p>
            <p className="mt-1 text-body-sm text-fg-soft">
              {resumo.textoRegistros}
              {resumo.minutos > 0 ? ` · ${formatarDuracao(resumo.minutos)} no total` : ''}
            </p>
          </>
        ) : estado === 'falhou' ? (
          <p className="text-body text-fg-soft">
            Não foi possível ler seus registros desta semana. O total não aparece porque não foi
            lido — não porque seja zero.
          </p>
        ) : (
          <p className="text-body text-fg-soft">Conferindo seus registros desta semana…</p>
        )}
      </div>

      {/* A ausência de meta é dita em letra, e o app não oferece nenhuma. */}
      <p className="mt-4 text-body-sm text-fg-soft">{ACTIVITY_SEM_META_TEXTO}</p>

      {/* A citação da OMS. A fonte viaja junto com o número, sempre: número de
          diretriz sem fonte escrita é indistinguível de meta inventada pelo app. */}
      <p className="mt-3 border-t border-line pt-4 text-body-sm leading-relaxed text-fg-soft">
        {OMS_REFERENCIA_TEXTO}
      </p>
    </PanelCard>
  );
}
