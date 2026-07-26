# HubPacientes — Pesquisa de produto, tecnologia e conformidade

**Data:** 2026-07-25 · **Método:** 5 pesquisadores paralelos (produto/concorrentes BR, UX/a11y/motion, engajamento/integrações, IA responsável/segurança, open source/stack). ~200 fontes consultadas.

**Convenção usada em todo o documento:**
- `FATO` — verificado em fonte, com URL.
- `ANÁLISE` — leitura/inferência nossa a partir dos fatos.
- `RECOMENDAÇÃO` — o que propomos fazer.
- ⚖️ precisa de advogado/DPO · 🩺 precisa de médico responsável técnico.

---

## 0. Os três achados que mudam a prioridade do roadmap

### 0.1 ⚠️ Resolução CFM 2.454/2026 — IA na medicina (entra em vigor ~26/08/2026)

`FATO` Publicada no DOU em 27/02/2026, com vigência 180 dias após a publicação.
Fonte oficial: https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2026/2454_2026.pdf · https://portal.cfm.org.br/noticias/cfm-normatiza-uso-da-ia-na-medicina/

`FATO` O que foi confirmado do conteúdo: veda delegar à IA a **comunicação de diagnósticos, prognósticos ou decisões terapêuticas**; exige **supervisão humana**; exige **informar o paciente de forma clara sempre que a IA for usada** como apoio relevante, com direito de recusa; institui **classificação de risco algorítmico em 4 níveis** (baixo, médio, alto, inaceitável).

`ANÁLISE` O HubPacientes já está do lado certo da linha (nunca diagnostica/prescreve). O que **falta** e vira requisito quase literal:
1. **Disclosure de IA por interação** (badge visível em cada bloco gerado por IA), não um disclaimer genérico no rodapé.
2. **Rastreabilidade**: registrar modelo, versão do prompt e fontes de cada geração.

⚖️ A resolução é norma ética dirigida a médicos e instituições médicas — se alcança a empresa desenvolvedora é questão jurídica em aberto. Precisa de leitura do PDF integral por advogado.

### 0.2 ⚠️ `runtimeVersion` fixo é uma bomba-relógio (falha nossa)

`FATO` A política `runtimeVersion: { policy: "fingerprint" }` calcula a runtime automaticamente a partir do código nativo, garantindo que updates OTA só cheguem a binários compatíveis.
https://docs.expo.dev/eas-update/runtime-versions/

`ANÁLISE` Hoje o `app.config.ts` tem `runtimeVersion: '0.2.0'` **fixo, mantido à mão** (decisão tomada no build 0.2.0 para isolar OTAs do APK antigo). O risco: no dia em que alguém adicionar uma biblioteca nativa e **esquecer de bumpar**, o OTA vai para aparelhos incompatíveis e o app **quebra no boot em produção** — para idosos, sem review de loja segurando e sem rollback rápido.

`RECOMENDAÇÃO` Migrar para `policy: "fingerprint"` no próximo build nativo + adotar **rollout gradual** (`eas update --rollout-percentage 10`) em todo update de produção.
https://docs.expo.dev/eas-update/deployment/

### 0.3 💰 Farmácia Popular 100% gratuita — o maior valor por real investido

`FATO` Desde 14/02/2025 os 41 itens do elenco são **gratuitos** (hipertensão, diabetes, asma, colesterol, osteoporose, glaucoma, Parkinson, fralda geriátrica). A autorização é gerada no Meu SUS Digital e **vale 180 dias**.
https://agenciagov.ebc.com.br/noticias/202503/saiba-como-retirar-medicamentos-e-insumos-pelo-farmacia-popular

`ANÁLISE` Nosso público é exatamente o alvo do programa e boa parte dele **paga por remédio que é gratuito**. Já temos `anvisa_link` nos medicamentos e a Edge Function `nearby-pharmacies`. É badge + tabela seed — complexidade baixa, impacto financeiro imediato e perceptível.

---

## 1. Tabela comparativa das propostas

Ordenada por relação impacto/esforço. "OTA?" é decisivo: hoje entregamos por OTA sobre o APK 0.2.0; item nativo exige APK novo.

