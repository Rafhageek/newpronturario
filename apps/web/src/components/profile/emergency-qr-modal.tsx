'use client';

import { HelpCircle, QrCode, ShieldCheck } from 'lucide-react';
import { diaLocal, isoToDateBR } from '@hubpatients/core';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui';

/**
 * Situação da consulta de alergias que alimenta o cartão.
 * - `ok`: a lista chegou do servidor e pode ser afirmada;
 * - `carregando`: ainda não chegou;
 * - `erro`: a busca falhou.
 */
export type AllergiesStatus = 'ok' | 'carregando' | 'erro';

/**
 * A declaração "não tenho alergia conhecida" (coluna
 * `profiles.sem_alergia_conhecida_em`, migration 0049) vista pelo cartão.
 *
 * São TRÊS estados, e não um booleano, porque "não declarou" é uma afirmação
 * tanto quanto "declarou": só o perfil RESPONDIDO autoriza qualquer uma das
 * duas. Perfil que falhou (ou que nem foi pedido, com o prontuário ainda sem
 * dono definido) é `desconhecida` — ignorância, não ausência.
 */
export type DeclaracaoSemAlergia =
  /** O paciente declarou. `em` é o instante ISO gravado (null se ilegível). */
  | { estado: 'declarada'; em: string | null }
  /** O perfil respondeu e NÃO há declaração. */
  | { estado: 'ausente' }
  /** O perfil não respondeu — o cartão não pode dizer nem que sim nem que não. */
  | { estado: 'desconhecida' };

/** "12/08/2026" a partir do instante do banco; '' quando não dá para ler. */
function dataCurta(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // Data inventada em prontuário é pior que data ausente: sem data legível a
  // frase sai SEM data, nunca com uma data chutada.
  if (Number.isNaN(d.getTime())) return '';
  // `diaLocal` antes de formatar: o carimbo é `timestamptz`, e ler o pedaço UTC
  // da string devolveria o dia anterior para quem declarou à noite no Brasil.
  return isoToDateBR(diaLocal(d));
}

/** O que a linha de alergias do cartão diz — e o porquê de dizer isso. */
export interface AlergiasDoCartao {
  /** Rótulo da linha: muda conforme a frase fale de TODAS ou só das graves. */
  rotulo: string;
  /** A frase principal, lida às pressas por quem está socorrendo. */
  valor: string;
  /** Complemento curto. Sempre opcional — o valor precisa se bastar sozinho. */
  nota?: string;
  /** Qual dos quatro estados gerou a frase (a tela escolhe o ícone por aqui). */
  origem: 'alergia-grave' | 'so-nao-graves' | 'declaracao' | 'sem-informacao';
}

const plural = (n: number, singular: string, plural_: string) =>
  `${n} ${n === 1 ? singular : plural_}`;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * O CONTEÚDO DO CARTÃO NASCE AQUI — E SÓ AQUI
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Até 12/08/2026 esta linha tinha DOIS estados: a lista, ou a palavra
 * "Nenhuma". A mesma palavra para quem DECLAROU não ter alergia e para quem
 * nunca preencheu nada — no cartão que existe justamente para o momento em que
 * essa ambiguidade custa mais caro (alguém inconsciente sendo socorrido). A
 * tela de Alergias prometia ao paciente, com todas as letras, que "quem te
 * socorrer vai ler essa declaração"; aqui é onde a promessa passa a ser
 * verdade.
 *
 * São QUATRO estados distinguíveis (o quinto, "não foi possível carregar",
 * nem chega a montar cartão — ver `EmergencyQrModal`):
 *   1. há alergia grave      → a lista, com a tinta de alerta;
 *   2. só há não graves      → diz que grave não há, e que existe outra coisa;
 *   3. declarou não ter      → a declaração, com a DATA em que foi feita;
 *   4. ninguém preencheu     → AUSÊNCIA DE INFORMAÇÃO, escrita como tal.
 *
 * A ordem é uma regra clínica, não estética: alergia registrada vence qualquer
 * declaração de ausência (o trigger da 0049 já derruba a declaração no banco,
 * mas cache e dado velho existem, e o cartão não pode exibir as duas coisas
 * juntas).
 *
 * Exportada porque o QR da Fase 5 tem de sair DESTA função. Cartão e QR que se
 * escrevem em dois lugares divergem — e um QR ambíguo desfaz sozinho tudo o que
 * está acima.
 */
