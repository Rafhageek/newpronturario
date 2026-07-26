# Acesso de IA ao prontuário (tokens pessoais + endpoint)

Permite que o assistente de IA do usuário (ex.: Claude) **leia** o prontuário
do PRÓPRIO usuário, **sem** compartilhar login/senha. O token é o segredo;
guardamos só o hash; a leitura é restrita aos escopos do token e auditada.

## Como o usuário gera um token
`/configuracoes/acesso-ia` → nome + escopos (somente leitura) + **confirmar senha
(segunda etapa)** → o token aparece **uma vez** (copiar). Expira em 90 dias e pode
ser **revogado** a qualquer momento. Escopos: `read:profile`, `read:medications`,
`read:vitals`, `read:allergies`, `read:exams`.

## Endpoint
```
GET /api/v1/me
Authorization: Bearer <token>
```
Retorna um pacote no estilo FHIR, só com os recursos cobertos pelos escopos:
`Patient`, `MedicationStatement[]`, `Observation[]` (vitais),
`AllergyIntolerance[]`, `DiagnosticReport[]` (exames, metadados).

Exemplo:
```bash
curl -H "Authorization: Bearer vlk_XXXX" https://SEU-DOMINIO/api/v1/me
```

## Segurança (resumo)
- Token de 256 bits; servidor guarda só o **SHA-256**.
- A leitura é uma RPC `api_me_bundle(p_token_hash)` **SECURITY DEFINER** gateada
  pelo hash — **sem service_role** no servidor web (mesmo modelo do calendar-feed).
- `last_used_at` e `audit_log` gravados a cada acesso. Rate limit por token.
- Gerar exige reautenticação por senha ("duas etapas"). Sem escopo de escrita.

## Plugando num cliente MCP (arquitetura, fase futura)
A fundação está pronta para um **servidor MCP do HubPatients** numa fase futura. O
caminho natural:
1. Um pequeno servidor MCP (Node/Deno) que recebe o token do usuário (config do
   cliente MCP) e expõe ferramentas como `get_medications`, `get_vitals`,
   chamando `GET /api/v1/me` com o `Authorization: Bearer`.
2. O cliente MCP (ex.: Claude Desktop) é configurado com o token; o servidor MCP
   traduz as ferramentas → endpoint REST acima.
3. Nada de senha; o usuário revoga o token quando quiser.

> Nesta fase NÃO construímos o servidor MCP nem um chatbot — só a fundação
> (tokens, escopos, endpoint, auditoria). Todo uso de IA mantém os guardrails:
> informativo, nunca diagnostica/prescreve, disclaimer permanente.

## Elegibilidade do "assistente de IA mínimo" no app
A flag `has_ai_assistant_access()` = **Plus (voucher)** OU **consentimento de
compartilhamento ativo** (pesquisa/laboratório/médico). Pronta para o cliente
decidir o modelo de produto (Plus pago, benefício de quem compartilha, ou os dois).