| # | Ideia | Frente | Problema que resolve | Complex. | Impacto | OTA? | Prioridade |
|---|---|---|---|---|---|---|---|
| 1 | **Modo Consulta** (compartilhar com o médico por link/QR temporário) | Produto | Paciente não consegue mostrar 3 anos de dados em 12 min | Baixa-Média | ★★★★★ | ✅ | **P0** |
| 2 | **Relatório PDF de 1 página** para a consulta | Produto | Médico não navega em app; lê uma folha | Média | ★★★★★ | ✅ (via Edge Function) | **P0** |
| 3 | **Farmácia Popular** (badge "este remédio é grátis") | Produto | Paciente paga pelo que é gratuito | Baixa | ★★★★★ | ✅ | **P0** |
| 4 | **Disclosure de IA + ledger imutável** | IA/Conformidade | CFM 2.454/2026 em vigor em ~1 mês | Baixa-Média | ★★★★★ | ✅ | **P0** |
| 5 | **Testes de RLS (pgTAP) no CI** | Segurança | Furo de RLS = vazamento de prontuário alheio | Média | ★★★★★ | ✅ | **P0** |
| 6 | **Smoke test (Maestro) antes de cada OTA** | Qualidade | OTA ruim quebra o app de todos na hora | Média | ★★★★★ | ✅ | **P0** |
| 7 | **`runtimeVersion: fingerprint` + rollout 10%** | Entrega | Bomba-relógio de incompatibilidade | Baixa | ★★★★★ | ❌ (APK 0.3.0) | **P0** |
| 8 | **Confirmação de dose com botões na notificação** | Engajamento | Sem evento de adesão, nada mais reage | Média | ★★★★★ | ✅ | **P0** |
| 9 | **Guardrail de saída de IA** (classificador pré-exibição) | IA | Modelo escorrega para linguagem diagnóstica | Baixa-Média | ★★★★ | ✅ | **P0** |
| 10 | **Anti prompt-injection no PDF de exame** | Segurança | PDF de terceiro pode conter instrução oculta | Média | ★★★★ | ✅ | **P0** |
| 11 | **Logs sem PHI + scrubber Sentry** | Segurança | Vazamento mais comum em saúde é o log | Baixa | ★★★★ | ✅ | **P0** |
| 12 | **Relatório de adesão terapêutica** | Produto | Médico sobe dose achando que o remédio falhou | Baixa | ★★★★ | ✅ | P1 |
| 13 | **Guardião de Dose** (avisa cuidador se dose não confirmada) | Engajamento | Idoso sozinho esquece e ninguém sabe | Média-Alta | ★★★★★ | Backend (push→APK) | P1 |
| 14 | **Lembrete de reposição de estoque** | Engajamento | Não-adesão por caixa que acabou | Baixa | ★★★★ | ✅ | P1 |
| 15 | **ICS + lembretes escalonados de consulta** | Engajamento | No-show; vida está no calendário do celular | Baixa | ★★★★ | ✅ | P1 |
| 16 | **Modo Sênior** (tipografia, alvo 56px, home reduzida) | UX/a11y | Público não enxerga/não acerta o toque | Média | ★★★★ | ✅ | P1 |
| 17 | **Gráfico com faixa de referência + resumo textual** | UX/a11y | Gráfico hoje é inacessível a leitor de tela | Média | ★★★★ | ✅ | P1 |
| 18 | **Base ANVISA/CMED de medicamentos** (autocomplete) | Integração | Cadastro é texto livre = dado sujo | Média | ★★★★ | ✅ | P1 |
| 19 | **LOINC + CID-10 pt-BR embarcados** | Dados | Exame é string; sem código não há série temporal | Baixa | ★★★★ | ✅ | P1 |
| 20 | **Exportação FHIR R4** (portabilidade LGPD) | Integração | Export atual não é lido por nenhum sistema | Média | ★★★★ | ✅ | P1 |
| 21 | **Streak compassivo** (escudo, sem punição) | Engajamento | Streak clássico pune quem tem dia ruim | Baixa | ★★★★ | ✅ | P1 |
| 22 | **Login sem teste cognitivo** (WCAG 3.3.8) | UX/a11y | Senha complexa é o gargalo real do idoso | Média | ★★★★★ | ✅ | P1 |
| 23 | **Cartão de Emergência offline (ICE)** | Produto | SAMU não sabe alergia/anticoagulante | Baixa-Média | ★★★★ | ✅ | P1 |
| 24 | **Caderneta de vacinas do adulto/idoso** | Produto | Só temos vacina infantil | Média | ★★★ | ✅ | P2 |
| 25 | **Ditado por voz no diário** (speech-to-text) | UX/a11y | Idoso com tremor/artrose não digita | Média | ★★★★★ | ❌ (APK) | P2 |
| 26 | **Código de barras** (remédio e alimento) | Integração | Maior fricção de onboarding | Média | ★★★★ | ❌ (APK) | P2 |
| 27 | **Health Connect ampliado** (peso, PA, glicemia) | Integração | Só passos entram automático | Média | ★★★★ | ❌ (APK) | P2 |
| 28 | **Offline-first** (Legend-State ou PowerSync) | Arquitetura | Internet ruim = perda de dado clínico | Alta | ★★★★★ | ❌ (APK) | P2 |
| 29 | **RAG com fontes oficiais BR + recusa segura** | IA | LLM alucina em saúde (~1 em 5 respostas) | Alta | ★★★★★ | ✅ | P2 |
| 30 | **Evals clínicos no CI** | IA | Não sabemos se um prompt piorou a segurança | Média | ★★★★ | ✅ | P2 |
| 31 | **Cofre de receitas + validação ITI** | Produto | Receita se perde no WhatsApp | Média | ★★★ | ✅ | P2 |
| 32 | **PWA offline na web (Serwist)** | Web | Cuidador com internet ruim no notebook | Baixa-Média | ★★★ | ✅ | P3 |
| 33 | **Radar de prevenção** (rastreamento por idade/sexo) | Produto | Ninguém lembra que mamografia venceu | Média | ★★★ | ✅ | P3 🩺 |
| 34 | **Alerta de interação medicamentosa** | IA/Clínico | Polifarmácia sem nenhum sinal | Alta | ★★★ | ✅ | ⚠️ Avaliar |
| 35 | **Triagem de sintomas (tipo Ada)** | IA | — | Alta | — | — | ❌ **Não fazer** |
| 36 | **RNDS/Conecte SUS online** | Integração | Dado do SUS existe mas fica fora | Muito alta | ★★★★★ | Backend | 🔒 Bloqueada (CNES) |

