# Checklist de segurança — HubPatients

Lista operacional do que precisa estar verdadeiro para o app poder guardar
prontuário de gente de verdade. Não é teoria: cada item diz **onde está no
repositório** e **como verificar**.

- `[x]` = já implementado e verificável no repo
- `[ ]` = pendente (ação humana, painel do Supabase ou código a escrever)

Contexto legal: **LGPD** (dado de saúde é dado sensível — art. 11) + normas do
**CFM**. Um furo de RLS aqui não é bug de UX: é vazamento de prontuário de
terceiro, o pior incidente possível neste produto.

---

## 1. Security Advisor do Supabase zerado

- [ ] **Rodar o Advisor no painel** (Dashboard → Advisors → Security) e chegar a
      zero alertas em *Errors* e *Warnings*. É a única checagem desta lista que
      não dá para automatizar do repo — depende do projeto hospedado.
- [x] As três causas mais comuns de alerta já estão fechadas por migração:
      RLS em toda tabela (§2), `search_path` fixo (§3) e `security_invoker` nas
      views (§4).
- [ ] **Auth → Protections**: ligar *Leaked password protection* (HaveIBeenPwned)
      e exigir MFA para contas de staff do projeto.
- [ ] **Postgres**: manter a versão do banco em dia (o Advisor alerta quando há
      patch de segurança pendente).

Depois de aplicar a `0038`, reexecutar o Advisor e anexar o print/resultado em
`D:\Obsidian\Projeto Prontuário\Histórico de Atualizações.md`.

---

## 2. RLS habilitada e correta em TODA tabela

- [x] **70 tabelas** em `public`, **70 com `enable row level security`**
      (migrações `0001`–`0037`). Nenhuma tabela sem RLS.
- [x] Tabelas de dado clínico são *owner-only* ou *owner + cuidador aceito*:
      o gate é `public.can_view_patient()` / `public.owns_child()` /
      `public.caregiver_has_permission()`, todas SECURITY DEFINER para não
      recursar na própria RLS.
- [x] Escritas sensíveis não têm policy de INSERT/UPDATE direto: passam por RPC
      (`set_patient_consent`, `request_account_deletion`, `log_ai_invocation`,
      `issue_personal_access_token`, `refill_medication_stock`). O RPC fixa
      `user_id = auth.uid()` — o cliente nunca escolhe de quem é a linha.
- [x] **Prova automatizada**: `supabase/tests/rls_isolation_test.sql` — 43
      asserções cobrindo 15 tabelas (titular A só vê a própria linha; terceiro
      sem vínculo não vê nada; A não altera/apaga linha de B; `anon` não lê dado
      clínico).
- [x] Provas complementares: `authorization_integrity_p0_test.sql`,
      `security_p0_test.sql`, `account_privacy_workflow_p1_test.sql`,
      `clinical_timeline_p2_test.sql`, `personal_access_tokens_p2_test.sql`,
      `clinical_data_constraints_p2_test.sql`.

**Como verificar:** `supabase db reset --no-seed && supabase test db`.

**Regra para PR novo:** toda tabela nova nasce com `enable row level security`,
policies explícitas e uma linha no `rls_isolation_test.sql`. Sem isso, não passa.

---

## 3. `search_path` fixo em toda função SECURITY DEFINER

Sem `search_path` fixo, a função resolve nomes pelo caminho de quem a chama —
um schema plantado à frente de `public` faz a função executar objeto do
atacante. Em SECURITY DEFINER, isso é escalada direta de privilégio.

- [x] **60/60 funções SECURITY DEFINER** de `public` declaram
      `set search_path = public` na própria definição (auditado nas migrações
      `0001`–`0037`).
- [x] As **5 funções SECURITY INVOKER** que ainda estavam sem foram corrigidas
      nominalmente na migração `0038_security_hardening_p3.sql`:
      `set_updated_at()`, `reject_reply_on_locked_post()`,
      `medication_daily_doses(uuid)`, `medication_days_remaining(uuid)`,
      `tg_health_places_updated_at()`.
- [x] **Regressão barrada no CI**: o `rls_isolation_test.sql` falha se qualquer
      função SECURITY DEFINER de `public` aparecer sem `search_path` fixo.
