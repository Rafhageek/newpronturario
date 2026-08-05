# Painel — direção de design (2026-08)

Este documento é a **fundação** do redesenho. As ~49 rotas da web e ~47 telas do
mobile vão ser reescritas em cima do que está aqui. Se você é o agente que vai
aplicar: leia inteiro antes de tocar na primeira tela.

Regra de ouro deste redesenho: **as telas não inventam vocabulário**. Se você
precisou escrever um hex, um `fontSize` ou um raio dentro de uma tela, o token
ou a primitiva estão faltando — abra-os aqui, não lá.

---

## 1. O que é o Painel

A casca clara e fria do mockup: lateral recolhível com grupos colapsáveis, topo
com busca (`Ctrl + K`), cabeçalho de página com data + saudação, fileira de
cartões de métrica com chip de ícone pastel, corpo em duas colunas, estados
vazios ilustrados e barra de ações rápidas no rodapé.

**O que ele NÃO é: um sistema novo.** É uma camada de superfície por cima do que
já existia e funciona. Continua valendo, sem uma linha alterada:

| O que foi preservado | Onde |
| --- | --- |
| Acessibilidade (alvo 44/56, clamp de fonte, Modo Sênior) | `a11y` em `ui-tokens` |
| Sistema de movimento (teto 400 ms, sem loop infinito) | `motion` em `ui-tokens` |
| Status `ink`/`mark`/`tint` (cor do SISTEMA) | `status` em `ui-tokens` |
| Paleta neutra-clínica de gráfico | `chart` em `ui-tokens` |
| Atkinson Hyperlegible (texto) + Mono (número clínico) | `--font-sans` / `.hp-num` / `type` |
| Alto contraste, escala A/A+/A++ | `html[data-contrast]`, `html[data-font-scale]` |

O que mudou de verdade: o canvas deixou de ser creme quente (`#faf9f6`) e virou
azul-neutro frio (`#f5f7fb`) — e ganhou chips pastel, uma escala de humor por
forma, e duas correções de WCAG que estavam em produção (§6).

---

## 2. As cinco regras invioláveis

Se você quebrar uma delas, um teste te acorda. Todos eles existem porque a
violação **já aconteceu** neste repositório.

### 2.1 Cor nunca no corpo do paciente

Verde, âmbar e vermelho pertencem ao **sistema** — dose atrasada, falha de
upload, aviso de segurança, agenda. **Nunca** ao corpo da pessoa: pressão, dor,
peso, IMC, humor, energia, calorias, tendência.

Semáforo em dado clínico é diagnóstico disfarçado, e o HubPatients não
diagnostica — exibe e organiza; quem interpreta é o médico. Além disso é hostil
a quem tem daltonismo, lê no sol ou imprime o prontuário (WCAG SC 1.4.1).

**O certo, quando o dado é do corpo:** rampa de **um matiz** + **forma** +
**palavra**.

- dor → `painIntensityColor` (`@hubpatients/core`)
- humor → `MOOD_RAMP` / `MOOD_SCALE` (`@hubpatients/core`) — §5
- faixa de referência → `<ClinicalRangeChip>` (web) / `<ClinicalValue>` (mobile)
- tendência → seta neutra + `aria-label` em palavras

**Trava:** `packages/core/src/utils/regra-cor-clinica.test.ts`. Ele varre as
telas e as **primitivas do Painel** como texto. Se o seu caso for mesmo do
sistema, abra a região com `@cor-do-sistema`, feche com `@fim-cor-do-sistema` e
ajuste `EXCECOES_ESPERADAS` **no mesmo commit** — uma exceção nova sempre passa
por revisão humana.

O chip de ícone pastel **não oferece** tom de gravidade. Não existe
`tone="alert"`. Isso é de propósito: nenhum cartão pode nascer "grave" por
acidente de escolha de cor.

### 2.2 Alvo de toque

44 px de piso de projeto, **56 px no Modo Sênior**. O mínimo normativo (WCAG 2.2
SC 2.5.8) é 24 — ficamos muito acima porque o público é majoritariamente idoso e
crônico.

- Web: `min-h-11` (2,75 rem). Em rem, e não em px, porque
  `html[data-senior] { font-size: 130% }` faz o alvo virar ~57 px sozinho.
  Há ainda uma rede de segurança em `globals.css` que aplica o piso a
  `button`, `a[href]`, `[role=button]`, `[role=tab]`…
- Mobile: `useTapTarget()`.

Sempre `minHeight`, **nunca** `height`: com a fonte ampliada o componente precisa
crescer, não cortar o rótulo.

