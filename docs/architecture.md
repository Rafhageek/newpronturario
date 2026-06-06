# Arquitetura — VidaLog

## Visão geral

Monorepo **Turborepo + pnpm workspaces** com dois apps (web e mobile) que compartilham
três pacotes. A regra de ouro: **tipos, validações e regras de negócio vivem uma única
vez** em `packages/` — web e mobile nunca divergem.

```
┌───────────────────────────────────────────────────────────────┐
│                          apps/                                 │
│  ┌────────────────────┐         ┌────────────────────────┐     │
│  │  web (Next.js 15)  │         │   mobile (Expo / RN)   │     │
│  │  App Router        │         │   expo-router          │     │
│  │  Tailwind v4       │         │   NativeWind           │     │
│  └─────────┬──────────┘         └───────────┬────────────┘     │
└────────────┼────────────────────────────────┼─────────────────┘
             │            consomem             │
             ▼                                 ▼
┌───────────────────────────────────────────────────────────────┐
│                        packages/                               │
│  core ──────────── tipos do banco, schemas Zod, constantes,    │
│   │                 helpers (puros, testados com Vitest)        │
│  supabase ───────── clients (browser/server/native),           │
│   │                 queries tipadas, hooks TanStack Query       │
│  ui-tokens ──────── cores, espaçamentos, tipografia             │
└───────────────┬───────────────────────────────────────────────┘
                │ @supabase/supabase-js + @supabase/ssr
                ▼
┌───────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                       │
│  Auth · RLS em todas as tabelas · Storage (bucket 'exams')     │
│  supabase/migrations/0001_init.sql                             │
└───────────────────────────────────────────────────────────────┘
```

## Pacotes compartilhados

### `@vidalog/core`
Sem dependências de framework. Exporta:
- **types/db.ts** — o tipo `Database` (espelha a migration) + atalhos `Row/InsertRow/UpdateRow`
  e aliases por entidade (`Profile`, `Vital`, `Medication`…). Pode ser regenerado com
  `supabase gen types typescript`.
- **schemas/** — validações Zod (auth, vitals, medication, diary, profile). Mesma validação
  no web e no mobile.
- **constants/** — planos (`PLANS`, `FEATURES`, `isFeatureAvailable`), textos éticos
  (`DISCLAIMERS`, `DOCTOR_REDIRECT`), rótulos PT-BR de saúde (`VITAL_TYPES`…).
- **utils/** — helpers puros (`calculateAge`, `isMinor`, `formatVital`, `isValidCPF`…).

### `@vidalog/supabase`
- **clients/browser.ts** — `createBrowserClient` (Next client components).
- **clients/server.ts** — `createServerClient` (Server Components / middleware; cookies injetados).
- **clients/native.ts** — `createClient` com storage adapter (expo-secure-store no mobile).
- **queries/** — funções tipadas que recebem o client (`getDashboardSummary`, `listVitals`,
  `createMedication`, `registerIntake`…). Lançam em erro; a UI trata.
- **hooks/** — `VidaLogClientProvider` (injeta o client) + hooks TanStack Query
  (`useDashboard`, `useVitals`, `useRegisterIntake`…) reutilizados nas duas plataformas.

> O tipo `Database` inclui `__InternalSupabase` (exigido pelo supabase-js 2.10x para
> inferir insert/update). Os clients do `@supabase/ssr` são normalizados por cast para o
> tipo nativo `SupabaseClient<Database>` (runtime idêntico).

### `@vidalog/ui-tokens`
Tokens neutros (objetos TS). O web usa via `@theme` no Tailwind v4; o mobile espelha os
valores no `tailwind.config.js` do NativeWind (RN não importa TS no config do Tailwind).

## Fluxo de dados (exemplo: dashboard)

1. App cria o client Supabase (web: cookies; mobile: secure-store) e o injeta em
   `VidaLogClientProvider`.
2. A tela chama `useDashboard(user.id)` (hook compartilhado).
3. O hook chama `getDashboardSummary(client, patientId)` — uma query tipada em
   `@vidalog/supabase`.
4. O Postgres aplica **RLS**: o paciente só lê o que é seu; um cuidador **aceito** lê via
   `is_accepted_caregiver()` / `can_view_patient()`.
5. Os dados retornam tipados de ponta a ponta (sem `any`).

## Segurança e LGPD (banco)

- **RLS em todas as 13 tabelas.** Dono tem CRUD; cuidador aceito tem SELECT.
- **`audit_log` é append-only** (sem políticas de UPDATE/DELETE).
- **`consents`** registra consentimento granular (Art. 7/11 LGPD).
- Colunas sensíveis marcadas com `COMMENT 'PHI: ...'`.
- **Storage**: bucket `exams` privado; cada arquivo fica sob `"<auth.uid()>/..."` e as
  policies garantem que só o dono acessa.
- `handle_new_user()` cria o `profile` automaticamente no cadastro.

## Autenticação

- **Web**: `@supabase/ssr` persiste a sessão em cookies; o `middleware.ts` refresca a
  sessão e protege rotas privadas (deslogado → `/login`). Resiliente a env ausente.
- **Mobile**: sessão persistida em `expo-secure-store`; `AuthProvider` escuta
  `onAuthStateChange` e o `_layout` redireciona entre `(auth)` e `(tabs)`.

## Tarefas Turbo

`dev`, `build`, `lint`, `typecheck`, `test`, `clean`. O atalho **`pnpm check`** roda
`lint + typecheck + test` em todo o monorepo. O E2E do web (`test:e2e`) fica fora do
`check` por exigir navegador + servidor.