- [x] Funções de sistema/gatilho têm `EXECUTE` revogado de
      `public, anon, authenticated` (migração `0025`) — não dá para chamá-las
      como RPC.

**Armadilha conhecida:** recriar função pelo SQL Editor do Supabase sem repetir
`set search_path = public` desfaz a proteção. Toda mudança de função vai por
migração, nunca pelo editor.

---

## 4. Views com `security_invoker`

Por padrão, uma view roda com os privilégios de quem a criou (`postgres`) — a
RLS das tabelas de base é avaliada como o dono e a view vira porta aberta.

- [x] As **4 views** de `public` foram criadas com `security_invoker = on`:
      `feed_posts`, `feed_comments`, `forum_category_stats`,
      `forum_trending_tags` (migrações `0022` e `0023`).
- [x] A migração `0038` **reafirma** o atributo com `ALTER VIEW ... SET
      (security_invoker = true)`, cobrindo o caso de alguém recriar a view sem
      a cláusula `WITH (...)`.
- [x] **Regressão barrada no CI**: o `rls_isolation_test.sql` falha se qualquer
      view de `public` (exceto objetos de extensão) estiver sem `security_invoker`.

---

## 5. Buckets privados + signed URL curta

- [x] `exams` — **privado** (`public = false`), limite de 50 MiB, MIME em
      allowlist (`pdf`, `png`, `jpeg`, `webp`, `heic`). Migração `0001`.
- [x] `professional-docs` — **privado**, 10 MiB, MIME em allowlist. Migração `0022`.
- [x] Policies de `storage.objects` exigem que a **primeira pasta do caminho
      seja `auth.uid()`** — ninguém lê/escreve fora da própria pasta.
- [x] Acesso ao arquivo é por **URL assinada de 60 segundos**
      (`getExamSignedUrl`, `packages/supabase/src/queries/exams.ts`). Nenhum uso
      de `getPublicUrl` no código.
- [ ] Nunca colar URL assinada em log, telemetria, e-mail ou push. (O scrubber
      do logger mobile já redige querystring — ver §7 — mas a regra vale para
      qualquer canal.)

---

## 6. `service_role` nunca no cliente

- [x] **Zero ocorrências** de `service_role` / `SUPABASE_SERVICE_ROLE_KEY` em
      `apps/` e `packages/`. O único acesso "de servidor" é feito por RPC
      SECURITY DEFINER gateada por hash de token pessoal
      (`api_me_bundle_v2`, migração `0035`) — o servidor web nunca segura uma
      chave que ignora RLS.
- [x] O cliente do app usa apenas a chave **anon** (`packages/supabase/src/clients/anon.ts`),
      que é pública por design e só funciona dentro da RLS.
- [x] `pnpm security:secrets` (`scripts/security/scan-secrets.mjs`) roda no CI
      e falha se algum segredo for versionado — sem imprimir o valor.
- [ ] Se um dia um endpoint precisar de `service_role`: só em Edge Function ou
      rota de servidor, com a chave em variável de ambiente do provedor, jamais
      em `NEXT_PUBLIC_*` nem em `app.json`/`eas.json`.

---

## 7. Logs sem PHI

- [x] **Mobile** — `apps/mobile/src/lib/logger.ts` reescrito com três camadas:
      1. **allowlist de campos** (só id, código, contador, status, nome de
         evento; o resto é descartado e só o total omitido é registrado);
      2. **scrubber** que redige CPF, CNS, e-mail, telefone, JWT/token,
         valor de querystring e sequência longa de dígitos, e trunca strings
         compridas — objeto/array **nunca** é serializado, então resposta
         inteira de API não vaza;
      3. **produção silenciosa** — `console.log/info/debug/warn` viram no-op e
         `console.error` sai como mensagem genérica + **id de correlação**
         (`hp_…`), que é o que o usuário informa no suporte.
- [x] A API pública (`logger.error` / `logger.warn`) não mudou; ambas agora
      devolvem o id de correlação.
- [ ] **Web** — `apps/web` ainda não tem logger equivalente. Enquanto não tiver,
      vale a regra manual: nenhum `console.*` com objeto de resposta.