### 2.3 Modo Sênior

`useType()` / `useFontScaler()` (mobile) e os degraus semânticos `text-caption`
… `text-display` (web). **Nunca** `text-[13px]`, `fontSize: 13` literal ou
`text-xs`.

Isso não é preferência de estilo: o Modo Sênior já morreu uma vez neste
repositório exatamente assim — a opção existia, quase nenhuma tela a consumia, e
ligar não mudava quase nada. As primitivas do Painel são a base de 96 telas; um
tamanho literal aqui mata o modo em 96 lugares de uma vez.

**Trava:** `apps/mobile/__tests__/painel-primitivas.test.tsx` e
`apps/mobile/__tests__/modo-senior.test.tsx`.

### 2.4 Mobile: nunca `Intl`

O Hermes **derruba o app** com `Intl` (dois incidentes reais:
`RelativeTimeFormat` e `DateTimeFormat` com `dateStyle`/`timeStyle`). "App
fecha" em vez de mostrar tela de erro = crash nativo.

Nenhuma primitiva formata data ou número por conta própria. O `eyebrow` do
`<PageHeader>` ("Quarta-feira, 5 de Agosto") chega **pronto**, formatado pelos
utilitários de data em PT-BR do `@hubpatients/core`. Use o mesmo caminho na web —
paridade também é ter um formatador só.

### 2.5 Movimento

Teto de 400 ms para o que responde a toque. Um elemento por vez. **Nada em loop
indefinido** ao lado de conteúdo (SC 2.2.2). "Reduzir movimento" ≠ "sem
animação": é **sem deslocamento** — opacidade e cor continuam.

A mancha de gradiente do cabeçalho é **estática** de propósito: movimento
periférico ao lado de texto é gatilho vestibular (35,4% dos adultos 40+ têm
disfunção vestibular) e fundo animado atrás de dado clínico atrapalha a leitura.

Tokens: `motion` em `@hubpatients/ui-tokens`.

---

## 3. Tokens — uma fonte, duas plataformas

**A fonte é `packages/ui-tokens/src/painel.ts`.** Web e mobile derivam dali.
Nenhum hex novo deve nascer em `globals.css`, em `tailwind.config.js` ou em
`theme.ts`.

| Token | Fonte (TS) | Web | Mobile |
| --- | --- | --- | --- |
| Superfícies e tinta | `painelSurfaceLight/Dark`, `painelInkLight/Dark` | `.hp-painel` redefine `--bg`, `--surface`, `--fg`… | `painel` em `@/theme`, ou as classes `bg-surface`/`text-fg` |
| Chips pastel | `chipPastel`, `CHIP_TONES` | `bg-chip-azul-tint` / `text-chip-azul-ink` | `useChipPastel()` ou as mesmas classes |
| Espaçamento | `spacePx` | `spacing` (rem, derivado) | `space` em `@/theme` |
| Raios | `radiusPx` | `rounded-card` (16), `rounded-chip` (12), `rounded-full` | `radius` em `@/theme` |
| Elevação | `shadowPainel` + `shadowToCss`/`shadowToRn` | `shadow-card`, `shadow-raised` | `usePainelShadow()` |
| Casca (larguras) | `layout` | — | — |
| Contraste | `contrastRatio`, `isCategoryHue` | usado em teste | usado em teste |

### 3.1 Superfícies

Quatro degraus, e cada um tem um trabalho:

| Token | Claro | Escuro | Para quê |
| --- | --- | --- | --- |
| `bg` | `#f5f7fb` | `#0d0d0d` | canvas da área de trabalho |
| `surface` | `#ffffff` | `#171717` | cartão, lateral, topo |
| `surface-2` | `#f7f8fc` | `#212121` | campo de busca, linha zebrada |
| `surface-3` | `#edf1f7` | `#2b2b2b` | chip neutro, cabeçalho de tabela |
| `line` | `#e2e7f0` | branco 10% | separador **decorativo** |
| `line-strong` | `#7a8597` | `#727578` | borda de **campo/controle** (≥3:1) |

`line` não serve de borda de campo — ela tem contraste de separador, não de
controle. Campo, checkbox e botão de contorno usam `line-strong`.

No tema escuro a hierarquia é por **degrau tonal + hairline**, não por sombra:
sombra não se lê sobre preto. `usePainelShadow()` já resolve isso; não escreva
`cardShadow` à mão numa superfície escura.

### 3.2 Chips pastel — cor de CATEGORIA

Seis tons: `azul`, `indigo`, `violeta`, `ameixa`, `turquesa`, `ardosia`.

