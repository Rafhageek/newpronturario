import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Sparkles } from 'lucide-react-native';
import {
  WHATS_NEW_ITEMS,
  WHATS_NEW_STORAGE_KEY,
  WHATS_NEW_TITLE,
  WHATS_NEW_VERSION,
} from '@hubpatients/core';
import { AppSheet, type AppSheetHandle } from './sheet';
import { Button } from './ui';
import { useColors, fonts } from '@/theme';

/**
 * Folha "O que mudou", exibida UMA vez por versão.
 *
 * Decisões que valem registro:
 *  - Grava a versão vista ao ABRIR, não ao fechar. Se a pessoa mata o app no
 *    meio, ela não é perseguida pelo mesmo aviso na próxima abertura.
 *  - Não usa animação própria: o `AppSheet` já entra deslizando e já respeita
 *    `useReducedMotion`. Empilhar mais movimento aqui só piora para quem pediu
 *    menos movimento.
 *  - Falha de leitura/escrita do SecureStore NÃO bloqueia o app nem mostra erro:
 *    é preferência, não dado clínico. Na dúvida, não mostra o popup — atrapalhar
 *    quem abriu o app para ver um remédio é pior do que perder um aviso.
 */
export function WhatsNewSheet() {
  const colors = useColors();
  const sheetRef = useRef<AppSheetHandle>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const vista = await SecureStore.getItemAsync(WHATS_NEW_STORAGE_KEY);
        if (cancelado || vista === WHATS_NEW_VERSION) return;
        setVisible(true);
        // Marca como vista já na abertura (ver comentário acima).
        await SecureStore.setItemAsync(WHATS_NEW_STORAGE_KEY, WHATS_NEW_VERSION);
      } catch {
        // sem popup neste caso — de propósito
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <AppSheet ref={sheetRef} onClose={() => setVisible(false)} title={WHATS_NEW_TITLE}>
      <View className="gap-4 pb-2">
        <View className="flex-row items-center gap-2.5">
          <Sparkles size={18} color={colors.primary} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] leading-5 text-fg-soft">
            A atualização chegou sozinha — você não precisa reinstalar nada.
          </Text>
        </View>

        {/* `ScrollView` com altura limitada: com a fonte do sistema ampliada a
            lista passa da tela, e sem rolagem o botão de fechar ficaria fora. */}
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          <View className="gap-3.5">
            {WHATS_NEW_ITEMS.map((item) => (
              <View key={item.title} className="gap-1">
                <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                  {item.title}
                </Text>
                <Text style={{ fontFamily: fonts.regular }} className="text-[13px] leading-5 text-fg-soft">
                  {item.body}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <Button label="Entendi" onPress={() => sheetRef.current?.close()} />
      </View>
    </AppSheet>
  );
}
