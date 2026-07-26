import { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import {
  Camera as CameraIcon,
  CameraOff,
  Check,
  Flashlight,
  FlashlightOff,
  Keyboard,
  type LucideIcon,
} from 'lucide-react-native';
import { AppSheet, type AppSheetHandle } from './sheet';
import { useColors, fonts } from '@/theme';

const CONTINUOUS = { borderCurve: 'continuous' as const };

/** Alvo de toque generoso: o público inclui idosos e quem tem tremor. */
const TOUCH = 56;

/** Altura do preview: cabe no sheet e ainda deixa os botões visíveis. */
const PREVIEW_H = 250;

/**
 * Janela em que o MESMO código é ignorado. O leitor dispara o callback a cada
 * quadro reconhecido (dezenas de vezes por segundo); sem isto, uma leitura vira
 * dez consultas de rede e dez rascunhos.
 */
const DEBOUNCE_MS = 2_500;

/** Formatos de embalagem de varejo no Brasil. Nada de QR code aqui. */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a'] as const;

export type ScannedCode = {
  /** Só dígitos: 8, 12 ou 13 posições. */
  ean: string;
  /** Formato relatado pelo leitor ('ean13', 'ean8', 'upc_a' ou 'manual'). */
  type: string;
};

/**
 * Normaliza o que a câmera (ou o teclado) devolveu para um código de produto.
 * Regra local do scanner — a validação da Open Food Facts é independente, para
 * o leitor não depender de nada de alimentos (ele também lê caixa de remédio).
 */
function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const ok = digits.length === 8 || digits.length === 12 || digits.length === 13;
  return ok ? digits : null;
}

/**
 * Leitor de código de barras reutilizável (embalagem de alimento e caixa de
 * medicamento), em bottom sheet.
 *
 * Três coisas que este componente trata de propósito:
 *   1. PERMISSÃO — explica em PT-BR antes de a caixa do Android aparecer e, se
 *      a pessoa já negou "para sempre", ensina o caminho nas Configurações.
 *   2. DEBOUNCE — o mesmo código não dispara dez vezes seguidas.
 *   3. ALTERNATIVA SEMPRE VISÍVEL — "Digitar manualmente". Mirar exige mão
 *      firme e visão; quem não consegue não pode ficar sem o recurso. A opção
 *      aparece inclusive quando a câmera está funcionando.
 *
 * Ele NÃO consulta nada e NÃO decide o que fazer com o código: devolve
 * `{ ean, type }` no callback e quem chamou resolve. A entrega acontece depois
 * da animação de saída (o pai desmonta o sheet no `onClose`).
 */
