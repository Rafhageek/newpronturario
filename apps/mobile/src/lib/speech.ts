import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import * as Speech from 'expo-speech';
import { logger } from './logger';

/**
 * Leitura em voz alta (TTS) — camada fina sobre `expo-speech`.
 *
 * Por quê: nosso público é majoritariamente idoso. Presbiopia e catarata tornam
 * a leitura de um resumo de exame cansativa ou impossível; ouvir resolve sem
 * exigir zoom nem óculos. Revisão de 132 estudos (2014–2025) coloca "feedback
 * áudio/voz" como elemento essencial de design para 65+:
 * https://pmc.ncbi.nlm.nih.gov/articles/PMC12350549/
 *
 * Decisões:
 *  - Velocidade ABAIXO do padrão (0.82 contra 1.0). A fala sintética padrão é
 *    rápida demais para quem tem perda auditiva de alta frequência (presbiacusia).
 *  - Uma fala por vez no app inteiro: um registro de "quem está falando" evita
 *    dois botões "Parar" acesos ao mesmo tempo e vozes sobrepostas.
 *  - Sem voz em português no aparelho, NÃO falamos: uma voz em inglês lendo
 *    "hemoglobina glicada" produz som ininteligível e assustador. Devolvemos
 *    `unsupported` para a UI explicar como instalar a voz.
 *  - Nada aqui envia áudio ou texto para fora do aparelho: TTS é 100% local.
 */

/** Idioma da leitura (IETF BCP 47). */
export const SPEECH_LANGUAGE = 'pt-BR';

/** Ritmo padrão: ~18% mais lento que o normal, adequado a idosos. */
export const SPEECH_RATE = 0.82;

/** Tom neutro — grave demais perde inteligibilidade em alto-falante de celular. */
export const SPEECH_PITCH = 1.0;

/** Limite conservador por fala (o Android trunca perto de 4000 caracteres). */
const MAX_CHUNK = 3000;

/** Resultado de uma tentativa de leitura. */
export type SpeakOutcome =
  /** Terminou de ler tudo. */
  | 'done'
  /** Interrompido (pelo usuário, ou por outra leitura ter começado). */
  | 'stopped'
  /** Não havia texto útil para ler. */
  | 'empty'
  /** Não há voz em português instalada no aparelho. */
  | 'unsupported'
  /** Falha do serviço de voz do sistema. */
  | 'error';

export type VoiceInfo = {
  /** Há voz em português no aparelho? `null` = não foi possível consultar. */
  ptBr: boolean | null;
  /** Identificador da melhor voz encontrada (pt-BR > pt-*, Enhanced > Default). */
  identifier?: string;
};

/* ──────────────────────────── Preparo do texto ──────────────────────────── */

const normalizeLang = (lang: string): string => lang.toLowerCase().replace(/_/g, '-');