export function alergiasDoCartao({
  graves,
  total,
  semAlergiaConhecida,
}: {
  /** Nomes das alergias GRAVES confirmadas. */
  graves: string[];
  /** Quantas alergias existem no total (graves + as outras). */
  total: number;
  semAlergiaConhecida: DeclaracaoSemAlergia;
}): AlergiasDoCartao {
  const outras = Math.max(total - graves.length, 0);

  if (graves.length > 0) {
    return {
      rotulo: 'Alergias graves',
      valor: graves.join(', '),
      nota:
        outras > 0
          ? `Há mais ${plural(outras, 'alergia registrada', 'alergias registradas')} sem marca de gravidade.`
          : undefined,
      origem: 'alergia-grave',
    };
  }

  /*
   * Sem grave, MAS com alergia no prontuário. Este caso não pode cair no texto
   * de "sem informação": alguém preencheu, e dizer o contrário apagaria da vista
   * do socorrista uma alergia que está registrada.
   */
  if (total > 0) {
    return {
      rotulo: 'Alergias graves',
      valor: 'Nenhuma marcada como grave',
      nota: `Há ${plural(total, 'alergia registrada', 'alergias registradas')} no prontuário, sem marca de gravidade.`,
      origem: 'so-nao-graves',
    };
  }

  if (semAlergiaConhecida.estado === 'declarada') {
    const quando = dataCurta(semAlergiaConhecida.em);
    return {
      rotulo: 'Alergias',
      valor: 'O paciente declarou não ter alergia conhecida',
      nota: quando ? `Declarado por ele em ${quando}.` : 'Declarado pelo próprio paciente.',
      origem: 'declaracao',
    };
  }

  /*
   * O TEXTO MAIS DELICADO DO APP. Quem lê está socorrendo alguém, e a leitura
   * errada aqui — "não tem nada escrito, então pode dar qualquer remédio" — é
   * exatamente a que o cartão antigo induzia ao escrever "Nenhuma".
   *
   * A frase serve tanto para o perfil que respondeu "não há declaração" quanto
   * para o perfil que não respondeu: nos dois casos o cartão não tem informação
   * confirmada, e é isso, nem mais nem menos, que ele diz.
   */
  return {
    rotulo: 'Alergias',
    valor: 'Sem informação',
    nota: 'Sem informação não é o mesmo que sem alergia. Confirme com o paciente ou com quem o acompanha.',
    origem: 'sem-informacao',
  };
}

/**
 * O cartão em texto puro — é este o conteúdo que vai para o QR (Fase 5) e para
 * o papel. Sai das MESMAS linhas que a tela mostra, de propósito: o cartão que
 * distingue os quatro estados e um QR que continua dizendo "Nenhuma" seriam o
 * mesmo defeito com uma superfície a menos.
 */
export function textoDoCartaoDeEmergencia({
  name,
  bloodType,
  alergias,
}: {
  name: string;
  bloodType?: string | null;
  alergias: AlergiasDoCartao;
}): string {
  return [
    'HubPatients · Cartão de emergência',
    `Nome: ${name}`,
    `Tipo sanguíneo: ${bloodType && bloodType !== 'unknown' ? bloodType : 'não informado'}`,
    `${alergias.rotulo}: ${alergias.valor}${alergias.nota ? ` — ${alergias.nota}` : ''}`,
  ].join('\n');
}

