# HubPatients — Documento de Progresso

> Última atualização: 2026-06-06
> Status de testes: **150 testes verdes** (`@hubpatients/core`, 6 arquivos, Vitest)

---

## 1. Visão geral

O **HubPatients** é um **Prontuário Pessoal de Saúde (PHR)** brasileiro. O paciente é dono dos próprios dados; o app **organiza, explica e acompanha** — **nunca diagnostica nem infere risco**. Toda interpretação clínica é responsabilidade de um profissional de saúde.

- **Conformidade:** LGPD (Art. 11 e 14 — dados sensíveis e de crianças) + normas do CFM.
- **Princípios de dados:** RLS em todas as tabelas; `audit_log` append-only (imutável até sob `service_role`); consentimento granular; soft-delete de conta com carência de 30 dias.

### Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | **Turborepo + pnpm** (workspaces) |
| Web | **Next.js 15** (`apps/web`) — App Router, Tailwind, Framer Motion |
| Mobile | **Expo / expo-router** (`apps/mobile`) — navegação por abas (Tabs) |
| Backend | **Supabase** (Postgres + RLS + Realtime + Edge Functions Deno) |
| Lógica compartilhada | `packages/core` (utils, schemas Zod, constants, types) |
| Acesso a dados | `packages/supabase` (clients, queries, hooks React Query) |
| Design tokens | `packages/ui-tokens` |

### Mapa do monorepo

```
packages/
  core/        utils · schemas (Zod) · constants · types
  supabase/    clients · queries (19) · hooks (14) · types
  ui-tokens/   tokens de design (tema claro morno padrão)
apps/
  web/         Next.js 15 — 18 rotas em src/app/(app)
  mobile/      Expo — abas: index, diario, medicamentos, perfil
supabase/
  migrations/  0001..0017
  functions/   verify-crm · process-exam · _shared
  seeds/       who_lms.json · WHO_SOURCE.md
```

#### `packages/core/src`

