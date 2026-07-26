# HubPacientes — Pesquisa de redesign (visual, tipografia, cor e motion)

**Data:** 2026-07-25 · **Método:** 3 pesquisadores paralelos (referências visuais · sistema tipo/cor · motion). Convenção: `FATO` = verificado com URL · `ANÁLISE`/`RECOMENDAÇÃO` = nossa leitura.

---

## 0. O que está errado HOJE (medido, não achismo)

O pesquisador de cor escreveu um conversor OKLCH↔sRGB e calculou o contraste real dos nossos tokens. Resultado:

| Token atual | Hex | Contraste | Veredito |
|---|---|---|---|
| `--faint` | `#847e74` | **3,82:1** | ❌ Reprova WCAG AA (o comentário no `globals.css` diz "~4.6:1" — está **errado**) |
| `semaphore.ok` | `#10b981` | **2,41:1** | ❌ Reprova até o piso não-textual de 3:1 |
| `semaphore.attention` | `#f59e0b` | **2,04:1** | ❌ Pior da paleta |
| `semaphore.alert` | `#ef4444` | **3,57:1** | ❌ Reprova para texto |
| branco sobre `coral-500` | `#f24b59` | **3,54:1** | ❌ Botão coral com texto branco reprova |
| `--line` como borda de campo | `#e6e3dc` | 1,28:1 | ❌ SC 1.4.11 pede 3:1 |
| `primary` no tema escuro | `#0442bf` | **2,3:1** | ❌ Azul royal não funciona sobre fundo escuro |

`FATO` WCAG 2.2: 4,5:1 para texto normal, 3:1 para elementos não-textuais e bordas de campo.
https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html

**ANÁLISE:** isso não é preciosismo. Nosso público é idoso com presbiopia/catarata — são justamente os tokens de texto secundário e de status que estão reprovando.

---

## 1. Referências — o que faz um app de saúde parecer caro

### Oura (redesign 2025, agência Instrument)
`FATO` https://ouraring.com/blog/new-oura-app-experience/ · https://www.instrument.com/work/oura-app
Quatro decisões declaradas: **três níveis adaptativos de visualização** (abstrato → focado → exploratório), sistema de cor **semântico** (cor é sinal, não decoração), tipografia refinada, e **de 5 abas para 3**.
**Copiável:** um nível de gráfico por profundidade de tela; faixa de referência como sombra do próprio hue a ~16%; **numerais tabulares em todo valor**; delta sempre ao lado do número.
**Não copiar:** é dark-only — inviável para idoso lendo sob sol.

### Whoop
`FATO` https://www.925studios.co/blog/whoop-design-breakdown
Vocabulário de **3 cores só**, número-herói gigante ("legível à distância do braço"), progressive disclosure em **telas separadas**.
**Copiável:** um número herói por tela, ~5× o tamanho do rótulo; hairline de 1px no lugar de sombra; respiro vertical generoso entre seções.
**Não copiar:** o semáforo verde/amarelo/vermelho — em prontuário, vermelho tem significado clínico e queimá-lo em métrica trivial é irresponsável.

### Headspace (rebrand, Italic Studio)
`FATO` https://italic-studio.com/projects/headspace-rebrand/
Paleta que **foge deliberadamente dos azuis e cinzas típicos de saúde**.
**Copiável:** canvas creme quente em vez de branco puro; texto em tinta quente (`#2E1A47`) em vez de preto duro; **sombras tingidas com a cor do texto, nunca pretas**; title case, CAPS proibido.
**Não copiar:** mascote/ilustração fofa — infantiliza público idoso.

### Flo — o melhor exemplo light-first
**Copiável:** **alerta em âmbar suave, vermelho só para o crítico**; card de previsão em 3 linhas de peso decrescente com declaração de incerteza; estado do calendário por **forma, não só cor**.

### One Medical (Moniker)
`FATO` https://monikersf.com/project/onemedical/
Serifada de display + sans no corpo; paleta reduzida; foto de pessoas reais.
**ANÁLISE:** uma serifada só em títulos é a alavanca mais barata para sair do visual genérico. Alternativas gratuitas ao GT Super: Fraunces, Instrument Serif, Newsreader.

### Gentler Streak — Apple Design Award 2024 (Social Impact)
`FATO` https://developer.apple.com/news/?id=3m0ht22s
A equipe **evitou deliberadamente**: linguagem de performance, métricas comparativas, culpabilização e **números sem contexto**.
**Copiável:** todo número vem com uma frase que o interpreta; comparar o usuário com ele mesmo, nunca com média populacional.

> ⚠️ **Erro corrigido pelo pesquisador:** várias páginas afirmam que o Bevel venceu o ADA 2024 — **é falso**. Quem venceu Social Impact foi o Gentler Streak.