- [ ] **Sentry (Q1b)** — quando entrar, ligar no `enviarAoMonitoramento()` e
      reaplicar `scrubContexto()` no `beforeSend` como segunda barreira.
- [x] **Auditoria no banco** — `public.audit_log` é append-only (sem policy de
      UPDATE/DELETE, `INSERT` revogado de `anon/authenticated`), guarda
      **metadado** de acesso, não conteúdo clínico. `public.ai_invocations`
      segue o mesmo padrão para uso de IA (CFM 2.454/2026): registra modelo,
      versão de prompt e hash da saída — nunca a saída.

---

## 8. Portões automáticos (CI)

`.github/workflows/ci.yml`:

- [x] `quality` — lint, typecheck e testes unitários.
- [x] `dependency-security` — `security:secrets` + `security:deps`
      (bloqueia vulnerabilidade *high*/*critical*).
- [x] `security-rls` — sobe Supabase local, aplica todas as migrações
      (`db reset --no-seed`), lista a suíte e roda **`supabase test db`**
      (pgTAP). Roda em todo push/PR, de propósito: mudança fora de
      `supabase/**` também quebra expectativa de RLS.
- [x] `security-rls` também executa `supabase db lint --level warning` como
      passo informativo (não bloqueia).
- [x] `build-web` e `e2e-web` (Playwright).

---

## 9. Plano de incidente (prazo ANPD: 3 dias úteis)

**Base normativa:** Resolução CD/ANPD nº 15/2024 — Regulamento de Comunicação de
Incidente de Segurança. A comunicação à ANPD **e ao titular** deve ocorrer em
**até 3 dias úteis contados do conhecimento** do incidente que possa acarretar
risco ou dano relevante. Incidente com dado de saúde presume risco relevante.
<https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca>

- [ ] **Papéis definidos e escritos**: quem é o encarregado (DPO), quem é o
      responsável técnico de plantão, quem fala com titular e imprensa.
- [ ] **Canal do titular publicado** (e-mail/página) para dúvida e denúncia.
- [ ] **Runbook salvo** com os passos abaixo, testado ao menos uma vez por ano.

### Runbook (D0 → D+3 úteis)

1. **Conter (imediato).** Revogar sessões (`auth.users` → sign out global),
   revogar tokens pessoais afetados (`revoke_personal_access_token`), rotacionar
   chaves expostas, e — se o vetor for RLS — desabilitar o endpoint/feature
   antes de qualquer outra coisa.
2. **Preservar prova.** Snapshot do banco + export de `public.audit_log` e
   `public.ai_invocations` do período. Não editar, não apagar: a trilha é
   append-only por design justamente para isto.
3. **Dimensionar (até D+1).** Quais titulares, quais categorias de dado, quantos
   registros, janela temporal, se houve exfiltração efetiva ou só exposição.
4. **Comunicar (até D+3 úteis).** Notificar a ANPD pelo canal oficial e os
   titulares afetados, em linguagem simples: o que aconteceu, qual dado, qual
   risco, o que já foi feito, o que a pessoa pode fazer.
5. **Corrigir com teste.** Toda correção de RLS entra como migração **+ caso
   novo no `rls_isolation_test.sql`** — o mesmo furo não pode reabrir em
   silêncio.
6. **Post-mortem sem culpa** registrado em
   `D:\Obsidian\Projeto Prontuário\Histórico de Atualizações.md`.

---

## 10. Pendências abertas (backlog de segurança)

- [ ] Rodar o Security Advisor após aplicar a `0038` e zerar o que sobrar (§1).
- [ ] Ligar proteção de senha vazada + MFA de staff no Auth (§1).
- [ ] Logger com scrubber no `apps/web` (§7).
- [ ] Plugar Sentry no `enviarAoMonitoramento()` com `beforeSend` (§7).
- [ ] Formalizar DPO, canal do titular e runbook de incidente (§9).
- [ ] Validar as constraints `NOT VALID` da migração `0036`
      (`alter table ... validate constraint ...`) depois de limpar o legado —
      os comandos já estão comentados no fim daquele arquivo.
- [ ] Definir política de retenção/expurgo de `public.audit_log` (hoje cresce
      sem prazo; LGPD pede necessidade e prazo definido).
