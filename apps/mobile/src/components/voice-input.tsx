import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionErrorCode,
} from 'expo-speech-recognition';
import {
  Check,
  Keyboard as KeyboardIcon,
  Mic,
  MicOff,
  RotateCcw,
  ShieldCheck,
  Square,
  TriangleAlert,
  WifiOff,
} from 'lucide-react-native';
import { AppSheet, type AppSheetHandle } from './sheet';
import { Button } from './ui';
import { PressableScale, haptics } from './feedback';
import { logger } from '@/lib/logger';
import { useColors, fonts, useTapTarget } from '@/theme';

/**
 * Ditado por voz (fala → texto) para campos de texto livre.
 *
 * Por quê: tremor essencial, artrose de mãos e presbiopia fazem do teclado a
 * maior barreira do app para quem tem 65+. Falar é o caminho mais curto entre
 * "senti dor no joelho de manhã" e o registro no diário. Base de evidência:
 * revisão de 132 estudos (2014–2025) sobre design para idosos —
 * https://pmc.ncbi.nlm.nih.gov/articles/PMC12350549/
 *
 * Regra clínica inegociável: a transcrição NUNCA é salva direto. O texto sempre
 * cai num campo editável para o usuário conferir e corrigir. Reconhecimento de
 * voz erra com nome de remédio, dose e número — e aqui um erro desses vira
 * registro de saúde.
 *
 * Privacidade (LGPD art. 11 — dado sensível): o reconhecimento é do SISTEMA
 * operacional, não nosso. No Android/iOS ele pode enviar o áudio aos servidores
 * do fornecedor. Por isso: (1) preferimos o modo on-device quando o aparelho
 * tem o modelo em português instalado, (2) o usuário é avisado disso em texto,
 * na tela, antes do primeiro uso, e (3) nada de áudio é gravado ou guardado
 * pelo HubPatients — só o texto que a pessoa confirmar.
 */

/* ──────────────────────────── Aviso de privacidade ──────────────────────────── */

const AVISO_KEY = 'hubpatients.voz.aviso-privacidade';

/** Cache de módulo: uma leitura por sessão serve para todas as telas. */
let avisoAceito: boolean | null = null;

async function lerAviso(): Promise<boolean> {
  if (avisoAceito !== null) return avisoAceito;
  try {
    avisoAceito = (await SecureStore.getItemAsync(AVISO_KEY)) === '1';
  } catch {
    avisoAceito = false; // sem preferência gravada, mostramos o aviso de novo
  }
  return avisoAceito;
}

async function salvarAviso(): Promise<void> {
  avisoAceito = true;
  try {
    await SecureStore.setItemAsync(AVISO_KEY, '1');
  } catch {
    // preferência não-crítica: no pior caso o aviso reaparece
  }
}

/* ──────────────────────────── Mensagens ──────────────────────────── */

const ERRO_MENSAGEM: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  'no-speech':
    'Não conseguimos ouvir nada. Aproxime o aparelho da boca, fale um pouco mais alto e tente de novo.',
  'speech-timeout':
    'Ficou um tempo em silêncio e a gravação parou sozinha. Toque no microfone e comece a falar logo em seguida.',
  'not-allowed': 'O aplicativo não tem permissão para usar o microfone.',
  'service-not-allowed':
    'O serviço de reconhecimento de voz não está disponível neste aparelho. Você pode digitar normalmente.',
  'language-not-supported':
    'Este aparelho não reconhece português do Brasil por voz. Você pode digitar normalmente.',
  network:
    'Este aparelho precisa de internet para transformar a fala em texto, e a conexão falhou. Tente de novo com internet, ou digite.',
  'audio-capture':
    'Não conseguimos usar o microfone. Verifique se outro aplicativo (uma chamada, por exemplo) está usando o microfone.',
  interrupted: 'A gravação foi interrompida por uma ligação ou alarme. Tente de novo.',
  busy: 'O reconhecimento de voz está ocupado. Espere um instante e tente de novo.',
  client: 'Algo deu errado no reconhecimento de voz do aparelho. Tente de novo.',
  unknown: 'Algo deu errado no reconhecimento de voz do aparelho. Tente de novo.',
  'bad-grammar': 'Algo deu errado no reconhecimento de voz do aparelho. Tente de novo.',
};

const ERRO_PADRAO = 'Não foi possível entender sua fala agora. Tente de novo ou escreva no teclado.';