---

## 2. Tendências 2026 — o que aplicar e o que evitar

| Tendência | Veredito | Base |
|---|---|---|
| **Material 3 Expressive** | ✅ **Aplicar o método** | `FATO` 46 estudos, 18.000+ participantes: elementos-chave localizados **até 4× mais rápido**, e **adultos 45+ igualaram a velocidade dos jovens**. https://design.google/library/expressive-material-design-google-research |
| **Liquid Glass (iOS 26)** | ⚠️ Só pontual | `FATO` contraste medido em **1,5:1**; NN/g reprovou; a American Foundation for the Blind enviou carta à Apple e ela recuou no 26.1. https://www.nngroup.com/articles/liquid-glass/ |
| **Bento grid** | ⚠️ Com hierarquia | 1 bloco grande + até 4 pequenos. Bento com 6 blocos iguais = zero hierarquia = pior caso para idoso |
| **Neo-brutalismo** | ❌ Evitar | `FATO` "a ousadia que lê como confiança em SaaS lê como insensibilidade em saúde" |
| **Tipografia gigante** | ✅ Só no número-herói | Um herói por tela; em tudo vira ruído |

---

## 3. Anti-referências — o visual "AI slop"

`FATO` https://www.925studios.co/blog/ai-slop-design-tells
1. **Gradiente azul→roxo** (o `indigo-500` default do Tailwind) — "o tell de IA mais alto de 2026"
2. **Inter em tudo** — "virou default e agora lê como genérico"; sinaliza decisão *não tomada*
3. Três cards arredondados em linha com ícone de linha fina
4. Ícones intercambiáveis que serviriam para qualquer produto

**Específicos de saúde (ANÁLISE):** semáforo em tudo · gauge/velocímetro para exame · KPI sem tendência · **numerais proporcionais** (a "dança" dos dígitos) · **peso 300 no corpo** · ilustração "Corporate Memphis" · emoji como ícone clínico.

---

## 4. Tipografia proposta

`FATO` **Atkinson Hyperlegible Next** foi desenhada pelo Braille Institute para baixa visão. Princípios declarados incluem distinguir explicitamente **1/I/i/l** e **0/O**.
https://www.brailleinstitute.org/freefont/ · https://www.brailleinstitute.org/about-us/news/braille-institute-launches-enhanced-atkinson-hyperlegible-font-to-make-reading-easier/

`FATO` Pacotes verificados como existentes: `@expo-google-fonts/atkinson-hyperlegible-next` e `.../atkinson-hyperlegible-mono` (7 pesos cada). E o `font-data.json` do **Next 15.5.19 já instalado aqui** contém as duas famílias — a web funciona sem atualizar nada.

**Por que isso é segurança, não estética:** dose de medicamento com `1` parecido com `l` é risco real. Bricolage (nossa display) tem `1` sem base e `I` sem serifa — **quase idênticos**. Por isso: **todo número clínico em Atkinson Mono**, onde a largura fixa é propriedade do desenho.

**Par recomendado:** Bricolage Grotesque (display, nunca <20px) + Atkinson Hyperlegible Next (texto) + Atkinson Hyperlegible Mono (dados clínicos).

**Mudanças na escala:** `body` 15 → **17px** (default do iOS HIG) com entrelinha 1,53 (SC 1.4.8 pede ≥1,5) · `tiny` 11px → alias de `caption` 13px (11px é inutilizável para o público) · `label` 13 → 15px.

---

## 5. Cor proposta (OKLCH, contrastes calculados)

**Princípio central:** **vermelho e âmbar pertencem ao sistema, não ao corpo do paciente.**

| Situação | Tratamento |
|---|---|
| Remédio atrasado, upload falhou, excluir conta | `ink-alert` + ícone + rótulo — é estado do app |
| **Valor de exame fora da faixa** | **`ink-neutro` + seta ↑/↓ + "acima do intervalo informado pelo laboratório"** |
| Valor dentro da faixa | texto normal — verde sugeriria "você está bem", e não sabemos disso |

**Correções (texto sobre o pior fundo):** `hint #6c675e` (4,55:1) substitui o `--faint` quebrado · `accent #c4293c` (4,56:1) substitui `#d12f3e` · no escuro, `primary #8ba9ff` (6,21:1) substitui o royal ilegível.

**Status com 3 papéis** — `ink` (texto), `mark` (traço 3:1), `tint` (fundo de chip). Ex. atenção claro: ink `#895b00` · mark `#b17700` · tint `#fff2e2` (ink sobre tint = 5,35:1 ✅).

**Paleta neutra-clínica para gráficos** (sem verde/vermelho): `#1043a8` · `#0d9298` · `#4c0f6d` · `#bd8047`.

