# VidaLog — Prontuário Pessoal de Saúde (PHR)

App brasileiro, **paciente-first**, onde a pessoa é dona dos próprios dados de saúde e
controla granularmente o que compartilha (família, médicos, laboratórios, pesquisa).
Conformidade **LGPD + CFM**.

> **Princípios éticos inegociáveis**
> 1. O app **nunca** diagnostica, **nunca** prescreve. Toda análise direciona ao médico.
> 2. Features de **segurança** (lembrete de medicação, registro de tomada, cartão de
>    emergência QR) são **gratuitas para sempre**.
> 3. Disclaimer permanente em telas de interpretação de exames.
> 4. LGPD by design: consentimento granular, audit log, dados sensíveis protegidos,
>    direito de exportar/excluir.

## Monorepo

```
apps/
  web/         Next.js 15 (App Router) — web
  mobile/      Expo (React Native) — iOS/Android
packages/
  core/        Tipos do banco, validações Zod, constantes (planos, ética), helpers
  supabase/    Clients (browser/server/native), queries tipadas, hooks TanStack Query
  ui-tokens/   Cores, espaçamentos, tipografia (Trust Blue #0284C7, Health Green #10B981)
supabase/
  migrations/  0001_init.sql — 13 tabelas, RLS, triggers, bucket de exames
```

Detalhes da arquitetura e do fluxo de dados em [docs/architecture.md](docs/architecture.md).

## Pré-requisitos

- **Node 20+** e **pnpm** (`corepack enable` ou `npm i -g pnpm`)
- Um projeto **Supabase** (URL + anon key)
- Para mobile: app **Expo Go** no celular (ou emulador)

## Configuração

1. Instale as dependências (na raiz):
   ```bash
   pnpm install
   ```
2. Variáveis de ambiente (veja `.env.example`):
   - **Web** → crie `apps/web/.env.local`:
     ```
     NEXT_PUBLIC_SUPABASE_URL=...
     NEXT_PUBLIC_SUPABASE_ANON_KEY=...
     ```
   - **Mobile** → crie `apps/mobile/.env`:
     ```
     EXPO_PUBLIC_SUPABASE_URL=...
     EXPO_PUBLIC_SUPABASE_ANON_KEY=...
     ```
3. Aplique a migration no seu Supabase de **desenvolvimento**:
   ```bash
   npx supabase db push      # nunca rode direto em produção
   ```

## Rodando

```bash
pnpm dev          # web em http://localhost:3000
pnpm dev:mobile   # Expo (abra no Expo Go via QR code; deep link vidalog://)
```

## Qualidade

```bash
pnpm check        # lint + typecheck + testes (Vitest) em todo o monorepo
pnpm --filter @vidalog/core test          # só os testes unitários
pnpm --filter @vidalog/web test:e2e       # E2E Playwright (login → dashboard)
```

Para o teste E2E de **login real**, defina `E2E_EMAIL` / `E2E_PASSWORD` (de um usuário de
teste) e as variáveis do Supabase no ambiente antes de rodar.

## Stack

- **Web**: Next.js 15, TypeScript estrito, Tailwind v4, TanStack Query, React Hook Form +
  Zod, Sonner, Supabase SSR.
- **Mobile**: Expo SDK 53, expo-router, NativeWind, TanStack Query, Zod,
  expo-secure-store (sessão).
- **Banco**: Supabase (PostgreSQL gerenciado, Auth, RLS, Storage, Edge Functions).
- **Monorepo**: Turborepo + pnpm workspaces.
