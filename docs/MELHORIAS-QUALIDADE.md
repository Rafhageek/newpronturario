# Melhorias de Qualidade/Arquitetura — análise 2026-06-08

Análise por 5 subagentes (skills do projeto + repos populares GitHub + nosso código).
Base sólida confirmada: core com 245 testes (Vitest), CI com RLS pgTAP, segurança
(SecureStore/2FA/biometria/RLS/anon-key), a11y já madura. Abaixo, o que elevar.

## 🐞 Bugs / correções rápidas ✅ (commit c3b1594)
- [x] **Vírgula decimal nos vitais**: normalizado `,`→`.` no diário/perfil/gestação/medicamentos/criança.
- [x] **Apagar arquivos de export de PHI do cache** após share (consentimento, perfil PDF, consultas ICS).
- [x] **`invalidateQueries()` com chave** no pull-to-refresh (index, diário, medicamentos, exames, consultas, família, perfil).
- [x] **ErrorState** nas telas principais (index, medicamentos, exames, consultas, família, crianças, análise).

## 🔴 Robustez & Observabilidade
- [x] **ErrorBoundary global** (expo-router) + ErrorFallback amigável + logger (c3b1594).
- [x] **Política de retry/backoff** do React Query (só rede/5xx; mutations sem retry) (c3b1594).
- [x] **expo-updates (OTA)** configurado (runtimeVersion appVersion + channels no eas.json).
- [ ] **Crash reporting Sentry** com scrubbing de PHI — ADIADO p/ fase do APK (módulo nativo; não vale em Expo Go; fazer guardado p/ não vazar PHI/LGPD).
- [ ] **Offline (NetInfo) + banner** — fazer na Onda Q3 (Performance), junto com a detecção de conexão.

## 🔐 Segurança & PHI ✅ (Q2 — commit pendente)
- [x] **expo-screen-capture**: hook `useScreenGuard` bloqueia print/gravação + oculta no app switcher nas telas de PHI (perfil, diário, exames, exame, criança, acesso-IA, consentimento).
- [x] **Timeout por inatividade** (5 min, PanResponder no _layout) → re-trava via LockScreen quando a biometria está ligada.
- [ ] **Root/jailbreak awareness** (jail-monkey/expo-device) — avisar + desabilitar export/QR. (precisa dev-client/EAS)
- [ ] **Certificate pinning** Supabase (avaliar custo×benefício; só dev-client/EAS).
- [ ] **Deep links**: validar formato do token antes da RPC; nunca logar URL completa.
- [ ] **`pnpm audit` no CI** (supply chain).

## ⚡ Performance & Arquitetura (Q3 — parcial)
- [x] **React Compiler** ativado (experiments.reactCompiler + babel-plugin-react-compiler) — memoização automática em todo o app, corta re-renders em cascata.
- [x] **Offline (NetInfo) + onlineManager do React Query** + banner "sem conexão" global (refetch automático ao reconectar).
- [ ] **FlashList** nas listas — ADIADO (listas são limitadas no servidor 30–200; React Compiler já cobre os re-renders; migração é grande e o módulo nativo precisa de cuidado no Expo Go). Fazer se medirmos lag real.
- [ ] **useInfiniteQuery** no feed/timeline; quebrar telas gigantes; enableFreeze — follow-up.

## 🧪 Testes & CI/CD (Q4 — parcial)
- [x] **Playwright web no CI** — novo job `e2e-web` (sobe next dev, roda os 3 specs, guarda report) + `concurrency` (cancela runs antigos).
- [x] **Jest (jest-expo) + RNTL no `apps/mobile`** — harness configurado (corrigido transformIgnorePatterns p/ pnpm + peer `test-renderer`); 3 testes-semente verdes; entra no `pnpm check` (turbo).
- [x] **Workflow EAS** `.eas/workflows/build.yml` (build APK preview, disparo manual).
- [ ] **Testar hooks de `@hubpatients/supabase`** (renderHook + client mockado) — follow-up.
- [ ] **Maestro e2e** mobile (login→medicamento→tomada) — follow-up.

## 🩺 EMR clínico & A11y (skills: healthcare-emr-patterns, frontend-a11y)
- [x] **Lembretes locais REAIS** (`expo-notifications`) de medicação (toggle nas Configurações; reagenda ao mudar meds; respeita quiet hours) + consulta (Q2).
- [x] **Medicamento × alergia** cross-check no cadastro (Alert com acknowledgment, não-diagnóstico) (Q2).
- [ ] **Alt textual nos gráficos** (SVG sem accessibilityLabel → invisível p/ TalkBack); levar DataTable ao dashboard/exame.
- [ ] **Modo simplificado/cuidador** (texto gigante + alto contraste in-app, persistido) — hoje só encaminha ao SO.
- [ ] **TTS** (`expo-speech`) p/ ler narrativa do exame/insight/educação.
- [ ] **Faixa de referência em TODOS os vitais** (glicemia/FC/SpO₂/temp/peso, não só PA) via `classifyVital` no core.
- [ ] **Acknowledgment** em alertas clínicos (não toast auto-dismiss); aria-live.
- [ ] **Cabeçalho clínico sticky** (alergias/condições) em medicação/exame.
- [ ] **Timeline clínica unificada** (diário+exames+consultas+medicação por data).
- [ ] **Export FHIR R4** (interoperar com médico/RNDS), além do PDF.