- **utils/**: `br.ts`, `clinical.ts`, `cycle.ts`, `education.ts`, `exams.ts`, `growth.ts` (LMS oficial OMS), `health.ts`, `pregnancy.ts`, `stats.ts` — com testes (`*.test.ts`).
- **schemas/** (Zod): `auth`, `child`, `clinical`, `cycle`, `diary`, `exam`, `family`, `medication`, `pregnancy`, `profile`, `settings`, `social`, `vitals`.
- **constants/**: `analysis`, `child`, `consent`, `cycle`, `ethics`, `exams`, `family`, `glossary`, `health`, `i18n`, `plans`, `pregnancy`, `social`.

#### `packages/supabase/src`

- **queries/** (19): `account`, `children`, `clinical`, `consent`, `cycle`, `dashboard`, `diary`, `education`, `exams`, `family`, `forum`, `interactions`, `medications`, `pregnancy`, `profile`, `settings`, `social`, `vitals`.
- **hooks/** (14, React Query): `children`, `clinical`, `context`, `cycle`, `exams`, `family`, `forum`, `keys`, `meds-diary`, `pregnancy`, `queries`, `settings-education`, `social`.

#### `apps/web/src/app/(app)` — 18 rotas

`analise` · `assinatura` · `ciclo` · `comunidade` · `configuracoes` · `consentimento` · `consultas` · `criancas` · `dashboard` · `diario` · `educacao` · `exames` · `familia` · `gestacao` · `medicamentos` · `perfil` · `planos` · `rede-social`

#### `apps/web/src/components` — domínios

`analise` · `app` · `child` · `consent` · `consultas` · `cycle` · `dashboard` · `diary` · `education` · `exams` · `family` · `meds` · `pregnancy` · `profile` · `settings` · `social` · `ui` (Modal acessível, etc.)

---

## 2. Linha do tempo das fases concluídas

### Fundação visual e navegação
- **Design tokens** consolidados em `packages/ui-tokens` e **tema claro morno** como padrão.
- **Navegação mobile** (Expo / expo-router) com abas: `index`, `diario`, `medicamentos`, `perfil`.

### Supabase real configurado
- Projeto **NewProntuario** provisionado; schema importado a partir das migrations versionadas.

### Esquema base (migrations 0001–0012)

| Migration | Resumo |
|---|---|
| **0001** `init` | Esquema inicial. RLS em todas as tabelas, `audit_log` append-only, consentimento granular (`consents`), enums base. Cuidador só acessa com vínculo aceito (`is_accepted_caregiver` / `can_view_patient`). |
| **0002** `profile_clinical` | Perfil clínico estendido (CPF, endereço) + agenda. Tabelas `appointments`, `allergies`, `surgeries`, `family_history`, `insurance_plans`. |
| **0003** `diary_meds` | Diário com dor (0–10) e energia; medicamentos (frequência, horários, unidade, prescritor); `medication_intakes` com motivo de pular; tabela de referência `drug_interactions`. |
| **0004** `exams_narrative` | Exames: categoria, médico/CRM, laudo textual; tabela educativa `exam_metric_explanations` (explicações leigas por métrica). |
| **0005** `exam_explanations_seed` | Seed do dicionário de explicações de exames (hemograma, lipídico, glicemia, função renal/hepática, tireoide…). |
| **0006** `analysis_consultas` | Altura no perfil (IMC) + consultas com CRM, link de teleconsulta, lembretes e anexo de exame. |
| **0007** `consent_settings_education` | Escopo de consentimento "Operadora de saúde"; soft-delete de conta (carência 30 dias); `user_settings` (tema, idioma, notificações). |
| **0008** `health_content_seed` | Seed de conteúdo educativo curado (hipertensão, diabetes tipo 2…), com fonte citada. |
| **0009** `family` | Família / modo cuidador: convites por e-mail (token 48h), permissões granulares, RLS por permissão. |
| **0010** `social` | Comunidade por CID-10 + rede social com Realtime. Posts anônimos não expõem `author_id` (view `feed_posts`). |
| **0011** `security_hardening` | `audit_log` imutável por trigger (mesmo sob `service_role`); view `feed_comments` que oculta autor de comentários anônimos. |
| **0012** `forum` | Fórum: `posts` viram tópicos e `post_comments` viram respostas (threading de 1 nível), com fixar/trancar/resolver. |

### Migration 0013 — Endurecimento de segurança / RLS
Arquivo: `supabase/migrations/0013_security_rls_hardening.sql`. Corrige achados de auditoria:
1. **Anti-elevação de privilégio do cuidador**: trigger `guard_care_permission_change()` — só o **paciente (dono)** pode alterar a coluna `permissions` em `care_relationships`.
2. **Anonimato no Realtime**: a *publication* deixa de entregar `author_id` de posts/comentários anônimos a clientes assinantes.
3. **Tópico trancado** (`is_locked`) passa a recusar novas respostas.
4. **Índices** faltantes em FKs quentes.

**Edge Functions endurecidas** (`supabase/functions/`):
- **verify-crm** (Selo Médico) — *scaffold/gancho*: usa **ANON KEY + JWT do usuário** (nunca `service_role`), deixando a RLS autorizar a escrita. Verificação real contra o CFM é placeholder (não há API pública estável).
- **process-exam** (Plus) — *scaffold*: baixa o laudo do bucket privado e pede ao Claude (vision) apenas a **transcrição estruturada** dos valores (nunca diagnóstico). A narrativa didática é montada no app a partir de `exam_metric_explanations`.

### Auditoria tela-a-tela (6 subagentes) + correções (lote 1)
- **Acessibilidade**: `Modal` acessível e reutilizável (`apps/web/src/components/ui/modal.tsx`) com `role="dialog"`, `aria-modal`, `aria-labelledby`/`aria-describedby`, **focus-trap** (Tab/Shift+Tab), foco inicial e restauração ao fechar, trava de scroll e respeito a **prefers-reduced-motion** (via MotionConfig global); rótulos `aria` em `Field`; correções de contraste.
- **Bugs clínicos**: `MetricRow` (indicação correta de alto/baixo), fuso horário na hora de tomada de medicação, alertas críticos e diálogos de confirmação.

### Jornadas de Vida

| Jornada | Migration(s) | Destaques |
|---|---|---|
| **Gestante** | `0014_pregnancy.sql` | Tabelas `pregnancy_journeys`, `pregnancy_weight_log`, `pregnancy_fetal_movements`, `pregnancy_milestone_catalog`, `pregnancy_milestones`. App **nunca** infere risco (`risk_level` só é o informado; `null` ≠ "baixo risco"); movimentos fetais são só registro; marcos do pré-natal vêm de catálogo curado do Ministério da Saúde; sem compartilhamento com cuidador por padrão. |
| **Caderneta da Criança** | `0015_child_health.sql` + `0016_who_lms_seed.sql` | Tabelas `children`, `child_growth_measurements`, `child_milestone_catalog`, `child_milestones`, `child_vaccine_schedule`, `who_growth_standards`. Criança é **dependente** (não conta). Curvas de crescimento usam dados **OFICIAIS da OMS** — pacote `anthro` da World Health Organization (**GPL-3**), **488 linhas LMS** (wfa/lhfa/bfa/hcfa × male/female × 0–60 meses), semeadas via `0016`. Leituras auditadas pela RPC `log_child_access`. Migration **idempotente**. |
| **Ciclo Menstrual** | `0017_menstrual_cycle.sql` | Tabelas `menstrual_cycle_settings`, `menstrual_cycle_logs`. **Privacidade máxima**: RLS ultra-restritiva (`user_id = auth.uid()`), **sem exceção de cuidador em nenhuma hipótese**. Compartilhamento é **opt-in** explícito por escopo (todos OFF por padrão). Não é método contraceptivo. Ao iniciar uma gestação (0014), o tracking do ciclo é **pausado automaticamente** (preserva os dados). |

> Origem e licença dos dados da OMS documentadas em `supabase/seeds/WHO_SOURCE.md`; dados em `supabase/seeds/who_lms.json`.

---

## 3. Estado de validação por jornada

| Jornada | Migration | Estado |
|---|---|---|
| Gestante | 0014 | **Validada ponta-a-ponta** (lógica coberta por `pregnancy.test.ts`, 45 testes). |
| Caderneta da Criança | 0015 + 0016 | **Aguardando aplicação das migrations pelo usuário** (lógica de crescimento coberta por `growth.test.ts`, 39 testes). |
| Ciclo Menstrual | 0017 | **Aguardando aplicação da migration pelo usuário** (lógica coberta por `cycle.test.ts`, 27 testes). |

**Resumo de testes (`pnpm --filter @hubpatients/core test`):**

```
✓ src/utils/growth.test.ts    (39 tests)
✓ src/utils/cycle.test.ts     (27 tests)
✓ src/utils/utils.test.ts     (11 tests)
✓ src/utils/pregnancy.test.ts (45 tests)
✓ src/utils/clinical.test.ts  (13 tests)
✓ src/schemas/schemas.test.ts (15 tests)

Test Files  6 passed (6)
     Tests  150 passed (150)
```

E2E (Playwright, `apps/web/e2e/`): `login.spec.ts`, `children.spec.ts`, `pregnancy.spec.ts` — os dois últimos pulam automaticamente sem credenciais Supabase reais.

---

## 4. Pendências conhecidas

- **Log de acessos real**: a RPC `log_child_access` registra **leituras de crianças**, mas o painel "Log de acessos" (`apps/web/src/components/consent/access-log.tsx`) ainda depende de o restante do app gravar `read` no `audit_log` para todos os recursos — cobertura de leituras gerais ainda incompleta.
- **Entitlements / `isPlus` hardcoded**: `isPlus = false` fixo em `apps/web/src/app/(app)/{configuracoes,analise,perfil}/page.tsx`. O plano real (Free/Plus) só é definido em fase futura — hoje recursos Plus apenas abrem o modal de upgrade.
- **Focus-trap em modais legados**: o `Modal` canônico tem focus-trap completo, mas há diálogos/painéis inline (ex.: respostas em `rede-social/[id]`) que não usam o componente acessível.
- **Edge Functions são scaffolds**: `verify-crm` (verificação CRM contra o CFM = placeholder) e `process-exam` (não deployado; requer `ANTHROPIC_API_KEY`).
- **Espelhamento mobile das jornadas**: o app Expo cobre apenas abas básicas (`diario`, `medicamentos`, `perfil`); Gestante, Criança e Ciclo ainda **não foram espelhados** no mobile. O cartão de emergência QR do perfil mobile é placeholder.
- **Ganchos "Fase 4"**: envio real de lembretes (push/e-mail/WhatsApp), purga definitiva de conta (job agendado pós-carência) e exportação LGPD por e-mail/ZIP ainda são ganchos.

---

## 5. Como aplicar as migrations e contas demo

### Aplicar migrations

1. **Via Supabase SQL Editor** (recomendado para o projeto remoto): abrir o SQL Editor do projeto **NewProntuario**, colar o conteúdo do arquivo `supabase/migrations/00XX_*.sql` e executar **em ordem**.
2. **Via CLI** (ambiente de dev): `npx supabase db push`.

**Importante:** **0015** (Caderneta da Criança) e **0017** (Ciclo Menstrual) são **idempotentes** — usam `create type ... exception when duplicate_object`, `create table if not exists` e recriação de policies, podendo ser reaplicadas com segurança. Ainda assim, **aplicar primeiro em dev** antes de produção. **0016** insere as 488 linhas LMS da OMS na `who_growth_standards`.

### Contas demo

Existem **contas demo de teste** provisionadas para validar as telas com dados realistas. As credenciais **não são versionadas neste repositório** e não estão documentadas aqui por segurança — solicitar ao responsável pelo ambiente.

---

## 6. Próxima fase planejada — "Medicação Pro"

Evolução do módulo de medicamentos para um acompanhamento avançado:

- **Estoque** de medicamentos (quantidade em casa, alerta de reposição).
- **Bula Anvisa** integrada (informação oficial do medicamento).
- **Mapa de dor** (registro corporal vinculado ao diário).
- **Sync de calendário** (lembretes de tomada e consultas no calendário do dispositivo).

---

*Documento factual gerado a partir da inspeção do repositório (migrations 0001–0017, pacotes `core`/`supabase`/`ui-tokens`, `apps/web` e `apps/mobile`). HubPatients nunca diagnostica — apenas organiza, explica e acompanha.*
