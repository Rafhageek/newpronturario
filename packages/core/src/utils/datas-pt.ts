/* ==========================================================================
 * DATAS POR EXTENSO EM PT-BR — sem `Intl`
 *
 * O mobile roda no Hermes, e `Intl.DateTimeFormat` já derrubou o app duas
 * vezes neste projeto. Então nome de mês e de dia da semana são tabela no
 * código, e a formatação é concatenação. O mesmo módulo serve a web, para as
 * duas plataformas escreverem a data com as mesmas palavras.
 *
 * Convenção de "dia": string `AAAA-MM-DD` no fuso LOCAL da pessoa. Não é ISO
 * com timezone de propósito — "o que eu comi na terça" é um fato do calendário
 * de quem viveu a terça, não um instante UTC. Converter cedo demais para UTC é
 * o que faz o jantar das 22h aparecer no dia seguinte.
 * ========================================================================== */

export const MESES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/** Domingo primeiro, para casar com `Date.getDay()`. */
export const DIAS_SEMANA_PT = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;

/** Abreviação de uma letra... não: de três, que uma letra confunde S de sábado. */
export const DIAS_SEMANA_CURTO_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/** `AAAA-MM-DD` do fuso local (nunca `toISOString()`, que joga para UTC). */
export function diaLocal(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * `Date` que veio de um `<input type="date">` → `AAAA-MM-DD`, de volta ao dia
 * que a pessoa digitou.
 *
 * Este é o caminho INVERSO do `diaLocal`, e os dois não são intercambiáveis —
 * confundi-los é o bug de um dia a menos.
 *
 * O `<input type="date">` manda a string `'2026-08-17'`. O Zod a coage com
 * `new Date('2026-08-17')`, e o motor de JS lê data sem hora como UTC: o `Date`
 * resultante é meia-noite UTC, que no Brasil é 16/08 às 21h. Ler esse `Date`
 * com getters LOCAIS (o que `diaLocal` faz, corretamente, para um instante de
 * verdade) devolveria 16/08 — um dia a menos do que a pessoa escreveu. Então
 * aqui os componentes são lidos em UTC, que é onde o dia digitado está intacto.
 *
 * Use isto para gravar coluna `date` (dia sem hora: `performed_at`,
 * `diagnosed_at`). Para carimbar QUANDO ALGO ACONTECEU AGORA, o instante é real
 * e `diaLocal` continua sendo o certo.
 */
export function diaDeFormulario(data: Date | null | undefined): string | null {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null;
  return data.toISOString().slice(0, 10);
}

/**
 * `AAAA-MM-DD` → `Date` à meia-noite LOCAL.
 * `new Date('2026-08-05')` seria interpretado como UTC e voltaria dia 4 no
 * Brasil; por isso os componentes entram separados no construtor.
 */
export function dataDoDia(dia: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia.trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const d = Number(m[3]);
  if (mes < 1 || mes > 12 || d < 1) return null;
  // Dia 0 do mês seguinte = último dia deste mês (resolve ano bissexto sozinho).
  if (d > new Date(ano, mes, 0).getDate()) return null;
  return new Date(ano, mes - 1, d);
}

/** Soma dias a um `AAAA-MM-DD`, devolvendo `AAAA-MM-DD`. */
export function somarDias(dia: string, quantidade: number): string {
  const base = dataDoDia(dia);
  if (!base) return dia;
  base.setDate(base.getDate() + quantidade);
  return diaLocal(base);
}

/** "5 de agosto" (sem o ano, que a tela quase nunca precisa). */
export function diaEMes(dia: string): string {
  const d = dataDoDia(dia);
  if (!d) return '';
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]}`;
}

/** "5 de agosto de 2026" — para impressão e relatório, onde o ano importa. */
export function dataPorExtenso(dia: string): string {
  const d = dataDoDia(dia);
  if (!d) return '';
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Rótulo do navegador de data: "Hoje, 5 de agosto" / "Ontem, 4 de agosto" /
 * "Sexta-feira, 31 de julho". Sempre traz a data numérica junto do apelido —
 * "Hoje" sozinho vira mentira se a aba ficou aberta virando a madrugada.
 */
export function rotuloDoDia(dia: string, hoje: string = diaLocal()): string {
  const d = dataDoDia(dia);
  if (!d) return '';
  const extenso = diaEMes(dia);
  if (dia === hoje) return `Hoje, ${extenso}`;
  if (dia === somarDias(hoje, -1)) return `Ontem, ${extenso}`;
  if (dia === somarDias(hoje, 1)) return `Amanhã, ${extenso}`;
  const semana = DIAS_SEMANA_PT[d.getDay()] ?? '';
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${extenso}`;
}

