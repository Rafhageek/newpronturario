# Acessibilidade — HubPatients

Checklist prático de acessibilidade do HubPatients (web + mobile), com foco no
nosso público real: **pessoas idosas, pacientes crônicos e cuidadores**.

Este documento é operacional: o que **já está feito**, o que **falta**, e o
**padrão** a seguir em qualquer tela nova. Marque os itens conforme forem sendo
aplicados tela a tela.

---

## 1. Por que (evidência)

| Fato | Fonte |
| --- | --- |
| Entre 25 e 60 anos a capacidade de usar sites cai **~0,8% ao ano**. "Tiny type" (letra minúscula) e alvos pequenos são a queixa central de usuários idosos. | [NN/g — Usability for Senior Citizens](https://www.nngroup.com/articles/usability-for-senior-citizens/) |
| Revisão sistemática de **132 estudos (2014–2025)**: os elementos essenciais de UI para idosos são **fontes maiores, alto contraste, alvos de toque ampliados, navegação linear e tolerância a erro**. | [PMC12350549](https://pmc.ncbi.nlm.nih.gov/articles/PMC12350549/) |
| **WCAG 2.2 SC 2.5.8 (Target Size, Minimum)**: alvo mínimo de **24×24 px**. | W3C WCAG 2.2 |
| **WCAG 2.x SC 1.4.3 / 1.4.11**: contraste **4,5:1** para texto normal, **3:1** para texto grande (≥24 px, ou ≥18,66 px em negrito) e para elementos interativos/ícones. | W3C WCAG 2.2 |

Nosso piso é **mais alto que o normativo**: 44 px de alvo no padrão e **56 px no
Modo Sênior**, contra os 24 px exigidos pelo WCAG 2.2.

---

## 2. Modo Sênior ("Modo simples") — FEITO

Uma única chave que liga os ajustes de maior impacto para leitura de baixa visão.
Na interface o nome é **"Modo simples"** (linguagem do paciente, não jargão de a11y).

### Tokens compartilhados — `packages/ui-tokens/src/index.ts`

- [x] `tapTarget` → `{ wcagMin: 24, min: 44, senior: 56, gap: 8 }`
- [x] `contrastRatios` → `{ normalText: 4.5, largeText: 3, nonText: 3, enhanced: 7 }`
- [x] `largeTextPx` → `{ regular: 24, bold: 18.66 }`
- [x] `SENIOR_FONT_FACTOR = 1.3` e `fontScaleClamp = { min: 1, max: 2 }`
- [x] `seniorTypography` → `typography.fontSize × 1.3` + entrelinha folgada (corpo 1.6)
- [x] Agregado `a11y` (exportado solto e dentro de `tokens`)

> Tudo é **aditivo**: nenhum token existente mudou de valor ou de nome.

### Mobile — `apps/mobile/src/theme.ts`

- [x] `useSeniorMode()` → `{ enabled, setEnabled }`, reativo em todas as telas
      (`useSyncExternalStore`), persistido em **SecureStore** na chave
      `hubpatients.senior-mode` (mesmo mecanismo de `lib/theme-pref.ts`).
      Carrega sozinho no primeiro uso — não exige mudança no `_layout.tsx`.
- [x] `useFontScale()` → `{ system, effective, style }`.
      `effective = clamp(fontScale do sistema × 1.3, 1.0, 2.0)`.
      `style = effective / system` — **desconta o que o React Native já multiplica
      sozinho** (`allowFontScaling`), evitando escala dupla e garantindo o teto de 2×
      mesmo com a fonte do aparelho no máximo.
- [x] `useType()` → a escala `type` já ajustada; `scaledType(fator)` memoizado.
- [x] `useTapTarget()` → `44` ou `56` conforme o modo.
- [x] `useReduceMotion()` → espelha `AccessibilityInfo.isReduceMotionEnabled()`.
- [x] API pública anterior intacta (`colors`, `useColors`, `fonts`, `type`, `space`,
      `radius`, `gradients`, `cardShadow`, `shadowRaised`).

### Telas de configuração

- [x] `apps/mobile/app/configuracoes.tsx` — seção **Acessibilidade → "Modo simples"**:
      switch com alvo de 56 px, explicação em linguagem simples, lista do que muda e
      **preview com o tamanho real do texto**.
- [x] `apps/web/src/app/(app)/configuracoes/page.tsx` — card **"Modo simples"** no topo.
      **Não duplica lógica**: é derivado do `a11y-provider` já existente
      (`fontScale === 'xlarge' && contrast === 'high'`), então persiste pelo mesmo
      `localStorage` + script no-flash de `layout.tsx`. O card de Acessibilidade virou
      "ajuste fino" (regular letra e contraste separadamente).
- [x] Web: `Toggle` da tela passou a ter alvo de **44×44 px**, `aria-label`,
      anel de foco visível e animação só em `motion-safe`.

### O que exatamente muda quando o Modo Sênior liga

| | Mobile | Web |
| --- | --- | --- |
| Texto | `type` × 1,3 (clamp total 1,0–2,0 junto com a fonte do sistema) | `html` a **130%** sob `[data-senior]` — tudo em `rem` acompanha |
| Contraste | herda o alto contraste do SO | liga `data-contrast="high"` (tokens `--fg`/`--muted`/`--primary` reforçados) |
| Alvo de toque | `useTapTarget()` → 56 px — já nos componentes compartilhados; telas soltas pendentes | `[data-senior]` impõe `min-height/min-width: 2.75rem`, que a 130% vale ~57 px |
| Persistência | SecureStore `hubpatients.senior-mode` | `localStorage` `vl-font-scale` + `vl-contrast` (deriva `data-senior`) |

> **Fator alinhado (2026-08-04).** A web usava 125% e o mobile 1,3 — duas
> promessas diferentes para o mesmo botão. Agora as duas usam o
> `SENIOR_FONT_FACTOR = 1.3` de `@hubpatients/ui-tokens`. O ajuste fino A/A+/A++
> continua em 100/112,5/125%; é outro controle.

---

## 3. Aplicação — feito e pendente

### 3.1 Alvo de toque (56 px no Modo Sênior)

- [x] Mobile: `src/components/ui.tsx` — `Button` (altura fixa → `minHeight` reativo),
      `ListRow`, `Input` (era `h-12`), botão de voltar do `AppHeader` (era `h-10 w-10`
      = 40 px, **abaixo do piso de 44 mesmo com o modo desligado**).
- [x] Mobile: `src/components/sheet.tsx` — botão de fechar do painel.
- [x] Web: rede de segurança global em `globals.css` sob `html[data-senior]`, e
      `data-senior` publicado pelo `a11y-provider` + script no-flash do `layout.tsx`.
      **O piso é `2.75rem`, não `3.5rem`**: como a base já está a 130%, 2,75rem vale
      ~57 px. `3.5rem` daria ~73 px e estouraria as barras de ação.
- [x] Web: `modal.tsx` (fechar, era 40 px), `icon-menu.tsx` (era 36 px),
      `error-state.tsx` (era 40 px), `tabs.tsx` (sem altura declarada).
- [ ] Mobile: os `<Pressable>` soltos dentro das telas (fora dos componentes
      compartilhados) ainda não declaram `minHeight`.
- [ ] Web: `slider.tsx` — o thumb tem 16 px. É um controle nativo; ampliar exige
      redesenhar o componente, não só um `min-height`.
- [ ] Manter **8 px de folga** (`tapTarget.gap`) entre alvos adjacentes.

### 3.2 Tipografia

- [x] Componentes compartilhados do mobile saíram de `text-[Npx]` para `style`
      escalado — é o que faz o Modo Sênior valer nas 48 de 51 telas que os usam.
- [x] Textos ≤ 11 px que carregam **dado clínico ou de ação**: apresentação/dose e
      tarja no autocomplete de medicamento, chip de faixa de referência, badge de
      status, rótulo e erro de formulário, adesão, aviso da Anvisa, banner de
      interação medicamentosa, legenda da escala de dor, Farmácia Popular.
- [ ] Restam **~795** `text-[Npx]` (698 nas telas, 97 em componentes) — esses
      escalam com a fonte do SISTEMA, mas **não** com o Modo Sênior.

> **Por que não dá para consertar tudo de uma vez.** Um `<Text className="text-[12px]">`
> tem o tamanho resolvido pelo Tailwind/NativeWind em tempo de build; nenhum hook
> alcança esse valor. As duas saídas globais foram avaliadas e descartadas:
> `rem.set()` do NativeWind escalaria também as **1538** classes de espaçamento
> (`p-4`, `w-10`…), quebrando ícones e larguras; e um `<Text>` interceptado por
> `cssInterop` não é verificável fora do Metro (em Jest o `className` chega vazio),
> o que é risco alto demais para um app de saúde. O caminho é migrar por
> consequência: componente compartilhado primeiro, depois o texto clínico.
      Enquanto houver `px` fixo, o Modo Sênior não alcança aquele texto.
- [ ] Corpo de texto nunca abaixo de 15 px no padrão / ~20 px no Modo Sênior.
- [ ] **Hermes**: nunca usar `Intl.RelativeTimeFormat` no mobile — derruba o app.
      Formatar datas relativas manualmente.

### 3.3 Contraste

- [ ] Auditar `text-faint` (`#847e74` no claro) sobre `bg`/`surface-2`: fica em ~4,6:1,
      **no limite** de 4,5:1 — só usar em texto ≥18,66 px negrito ou promover para `muted`.
- [ ] Ícones e bordas de campo precisam de **3:1** (`contrastRatios.nonText`).
- [ ] Nunca comunicar estado **só por cor** — semáforo de exames precisa de rótulo/ícone
      junto (norma clínica + SC 1.4.1).
- [ ] Verificar o modo `data-contrast="high"` no tema escuro (halation: `--fg` off-white,
      não branco puro, em texto longo).

### 3.4 Semântica / leitor de tela

- [ ] `accessibilityRole` em todo `Pressable` (`button`, `link`, `switch`, `checkbox`,
      `header`, `alert`) — hoje presente em ~40 dos 79 arquivos `.tsx` do mobile.
- [ ] `accessibilityLabel` sempre que o rótulo visível for ícone, abreviação ou número
      solto ("12" → "12 mg"). `accessibilityHint` para o que não é óbvio.
- [ ] `accessibilityState` (`{ selected }`, `{ checked }`, `{ expanded }`, `{ disabled }`).
- [ ] Ícone decorativo: `aria-hidden="true"` (web) / dentro do `accessible` do pai (mobile).
- [ ] Não deixar dois nós anunciarem a mesma coisa (Switch dentro de Pressable →
      `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`).

### 3.5 Regiões vivas (toasts, erros, resultados)

- [x] Mobile: `src/components/toast.tsx` já usa `accessibilityLiveRegion="polite"`;
      `ui.tsx` usa `"assertive"` para erro.
- [x] Web: `sonner` já anuncia; há `aria-live` em ciclo, interações medicamentosas,
      recuperação de senha e compartilhamento.
- [ ] Padronizar: **`polite`** para confirmação/sucesso, **`assertive` + `role="alert"`**
      só para erro e alerta clínico. Assertivo demais atropela a leitura.
- [ ] Toda tela que carrega dados precisa anunciar o fim do carregamento
      ("3 exames encontrados"), não só um spinner.

### 3.6 Movimento

- [ ] Mobile: toda animação nova checa `useReduceMotion()` e cai para transição
      instantânea (auditar `celebration.tsx`, `welcome-overlay.tsx`, `sheet.tsx`,
      `tab-bar.tsx`, `places-map.tsx`).
- [ ] Web: usar as variantes `motion-safe:` do Tailwind em qualquer `transition`/
      `animate-` (as animações de `globals.css` — `vl-rotate`, `vl-pulse-glow` —
      ainda precisam de um bloco `@media (prefers-reduced-motion: reduce)`).
- [ ] Nada pisca entre 3 e 55 Hz (SC 2.3.1).

### 3.7 Foco e navegação

- [ ] Ordem de foco = ordem visual; sem `tabIndex` positivo.
- [ ] Anel de foco **visível sempre** (`focus-visible:ring-2 focus-visible:ring-primary`),
      nunca `outline: none` sem substituto (SC 2.4.7 / 2.4.11).
- [ ] Modais e `AppSheet`: mover o foco para dentro ao abrir, **prender** o foco enquanto
      aberto e **devolver** ao gatilho ao fechar; `Esc` fecha.
- [ ] Web: "Pular para o conteúdo" como primeiro elemento focável.
- [ ] **Navegação linear** (recomendação da revisão de 132 estudos): um caminho óbvio por
      tarefa, sem atalhos escondidos atrás de gestos; evitar menus aninhados em 3 níveis.
- [ ] Nenhuma função só por gesto (arrastar/pinçar) sem alternativa por botão (SC 2.5.1).

### 3.8 Formulários — "uma coisa por tela"

- [ ] Quebrar formulários longos (cadastro, exame, medicamento) em passos com **uma
      pergunta por tela** e indicador de progresso ("Passo 2 de 4").
- [ ] Rótulo **sempre visível** acima do campo — nunca só `placeholder`.
- [ ] Campo com `autoComplete`/`textContentType` corretos e teclado adequado
      (`number-pad` para dose, `numbers-and-punctuation` para hora).
- [ ] Alvos e campos com **56 px** de altura no Modo Sênior.
- [ ] Ajuda contextual junto do campo, não em tooltip que some.

### 3.9 Padrão de erro (tolerância a erro)

Regras obrigatórias — vale para web e mobile:

- [ ] **Resumo no topo** do formulário, com `role="alert"` / `accessibilityLiveRegion="assertive"`,
      listando os campos com problema e link/foco para cada um.
- [ ] **Não validar enquanto o usuário digita.** Validar no `blur` do campo ou no envio.
      Erro que aparece na terceira letra do e-mail é ruído.
- [ ] **Nunca limpar o campo** após erro — nem senha, nem CPF, nem dose.
- [ ] Mensagem diz **o que fazer**, não o que a máquina achou:
      "Use o formato HH:MM (ex.: 22:00)", não "valor inválido".
- [ ] Ação destrutiva sempre confirma e explica a consequência; oferecer desfazer quando
      der (apagar histórico, gerar nova URL de calendário, sair de outros dispositivos).
- [ ] Erro nunca só em vermelho: ícone + texto (SC 1.4.1).

### 3.10 Teste

- [ ] TalkBack (Android) e VoiceOver (iOS) nos fluxos críticos: entrar, ver
      medicamentos do dia, registrar tomada, abrir exame.
- [ ] Web: navegação **só por teclado** nos mesmos fluxos + NVDA/VoiceOver.
- [ ] Rodar com a fonte do sistema no máximo **e** Modo Sênior ligado — checar que nada
      é cortado (o clamp de 2× existe justamente para isso).
- [ ] Lighthouse/axe na web como piso, nunca como prova — a maioria dos problemas
      acima não é detectada por ferramenta automática.

---

## 4. Regras rápidas para código novo

1. Alvo tocável: `minHeight` = `useTapTarget()` (mobile) ou `a11y.tapTarget.min` (web).
2. Texto: `useType()` (mobile) / classes em `rem` (web). Zero `px` fixo em texto.
3. Todo `Pressable`/`button` tem `accessibilityRole` + nome acessível.
4. Toda animação passa por `useReduceMotion()` / `motion-safe:`.
5. Erro: resumo no topo, valida no blur, não limpa o campo.
6. Escreva como se fala: "Modo simples", não "escala tipográfica".
</content>
