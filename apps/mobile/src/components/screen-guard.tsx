import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';

/**
 * Protege a tela atual contra captura/gravação enquanto está em foco.
 *
 * - Android: aplica FLAG_SECURE (bloqueia print e oculta a tela no app switcher).
 * - iOS: bloqueia gravação de tela. O SO não permite bloquear o print de
 *   forma confiável — limitação aceitável.
 *
 * Usa `useFocusEffect` para só ativar enquanto a tela está montada E focada,
 * liberando a captura no blur/unmount. Cada tela deve passar uma `tag` única
 * para evitar que uma tela libere o bloqueio de outra (chaves do SO).
 *
 * É idempotente e seguro: em alguns ambientes (ex.: Expo Go) as chamadas podem
 * lançar; os erros são silenciados para nunca quebrar a tela protegida.
 *
 * @param tag Identificador único por tela (ex.: 'perfil', 'diario').
 */
export function useScreenGuard(tag: string): void {
  useFocusEffect(
    useCallback(() => {
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
    }, [tag]),
  );
}
