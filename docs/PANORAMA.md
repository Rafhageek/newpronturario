# HubPatients — Panorama geral (tudo que já construímos)

> Salvo aqui porque o drive **D:** (vault do Obsidian) estava desconectado no momento.
> Quando o D: voltar, este conteúdo deve ser anexado em
> `D:\Obsidian\Projeto Prontuário\Histórico de Atualizações.md` como entrada
> `## 2026-06-07 — PANORAMA GERAL`.

## Produto & princípios
**HubPatients** é um **prontuário pessoal de saúde (PHR) brasileiro**, patient-first; público inclui idosos e crônicos. **LGPD + CFM**, PT-BR. Regras inegociáveis: **nunca diagnostica/prescreve**; features de **segurança grátis para sempre**; disclaimers permanentes nas telas de interpretação; nunca rodar migration em produção sem revisão; **segurança antes de feature**.

## Stack & arquitetura
Monorepo **Turborepo + pnpm**:
- `apps/web` — Next.js 15 (App Router), Tailwind v4 (@theme), Framer Motion, Recharts, TanStack Query, Zod + RHF, next-themes, Sonner, lucide.
- `apps/mobile` — Expo.
- `packages/core` — tipo `Database` (mantido à mão), schemas, utils + ~250 testes vitest.
- `packages/supabase` — queries/hooks. `packages/ui-tokens` — tokens.
- **Supabase** real: NewProntuario (`kicbnkzdytfdlnizhczt`). `pnpm check` (lint+typecheck+test) verde a cada bloco. CI no GitHub Actions (qualidade + build + job pgTAP de segurança).

## Banco — 26 migrations (RLS por toda parte)
- **0001–0009** base: perfil, clínico, diário/meds, exames, análise/consultas, consentimento/settings/educação, família/cuidadores.
- **0010–0013** social + fórum + 2 rodadas de hardening (anonimato, anti-elevação de cuidador, Realtime por coluna).
- **0014–0017** Jornadas: gestação, caderneta da criança (+ curvas OMS LMS, 488 linhas oficiais), ciclo menstrual.
- **0018–0021** Medicação Pro: estoque + alertas (pg_cron), bula Anvisa, mapa de dor corporal, tokens de calendário.
- **0022–0024** Comunidade/Fórum: papéis (community_members), estrutura (categorias/tags/busca PT, useful_marks), moderação.
- **0025** Segurança P0. **0026** Vouchers/Plus.
- **Edge Functions**: verify-crm, process-exam, calendar-feed.

## Módulos construídos
- **Prontuário base**: dashboard, perfil (dados, condições CID-10, alergias, cirurgias, antecedentes, convênio), diário clínico (humor/energia/dor/sintomas + sinais vitais), medicamentos (lista, tomadas, adesão, interações), exames (Narrativa de Saúde), consultas, análise.
- **Jornadas de vida** (gestação e ciclo só para perfil feminino): Gestação (timeline trimestral, peso, movimentos, marcos MS), Ciclo (calendário por fase, pausa na gravidez), Crianças (crescimento com percentis OMS, vacinas, marcos).
- **Medicação Pro**: estoque com "acabando", bula oficial Anvisa, mapa de dor 2D (SVG), sync de calendário (.ics/feed ao vivo).
- **Comunidade/Fórum** (S1–S4 code-complete): papéis (Admin/Moderador/Médico verificado/VIP) com `<UserBadge>` (precedência, a11y, tooltip ético); reputação (níveis estilo Discourse); categorias → tópicos → respostas; markdown próprio seguro; busca full-text PT; "resposta útil" (+5); moderação (ocultar/fixar/trancar/advertir → suspensão automática); guardrails de saúde (bloqueia venda de remédio, acolhe crise com CVV 188, modera posologia); regras + onboarding; perfil público (sem dado clínico) + vitrine de médicos.
- **Pessoas / LGPD**: família/cuidadores com permissões, rede social, educação, consentimento (export/exclusão, log de auditoria).

## Topbar funcional
Tema (claro/escuro/sistema), Idioma (cookie + settings + 5 locales), Notificações (dados reais de `notification_queue`, badge de não-lidas com pulso), menu Conta — todos popovers acessíveis.

## Design / UX
- **Acessibilidade (idosos)**: seletor de fonte **A / A+ / A++**, **modo alto contraste**, contraste melhorado, skip link, landmarks ARIA, alvos de toque ≥44px.
- **Biblioteca de componentes**: Badge, Alert, EmptyState, ErrorState, Skeleton, Tabs (animado), Spinner, Button com loading — fim do ad-hoc.
- **Calm UI** + **bento** no dashboard, **onboarding "Comece por aqui"**, rollout nas telas.
- **Notificações modernizadas** (toasts com vidro fosco + ícone por tipo).
- **Sidebar** por seções + busca + item ativo (`startsWith`) + status real (stable/beta).
- **Performance**: `loading.tsx` (skeleton instantâneo na navegação) + cache 2 min (revisita instantânea). Diagnóstico medido: a lentidão é sobretudo **modo dev** (compila on-demand), cascata de queries e `getUser` no middleware; em produção fica 2–3× mais rápido.

## Segurança P0 (auditoria externa) — PROVADO no banco real
0025: triggers anti-escalada (is_pinned/is_locked/hidden/verified_crm), revoke seletivo de funções SECURITY DEFINER (só sistema/gatilho), calendar-feed (cache privado, sem link de teleconsulta, rate-limit), process-exam (só examId, Zod estrito, consentimento auditado), `getSafeNextPath` (anti open-redirect), 2FA (erro tratado, reauth por senha, QR via `<img>`). **5/5 escaladas bloqueadas**, validadas via REST contra o projeto real (403/400/[] esperados) + vitest + pgTAP/CI.

## Plus / entitlement
**Sem Stripe ainda.** 0026 cria `has_plus_access()` do zero + `redeem_voucher()` + `/admin/vouchers` (admin gera) + "Tenho um código" em /planos. Voucher destrava Plus + selo VIP. Regra de negócio: **trial de 90 dias grátis** do plano pago.

## Auth
**Google OAuth — código web pronto** (botões em login/cadastro + rota callback PKCE + `getSafeNextPath`). Falta a **config do provedor** (Google Cloud + Supabase — guia em `docs/auth/google-oauth.md`) e o **fluxo mobile** (Expo). gov.br é placeholder.

## Estado atual & pendências
- **Aplicado no banco**: até **0025** (segurança provada). **Aplicar**: 0026 (vouchers) + criar 1º voucher como admin.
- **Pendente do sprint**: BLOCO 2.1 Google OAuth **mobile**; BLOCO 3 (tokens de acesso de IA: tabela com hash, escopos, `/configuracoes/acesso-ia` com 2FA, endpoint `/api/v1/me` em formato pró-FHIR, flag `ai_assistant_enabled`); BLOCO 4 (`docs/decisao-historico-ilimitado.md` — conflito B2C limites vs B2B dados ilimitados, decisão do cliente).
- **Config do cliente**: Google OAuth (Google Cloud + Supabase); definir o 1º admin (`community_members.staff_role='admin'`).
- **Fase própria**: fórum mobile (Expo); empacotamento Android (Capacitor/TWA) só no fim.
