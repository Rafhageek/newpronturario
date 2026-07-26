# HubPatients — App Android (Expo) — build & correções

App nativo em `apps/mobile` (Expo + expo-router + NativeWind). Reusa `@hubpatients/core` e `@hubpatients/supabase`.

## Correções do pente fino (2026-06-07)
- 🔴 **Sessão > 2 KB no SecureStore** (Android quebrava a persistência) → storage **fragmentado** em `apps/mobile/src/lib/supabase.ts`.
- **Refresh de token** ligado ao `AppState` (foreground/background) — padrão Supabase RN.
- **`GestureHandlerRootView` + `SafeAreaProvider`** no root (gestos/reanimated + notch).
- **Gate de loading** (splash enquanto restaura a sessão) — sem flash de tela errada.
- **Erros tratados** em Medicamentos (antes falhava em silêncio).
- **Google OAuth** (login + cadastro): `signInWithGoogle` abre o navegador do sistema e volta pelo deep link `hubpatients://auth/callback`, que troca o `code` por sessão (PKCE).
- **Build configurável**: `icon`/`splash`/`adaptiveIcon`/`versionCode` no `app.config.ts` + `eas.json` + assets PLACEHOLDER gerados.

## Config necessária para o OAuth Google no app
No Supabase → Authentication → URL Configuration → **Redirect URLs**, adicione:
```
hubpatients://auth/callback
```
(O provedor Google já configurado para a web serve o app — mesma conta OAuth.)

## Arte (placeholder → final)
Os ícones em `apps/mobile/assets/` são **placeholder** (círculo branco + "+"). Substitua por:
- `icon.png` 1024×1024
- `adaptive-icon.png` 1024×1024 (foreground, fundo definido em `app.config.ts`)
- `splash-icon.png` 1024×1024
Regenerar os placeholders: `node apps/mobile/scripts/gen-assets.mjs`.

## Build do APK/AAB (precisa de toolchain — não há nesta máquina)
```bash
npm i -g eas-cli            # uma vez
cd apps/mobile
eas login
eas init                    # cria o projeto EAS e preenche extra.eas.projectId
eas build -p android --profile preview      # APK para instalar/testar
eas build -p android --profile production    # AAB para a Play Store
```

## Ainda pendente (não-bloqueante)
- **Paridade de telas** com a web (hoje só Início, Diário, Medicamentos, Perfil).
- **Ícones vetoriais** nas abas (hoje emoji) — precisa instalar `@expo/vector-icons`.
- **Dark mode** no mobile (web já tem).
- Validar tudo num **device/emulador** real (não foi possível aqui — sem toolchain).