---

## 2. Detalhamento das propostas P0

### 2.1 Modo Consulta — compartilhamento temporário com o médico

**Problema.** `ANÁLISE` O paciente acumula anos de dados e não consegue transmitir nada numa consulta de 12 minutos. Esse é o momento em que o app prova (ou não) que serve para alguma coisa.

**Benefícios.** Paciente: para de imprimir/decorar. Profissional: vê medicação e vitais reais em vez de relato de memória.

**Referências.** `FATO` Rede D'Or já oferece compartilhar exames e laudos com médicos de confiança (https://www.rededorsaoluiz.com.br/app); mySugr usa **sharing code** (https://support.mysugr.com/hc/en-us/articles/15092880595996-How-to-share-my-health-data-from-mySugr-with-my-doctor-using-a-sharing-code); Apple deixa o paciente escolher **categorias** a liberar (https://support.apple.com/guide/healthregister/health-app-data-share-with-provider-faq-apd531bc6215/web); concorrentes BR já fazem QR de prontuário (https://apps.apple.com/us/app/prontu%C3%A1rio-ai/id6742797355).

**Aplicação no HubPacientes.** `ANÁLISE` ~80% da infraestrutura já existe: a migração de **tokens de acesso pessoal** já tem escopos (`read:medications`, `read:vitals`…), expiração obrigatória, revogação por RPC, hash no banco e auditoria. Falta: (a) página pública `/consulta/[token]` read-only consumindo a timeline clínica; (b) UI de emissão com presets "1 hora / hoje / 7 dias"; (c) QR no app; (d) painel "quem abriu e quando".

**Interface e animação.** Botão grande "Mostrar ao meu médico" na Home. Ao tocar: sheet sobe (spring, ~350 ms) com o QR grande, contagem regressiva do tempo restante e escopos como chips selecionáveis. QR com leve pulsar (opacidade 0.9→1, 2 s, respeitando reduce-motion). Ao revogar: o QR esmaece e vira um selo "acesso encerrado".

**Tecnologias.** Next.js (rota pública), `react-native-qrcode-svg` (já instalado), RPC existente de tokens.

**Etapas.** (1) rota pública read-only; (2) tela de emissão com presets; (3) QR; (4) log de acesso visível; (5) revogação em um toque.

**Riscos.** Link vazado = prontuário exposto → expiração curta por padrão, escopo mínimo, `noindex`, sem dado no path. ⚖️ Registrar consentimento por compartilhamento (LGPD art. 11). Nunca chamar de "prontuário médico" — é registro pessoal do paciente.

### 2.2 Relatório PDF de 1 página