A paleta inteira vive entre **165° e 320° de matiz**. Isso exclui, por
construção, verde (~90-160°), amarelo (~55-65°), âmbar/laranja (~25-50°),
vermelho (~0-15°) e rosa (~340-355°). Ou seja: **não há como escolher um
semáforo** — a lista não tem um.

A cor diz **de que assunto é o cartão** (medicamento, consulta, exame), nunca a
gravidade do que está dentro dele.

Se você não quiser escolher, não escolha: passe `seed` (a rota, o nome da seção)
e `chipToneFor()` deriva um tom estável — a mesma seção fica com a mesma cor na
web e no mobile, sem tabela duplicada.

```tsx
<IconChip icon={Pill} seed="medicamentos" />   // determinístico nas 2 plataformas
<IconChip icon={Pill} tone="turquesa" />       // quando a seção já tem cor definida
```

### 3.3 Tipografia

Nada mudou. `--font-sans` = Atkinson Hyperlegible Next (1/I/l e 0/O distintos),
`--font-display` = Bricolage (só título ≥20px), e **todo número clínico** em
Atkinson Mono: `.hp-num` na web, `type.data*` no mobile.

Dose de medicamento lida errado é risco real. Se o valor é uma medida do corpo,
passe `clinical` no `<StatCard>`.

---

## 4. Primitivas — o que usar, e quando

Web: `import { … } from '@/components/ui/painel'`
Mobile: `import { … } from '@/components/painel'`

**Os nomes e a API conceitual são os mesmos nas duas plataformas.** Mudou a
assinatura de um lado? Muda do outro, no mesmo commit.

| Primitiva | Use quando | Não use quando |
| --- | --- | --- |
| `PanelCard` | qualquer superfície de conteúdo | você precisa de um cartão "diferente" — provavelmente não precisa |
| `IconChip` | identificar a categoria de um cartão/seção | quer indicar gravidade → é `<StatusChip>` |
| `StatCard` + `StatRow` | fileira de métricas do topo da página | o valor precisa de gráfico → cartão próprio dentro de `PanelCard` |
| `PageHeader` | topo de **toda** rota: data, saudação, subtítulo, selo | — |
| `SectionHeader` | título de cartão com "Ver todos" | — |
| `EmptyState` | não há nada ainda (e está tudo bem) | **algo falhou** → `ErrorState` |
| `PanelButton` | qualquer ação | — |
| `Seal` | informação fixa ("Dados protegidos • LGPD") | algo pode dar errado → `<StatusChip>` |
| `QuickActions` | barra de atalhos no rodapé do conteúdo | — |
| `MoodScale` / `MoodFace` / `MoodMark` | registrar ou exibir humor | — |

Notas de comportamento que as primitivas garantem sozinhas:

- `StatCard` só mostra o chevron quando existe `href`. Seta que não leva a lugar
  nenhum é promessa quebrada.
- `EmptyState` ≠ `ErrorState`. Vazio é "ainda não há nada aqui, e é assim que
  começa" — linguagem acolhedora, botão dizendo o que vai acontecer. Falha de
  carregamento oferece **tentar de novo**.
- `IconChip` é decorativo e sai da árvore de acessibilidade (`aria-hidden` /
  `accessibilityElementsHidden`): o significado está no rótulo ao lado.
- `StatCard` no mobile é lido de uma vez: "Peso, 78,4 kg, ontem".

---

## 5. A escala de humor — o que mudou e por quê

O mockup trazia "Como você está se sentindo hoje?" com cinco carinhas indo de
**vermelha triste** a **verde sorridente**. **Não foi reproduzido.**

É semáforo em dado autorrelatado: quem teve um dia ruim toca no botão e recebe um
carimbo vermelho do próprio aplicativo de saúde. E 8% dos homens (protanopia /
deuteranopia) não distinguem aquele vermelho daquele verde — para eles a escala
inteira eram cinco círculos iguais.

**O que foi preservado:** cinco opções, ordenadas, tocáveis de uma vez, com
carinha. A escala não encolheu nem virou slider.

**O que mudou:** a ordem saiu da cor e foi para quatro canais que ninguém perde.

| Degrau | Rótulo | Curva da boca | Inclinação do olho |
| --- | --- | --- | --- |
| 1 | Muito mal | −3,4 (bem para baixo) | +22° (aflito) |
| 2 | Mal | −1,7 | +11° |
| 3 | Neutro | 0 (reta) | 0° |
| 4 | Bem | +1,7 | −7° |
| 5 | Muito bem | +3,4 (bem para cima) | −14° + arco (riso) |