export function BarcodeScannerSheet({
  title = 'Ler código de barras',
  helpText = 'Aponte a câmera para o código de barras da embalagem, dentro da moldura.',
  privacyNote,
  onScanned,
  onClose,
}: {
  title?: string;
  /** Instrução curta acima do preview. */
  helpText?: string;
  /** Uma linha sobre o que acontece com o código depois de lido. */
  privacyNote?: string;
  /** Recebe o código lido — chamado uma única vez, após o sheet fechar. */
  onScanned: (code: ScannedCode) => void;
  /** O pai deve desmontar o sheet aqui. */
  onClose: () => void;
}) {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const sheetRef = useRef<AppSheetHandle>(null);

  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  /** Trava a leitura entre o "bipe" e o fechamento do sheet. */
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /** Última leitura aceita/rejeitada, para o debounce. */
  const lastRead = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  /** Código a entregar quando a animação de fechamento terminar. */
  const pending = useRef<ScannedCode | null>(null);

  /** Ponto único de saída: desmonta e só então entrega o que foi lido. */
  const handleClose = useCallback(() => {
    const code = pending.current;
    pending.current = null;
    onClose();
    if (code) onScanned(code);
  }, [onClose, onScanned]);

  function deliver(code: ScannedCode) {
    pending.current = code;
    setLocked(true);
    setMessage(`Código ${code.ean} lido.`);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sheetRef.current?.close();
  }

  function handleBarcode(result: BarcodeScanningResult) {
    if (locked) return;
    const now = Date.now();
    const ean = normalizeBarcode(result.data);

    if (!ean) {
      // Etiqueta de balança, QR de promoção, código interno da loja…
      if (now - lastRead.current.at > DEBOUNCE_MS) {
        lastRead.current = { code: result.data, at: now };
        setMessage('Esse código não parece ser o da embalagem. Tente o código com 13 números.');
      }
      return;
    }

    if (ean === lastRead.current.code && now - lastRead.current.at < DEBOUNCE_MS) return;
    lastRead.current = { code: ean, at: now };
    deliver({ ean, type: result.type });
  }

  function submitManual() {
    const ean = normalizeBarcode(manual);
    if (!ean) {
      setManualError('O código da embalagem tem 8, 12 ou 13 números. Confira e digite de novo.');
      return;
    }
    setManualError(null);
    deliver({ ean, type: 'manual' });
  }

  async function askPermission() {
    setAsking(true);
    try {
      await requestPermission();
    } finally {
      setAsking(false);
    }
  }

  const granted = permission?.granted === true;
  const blocked = permission != null && !permission.granted && !permission.canAskAgain;

  return (
    <AppSheet ref={sheetRef} onClose={handleClose} title={title}>
      <View className="gap-3">
        {mode === 'manual' ? (
          <ManualEntry
            value={manual}
            error={manualError}
            onChange={(v) => {
              setManual(v);
              setManualError(null);
            }}
            onSubmit={submitManual}
            onBack={() => setMode('camera')}
            disabled={locked}
          />
        ) : (
          <>
            <Text
              maxFontSizeMultiplier={1.5}
              style={{ fontFamily: fonts.regular }}
              className="text-[14px] leading-5 text-fg-soft"
            >
              {helpText}
            </Text>

            {permission == null ? (
              <View
                style={[{ height: PREVIEW_H }, CONTINUOUS]}
                className="items-center justify-center gap-2 rounded-3xl border border-line bg-surface-2"
              >
                <ActivityIndicator color={colors.primary} />
                <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
                  Preparando a câmera…
                </Text>
              </View>
            ) : granted ? (
              <View
                style={[{ height: PREVIEW_H, overflow: 'hidden', backgroundColor: '#000000' }, CONTINUOUS]}
                className="rounded-3xl border border-line"
              >
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  enableTorch={torch}
                  barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                  onBarcodeScanned={locked ? undefined : handleBarcode}
                />
                {/* Moldura de mira: mostra onde o código precisa ficar. */}
                <View pointerEvents="none" style={StyleSheet.absoluteFill} className="items-center justify-center">
                  <View
                    style={[
                      {
                        width: '82%',
                        height: 108,
                        borderWidth: 3,
                        borderColor: locked ? colors.accent : '#ffffff',
                      },
                      CONTINUOUS,
                    ]}
                    className="rounded-2xl"
                  />
                </View>
                {/* Lanterna: embalagem em armário mal iluminado é a regra, não a exceção. */}
                <Pressable
                  onPress={() => setTorch((t) => !t)}
                  accessibilityRole="button"
                  accessibilityLabel={torch ? 'Desligar a lanterna' : 'Ligar a lanterna'}
                  accessibilityState={{ selected: torch }}
                  style={[
                    {
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: TOUCH,
                      height: TOUCH,
                      backgroundColor: 'rgba(0,0,0,0.55)',
                    },
                    CONTINUOUS,
                  ]}
                  className="items-center justify-center rounded-2xl active:opacity-70"
                >
                  {torch ? (
                    <Flashlight size={24} color="#ffffff" />
                  ) : (
                    <FlashlightOff size={24} color="#ffffff" />
                  )}
                </Pressable>
              </View>
            ) : (
              <PermissionCard
                blocked={blocked}
                asking={asking}
                onAsk={() => void askPermission()}
              />
            )}

            {message ? (
              <Text
                accessibilityLiveRegion="polite"
                maxFontSizeMultiplier={1.5}
                style={{ fontFamily: fonts.medium }}
                className="text-[13px] leading-5 text-fg-soft"
              >
                {message}
              </Text>
            ) : null}

            {/* Sempre visível: nem todo mundo consegue mirar. */}
            <ActionButton
              label="Digitar manualmente"
              icon={Keyboard}
              variant="outline"
              onPress={() => {
                setMessage(null);
                setMode('manual');
              }}
              disabled={locked}
            />
          </>
        )}

        {privacyNote ? (
          <Text
            maxFontSizeMultiplier={1.6}
            style={{ fontFamily: fonts.regular }}
            className="text-[11px] leading-4 text-muted"
          >
            {privacyNote}
          </Text>
        ) : null}
      </View>
    </AppSheet>
  );
}

/* ──────────────────────────── Digitação manual ──────────────────────────── */

