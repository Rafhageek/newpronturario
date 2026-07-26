# Testes de escalada de privilégio — Comunidade (0022)

Bateria de segurança para a Sub-fase 1 (papéis, badges e reputação). Roda **após
aplicar `0022_community_roles.sql`** em dev, com duas contas autenticadas (A e B).
Cada tentativa abaixo DEVE falhar — é assim que confirmamos que a escalada de
privilégio (risco nº 1 em sistemas de papéis) está fechada por construção.

Use o token JWT de um usuário comum (anon key + Authorization do usuário). Base:
`$URL = https://kicbnkzdytfdlnizhczt.supabase.co/rest/v1`

| # | Tentativa | Como | Resultado esperado |
|---|-----------|------|--------------------|
| 1 | **Auto-admin** | `PATCH /community_members?user_id=eq.<self>` com `{"staff_role":"admin"}` | **0 linhas / 403** — sem policy de UPDATE para `authenticated` |
| 2 | **Auto-VIP** | `PATCH /community_members?user_id=eq.<self>` com `{"member_tier":"vip"}` | **0 linhas / 403** — idem |
| 3 | **Auto-selo médico** | `PATCH /social_profiles?user_id=eq.<self>` com `{"verified_crm":true}` | **403 / coluna não atualizável** — GRANT revogado |
| 4 | **Editar reputação** | `POST /reputation_events` com `{"user_id":"<self>","event_type":"x","points":99999}` | **403** — sem INSERT para `authenticated` |
| 4b | **Inflar via RPC** | `POST /rpc/award_reputation` | **403** — EXECUTE revogado de `authenticated` |
| 5 | **Aprovar a si mesmo** | `POST /rpc/approve_professional_verification` com pedido próprio | **exception** — `is_admin()` interno barra |
| 6 | **Inserir community_members** | `POST /community_members` com `{"user_id":"<self>","staff_role":"admin"}` | **403** — sem INSERT para `authenticated` |
| 7 | **Ler doc de outro** | `GET storage/professional-docs/<B>/...` autenticado como A | **403** — policy de pasta-dono/admin |

Tentativas que DEVEM funcionar (controle positivo):
- Criar pedido próprio: `POST /professional_verifications` com `status:'pending'` e `user_id` próprio → **201**.
- Ler o próprio status / o próprio `community_members` → **200**.
- Após um admin chamar `approve_professional_verification`, a badge de médico
  aparece nas views do feed; após `expire_professional_verifications`, some.

Observação: o **bootstrap do 1º admin** é manual no SQL Editor (documentado no fim
do 0022). Sem nenhum admin, nem `approve_*` nem `set_staff_role` podem ser usados —
o que é o comportamento seguro desejado.
