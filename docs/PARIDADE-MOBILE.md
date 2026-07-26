# Paridade Mobile ↔ Web — Backlog (auditoria 2026-06-08)

Fechar TODOS os gaps em ondas priorizadas (decisão do usuário: "tudo, em ondas").
Camada de dados é compartilhada (`@hubpatients/supabase`) — quase todo gap é UI não-portada.
Marcar `[x]` ao concluir cada item (validado com `tsc --noEmit` + `expo export` e commitado).

## Onda A — Segurança & Conformidade ✅ (commit pendente)
- [x] Cadastro: checkbox real de aceite de termos LGPD (`acceptedTerms`, sem hardcode)
- [x] acesso-ia: reautenticar senha antes de gerar token (igual web)
- [x] Configurações: seção 2FA/TOTP (enroll QR, verificar, desativar com reauth)
- [x] verificacao-profissional: upload de documento (bucket `professional-docs`) + chamar `verify-crm`
- [x] Diário: validar com `diaryEntrySchema` (regra PA pareada)
- [x] Moderação: gating alinhar à web (admin/moderator) + tiles do "Mais" por papel

## Onda B — Saúde infantil (criancas/[id]) ✅
- [x] Curva de crescimento OMS (P3–P97 + seletor wfa/lhfa/bfa/hcfa) — componente WhoGrowthChart em SVG
- [x] Aba Vacinas (calendário PNI, pendentes/atrasadas/registrar) — nextDueVaccines + useRecordVaccine
- [x] Aba Marcos (catálogo por categoria, marcar/desmarcar) — useMilestoneCatalog/useChildMilestones/useMarkMilestone
  - nota: marcos marcam com data=hoje (web abre date-picker p/ dia exato)

## Onda C — Profundidade Diário & Exame ✅
- [x] Diário: mapa de dor INTERATIVO (tocar região → AppSheet intensidade/lado/tipo/nota → `useAddPainPoints`) + 7 sinais vitais (FC/temp/SpO₂) + multiselect de sintomas (chips) + dor 0–10
- [x] Exame detalhe: banner crítico + resumo 30s + painéis temáticos + perguntas pro médico + explicações por métrica (`useExplanations`)
  - nota: sem ditado por voz; acordeões sem animação de altura (web usa framer-motion)

## Onda D — Telas faltantes (Tier 0) + social ✅ (Markdown adiado p/ G)
- [x] comunidade/medicos (diretório de médicos verificados, useCommunityDoctors)
- [x] comunidade/regras (6 regras + CRISIS_NOTICE)
- [x] comunidade/u/[id] (perfil público + reputação + stats + UserBadge)
- [x] familia/aceitar (rota = deep link `hubpatients://familia/aceitar?token=`; accept por token)
- [x] Comunidade/Rede social: seguir tópico + realtime + "melhor resposta" + UserBadge completo + link p/ perfil do autor
- [ ] (adiado p/ Onda G) render Markdown nos posts/respostas (hoje texto puro)

## Onda E — Família, Consultas, Ciclo (Tier 2) ✅
- [x] Família: tipo de vínculo (kind), editor de permissões (convite + vínculo), link de convite, convites enviados, confirmar remoção; botão "X" stub removido
- [x] Consultas: CRM, link telemedicina + "Entrar na chamada", lembretes, ICS (adicionar à agenda), notas pós-consulta, anexar exame
  - nota: ICS via Share.share (expo-sharing não instalado → ideal seria FileSystem+Sharing; ver Onda G)
- [x] Ciclo: guardas (sexo/gestação), PrivacyBanner, calendário navegável com fases + legenda, registrar dia escolhido (AppSheet), humor/sintomas/notas, erro+retry

## Onda F — Configurações & Consentimento (Tier 2) ✅
- [x] Configurações: gate Plus no WhatsApp, instruções de calendário (Google/Apple/Outlook), "ciclo médio (dias)" (15–60)
- [x] Configurações: acessibilidade → atalho "Abrir ajustes do sistema" (mobile defere fonte/contraste ao SO = padrão correto; já respeita Dynamic Type). NÃO foi construído motor in-app de fonte/contraste (anti-padrão mobile).
- [x] Consentimento: exportar ARQUIVO JSON real (useExportData + FileSystem + Share), chips de categorias por escopo (CONSENT_SCOPES/DATA_CATEGORY_LABELS)
  - nota: Share do Android não anexa arquivo (sem expo-sharing) → instalar expo-sharing na Onda G p/ ICS + export ideais

## Onda G — Tier 3 (cosméticos/menores)
### G-core (sem deps novas) ✅
- [x] Remédios: link bula Anvisa (resolveBulaUrl + ANVISA_EXIT_NOTICE)
- [x] Dashboard: insight da semana (Plus), setup checklist, lista de lembretes de hoje
- [x] Perfil: CPF (profileSchema), endereço completo, observação de emergência + tags convênio/alergias no header (PDF → G-deps)
- [x] Diário: filtros (período 7/30/90/Tudo + sintoma), vitais na timeline (useVitalsAllRange)
- [x] Análise: tabelas de dados sob gráficos + período "Tudo" (gated Plus)
- [x] Login/Cadastro: mostrar/ocultar senha (Eye) + botão gov.br
- [ ] (opcional) derivar listas hardcoded de planos do core — baixa prioridade
### G-deps (libs novas) ✅
- [x] Markdown nos posts/respostas (react-native-markdown-display) — componente src/components/markdown.tsx
- [x] expo-sharing: ICS (consultas) + export JSON (consentimento) compartilham arquivo de verdade
- [x] Perfil: exportar PDF (expo-print, gated Plus) → Sharing

---
## STATUS: paridade Tier 0→3 fechada. Pendências menores (opcionais):
- Markdown no PREVIEW do composer (ao escrever) — só render no display foi feito
- Derivar listas de benefícios de planos do core (hoje curadas à mão)
- Marcos infantis: date-picker do dia exato (hoje marca = hoje)
- Ditado por voz no diário (web tem; não portado)
PRÓXIMO: APK via EAS Build.