**Problema.** `FATO` 64% dos médicos já usaram dados gerados pelo paciente, quase sempre **em papel**, e a barreira citada é falta de tempo para revisar na consulta (https://www.jmir.org/2026/1/e86368). `FATO` Resumo pré-consulta entregue ao paciente: 78% acharam claro, 75% útil, **72% conseguiram abordar os itens com o médico** (https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3123579/).

**Aplicação.** `RECOMENDAÇÃO` Gerar o PDF **na Edge Function** (HTML→PDF), não no dispositivo: sai por OTA, layout idêntico entre web e mobile, e a regra de conteúdo fica versionada no servidor. Conteúdo: medicamentos ativos + posologia, últimos 30 dias de PA/glicemia com mini-gráfico, 3 últimos exames, queixas do diário, alergias. Rodapé: "dados autorreferidos pelo paciente; não constitui laudo".

**Riscos.** 🩺 Um PDF que *parece* laudo é o principal risco CFM: sem cabeçalho institucional, sem interpretação, sem faixa "normal/alterado" com juízo clínico. Signed URL de PHI com TTL de minutos e log de auditoria.

### 2.3 Disclosure de IA + registro imutável

**Aplicação.** `RECOMENDAÇÃO` Todo bloco gerado por IA (web e mobile) carrega badge "Gerado por IA — estimativa educativa, não é diagnóstico" + link "como isso foi gerado" (modelo, versão do prompt, fontes, data). No banco, tabela `ai_invocations` append-only, no mesmo padrão do `audit_log` que já é imutável.

**Interface.** Badge discreto no rodapé do bloco; toque abre drawer, nunca modal.

**Riscos.** Poluição visual (mitigar com drawer sob demanda). ⚖️ Prazo: vigência em ~26/08/2026.

### 2.4 Testes de RLS com pgTAP + smoke test Maestro

`FATO` pgTAP no Supabase com `supabase test db` e helpers que permitem `tests.authenticate_as('user_b')`: https://supabase.com/docs/guides/database/extensions/pgtap · https://github.com/usebasejump/supabase-test-helpers
`FATO` Maestro: 15.1k estrelas, Apache 2.0, fluxos YAML, integração de primeira classe com EAS Workflows: https://github.com/mobile-dev-inc/Maestro · https://docs.expo.dev/eas/workflows/introduction/

`ANÁLISE` São as duas redes de segurança que **não temos** e que protegem contra os dois piores cenários: vazar prontuário de terceiro (pgTAP) e derrubar o app de todos com um OTA ruim (Maestro). Um teste por tabela com PHI: "usuário A tenta ler linha de B → 0 linhas".

---

## 3. Conformidade — mapa normativo consolidado

| Tema | Norma / fonte |
|---|---|
| IA na medicina | Res. CFM 2.454/2026 — https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2026/2454_2026.pdf |
| Telemedicina | Res. CFM 2.314/2022 — https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2022/2314_2022.pdf |
| Prontuário / guarda 20 anos | Res. CFM 1.821/2007 — https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2007/1821_2007.pdf |
| Software como dispositivo médico | RDC ANVISA 657/2022 — https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2022/software-como-dispositivo-medico-perguntas-e-respostas |
| Incidente de segurança (3 dias úteis) | Res. CD/ANPD 15/2024 — https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca |
| Transferência internacional (LLM) | Res. CD/ANPD 19/2024 — https://www.gov.br/anpd/pt-br/assuntos/noticias/resolucao-normatiza-transferencia-internacional-de-dados |
| Alto risco / RIPD | Res. CD/ANPD 2/2022 — https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022 |
| Fiscalização de saúde 2025-26 | Agenda Regulatória ANPD — https://www.migalhas.com.br/coluna/migalhas-de-protecao-de-dados/423103/destaques-da-agenda-regulatoria-2025-2026-da-anpd |
| AppSec / LLM Sec | OWASP Top 10:2025 — https://owasp.org/Top10/2025/0x00_2025-Introduction/ · LLM Top 10 — https://genai.owasp.org/llm-top-10/ |

**Pontos que exigem decisão ⚖️:**
1. **Base legal.** `FATO` O art. 11, II, "f" (tutela da saúde) vale "exclusivamente, em procedimento realizado por **profissionais de saúde, serviços de saúde ou autoridade sanitária**". `ANÁLISE` Somos um PHR operado por empresa de tecnologia — provavelmente **não** nos enquadramos; a base deve ser **consentimento específico e destacado** (art. 11, I), granular por finalidade.
2. **Transferência internacional ao provedor de LLM** — DPA + cláusulas-padrão da ANPD (período de graça encerrado em ago/2025) + avaliar Zero Data Retention.
3. **RIPD/DPIA** — pelos critérios da ANPD (dado sensível + decisão automatizada), o app se enquadra como alto risco.

**Matriz clínica de IA 🩺** (verde = fazer; amarelo = só com guardrail; vermelho = não fazer):
- 🟢 Traduzir jargão · organizar o que o usuário digitou · transcrever · gerar perguntas para o médico · resumir a própria evolução.
- 🟡 "Este valor está fora da faixa do laboratório" (lê o laudo, não interpreta) · sinalizar possível interação **citando fonte** e mandando ao farmacêutico.
- 🔴 Sugerir diagnóstico · triagem de urgência · ajustar dose · interpretar imagem · prognóstico.

---

## 4. Plano de ação

### 4.1 Ganhos rápidos (2–4 semanas, tudo OTA)

1. **Farmácia Popular** — seed do elenco + badge no medicamento + "farmácias credenciadas perto de mim" (já temos a Edge Function).
2. **Modo Consulta** — rota pública + QR sobre a infra de tokens já existente.
3. **Relatório PDF de 1 página** via Edge Function.
4. **Disclosure de IA + `ai_invocations`** (prazo CFM: ~26/08/2026).
5. **Higiene de segurança** — Supabase Security Advisor zerado, `search_path` em funções `SECURITY DEFINER`, views com `security_invoker`, buckets privados com signed URL curta, scrubber de logs.
6. **pgTAP de RLS + smoke test Maestro** no CI, com o Maestro rodando **antes** de cada `eas update`.
7. **Alvo de toque 56px + rótulo sempre visível na tab bar** (auditoria de a11y barata).

### 4.2 Médio prazo (1–3 meses)

1. **Confirmação de dose com ações na notificação** → destrava adesão, streak, relatório e escalonamento.
2. **Guardião de Dose** (avisa o cuidador) — com consentimento granular e opção de desligar pelo próprio paciente.
3. **Relatório de adesão** + **lembrete de reposição de estoque**.
4. **Base ANVISA/CMED** + **LOINC/CID-10** embarcados → dado limpo e comparável.
5. **Modo Sênior** e **login sem teste cognitivo** (link mágico / OAuth como caminho primário).
6. **Gráficos com faixa de referência + resumo textual** para leitor de tela.
7. **Exportação FHIR R4** (portabilidade LGPD hoje; degrau para RNDS amanhã).
8. **Um único APK 0.3.0 agrupando**: `runtimeVersion: fingerprint`, push remoto (FCM), Health Connect ampliado, câmera para código de barras, ditado por voz, e a base de offline-first.

### 4.3 Inovações estratégicas (6–12 meses)

1. **Offline-first de verdade** (Legend-State como piloto, PowerSync como evolução) — é a maior alavanca de retenção para o público do interior.
2. **RAG com fontes oficiais brasileiras** (Bulário ANVISA, MS, sociedades) + citação obrigatória + recusa segura, com **evals clínicos no CI**.
3. **Formulários como `Questionnaire` FHIR** — adicionar uma escala clínica vira INSERT + OTA, sem release.
4. **Caderneta de vacinas do adulto** e **Radar de prevenção** 🩺 (exigem revisão médica antes de publicar).
5. **Importação assistida do Meu SUS Digital** (PDF) enquanto a RNDS não abre para app de cidadão.

### 4.4 Não fazer

- **Triagem de sintomas / "devo ir ao pronto-socorro?"** — incompatível com a regra de não diagnosticar e com a CFM 2.454/2026.
- **Base própria de interações medicamentosas** — passivo clínico. `FATO` A API de interações do RxNav foi descontinuada em jan/2024 e o checker gratuito do DrugBank encerra em mar/2026. Alternativa segura: nudge neutro "você tem 6 medicamentos — leve esta lista ao farmacêutico".
- **Trocar Recharts, adotar Skia/Rive, SNOMED CT, CBHPM** — custo sem ganho no nosso contexto.
- **Copiar código do Fasten Health** — GPL-3.0, incompatível com produto fechado (usar só como benchmark).

---

## 5. Posicionamento (síntese)

`ANÁLISE` Cruzando os concorrentes pesquisados: Rede D'Or e Einstein são apps **de rede**; Memed é do **prescritor**; Meu SUS Digital é do **Estado**. Ninguém ocupa bem o espaço do **paciente crônico brasileiro que precisa chegar organizado na consulta**.

As cinco features do bloco P0 (Modo Consulta + Relatório PDF + Adesão + Farmácia Popular + Guardião de Dose) contam **uma história única**: *"o HubPacientes é o que você leva para a consulta"*. É a posição mais defensável e a que melhor aproveita o que já está construído.