const MSG_PERMISSAO =
  'Para ditar, o aplicativo precisa da sua permissão para usar o microfone. Toque em "Tentar de novo" e escolha "Permitir".';

const MSG_PERMISSAO_BLOQUEADA =
  'A permissão do microfone está bloqueada nos ajustes do aparelho. Abra os ajustes e libere o microfone para o HubPatients — ou continue digitando normalmente.';

const MSG_INDISPONIVEL =
  'Este aparelho não tem reconhecimento de voz disponível. No Android, ele costuma vir do app "Google"; no iPhone, dos Ajustes de Teclado (Ditado). Você pode escrever no teclado normalmente.';

const MSG_SILENCIO =
  'Não ouvimos nada. Toque no microfone e comece a falar logo em seguida, com o aparelho perto da boca.';

/** Tempo sem NENHUM som antes de encerrarmos a escuta sozinhos. */
const TIMEOUT_SILENCIO_MS = 10_000;

/** Teto de duração de uma escuta — evita microfone aberto esquecido. */
const TIMEOUT_MAXIMO_MS = 60_000;

/* ──────────────────────────── Componente público ──────────────────────────── */

export type VoiceInputProps = {
  /**
   * Recebe o texto DITADO E JÁ REVISADO pelo usuário. Quem chama decide se
   * substitui ou acrescenta ao conteúdo atual do campo.
   */
  onConfirm: (texto: string) => void;
  /** Rótulo do botão que abre o ditado. */
  label?: string;
  /** Título do painel. */
  title?: string;
  /** Uma linha explicando o que se espera que a pessoa fale. */
  hint?: string;
  /** Palavras que ajudam o reconhecedor (nomes de remédio, termos da tela). */
  contextualStrings?: string[];
};

/**
 * Botão de microfone grande (64 px de altura) que abre o painel de ditado.
 * Reutilizável em qualquer campo de texto livre.
 */