Mais a **posição** (1ª a 5ª, sempre igual) e o **rótulo em texto**, sempre
visível — nunca só em `aria-label`.

A cor entra apenas como **estado** (escolhida × não escolhida), num matiz só: **a
1ª e a 5ª opção têm exatamente a mesma cor**. A opção escolhida também engrossa o
traço — mais um canal de forma, que sobrevive ao preto e branco.

A geometria vem de `MOOD_SCALE` (`packages/core/src/data/mood-scale.ts`) como
`d` de `<path>` num viewBox 24×24: **uma conta só**, desenhada por `<svg>` na web
e por `react-native-svg` no mobile.

### 5.1 O anel, o gráfico e o mapa do ano

Humor e energia são dado autorrelatado — mesma regra. Use `MOOD_RAMP` (rampa
azul de um matiz, 217°–221°) ou os tokens `--chart-*`.

O `MOOD_PIXEL` do "ano em cores" **era** um semáforo completo (coral, âmbar,
cinza, azul e verde) e foi trocado pela mesma rampa. O contraste entre degraus
vizinhos é baixo de propósito (1,35 · 1,60 · 1,93 · 2,18): **cor aqui é
reforço**, e todo uso da rampa exige rótulo por perto — `MOOD_LEGEND` existe
para isso.

---

## 6. Contraste — medido, não estimado

Texto cinza-claro sobre branco é o erro clássico deste estilo visual, e ele já
tinha acontecido: o `--hint` da casca (`#67748a`) parecia perfeitamente legível e
entregava **4,17:1** sobre `--surface-3` — reprovava AA por pouco, em produção,
sem ninguém perceber. Duas correções entraram junto com o Painel:

| Token | Antes | Depois | Contra | Antes → Depois |
| --- | --- | --- | --- | --- |
| `--hint` | `#67748a` | `#616e83` | `surface-3` | 4,17 → **4,55** |
| `--line-strong` | `#8994a7` | `#7a8597` | `surface-3` | 2,70 → **3,29** |

Todos os números abaixo são calculados com a fórmula da WCAG 2.2, **truncados**
(não arredondados) em 2 casas, contra o **pior fundo** de cada tema.

**Tema claro** (pior fundo com texto: `surface-3` `#edf1f7`)

| Token | Valor | Sobre `surface-3` | Sobre `bg` |
| --- | --- | --- | --- |
| `fg` | `#151b2b` | 15,14:1 | 16,00:1 |
| `fg-soft` | `#354056` | 9,17:1 | 9,69:1 |
| `muted` | `#58657a` | 5,20:1 | 5,50:1 |
| `hint` | `#616e83` | **4,55:1** | 4,81:1 |
| `primary` | `#0442bf` | 7,30:1 | 7,71:1 |
| `line-strong` | `#7a8597` | **3,29:1** | 3,47:1 |
| `on-primary` sobre `primary` | `#ffffff` | — | 8,27:1 |

**Tema escuro** (pior fundo: `surface-3` `#2b2b2b`)

| Token | Valor | Sobre `surface-3` |
| --- | --- | --- |
| `fg` | `#e8eaf0` | 11,77:1 |
| `fg-soft` | `#cfd4dd` | 9,51:1 |
| `muted` | `#a7acb2` | 6,19:1 |
| `hint` | `#909398` | 4,59:1 |
| `primary` | `#8ba9ff` | 6,21:1 |
| `line-strong` | `#727578` | 3,05:1 |

⚠️ No escuro, `on-primary` **inverte** para tinta escura (`#0d1220`, 8,19:1
sobre o azul claro). Branco ali daria **2,27:1**. A regra `.bg-primary` em
`globals.css` já faz essa troca sozinha — não escreva `text-white` esperando que
funcione nos dois temas.

**Chips pastel** — `ink` sobre o próprio `tint`:

| Tom | Claro | Escuro |
| --- | --- | --- |
| azul | 6,98:1 | 7,42:1 |
| indigo | 7,40:1 | 7,65:1 |
| violeta | 7,03:1 | 7,83:1 |
| ameixa | 6,78:1 | 8,47:1 |
| turquesa | 5,18:1 | 9,04:1 |
| ardosia | 7,61:1 | 7,76:1 |

Todos passam de AA para **texto**, muito acima dos 3:1 que um ícone exigiria — a
folga existe porque o chip às vezes hospeda um rótulo curto.

**Rampa de humor** — tinta declarada sobre cada degrau: 12,57 · 9,30 · 5,78 ·
5,80 · 12,69.