export function EmergencyQrModal({
  open,
  onClose,
  name,
  bloodType,
  allergies,
  allergiesTotal,
  allergiesStatus,
  semAlergiaConhecida,
  onRetry,
  retrying,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  bloodType?: string | null;
  /** Alergias graves confirmadas. Só é lida quando `allergiesStatus === 'ok'`. */
  allergies: string[];
  /** Total de alergias do prontuário (graves + as outras). */
  allergiesTotal: number;
  allergiesStatus: AllergiesStatus;
  semAlergiaConhecida: DeclaracaoSemAlergia;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  /*
   * O cartão só é montado com a lista de alergias confirmada.
   *
   * Quem lê este cartão é socorrista, e a linha de alergias é lida como
   * afirmação. Se a consulta falhou (ou ainda não voltou), a lista chega vazia
   * — e vazio aqui viraria uma frase de ausência, ou seja, o app afirmaria não
   * haver alergia grave sem nunca ter recebido esse dado. Preferimos não
   * entregar cartão nenhum a entregar um cartão que pode estar mentindo.
   *
   * A declaração de "sem alergia conhecida" NÃO afrouxa esta trava: ela é uma
   * afirmação a mais, e uma afirmação a mais sobre dado não confirmado seria
   * ainda pior que a anterior.
   */
  const confirmado = allergiesStatus === 'ok';
  const alergias = alergiasDoCartao({
    graves: allergies,
    total: allergiesTotal,
    semAlergiaConhecida,
  });
  const texto = textoDoCartaoDeEmergencia({ name, bloodType, alergias });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cartão de Emergência"
      description="Acesso rápido a dados vitais (gratuito, sempre)."
      className="max-w-sm"
    >
      {confirmado ? (
        <>
          {/*
            `data-cartao-emergencia` é o contrato com a Fase 5: o QR se gera a
            partir DESTE texto, que é o mesmo das linhas abaixo. Quem for
            implementar o QR não precisa (nem deve) remontar o conteúdo.
          */}
          <div
            data-cartao-emergencia={texto}
            className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl border-2 border-dashed border-line bg-surface-2"
          >
            <QrCode className="h-20 w-20 text-muted" aria-hidden="true" />
          </div>
          {/*
            A frase diz o que É, não o que será: o quadrado acima é um lugar
            reservado, e alguém pode tentar apontar a câmera para ele. Prometer
            aqui "o QR vai levar isto" seria o app falando de si mesmo com uma
            certeza que ele ainda não tem — a mesma regra de veracidade que vale
            para os dados do prontuário vale para as promessas da tela.
          */}
          <p className="mt-2 text-center text-body-sm text-muted">
            O QR público ainda não existe (chega na Fase 5). Vale o cartão abaixo.
          </p>

          <div className="mt-5 space-y-2 rounded-xl border border-line bg-surface p-4 text-left">
            <Row label="Nome" value={name} />
            {/* "—" num cartão de emergência é um traço que cada leitor
                interpreta como quiser. "Não informado" diz o que é: falta de
                informação, não um tipo sanguíneo compatível com tudo. */}
            <Row
              label="Tipo sanguíneo"
              value={bloodType && bloodType !== 'unknown' ? bloodType : 'Não informado'}
            />

            {/*
              A linha de alergias sai da coluna do `Row` e vira bloco próprio: as
              frases dos quatro estados são frases, não valores curtos, e
              espremê-las na metade direita de uma linha era o que empurrava o
              cartão de volta para o "Nenhuma" de uma palavra só.

              Tinta: o vermelho aparece SÓ quando há alergia grave confirmada —
              é alerta de segurança do SISTEMA, não julgamento do corpo de
              ninguém. "Sem informação" NÃO ganha vermelho: um cartão que grita
              em vermelho a todo momento ensina o socorrista a ignorá-lo, e a
              distinção que importa aqui está na PALAVRA, não no matiz.
            */}
            <div className="border-t border-line pt-2">
              <p className="text-body-sm text-fg-soft">{alergias.rotulo}</p>
              <p
                className={`mt-0.5 flex items-start gap-1.5 text-body font-semibold ${
                  alergias.origem === 'alergia-grave' ? 'text-rose-800 dark:text-rose-200' : 'text-fg'
                }`}
              >
                {alergias.origem === 'declaracao' && (
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                )}
                {alergias.origem === 'sem-informacao' && (
                  <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                )}
                {alergias.valor}
              </p>
              {alergias.nota && (
                <p className="mt-1 text-body-sm text-fg-soft">{alergias.nota}</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {/* Tom de alerta aqui é do SISTEMA (a busca falhou), não do corpo de ninguém. */}
          <Alert
            tone={allergiesStatus === 'erro' ? 'danger' : 'info'}
            title={
              allergiesStatus === 'erro'
                ? 'Não foi possível carregar suas alergias'
                : 'Carregando suas alergias…'
            }
          >
            <p className="mt-1">
              {allergiesStatus === 'erro'
                ? 'O cartão não é gerado sem essa lista. Sem ela, o cartão afirmaria ausência de alergia — uma informação que ninguém conferiu e que um socorrista leria como verdade.'
                : 'O cartão aparece assim que a lista de alergias terminar de carregar.'}
            </p>
          </Alert>
          {allergiesStatus === 'erro' && onRetry && (
            <Button onClick={onRetry} loading={retrying} className="w-full">
              Tentar de novo
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

/*
 * 15px no rótulo e 17px no valor (`text-body-sm` / `text-body`, os degraus do
 * sistema em `rem` puro). O cartão saía inteiro em 14px, abaixo do piso do
 * projeto, numa tela lida às pressas e muitas vezes por quem tem 50+.
 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-body-sm text-fg-soft">{label}</span>
      <span className="text-right text-body font-medium text-fg">{value}</span>
    </div>
  );
}