export function VoiceInput({
  onConfirm,
  label = 'Falar em vez de digitar',
  title = 'Ditar por voz',
  hint,
  contextualStrings,
}: VoiceInputProps) {
  const colors = useColors();
  const [aberto, setAberto] = useState(false);
  const [avisoLido, setAvisoLido] = useState<boolean>(avisoAceito === true);

  useEffect(() => {
    let alive = true;
    void lerAviso().then((v) => {
      if (alive) setAvisoLido(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View className="gap-1.5">
      <PressableScale
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Abre o ditado por voz. Você confere e corrige o texto antes de salvar."
        style={{ borderRadius: 20 }}
      >
        <View
          style={{ height: 64, borderRadius: 20, borderCurve: 'continuous' }}
          className="flex-row items-center gap-3 border border-trust-600 bg-trust-100 px-4"
        >
          <View
            style={{ borderCurve: 'continuous' }}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-surface"
          >
            <Mic size={26} color={colors.primary} accessible={false} />
          </View>
          <View className="flex-1">
            <Text
              maxFontSizeMultiplier={1.5}
              style={{ fontFamily: fonts.semibold }}
              className="text-[15px] text-primary"
            >
              {label}
            </Text>
            <Text
              maxFontSizeMultiplier={1.5}
              style={{ fontFamily: fonts.regular }}
              className="text-[12px] leading-4 text-fg-soft"
            >
              Você confere e corrige o texto antes de salvar.
            </Text>
          </View>
        </View>
      </PressableScale>

      {aberto ? (
        <VoicePanel
          title={title}
          hint={hint}
          contextualStrings={contextualStrings}
          precisaAviso={!avisoLido}
          onConfirm={onConfirm}
          onClose={() => {
            setAberto(false);
            setAvisoLido(avisoAceito === true);
          }}
        />
      ) : null}
    </View>
  );
}

/* ──────────────────────────── Painel ──────────────────────────── */

type Fase =
  /** Aviso de privacidade (primeiro uso). */
  | 'aviso'
  /** Pronto para começar a falar. */
  | 'pronto'
  /** Pedindo permissão / iniciando o reconhecedor. */
  | 'preparando'
  /** Microfone aberto. */
  | 'ouvindo'
  /** Parou de gravar, aguardando o resultado final. */
  | 'processando'
  /** Texto pronto para revisão no campo editável. */
  | 'revisao'
  /** Algo falhou — mensagem + alternativa de digitar. */
  | 'erro'
  /** Aparelho sem reconhecimento de voz. */
  | 'indisponivel';

function VoicePanel({
  title,
  hint,
  contextualStrings,
  precisaAviso,
  onConfirm,
  onClose,
}: {
  title: string;
  hint?: string;
  contextualStrings?: string[];
  precisaAviso: boolean;
  onConfirm: (texto: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const tap = useTapTarget();
  const reduce = useReducedMotion();
  const sheetRef = useRef<AppSheetHandle>(null);

  const [fase, setFase] = useState<Fase>(precisaAviso ? 'aviso' : 'pronto');
  const [parcial, setParcial] = useState('');
  const [rascunho, setRascunho] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [permBloqueada, setPermBloqueada] = useState(false);
  /** `null` enquanto verificamos se dá para reconhecer sem enviar áudio. */
  const [onDevice, setOnDevice] = useState<boolean | null>(null);

  // Espelhos em ref: os ouvintes nativos precisam do valor atual, não do valor
  // capturado no render em que foram registrados.
  const parcialRef = useRef('');
  const finalRef = useRef('');
  const rascunhoRef = useRef('');
  const erroRef = useRef<ExpoSpeechRecognitionErrorCode | null>(null);
  const usouOnDeviceRef = useRef(false);
  const ouvindoRef = useRef(false);
  const confirmadoRef = useRef<string | null>(null);
  /** No Android, o botão Voltar pode disparar fechamento por dois caminhos —
   *  sem esta trava o texto ditado entraria duas vezes no campo. */
  const fechadoRef = useRef(false);
  const silencioRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maximoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limparTimers = useCallback(() => {
    if (silencioRef.current !== null) {
      clearTimeout(silencioRef.current);
      silencioRef.current = null;
    }
    if (maximoRef.current !== null) {
      clearTimeout(maximoRef.current);
      maximoRef.current = null;
    }
  }, []);

  /* ── Disponibilidade e modo sem internet ── */

  useEffect(() => {
    let alive = true;
    let disponivel = false;
    try {
      disponivel = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch (err) {
      logger.warn('Falha ao consultar disponibilidade do reconhecimento de voz', {
        reason: err instanceof Error ? err.message : 'desconhecido',
      });
    }
    if (!disponivel) {
      setFase('indisponivel');
      return;
    }

    void (async () => {
      let local = false;
      try {
        local = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
      } catch {
        local = false;
      }
      // No Android, "suportar" não basta: o modelo do idioma precisa estar
      // baixado, senão o start() falha com language-not-supported.
      if (local && Platform.OS === 'android') {
        try {
          const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
            androidRecognitionServicePackage: 'com.google.android.as',
          });
          local = installedLocales.some((l) => l.toLowerCase().replace(/_/g, '-').startsWith('pt-br'));
        } catch {
          local = false;
        }
      }
      if (alive) setOnDevice(local);
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* ── Encerramento limpo ── */

  useEffect(
    () => () => {
      limparTimers();
      if (ouvindoRef.current) {
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          // painel já está saindo; nada a fazer
        }
      }
    },
    [limparTimers],
  );

  /* ── Início da escuta ── */

  const iniciar = useCallback(
    async (preferirLocal: boolean) => {
      limparTimers();
      setMensagemErro('');
      setPermBloqueada(false);
      setParcial('');
      parcialRef.current = '';
      finalRef.current = '';
      erroRef.current = null;
      setFase('preparando');

      try {
        const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!perm.granted) {
          setPermBloqueada(!perm.canAskAgain);
          setMensagemErro(perm.canAskAgain ? MSG_PERMISSAO : MSG_PERMISSAO_BLOQUEADA);
          setFase('erro');
          return;
        }
      } catch (err) {
        logger.warn('Falha ao pedir permissão de microfone', {
          reason: err instanceof Error ? err.message : 'desconhecido',
        });
        setMensagemErro(MSG_PERMISSAO);
        setFase('erro');
        return;
      }

      try {
        usouOnDeviceRef.current = preferirLocal;
        ouvindoRef.current = true;
        ExpoSpeechRecognitionModule.start({
          lang: 'pt-BR',
          interimResults: true,
          continuous: false,
          maxAlternatives: 1,
          // Privacidade primeiro: quando o aparelho consegue reconhecer sem rede,
          // o áudio não sai daqui.
          requiresOnDeviceRecognition: preferirLocal,
          addsPunctuation: true,
          contextualStrings,
          iosTaskHint: 'dictation',
          androidIntentOptions: {
            // Idoso fala com pausas longas; o padrão do Android corta cedo demais.
            EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 3000,
            EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2500,
          },
        });
        maximoRef.current = setTimeout(() => {
          try {
            ExpoSpeechRecognitionModule.stop();
          } catch {
            // o evento 'end' resolve o estado de qualquer forma
          }
        }, TIMEOUT_MAXIMO_MS);
      } catch (err) {
        ouvindoRef.current = false;
        logger.warn('Falha ao iniciar o ditado por voz', {
          reason: err instanceof Error ? err.message : 'desconhecido',
        });
        setMensagemErro(ERRO_PADRAO);
        setFase('erro');
      }
    },
    [contextualStrings, limparTimers],
  );

  const parar = useCallback(() => {
    limparTimers();
    setFase('processando');
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // 'end' cuida do resto
    }
  }, [limparTimers]);

  /* ── Eventos nativos ── */

  useSpeechRecognitionEvent('start', () => {
    ouvindoRef.current = true;
    setFase('ouvindo');
    if (silencioRef.current !== null) clearTimeout(silencioRef.current);
    silencioRef.current = setTimeout(() => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // 'end' cuida do resto
      }
    }, TIMEOUT_SILENCIO_MS);
  });

  useSpeechRecognitionEvent('speechstart', () => {
    // Já há voz: o relógio do silêncio não faz mais sentido.
    if (silencioRef.current !== null) {
      clearTimeout(silencioRef.current);
      silencioRef.current = null;
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    const texto = event.results[0]?.transcript ?? '';
    if (silencioRef.current !== null) {
      clearTimeout(silencioRef.current);
      silencioRef.current = null;
    }
    if (texto.length > 0) {
      parcialRef.current = texto;
      setParcial(texto);
      if (event.isFinal) finalRef.current = texto;
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    erroRef.current = event.error;
  });

  useSpeechRecognitionEvent('end', () => {
    ouvindoRef.current = false;
    limparTimers();

    const erro = erroRef.current;
    erroRef.current = null;
    const ouvido = (finalRef.current.length > 0 ? finalRef.current : parcialRef.current).trim();
    finalRef.current = '';
    parcialRef.current = '';
    setParcial('');

    // Cancelado por nós mesmos (abort) — sem drama.
    if (erro === 'aborted') {
      setFase(rascunhoRef.current.length > 0 ? 'revisao' : 'pronto');
      return;
    }

    // On-device sem modelo baixado: cai uma vez para o modo com rede, avisando.
    if (
      erro != null &&
      usouOnDeviceRef.current &&
      (erro === 'language-not-supported' || erro === 'service-not-allowed')
    ) {
      usouOnDeviceRef.current = false;
      setOnDevice(false);
      void iniciar(false);
      return;
    }

    // Mesmo com erro, aproveitamos o que foi reconhecido até ali.
    if (ouvido.length > 0) {
      const junto = rascunhoRef.current.length > 0 ? `${rascunhoRef.current} ${ouvido}` : ouvido;
      rascunhoRef.current = junto;
      setRascunho(junto);
      setFase('revisao');
      haptics.tap();
      return;
    }

    if (erro != null) {
      setMensagemErro(ERRO_MENSAGEM[erro] ?? ERRO_PADRAO);
      setFase('erro');
      return;
    }

    if (rascunhoRef.current.length > 0) {
      setFase('revisao');
      return;
    }

    setMensagemErro(MSG_SILENCIO);
    setFase('erro');
  });

  /* ── Animação do microfone ── */

  const pulso = useSharedValue(1);
  const nivel = useSharedValue(0);

  useSpeechRecognitionEvent('volumechange', (event) => {
    if (reduce) return;
    // -2 a 10; abaixo de 0 é inaudível.
    const bruto = (event.value + 2) / 12;
    nivel.value = withTiming(Math.max(0, Math.min(1, bruto)), { duration: 120 });
  });

  const ouvindo = fase === 'ouvindo';

  useEffect(() => {
    if (!ouvindo) {
      pulso.value = withTiming(1, { duration: 160 });
      nivel.value = withTiming(0, { duration: 160 });
      return;
    }
    if (reduce) return;
    pulso.value = withRepeat(
      withSequence(
        withTiming(1.14, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [nivel, ouvindo, pulso, reduce]);

  const anelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulso.value * (1 + nivel.value * 0.28) }],
  }));

  /* ── Ações ── */

  const aceitarAviso = useCallback(() => {
    void salvarAviso();
    void iniciar(onDevice === true);
  }, [iniciar, onDevice]);

  const confirmar = useCallback(() => {
    const texto = rascunhoRef.current.trim();
    if (texto.length === 0) return;
    confirmadoRef.current = texto;
    haptics.success();
    sheetRef.current?.close();
  }, []);

  const fechar = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  const editarRascunho = useCallback((texto: string) => {
    rascunhoRef.current = texto;
    setRascunho(texto);
  }, []);

  const recomecar = useCallback(() => {
    rascunhoRef.current = '';
    setRascunho('');
    void iniciar(onDevice === true);
  }, [iniciar, onDevice]);

  return (
    // O painel vive num Modal porque o VoiceInput fica DENTRO de um formulário
    // (card, ScrollView): um sheet posicionado ali seria recortado pelo card.
    // O Modal o leva para o topo da tela, funcione onde funcionar o campo.
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={fechar}
      accessibilityLabel={title}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppSheet
          ref={sheetRef}
          title={title}
          onClose={() => {
            if (fechadoRef.current) return;
            fechadoRef.current = true;
            const texto = confirmadoRef.current;
            if (texto != null) onConfirm(texto);
            onClose();
          }}
        >
          {/* flexShrink deixa o conteúdo rolar quando a fonte do sistema está grande
              (o painel para em 90% da tela) — senão os botões ficariam cortados. */}
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {fase === 'aviso' ? (
              <AvisoPrivacidade onDevice={onDevice} onAceitar={aceitarAviso} onDigitar={fechar} />
            ) : fase === 'indisponivel' ? (
              <EstadoMensagem
                tom="neutro"
                icone={<MicOff size={26} color={colors.muted} accessible={false} />}
                titulo="Ditado indisponível neste aparelho"
                texto={MSG_INDISPONIVEL}
              >
                <Button label="Fechar e digitar" icon={KeyboardIcon} variant="outline" onPress={fechar} />
              </EstadoMensagem>
            ) : fase === 'erro' ? (
              <EstadoMensagem
                tom="alerta"
                icone={<TriangleAlert size={26} color={colors.alert} accessible={false} />}
                titulo="Não deu certo"
                texto={mensagemErro || ERRO_PADRAO}
              >
                <View className="gap-2">
                  {permBloqueada ? (
                    <Button
                      label="Abrir ajustes do aparelho"
                      onPress={() => {
                        void Linking.openSettings();
                      }}
                    />
                  ) : (
                    <Button label="Tentar de novo" icon={RotateCcw} onPress={() => void iniciar(onDevice === true)} />
                  )}
                  <Button label="Prefiro digitar" icon={KeyboardIcon} variant="outline" onPress={fechar} />
                </View>
              </EstadoMensagem>
            ) : fase === 'revisao' ? (
              <View className="gap-3">
                <Text
                  maxFontSizeMultiplier={1.5}
                  style={{ fontFamily: fonts.semibold }}
                  className="text-[15px] text-fg"
                >
                  Confira antes de salvar
                </Text>
                <Text
                  maxFontSizeMultiplier={1.5}
                  style={{ fontFamily: fonts.regular }}
                  className="text-[13px] leading-5 text-fg-soft"
                >
                  O reconhecimento de voz erra, principalmente com nomes de remédios, doses e números. Toque no
                  texto para corrigir o que estiver errado.
                </Text>
                <TextInput
                  value={rascunho}
                  onChangeText={editarRascunho}
                  multiline
                  textAlignVertical="top"
                  autoCorrect
                  accessibilityLabel="Texto reconhecido, editável"
                  accessibilityHint="Corrija o que estiver errado antes de usar."
                  placeholder="Seu texto aparece aqui…"
                  placeholderTextColor={colors.muted}
                  maxFontSizeMultiplier={1.5}
                  style={{ fontFamily: fonts.regular, minHeight: 140, borderCurve: 'continuous' }}
                  className="rounded-2xl border border-line bg-surface p-4 text-[17px] leading-6 text-fg"
                />
                <Button label="Usar este texto" icon={Check} onPress={confirmar} />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button
                      label="Falar mais"
                      icon={Mic}
                      variant="outline"
                      size="sm"
                      onPress={() => void iniciar(onDevice === true)}
                    />
                  </View>
                  <View className="flex-1">
                    <Button label="Começar de novo" icon={RotateCcw} variant="ghost" size="sm" onPress={recomecar} />
                  </View>
                </View>
              </View>
            ) : (
              <View className="gap-3">
                {hint ? (
                  <Text
                    maxFontSizeMultiplier={1.5}
                    style={{ fontFamily: fonts.regular }}
                    className="text-center text-[14px] leading-5 text-fg-soft"
                  >
                    {hint}
                  </Text>
                ) : null}

                {/* Microfone grande — alvo muito maior que o mínimo da WCAG (24 px). */}
                <View className="items-center justify-center" style={{ height: 190 }}>
                  <Animated.View
                    pointerEvents="none"
                    accessible={false}
                    style={[
                      {
                        position: 'absolute',
                        width: 148,
                        height: 148,
                        borderRadius: 74,
                        backgroundColor: ouvindo ? colors.alert : colors.primary,
                        opacity: ouvindo ? 0.18 : 0.1,
                      },
                      anelStyle,
                    ]}
                  />
                  <PressableScale
                    onPress={() => {
                      if (ouvindo) parar();
                      else void iniciar(onDevice === true);
                    }}
                    disabled={fase === 'preparando' || fase === 'processando'}
                    accessibilityRole="button"
                    accessibilityLabel={ouvindo ? 'Parar de gravar' : 'Tocar para falar'}
                    accessibilityHint={
                      ouvindo
                        ? 'Encerra a gravação e mostra o texto para você conferir.'
                        : 'Abre o microfone para você falar. O texto aparece para conferência.'
                    }
                    accessibilityState={{ busy: ouvindo, disabled: fase === 'preparando' || fase === 'processando' }}
                    style={{ borderRadius: 60 }}
                  >
                    <View
                      style={{
                        width: Math.max(112, tap * 2),
                        height: Math.max(112, tap * 2),
                        borderRadius: 999,
                        backgroundColor: ouvindo ? colors.alert : colors.primary,
                      }}
                      className="items-center justify-center"
                    >
                      {fase === 'preparando' || fase === 'processando' ? (
                        <ActivityIndicator color={colors.white} size="large" />
                      ) : ouvindo ? (
                        <Square size={40} color={colors.white} fill={colors.white} accessible={false} />
                      ) : (
                        <Mic size={48} color={colors.white} accessible={false} />
                      )}
                    </View>
                  </PressableScale>
                </View>

                <Text
                  accessibilityLiveRegion="polite"
                  maxFontSizeMultiplier={1.5}
                  style={{ fontFamily: fonts.semibold }}
                  className="text-center text-[16px] text-fg"
                >
                  {fase === 'preparando'
                    ? 'Preparando o microfone…'
                    : fase === 'processando'
                      ? 'Entendendo o que você falou…'
                      : ouvindo
                        ? 'Estou ouvindo. Pode falar.'
                        : 'Toque no microfone e fale'}
                </Text>

                {/* Transcrição em tempo real: a pessoa vê que está funcionando. */}
                {parcial.length > 0 ? (
                  <View
                    style={{ borderCurve: 'continuous' }}
                    className="rounded-2xl border border-line bg-surface-2 p-4"
                  >
                    <Text
                      maxFontSizeMultiplier={1.5}
                      style={{ fontFamily: fonts.regular }}
                      className="text-[17px] leading-6 text-fg"
                    >
                      {parcial}
                    </Text>
                  </View>
                ) : null}

                {rascunho.length > 0 && !ouvindo ? (
                  <Text
                    maxFontSizeMultiplier={1.5}
                    style={{ fontFamily: fonts.regular }}
                    className="text-center text-[12px] text-muted"
                  >
                    Já reconhecido: {rascunho.length} caracteres. O texto completo aparece para conferência ao
                    terminar.
                  </Text>
                ) : null}

                <LinhaPrivacidade onDevice={onDevice} />

                <Button label="Prefiro digitar" icon={KeyboardIcon} variant="outline" onPress={fechar} />
              </View>
            )}
          </ScrollView>
        </AppSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

/* ──────────────────────────── Peças da UI ──────────────────────────── */

/** Aviso de privacidade do primeiro uso — texto na tela, não em comentário. */
function AvisoPrivacidade({
  onDevice,
  onAceitar,
  onDigitar,
}: {
  onDevice: boolean | null;
  onAceitar: () => void;
  onDigitar: () => void;
}) {
  const colors = useColors();
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <ShieldCheck size={20} color={colors.primary} accessible={false} />
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
          style={{ fontFamily: fonts.display }}
          className="flex-1 text-[16px] text-fg"
        >
          Antes de falar, saiba disto
        </Text>
      </View>

      <Text
        maxFontSizeMultiplier={1.5}
        style={{ fontFamily: fonts.regular }}
        className="text-[14px] leading-6 text-fg-soft"
      >
        Quem transforma sua fala em texto é o serviço de voz do próprio aparelho (Google, no Android; Apple,
        no iPhone) — não o HubPatients.
      </Text>

      <ItemAviso texto="Dependendo do aparelho, esse serviço pode enviar o áudio da sua fala para os servidores da empresa que o fornece." />
      <ItemAviso
        texto={
          onDevice === true
            ? 'Boa notícia: este aparelho reconhece português sem internet. Vamos usar esse modo, e sua voz não sai daqui.'
            : onDevice === false
              ? 'Este aparelho não tem o reconhecimento offline em português, então a fala precisará passar pelo serviço do sistema.'
              : 'Estamos verificando se este aparelho consegue reconhecer sua fala sem internet.'
        }
      />
      <ItemAviso texto="O HubPatients não grava nem guarda o áudio. Só o texto que você confirmar é salvo." />
      <ItemAviso texto="Você sempre lê e corrige o texto antes de salvar." />

      <Button label="Entendi, quero falar" icon={Mic} onPress={onAceitar} />
      <Button label="Prefiro digitar" icon={KeyboardIcon} variant="outline" onPress={onDigitar} />
    </View>
  );
}

function ItemAviso({ texto }: { texto: string }) {
  return (
    <View className="flex-row gap-2">
      <Text style={{ fontFamily: fonts.regular }} className="text-[14px] leading-6 text-primary">
        •
      </Text>
      <Text
        maxFontSizeMultiplier={1.5}
        style={{ fontFamily: fonts.regular }}
        className="flex-1 text-[13px] leading-5 text-fg-soft"
      >
        {texto}
      </Text>
    </View>
  );
}

/** Lembrete permanente de para onde vai (ou não vai) a voz. */
function LinhaPrivacidade({ onDevice }: { onDevice: boolean | null }) {
  const colors = useColors();
  const local = onDevice === true;
  return (
    <View
      style={{ borderCurve: 'continuous' }}
      className={`flex-row items-start gap-2 rounded-2xl border px-3 py-2.5 ${
        local ? 'border-trust-100 bg-trust-50' : 'border-line bg-surface-2'
      }`}
    >
      {local ? (
        <WifiOff size={15} color={colors.primary} style={{ marginTop: 2 }} accessible={false} />
      ) : (
        <ShieldCheck size={15} color={colors.muted} style={{ marginTop: 2 }} accessible={false} />
      )}
      <Text
        maxFontSizeMultiplier={1.5}
        style={{ fontFamily: fonts.regular }}
        className="flex-1 text-[11px] leading-4 text-fg-soft"
      >
        {local
          ? 'Modo sem internet: sua voz é reconhecida dentro do aparelho e não é enviada a ninguém.'
          : 'Sua fala é processada pelo serviço de voz do sistema e pode ser enviada aos servidores dele. O HubPatients não guarda o áudio.'}
      </Text>
    </View>
  );
}

function EstadoMensagem({
  icone,
  titulo,
  texto,
  tom,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  texto: string;
  tom: 'alerta' | 'neutro';
  children?: ReactNode;
}) {
  return (
    <View className="gap-3" accessibilityLiveRegion="polite">
      <View
        style={{ borderCurve: 'continuous' }}
        className={`items-center gap-2 rounded-3xl border px-5 py-6 ${
          tom === 'alerta' ? 'border-rose-200 bg-rose-50' : 'border-line bg-surface-2'
        }`}
      >
        {icone}
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
          style={{ fontFamily: fonts.semibold }}
          className="text-center text-[15px] text-fg"
        >
          {titulo}
        </Text>
        <Text
          maxFontSizeMultiplier={1.5}
          style={{ fontFamily: fonts.regular }}
          className="text-center text-[13px] leading-5 text-fg-soft"
        >
          {texto}
        </Text>
      </View>
      {children}
    </View>
  );
}