/**
 * Limpa marcações que o sintetizador leria como ruído ("asterisco", "cerquilha")
 * ou soletraria. Mantém a pontuação, que é o que dá as pausas naturais.
 */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[*_`#>|~]+/g, ' ')
    .replace(/[-–—]{2,}/g, ' ')
    .replace(/[•·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Quebra em frases sem usar lookbehind no regex — o Hermes não é confiável para
 * essa construção, e um crash em runtime aqui derrubaria a tela inteira.
 */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== ';') continue;
    let end = i + 1;
    while (end < text.length && text[end] === ' ') end += 1;
    const piece = text.slice(start, end).trim();
    if (piece.length > 0) out.push(piece);
    start = end;
    i = end - 1;
  }
  const rest = text.slice(start).trim();
  if (rest.length > 0) out.push(rest);
  return out;
}

/** Divide um texto longo em blocos faláveis, sem cortar frase no meio. */
export function splitForSpeech(text: string, max: number = MAX_CHUNK): string[] {
  const clean = cleanForSpeech(text);
  if (clean.length === 0) return [];
  if (clean.length <= max) return [clean];

  const chunks: string[] = [];
  let buffer = '';
  for (const sentence of splitSentences(clean)) {
    if (sentence.length > max) {
      // Frase gigante (laudo sem pontuação): corta na força bruta.
      if (buffer.length > 0) {
        chunks.push(buffer);
        buffer = '';
      }
      for (let i = 0; i < sentence.length; i += max) chunks.push(sentence.slice(i, i + max));
      continue;
    }
    if (buffer.length + sentence.length + 1 > max) {
      chunks.push(buffer);
      buffer = sentence;
    } else {
      buffer = buffer.length > 0 ? `${buffer} ${sentence}` : sentence;
    }
  }
  if (buffer.length > 0) chunks.push(buffer);
  return chunks;
}

/* ──────────────────────────── Voz do aparelho ──────────────────────────── */

let voiceLookup: Promise<VoiceInfo> | null = null;

/**
 * Descobre (uma vez por sessão) a melhor voz em português instalada.
 * Se a consulta falhar, devolvemos `ptBr: null` — "não sei" — e a leitura é
 * tentada mesmo assim com `language: 'pt-BR'`, deixando o sistema escolher.
 */
export function resolvePortugueseVoice(): Promise<VoiceInfo> {
  voiceLookup ??= (async (): Promise<VoiceInfo> => {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const portuguese = voices.filter((v) => normalizeLang(v.language).startsWith('pt'));
      if (portuguese.length === 0) return { ptBr: false };

      const brazilian = portuguese.filter((v) => normalizeLang(v.language).startsWith('pt-br'));
      const pool = brazilian.length > 0 ? brazilian : portuguese;
      const enhanced = pool.find((v) => v.quality === Speech.VoiceQuality.Enhanced);
      const chosen = enhanced ?? pool[0];

      return { ptBr: true, identifier: chosen?.identifier };
    } catch (err) {
      logger.warn('Não foi possível listar as vozes do aparelho', {
        reason: err instanceof Error ? err.message : 'desconhecido',
      });
      return { ptBr: null };
    }
  })();
  return voiceLookup;
}

/* ──────────────────────────── Estado global ──────────────────────────── */

/** Dono da fala atual (id do `useSpeech` que pediu), ou `null` se em silêncio. */
let activeOwner: number | null = null;

/** Invalidado a cada nova fala/parada — garante que só a última sequência siga. */
let sequence = 0;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getActiveOwner(): number | null {
  return activeOwner;
}

/** `true` se o app está lendo algo em voz alta neste momento. */
export function isSpeaking(): boolean {
  return activeOwner !== null;
}

function release(mySequence: number): void {
  if (mySequence !== sequence) return;
  if (activeOwner === null) return;
  activeOwner = null;
  emit();
}

/* ──────────────────────────── API pública ──────────────────────────── */

/** Interrompe qualquer leitura em andamento. Seguro chamar a qualquer momento. */
export async function stopSpeaking(): Promise<void> {
  sequence += 1;
  if (activeOwner !== null) {
    activeOwner = null;
    emit();
  }
  try {
    await Speech.stop();
  } catch (err) {
    logger.warn('Falha ao interromper a leitura em voz alta', {
      reason: err instanceof Error ? err.message : 'desconhecido',
    });
  }
}

/**
 * Fala um bloco e resolve quando ele termina, é interrompido ou falha.
 *
 * O "vigia" existe porque em alguns aparelhos Android o `onDone` simplesmente
 * não chega; sem ele o botão ficaria travado em "Parar" para sempre — péssimo
 * justamente para quem depende do recurso. Ele só conclui depois que a fala
 * realmente começou E o sistema informa que não está mais falando.
 */
function speakChunk(chunk: string, voice: string | undefined, rate: number): Promise<SpeakOutcome> {
  return new Promise<SpeakOutcome>((resolve) => {
    let settled = false;
    let started = false;
    let watchdog: ReturnType<typeof setInterval> | null = null;

    const settle = (outcome: SpeakOutcome): void => {
      if (settled) return;
      settled = true;
      if (watchdog !== null) clearInterval(watchdog);
      resolve(outcome);
    };

    watchdog = setInterval(() => {
      if (settled || !started) return;
      void Speech.isSpeakingAsync()
        .then((speaking) => {
          if (!speaking) settle('done');
        })
        .catch(() => undefined);
    }, 1500);

    try {
      Speech.speak(chunk, {
        language: SPEECH_LANGUAGE,
        rate,
        pitch: SPEECH_PITCH,
        voice,
        onStart: () => {
          started = true;
        },
        onDone: () => settle('done'),
        onStopped: () => settle('stopped'),
        onError: (err: Error) => {
          logger.warn('Erro do sintetizador de voz', { reason: err.message });
          settle('error');
        },
      });
    } catch (err) {
      logger.warn('Não foi possível iniciar a leitura em voz alta', {
        reason: err instanceof Error ? err.message : 'desconhecido',
      });
      settle('error');
    }
  });
}

export type SpeakOptions = {
  /** Id de quem pediu a fala (uso interno do `useSpeech`). */
  owner?: number;
  /** Sobrescreve a velocidade padrão (0.82). */
  rate?: number;
};

/**
 * Lê um texto em voz alta, em português, mais devagar que o padrão do sistema.
 * Interrompe qualquer leitura anterior — nunca sobrepõe vozes.
 */
export async function speak(text: string, options: SpeakOptions = {}): Promise<SpeakOutcome> {
  const chunks = splitForSpeech(text);
  if (chunks.length === 0) return 'empty';

  await stopSpeaking();

  sequence += 1;
  const mySequence = sequence;
  activeOwner = options.owner ?? 0;
  emit();

  const voice = await resolvePortugueseVoice();
  if (mySequence !== sequence) return 'stopped';
  if (voice.ptBr === false) {
    release(mySequence);
    return 'unsupported';
  }

  const rate = options.rate ?? SPEECH_RATE;
  for (const chunk of chunks) {
    if (mySequence !== sequence) return 'stopped';
    const outcome = await speakChunk(chunk, voice.identifier, rate);
    if (outcome !== 'done') {
      release(mySequence);
      return outcome;
    }
  }

  release(mySequence);
  return 'done';
}

/* ──────────────────────────── Hook ──────────────────────────── */

let ownerSequence = 0;

export type UseSpeech = {
  /** Esta instância do hook está lendo algo agora. */
  speaking: boolean;
  /** Alguma parte do app está lendo algo agora (inclusive outra tela). */
  anySpeaking: boolean;
  /**
   * Há voz em português instalada? `null` enquanto consulta ou se não foi
   * possível descobrir. A UI usa isto para explicar o problema ANTES do toque.
   */
  ptBrVoice: boolean | null;
  /** Lê o texto. Devolve o desfecho para a UI dar a mensagem certa. */
  speak: (text: string) => Promise<SpeakOutcome>;
  /** Interrompe a leitura. */
  stop: () => Promise<void>;
};

/**
 * Controla a leitura em voz alta de um trecho. Cada componente que usa o hook
 * tem seu próprio "dono": quando outro começa a falar, este volta para "Ouvir"
 * sozinho, sem precisar coordenar nada entre telas.
 */
export function useSpeech(): UseSpeech {
  const [owner] = useState(() => {
    ownerSequence += 1;
    return ownerSequence;
  });
  const [ptBrVoice, setPtBrVoice] = useState<boolean | null>(null);

  const active = useSyncExternalStore(subscribe, getActiveOwner, getActiveOwner);

  useEffect(() => {
    let alive = true;
    void resolvePortugueseVoice().then((info) => {
      if (alive) setPtBrVoice(info.ptBr);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Sair da tela precisa calar a voz: ninguém quer o resumo do exame sendo lido
  // depois de já ter voltado para a lista.
  useEffect(
    () => () => {
      if (getActiveOwner() === owner) void stopSpeaking();
    },
    [owner],
  );

  const speakText = useCallback((text: string) => speak(text, { owner }), [owner]);
  const stop = useCallback(() => stopSpeaking(), []);

  return {
    speaking: active === owner,
    anySpeaking: active !== null,
    ptBrVoice,
    speak: speakText,
    stop,
  };
}
