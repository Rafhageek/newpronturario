# Motion & UX — HubPatients (2026-07-13)

> Pesquisa multi-agente (entrada/onboarding, login/auth, micro-interações/transições).
> Refs: Revolut, N26, Monzo, Headspace, Linear, Family, Reanimated/Moti/SVG, framer-motion.

## Direção de motion

**Princípio:** *"Movimento com propósito clínico — calmo para dados, celebração só em marcos."*
Easing-assinatura `cubic-bezier(0.22,1,0.36,1)` em **220–320ms**; toque = spring de baixo overshoot
(`damping ≥ 14`, 1 bounce); dados clínicos sóbrios (count-up + fade); spring/confete reservados a
conquistas de adesão. `useReducedMotion()` degrada tudo para crossfade de opacidade de 120ms
(nunca remove o feedback — ele orienta o idoso). *Feeling:* "o app está cuidando de você" —
respiração antes de pressa, continuidade em vez de cortes. **Tom Revolut/Headspace, nunca Duolingo infantil.**

## Entrada do app (WelcomeOverlay v2) — OTA

1. **Handoff splash nativa → app** — `SplashScreen.setOptions({duration:400, fade:true})`; overlay com a MESMA cor/ícone/posição da splash nativa faz `scale 1→1.06` + `opacity→0` (600ms), conteúdo em FadeIn. Elimina o "corte seco" e o "dois logos".
2. **Logo que se desenha** — `AnimatedPath` do ícone/ECG: `strokeDashoffset L→0` (700ms) → `fillOpacity 0→1` (250ms). Efeito premium de custo zero (sem Lottie).
3. **Carregando = respiração** — em vez de spinner, anel `scale 1→1.08→1` em loop de 4s (`Easing.inOut(sin)`). Calmo para idoso.
4. **Transição overlay → dashboard** — **mask reveal circular** (SVG `<Mask>` + `AnimatedCircle` r animado) abrindo do ícone central; ícone "vira" o header (medido com `measure()`, não `sharedTransitionTag` — instável no Reanimated 4).
- **Web:** framer-motion — `motion.path pathLength` + `layoutId="brand-logo"`.

## Login/cadastro — OTA

- **Fundo que respira** — mesh de 2-3 `<RadialGradient>` SVG (royal/coral 12-22%) com `cx/cy` animando em loop 9-14s. **Não** animar `colors` do LinearGradient (quebra no Android).
- **Campos** — label flutuante (`translateY -22`, `scale 0.82`, 220ms) + anel de foco `interpolateColor` royal + halo SVG.
- **Erro** — shake curto (`≤8px`, withSequence) + pulso coral + `Haptics.Error`. Reduce-motion: só pulso de cor.
- **Senha** — morph do olho (crossfade 2 SVG + rotate). Opcional "peek" (revela ao segurar).
- **Validação** — check que desenha (`AnimatedPath strokeDashoffset` + `scale spring`). Substitui Lottie.
- **Botão submit = máquina de estados** (maior impacto percebido) — `idle → loading` (largura → círculo, arco girando) → `success` (expande + check + `Haptics.Success`) encadeia no handoff hero→dashboard.
- **Hero keyboard-aware** — `useAnimatedKeyboard` encolhe o hero conforme o teclado sobe (resolve o botão escondido).

## Kit de micro-interações (reutilizável, OTA)

- **Press:** `onPressIn scale 0.96 spring(damping:15,stiffness:400)`; háptica no **onPressIn** (antecipação).
- **Mapa háptico semântico:** navegação=`selection`; registro=`Success`; erro=`Error`; primário=`ImpactMedium`.
- **List stagger + reorder:** `FadeInDown.delay(i*40)` (cap 6) + `LinearTransition.springify()` + `exiting FadeOut`.
- **Skeleton → real:** Moti (`npm i moti`, JS/OTA) shimmer + `AnimatePresence` crossfade. Elimina flash/pulo.
- **Sucesso (marco):** check draw-on + count-up +80ms + confete sóbrio (12-18 partículas, só azul+coral). **Só em metas.**
- **Swipe actions:** RNGH `ReanimatedSwipeable` (`overshootRight:false`, háptica no threshold) — sempre manter menu 3-pontos + confirmar destrutivo.
- **Pull-to-refresh:** overscroll desenha ECG (SVG) → solta → check. Reduce-motion: `RefreshControl` nativo.
- **Gráficos:** draw-on `strokeDashoffset` (600-800ms, só 1º render); tooltip seguindo o dedo; alerta = coral **+ ícone** (nunca só cor).

## Plano OTA (3 ondas)

- **1ª (baixo risco):** mapa de transições Expo Router por rota (config); skeleton→conteúdo com Moti (maior ganho/menor esforço); kit de press + háptica semântica; entradas do login.
- **2ª (médio):** botão submit máquina de estados + check inline; campos (label/foco/shake/olho); list `layout`+`exiting` casado com sucesso (loop "marquei remédio → item sai → check → count-up"); logo que se desenha.
- **3ª (mais alto):** handoff splash→app; mask reveal + shared element medido; fundo que respira + hero keyboard-aware; pull-to-refresh ECG + draw-on de gráficos.

## Fica para build nativo — veredito

| Recurso | Módulo | Veredito |
|---|---|---|
| Blur real (glass no login) | `expo-blur` | **Talvez** — fallback OTA (translúcido + borda) fica 90% tão bom. |
| Mesh/aurora GPU | Skia | **Não prioritário** — mesh SVG já entrega o premium calmo. |
| Zoom nativo iOS 18 (card→tela) | Expo Router `Link.AppleZoom` SDK 55+ | **Sim, quando subir de SDK** — efeito "Apple Wallet" nos fluxos-herói. |
| Shared element robusto | `react-native-screen-transitions` | **Opcional** — só se o medido (OTA) for frágil. |
| Lottie | `lottie-react-native` | **Não** — tudo reproduzível com SVG stroke OTA. |

**Recomendação de build:** um único dev build futuro com `expo-blur` (glass) + upgrade SDK 55+ (zoom nativo). Até lá, as 3 ondas OTA cobrem **95% do salto premium**.

*(Pesquisa bruta com URLs: workflow `wf_6a50bc05-930`, sessão 2026-07-13.)*