**Onde isso é verificado:** `packages/core/src/utils/contraste-painel.test.ts`
(44 asserções). A calculadora é `contrast.ts` em `@hubpatients/ui-tokens` — sem
dependências, roda igual em Node, na web e no Hermes.

---

## 7. Casca (para quem for montar a lateral e o topo)

Medidas em `layout` (`ui-tokens/painel.ts`):

| Medida | Valor |
| --- | --- |
| Lateral aberta | 264 px |
| Lateral recolhida (botão «) | 76 px |
| Barra do topo | 64 px |
| Largura máxima do conteúdo | 1280 px |
| Corpo em duas colunas | `2fr 1fr` |

Os grupos do menu já existem e já batem com o mockup:
`NAV_SECTIONS` em `apps/web/src/components/app/nav.ts` — Meu prontuário,
Bem-estar, Jornadas de cuidado, Comunidade e serviços, Conta e privacidade.
**Não crie uma segunda lista.**

Item ativo: `bg-nav-active-tint text-nav-active-ink` (6,98:1). O estado ativo
precisa de mais que a pílula colorida — `aria-current="page"` é obrigatório.

Lateral recolhida: o rótulo some da tela, então cada item vira ícone + `title` +
`aria-label`. Ícone sozinho sem nome acessível é um botão mudo.

---

## 8. Checklist antes de abrir PR de tela

- [ ] Nenhum hex novo no arquivo da tela.
- [ ] Nenhum `text-[Npx]`, `fontSize: N` literal ou `text-xs`.
- [ ] Todo alvo tocável em `min-h-11` (web) ou `useTapTarget()` (mobile), com
      `minHeight` — nunca `height`.
- [ ] Nenhuma cor de semáforo em dado do corpo. Se for do sistema, região
      `@cor-do-sistema` aberta, fechada e `EXCECOES_ESPERADAS` ajustado.
- [ ] Data e número formatados por `@hubpatients/core`, **sem `Intl`**.
- [ ] A tela existe nas duas plataformas (web + mobile em paridade).
- [ ] `corepack pnpm -r --workspace-concurrency=1 run typecheck`
- [ ] `corepack pnpm --filter @hubpatients/core run test`
- [ ] `corepack pnpm --filter @hubpatients/mobile run test`
- [ ] lint de web e mobile

## 9. Anti-padrões (todos já aconteceram aqui)

| Não faça | Faça |
| --- | --- |
| `iconTone="rose"` num cartão de pressão | `tone` de categoria, ou `seed` |
| `ZONE_TONE = { alta: 'amber', … }` | mapeie a zona para **texto e seta** |
| `bg-primary text-white` no escuro | `bg-primary` sozinho (a tinta inverte) |
| `text-faint` em texto que importa | `text-muted` ou `text-hint` |
| `border-line` num campo de formulário | `border-line-strong` (≥3:1) |
| `height: 44` num botão | `minHeight` — o botão precisa crescer |
| `new Intl.DateTimeFormat(...)` no mobile | utilitários de data do `core` |
| `animation: … infinite` ao lado de conteúdo | limite de repetições (`LOOP_LIMIT`) |
| carinha vermelha no humor | `<MoodScale>` |

---

## 10. Onde está cada coisa

```
packages/ui-tokens/src/painel.ts     ← superfícies, chips, elevação, métricas
packages/ui-tokens/src/contrast.ts   ← cálculo WCAG + faixa de matiz de categoria
packages/ui-tokens/src/index.ts      ← status, chart, a11y, tipografia (base)
packages/ui-tokens/src/motion.ts     ← durações, curvas, springs

packages/core/src/data/mood-scale.ts ← escala de humor (forma + rótulo + rampa)
packages/core/src/data/body-regions.ts ← rampa de dor (referência da regra)

apps/web/src/app/globals.css                  ← vars do Painel (:root/.dark/.hp-painel)
apps/web/src/components/ui/painel/            ← primitivas (web)
apps/mobile/global.css + tailwind.config.js   ← vars do Painel (mobile)
apps/mobile/src/theme.ts                      ← paleta, escala, Modo Sênior
apps/mobile/src/components/painel/            ← primitivas (mobile)

packages/core/src/utils/contraste-painel.test.ts   ← contraste medido
packages/core/src/utils/regra-cor-clinica.test.ts  ← regra de cor clínica
apps/mobile/__tests__/painel-primitivas.test.tsx   ← Modo Sênior + alvo + humor
```

Histórico anterior (não substituído, complementado):
[REDESIGN-2026-07.md](REDESIGN-2026-07.md) · [ACESSIBILIDADE.md](ACESSIBILIDADE.md) ·
[MOTION-UX.md](MOTION-UX.md)