function ManualEntry({
  value,
  error,
  onChange,
  onSubmit,
  onBack,
  disabled,
}: {
  value: string;
  error: string | null;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  disabled: boolean;
}) {
  const colors = useColors();
  return (
    <View className="gap-3">
      <Text
        maxFontSizeMultiplier={1.5}
        style={{ fontFamily: fonts.regular }}
        className="text-[14px] leading-5 text-fg-soft"
      >
        Digite os números que ficam embaixo das barras da embalagem, sem espaços.
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        keyboardType="number-pad"
        returnKeyType="done"
        autoFocus
        maxLength={13}
        placeholder="Ex.: 7891000100103"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Código de barras"
        accessibilityHint={error ?? 'Oito, doze ou treze números'}
        maxFontSizeMultiplier={1.4}
        style={[{ fontFamily: fonts.regular, height: TOUCH, letterSpacing: 1.5 }, CONTINUOUS]}
        className="rounded-2xl border border-line bg-surface px-4 text-[18px] text-fg"
      />
      {error ? (
        <Text
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          maxFontSizeMultiplier={1.6}
          style={{ fontFamily: fonts.regular }}
          className="text-[12px] leading-4 text-semaphore-alert"
        >
          {error}
        </Text>
      ) : null}
      <ActionButton label="Usar este código" icon={Check} onPress={onSubmit} disabled={disabled} />
      <ActionButton label="Voltar para a câmera" icon={CameraIcon} variant="outline" onPress={onBack} disabled={disabled} />
    </View>
  );
}


/* ──────────────────────────── Permissão ──────────────────────────── */

/**
 * Sem permissão o recurso simplesmente não existe — então a tela explica por
 * que precisamos da câmera (e o que NÃO fazemos com ela) e dá o caminho de
 * volta. `blocked` é o caso "não perguntar de novo": aí só as Configurações do
 * Android resolvem, e o passo a passo precisa estar escrito.
 */
function PermissionCard({
  blocked,
  asking,
  onAsk,
}: {
  blocked: boolean;
  asking: boolean;
  onAsk: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={CONTINUOUS}
      className="gap-3 rounded-3xl border border-dashed border-line bg-surface-2 p-4"
    >
      <View className="flex-row items-center gap-2">
        <CameraOff size={20} color={colors.muted} />
        <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[15px] text-fg">
          {blocked ? 'A câmera está bloqueada' : 'Precisamos da câmera'}
        </Text>
      </View>
      <Text
        maxFontSizeMultiplier={1.5}
        style={{ fontFamily: fonts.regular }}
        className="text-[13px] leading-5 text-fg-soft"
      >
        {blocked
          ? 'Você negou o acesso à câmera para o HubPatients. Para liberar: abra as Configurações do Android, toque em Aplicativos, escolha HubPatients, entre em Permissões e ligue a Câmera. Depois volte aqui.'
          : 'A câmera é usada só para ler o código de barras, aqui dentro. Nenhuma foto é tirada, guardada ou enviada para lugar nenhum.'}
      </Text>
      {blocked ? (
        <ActionButton
          label="Abrir as configurações"
          icon={CameraIcon}
          onPress={() => void Linking.openSettings()}
        />
      ) : (
        <ActionButton label="Permitir o uso da câmera" icon={CameraIcon} onPress={onAsk} disabled={asking} />
      )}
      <Text
        maxFontSizeMultiplier={1.6}
        style={{ fontFamily: fonts.regular }}
        className="text-[12px] leading-4 text-muted"
      >
        Se preferir, você pode digitar o código na mão — o botão abaixo funciona sem a câmera.
      </Text>
    </View>
  );
}

/* ──────────────────────────── Botão grande ──────────────────────────── */

/**
 * Botão do leitor: 56 px de altura (mais alto que o padrão do app) porque estas
 * ações são feitas com o celular na mão, apontado para uma caixa.
 */
function ActionButton({
  label,
  icon: Icon,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
}) {
  const colors = useColors();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        { height: TOUCH, backgroundColor: primary ? colors.primary : 'transparent' },
        CONTINUOUS,
        disabled ? { opacity: 0.6 } : null,
      ]}
      className={`flex-row items-center justify-center gap-2 rounded-2xl px-4 active:opacity-80 ${
        primary ? '' : 'border border-line bg-surface'
      }`}
    >
      <Icon size={20} color={primary ? colors.white : colors.fg} />
      <Text
        maxFontSizeMultiplier={1.4}
        style={{ fontFamily: fonts.semibold, color: primary ? colors.white : colors.fg }}
        className="text-[15px]"
      >
        {label}
      </Text>
    </Pressable>
  );
}
