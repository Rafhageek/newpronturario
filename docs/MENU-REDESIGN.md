# Redesenho do Menu — HubPatients (2026-07-13)

> Pesquisa multi-agente (nav mobile, sidebar web, navegação para idosos) com referências:
> Meu SUS Digital, Medisafe, Apple Saúde, Nubank/C6 (home de atalhos), MyChart, Linear,
> shadcn/ui sidebar, NN/g, Material 3, W3C COGA, AbilityNet.

## Aplicado nesta leva (OTA)

**Mobile — tela "Mais":**
- **Busca no topo** ("Buscar função…") com filtro tolerante a acento + empty state — era o maior gap (app tem muitas features e o idoso não sabia em que seção procurar).
- **Regrupado em seções na linguagem do paciente:** Minha saúde · Minhas jornadas · Minhas pessoas · Aprender · Conta e privacidade · Equipe (só staff, oculto do paciente).
- **Renomeações:** "Análise" → "Meus indicadores", "Exames" → "Meus exames", "Consultas" → "Minhas consultas", "Educação" → "Conteúdos de saúde", "Privacidade" → "Meus dados", + "Onde me consultar" (locais).

**Web — sidebar:**
- **Bug corrigido:** o logo ainda escrevia "VidaLog" (o rebrand não pegou porque estava quebrado em JSX `Vida`+`Log`) → agora "HubPatients".
- **Estado ativo multi-sinal:** barra lateral **coral #F24B59** + tint azul-royal + negrito (antes era só um tint sky do palette antigo). Melhor para daltônicos e idosos.
- **Renomeações espelhando o mobile** (Meus indicadores, Onde me consultar, Meus dados) — paridade de rótulos.
- Palette do menu migrada do sky antigo para os tokens novos (primary/coral).

**Tab bar mobile:** já estava boa (rótulos sempre visíveis, "Remédios" já renomeado, pill ativa com gradiente) — mantida.

## Referências-chave por decisão

- **Busca obrigatória** em menu com muitas funções — MyChart, W3C COGA "Provide Search".
- **Rótulo sempre visível + ícone** (nunca só ícone) — Material 3, AbilityNet (design para demência).
- **Estado ativo multi-sinal (cor + barra + negrito)** — shadcn Sidebar, a11y para daltônicos.
- **Rótulos na linguagem do paciente** (não jargão) — NN/g, W3C COGA.
- **Home "estilo banco"** (saldo = estado de saúde de hoje; grade de atalhos por frequência) — Nubank, Meu SUS.

## Próximas levas (do plano, não aplicadas ainda)

- Botão central coral **"Registrar"** (action sheet de registro rápido) na tab bar.
- **Favoritos editáveis** (fixar atalhos) na tela Mais e no topo da sidebar.
- **Command palette Cmd+K** na web (busca fuzzy "ir para…") — para cuidador/staff.
- **"Usados recentemente"** na tela Mais.
- **Modo Simples** (4–6 cartões grandes) e perfis paciente/cuidador sobre os mesmos dados.

*(Síntese completa com URLs: workflow `wf_bab798d9-d9f`, sessão 2026-07-13.)*
