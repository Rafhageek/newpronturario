import { Platform, Text, View } from 'react-native';
import { Volume2, Square } from 'lucide-react-native';
import { PressableScale } from './feedback';
import { toast } from './toast';
import { useSpeech } from '@/lib/speech';
import { useColors, fonts, useTapTarget } from '@/theme';

/**
 * Botão "Ouvir" — lê em voz alta o texto ao lado dele e vira "Parar" enquanto fala.
 *
 * Existe para o resumo do exame, o laudo e a posologia: são textos longos, em
 * letra pequena, e o nosso público tem presbiopia. Ouvir custa um toque; ler
 * custa achar os óculos.
 *
 * Nada sai do aparelho — a síntese de voz é local (ao contrário do ditado).
 */

const COMO_INSTALAR_VOZ = Platform.select({
  android:
    'Seu aparelho não tem uma voz em português instalada. Vá em Configurações › Acessibilidade › Texto para fala e instale o português (Brasil).',
  ios: 'Seu aparelho não tem uma voz em português instalada. Vá em Ajustes › Acessibilidade › Conteúdo Falado › Vozes e baixe Português (Brasil).',
  default: 'Este aparelho não tem uma voz em português para ler o texto em voz alta.',
});

export function ReadAloudButton({
  text,
  what,
  label = 'Ouvir',
  stopLabel = 'Parar',
}: {
  /** Texto que será lido. Se vier vazio, o botão não é exibido. */
  text: string;
  /** O que está sendo lido, para o leitor de tela: "o resumo do exame". */
  what?: string;
  label?: string;
  stopLabel?: string;
}) {
  const colors = useColors();
  const tap = useTapTarget();
  const { speaking, ptBrVoice, speak, stop } = useSpeech();

  const clean = text.trim();
  if (clean.length === 0) return null;

  async function handlePress(): Promise<void> {
    if (speaking) {
      await stop();
      return;
    }
    const outcome = await speak(clean);
    if (outcome === 'unsupported') toast.info(COMO_INSTALAR_VOZ);
    else if (outcome === 'error') toast.error('Não foi possível ler em voz alta agora. Tente de novo.');
    else if (outcome === 'empty') toast.info('Não há texto para ler aqui.');
  }

  const alvo = what ?? 'este texto';

  return (
    <View className="gap-1">
      <PressableScale
        onPress={() => void handlePress()}
        accessibilityRole="button"
        accessibilityLabel={speaking ? `Parar a leitura de ${alvo}` : `Ouvir ${alvo} em voz alta`}
        accessibilityState={{ busy: speaking }}
        hitSlop={6}
        style={{ borderRadius: 999, alignSelf: 'flex-start' }}
      >
        <View
          style={{ minHeight: tap, borderCurve: 'continuous' }}
          className={`flex-row items-center gap-2 rounded-full border px-4 py-2 ${
            speaking ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'
          }`}
        >
          {speaking ? (
            <Square size={16} color={colors.primary} fill={colors.primary} accessible={false} />
          ) : (
            <Volume2 size={18} color={colors.primary} accessible={false} />
          )}
          <Text
            maxFontSizeMultiplier={1.6}
            style={{ fontFamily: fonts.semibold }}
            className="text-[14px] text-primary"
          >
            {speaking ? stopLabel : label}
          </Text>
        </View>
      </PressableScale>

      {/* Aviso honesto: sem voz instalada, o toque não vai produzir som. */}
      {ptBrVoice === false ? (
        <Text
          maxFontSizeMultiplier={1.6}
          style={{ fontFamily: fonts.regular }}
          className="text-[11px] leading-4 text-muted"
        >
          {COMO_INSTALAR_VOZ}
        </Text>
      ) : null}
    </View>
  );
}
