# Servidor MCP do HubPatients (Caminho A — MVP local)

Permite que um assistente de IA (Claude Code, Claude Desktop ou qualquer cliente
MCP) **consulte o prontuário do próprio usuário por voz ou texto**, sem nunca ver
login/senha. É a implementação do "Caminho A" do plano de integração de IA: um
servidor MCP local (stdio) por cima da fundação que já existia — tokens pessoais
com escopos (`docs/ai-access.md`) e o endpoint `GET /api/v1/me`.

```
Cliente MCP (Claude) ── stdio ──▶ apps/mcp-server ── Bearer vlk_… ──▶ /api/v1/me ──▶ RPC auditada
```

- **Somente leitura.** Os escopos de escrita não existem no PAT — registrar dado
  de saúde via IA fica para o Caminho B (OAuth 2.1 + consentimento granular).
- O token é o segredo; o app guarda só o SHA-256. Cada acesso grava `last_used`
  e auditoria no banco, com rate limit por token.
- Guardrails éticos embutidos nas instruções e descrições das ferramentas:
  informativo, nunca diagnostica/prescreve (LGPD + CFM 2.454/2026).

## Ferramentas

| Ferramenta | Escopo exigido | O que devolve |
|---|---|---|
| `consultar_perfil` | `read:profile` | Nome, nascimento, sexo biológico, tipo sanguíneo |
| `consultar_medicamentos` | `read:medications` | Medicamentos ativos (dose, forma, frequência) |
| `consultar_sinais_vitais` | `read:vitals` | Medições (filtros: `tipo`, `dias`, `limite`) |
| `consultar_alergias` | `read:allergies` | Substância, gravidade, reação |
| `consultar_exames_recentes` | `read:exams` | Metadados dos exames (`limite`) |
| `resumo_prontuario` | qualquer | Visão geral das seções autorizadas + escopos ausentes |

Seção ausente no bundle = escopo não autorizado no token (a ferramenta explica
isso em vez de fingir prontuário vazio).

## Como usar

1. **Gerar o token** no app: Configurações → Acesso de IA → escolher escopos →
   confirmar senha. O token (`vlk_…`) aparece UMA vez; expira em 90 dias e pode
   ser revogado a qualquer momento.
2. **Buildar** (uma vez, na raiz do monorepo):
   ```bash
   corepack pnpm install
   corepack pnpm --filter @hubpatients/mcp-server run build
   ```
3. **Conectar no Claude Code** (o token via variável de ambiente, nunca em arquivo
   commitado):
   ```bash
   claude mcp add hubpatients -e HUBPATIENTS_TOKEN=vlk_SEU_TOKEN -- node "<raiz-do-repo>/apps/mcp-server/dist/index.js"
   ```
4. **Ou no Claude Desktop** (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "hubpatients": {
         "command": "node",
         "args": ["<raiz-do-repo>/apps/mcp-server/dist/index.js"],
         "env": { "HUBPATIENTS_TOKEN": "vlk_SEU_TOKEN" }
       }
     }
   }
   ```
5. Perguntar: *"que remédios eu tomo?"*, *"como está minha pressão nos últimos
   30 dias?"*, *"me dê um resumo do meu prontuário"*.

Variáveis de ambiente: `HUBPATIENTS_TOKEN` (obrigatória) e `HUBPATIENTS_API_URL`
(opcional; padrão `https://app.hubpacients.org` — aponte para
`http://localhost:3000` em desenvolvimento).

Para desenvolvimento sem build: `corepack pnpm --filter @hubpatients/mcp-server run dev`
(usa `tsx`; no Claude Code, troque o comando por `npx tsx <raiz>/apps/mcp-server/src/index.ts`).

## Decisões de implementação

- **stdio, não HTTP**: é um MVP para o titular rodar na própria máquina; nada é
  exposto na rede e o token não sai do ambiente local (além da chamada HTTPS ao
  próprio HubPatients).
- **Cache de 60 s do bundle**: uma pergunta costuma disparar várias ferramentas;
  sem o cache, cada turno consumiria o rate limit do token à toa.
- **Erros acionáveis**: 401 orienta a gerar novo token; 429 pede para aguardar;
  formato inválido explica onde o token é exibido.
- **stdout é do protocolo**: logs vão para stderr.

## Caminho B (produção — ainda não construído)

Antes de abrir a qualquer paciente além do time (requisitos confirmados na
revisão técnica de 2026-08-09 contra a documentação oficial Anthropic/MCP):

- OAuth 2.1 **obrigatório** com PKCE S256; tela de consentimento própria com
  escopos granulares; revogação por usuário.
- RFC 9728 (`/.well-known/oauth-protected-resource`), RFC 8707 (parâmetro
  `resource`) e validação de audience do token.
- Registro de cliente preferencialmente via **CIMD** (DCR só como fallback).
- Transporte Streamable HTTP + HTTPS; registro como conector no claude.ai/API.
- Escopos de escrita (ex.: registrar sinal vital) exigem novas RPCs auditadas e
  disclosure de IA (CFM 2.454/2026) — hoje o PAT é somente leitura por design.
- Dados reais de paciente **não** passam pelo claude.ai consumer (sem BAA);
  produção exige avaliação de acordo adequado na API.