/**
 * Os 7 dias da semana que contém `dia`, de segunda a domingo.
 * Segunda primeiro porque é como o calendário brasileiro é lido, ainda que
 * `getDay()` comece no domingo.
 */
export function semanaDe(dia: string): string[] {
  const d = dataDoDia(dia);
  if (!d) return [];
  // getDay(): 0=domingo. Distância até a segunda anterior: domingo volta 6.
  const recuo = (d.getDay() + 6) % 7;
  const segunda = somarDias(dia, -recuo);
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
}

/** Iniciais da semana na mesma ordem de `semanaDe` (segunda → domingo). */
export const SEMANA_CURTA_SEG_PRIMEIRO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

/* ==========================================================================
 * HORA E TEMPO RELATIVO — também sem `Intl`
 *
 * Estas funções existiam soltas: `horaLocal` escrita à mão na home do mobile,
 * `timeAgo` copiada em `app/notificacoes.tsx`, e `Intl.RelativeTimeFormat` na
 * `topbar-menus.tsx` da web. Três implementações, três redações — e a da web é
 * uma bomba armada: no dia em que o sino for para o mobile, `RelativeTimeFormat`
 * derruba o app no Hermes. Já aconteceu neste projeto, com essa API exata.
 * ========================================================================== */

/** "14:30" no fuso de quem está lendo. Aceita ISO ou `Date`. */
export function horaLocal(quando: string | Date): string {
  const d = quando instanceof Date ? quando : new Date(quando);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "12 de agosto, 14:30" — data curta + hora, no fuso local. */
export function dataEHoraLocal(quando: string | Date): string {
  const d = quando instanceof Date ? quando : new Date(quando);
  if (Number.isNaN(d.getTime())) return '';
  return `${diaEMes(diaLocal(d))}, ${horaLocal(d)}`;
}

/**
 * "agora" · "há 2 min" · "há 3 h" · "ontem" · "há 5 dias" · "há 2 meses".
 *
 * Redação escolhida para caber em chip e em linha de lista, e para não afirmar
 * precisão que não temos: arredondar 90 min para "há 2 h" é honesto; "há 1,5
 * hora" seria exatidão inventada em cima de um relógio que pode estar torto.
 *
 * Futuro (`quando` à frente de `agora`) devolve "em …" em vez de um "há -3 h"
 * sem sentido — acontece de verdade com relógio de aparelho adiantado.
 */
export function tempoRelativo(quando: string | Date, agora: Date = new Date()): string {
  const d = quando instanceof Date ? quando : new Date(quando);
  if (Number.isNaN(d.getTime())) return '';

  const deltaMs = agora.getTime() - d.getTime();
  const futuro = deltaMs < 0;
  const seg = Math.round(Math.abs(deltaMs) / 1000);

  if (seg < 45) return futuro ? 'daqui a pouco' : 'agora';

  const prefixo = (texto: string) => (futuro ? `em ${texto}` : `há ${texto}`);

  const min = Math.round(seg / 60);
  if (min < 60) return prefixo(`${min} min`);

  const hr = Math.round(min / 60);
  if (hr < 24) return prefixo(hr === 1 ? '1 h' : `${hr} h`);

  const dias = Math.round(hr / 24);
  if (dias === 1) return futuro ? 'amanhã' : 'ontem';
  if (dias < 30) return prefixo(`${dias} dias`);

  const meses = Math.round(dias / 30);
  if (meses < 12) return prefixo(meses === 1 ? '1 mês' : `${meses} meses`);

  const anos = Math.round(meses / 12);
  return prefixo(anos === 1 ? '1 ano' : `${anos} anos`);
}

/** "Bom dia" · "Boa tarde" · "Boa noite" — pelo relógio de quem está lendo. */
export function saudacao(agora: Date = new Date()): string {
  const h = agora.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