> **Limite matemático, dito com honestidade:** nenhuma paleta de 4 séries consegue 3:1 entre si **e** 3:1 contra o fundo em sRGB. Por isso: máx. 4 séries, rótulo direto na ponta da linha, traço distinto por série, faixa de referência como banda cinza.

**Elevação no escuro:** sombra não funciona — usar **degrau tonal** (`#0d0d0d` → `#171717` → `#212121` → `#2b2b2b`, passos uniformes em L do OKLCH) + hairline branca a 10% no topo.

---

## 6. Motion — princípios e bugs encontrados

`FATO` WCAG 2.3.3 nomeia **parallax** como gatilho vestibular; 35,4% dos adultos 40+ têm disfunção vestibular (NHANES). https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions · https://pubmed.ncbi.nlm.nih.gov/19468085/

**Princípios:** movimento confirma ação, nunca decora · **nada se move durante leitura de dado clínico** · teto de 400ms · sem overshoot (ζ ≥ 0,85) · um elemento por vez · nada em loop ao lado de conteúdo · reduced motion = sem deslocamento (opacidade e cor continuam).

### 🐞 Bugs reais achados no nosso código
1. `welcome-overlay.tsx` — `withRepeat(-1)` e **não consulta `useReducedMotion`**. É o único componente que ignora a preferência do sistema.
2. `feedback.tsx:170` — o ramo de *reduced motion* troca o shimmer por outro loop infinito (continua animando).
3. Loops infinitos ao lado de conteúdo (skeleton, coração do login, `.vl-route-bar`) — violam SC 2.2.2.
4. `celebrate()` dispara a **cada** salvamento do diário — confete diário esvazia a celebração.
5. `FadeInItem` usa `index * 55` **sem teto** — o 20º item entra 1,1s depois do primeiro.
6. Web: Recharts 2.15 **não** respeita `prefers-reduced-motion` (o `'auto'` é da linha 3.x) e o default é 1500ms.
7. Tab bar com ζ≈0,63–0,79 → overshoot visível; alvo que ainda oscila é alvo que mão trêmula erra.

**Tokens propostos:** durações 90/160/240/320/480/700 · easing assinatura `[0.22,1,0.36,1]` · 3 springs (`responsive` ζ=1,0 · `calm` ζ=1,0 · `affirm` ζ=0,72, só para confirmação).

**Shared element:** ❌ não é viável — só existe no Reanimated ≥4.2.0, atrás de flag e experimental. Estamos no 4.1.7. A alternativa é **continuidade por posicionamento** (mesmo header no card e na tela de destino).

---

## 7. As três direções

### A — "Papel Clínico Quente"
Canvas creme (`#FAF7F2`), texto em tinta azul-escura, royal só como ação, serifada de display nos títulos, 2 estados semânticos, sombras tingidas, foto de gente real.
**Âncora:** One Medical + Headspace + AllTrails. **Idoso:** ✅ mais segura (creme evita o brilho do branco puro, importante em catarata).

### B — "Painel Sereno"
Arquitetura do Oura/Whoop invertida para light-first: três níveis de visualização, número-herói 48–56px com unidade menor ao lado, tabular em tudo, hierarquia por valor de superfície, botão de raio pequeno.
**Idoso:** ✅ com corte de densidade pela metade. **Risco:** frieza — precisa da frase interpretativa.

### C — "Expressivo Acessível"
As 5 alavancas do M3 Expressive (cor, forma, tamanho, movimento, contenção) como hierarquia: ação primária 1,6× o secundário em container de cor cheia; cada domínio com forma própria.
**Idoso:** ✅ **única com evidência quantitativa** (45+ empatando com jovens). **Risco:** copiar a estética do Google em vez do método.

**Recomendação dos pesquisadores:** **A + C**, com a arquitetura de dados de **B**.

---

## 8. O que é OTA e o que exige APK

| Mudança | Entrega |
|---|---|
| Cores, status, paleta de gráfico, espaçamento, raio, elevação | ✅ **OTA** |
| Tokens e correções de motion (incl. os 7 bugs) | ✅ **OTA** |
| Escala tipográfica (tamanhos/entrelinha) | ✅ **OTA** |
| **Fontes no web** (Atkinson via `next/font`) | ✅ **deploy web** |
| **Fontes no mobile** (Atkinson via `@expo-google-fonts`) | ❌ **APK 0.4.0** — fonte é asset nativo |

**Primeiro passo, mecânico e barato:** corrigir `--faint` e os três `semaphore` (violações de acessibilidade **em produção agora**), banir peso 300, corrigir o coral para uso não-textual e criar o tint claro do azul para o tema escuro.
