import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useBlockScreenCapture } from '@/theme';

/**
 * Protege a tela atual contra captura/gravação enquanto está em foco.
 *
 * - Android: aplica FLAG_SECURE (bloqueia print e oculta a tela no app switcher).
 * - iOS: bloqueia gravação de tela. O SO não permite bloquear o print de
 *   forma confiável — limitação aceitável.
 *
 * ───────────────── AGORA É OPCIONAL, E VEM DESLIGADO ─────────────────
 * O bloqueio era permanente, e isso impedia coisas legítimas: mandar o print de
 * um exame para o médico, guardar o comprovante de uma consulta, ou relatar um
 * problema no app. O dono do prontuário é o próprio paciente — decidir se pode
 * fotografar a própria tela é dele.
 *
 * O padrão passou a ser LIBERADO; o bloqueio virou opção em Configurações →
 * Segurança, útil para quem usa o aparelho em local compartilhado. A proteção
 * que de fato importa continua intacta: RLS no banco, bloqueio do app por
 * biometria e trilha de auditoria. Print exige o aparelho na mão e
 * desbloqueado — é ameaça de outra natureza.
 *
 * Usa `useFocusEffect` para valer só enquanto a tela está montada E focada.
 * Cada tela passa uma `tag` única para não liberar o bloqueio de outra.
 *
 * @param tag Identificador único por tela (ex.: 'perfil', 'diario').
 */
export function useScreenGuard(tag: string): void {
  const { blocked } = useBlockScreenCapture();

  useFocusEffect(
    useCallback(() => {
      if (!blocked) {
        // Desfaz bloqueio que tenha sobrado de quando a opção estava ligada.
        void (async () => {
          try {
            await ScreenCapture.allowScreenCaptureAsync(tag);
          } catch {
            // Ambiente sem suporte (ex.: Expo Go / web) — ignora.
          }
        })();
        return;
      }

      void (async () => {
        try {
          await ScreenCapture.preventScreenCaptureAsync(tag);
        } catch {
          // Ambiente sem suporte (ex.: Expo Go / web) — ignora.
        }
      })();

      return () => {
        void (async () => {
          try {
            await ScreenCapture.allowScreenCaptureAsync(tag);
          } catch {
            // Idem: nunca propaga erro no cleanup.
          }
        })();
      };
    }, [tag, blocked]),
  );
}
