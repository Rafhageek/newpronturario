# Benchmark de Rastreamento & Bem-estar — HubPatients (2026-07-13)

> Pesquisa multi-agente (plataformas de saúde, micro-trackers/wellness, GitHub OSS).
> Foco: a dimensão quantified-self (Apple Saúde / Google Fit) adaptada a **idoso/crônico** —
> não virar app fitness. Refs: Apple Health Trends/State of Mind, Withings, Garmin, Samsung,
> WaterMinder/Waterllama, uhabits, Daylio, + libs RN.

## A tese (como encaixa na identidade)

Inverter o gesto do quantified-self: em vez de pedir ao idoso para **produzir** mais números
(modo Strava), o HubPatients passa a **colher** o que o corpo e os aparelhos dele já geram e
**traduzir** em autocuidado — **seta** em vez de curva, "está melhorando" em vez de dispersão,
metas gentis (5–7 mil passos, não 10 mil), anel que perdoa dias ruins, hidratação com **teto**
para cardiopata/renal. Tudo carrega "estimativa / observação / converse com seu médico".

## QUICK WINS OTA (só JS, entregáveis hoje — por impacto)

1. **Tendências com setas em linguagem simples** — sobre os gráficos que já existem: seta ↑/↓ + frase ("Sua pressão vem melhorando nos últimos 3 meses"), ~90d vs base longa. O idoso não lê dispersão — quer saber "melhor ou pior?". *Apple Health Trends. Baixo–médio.*
2. **Constância Gentil 2.0** — evoluir o índice atual com a fórmula de "força do hábito" do `iSoron/uhabits` (repetição fortalece, falha enfraquece suave) + modo descanso + celebração igual para o mínimo e o grande. *uhabits, Finch, Gentle Streak. Médio.*
3. **Mapa do ano do humor (year-in-pixels)** — o humor já é coletado no diário; falta a visualização: calendário‑mosaico colorido por emoção, padrões sazonais num relance. Zero coleta nova. *Daylio; react-native-calendar-heatmap. Baixo.*
4. **Correlações em linguagem simples** — minerar o diário (humor/energia/dor/vitais/sono) e mostrar observações **não‑causais**: "dias com mais passos → melhor humor". *Apple State of Mind. Médio.*
5. **Água em 1 toque, meta clínica + trava** — botão "bebi um copo" (250ml), meta por peso/idade (**25 ml/kg a partir de 65 anos**), nos lembretes locais. **Crítico:** modo "teto" para IC/DRC ("confirme seu limite com a equipe"). *WaterMinder; HydroTracker. Baixo.*
6. **Respiração guiada lenta (~6 rpm)** — círculo que expande/contrai (inspire/segure/expire), 1–3 min, 1 toque, registra na Constância. Disclaimer: "relaxamento, não substitui medicação". *Apple Breathe. Baixo–médio.*
7. **Peso com tendência suavizada + red-flags gentis** — média móvel (não o ruído diário) + IMC, sinal gentil para ganho rápido (retenção/IC) e perda não intencional (fragilidade). *Withings Trajectory. Baixo.*
8. **Check-in / Relatório da manhã** — card matinal prospectivo (sono, remédios e consultas do dia + 1 dica), distinto do resumo semanal (retrospectivo). *Garmin Morning Report; Samsung Energy Score. Médio.*

*Vice-campeões OTA: semáforo sal/açúcar/hidratação; sono 2 toques + correlação com PA; nudge anti-sedentarismo; time-in-range de glicemia; minutos OMS 150/sem.*

## PRECISA DE APK NOVO (agrupar num único build)

1. **Ponte HealthKit + Health Connect ("Conectar meu relógio") — a alavanca-mãe** — importa passos, FC, sono, PA, SpO2, glicemia, peso do Apple Saúde / Health Connect direto para os 7 vitais + diário, **sem digitar**. Resolve a causa nº 1 de abandono. Usar `xmartlabs/react-native-health-link` (une health + health-connect). **Não usar Google Fit (descontinuado 2025).** Consentimento granular na central LGPD. *Alto.*
2. **Pedômetro em background** (para quem não tem wearable) — `expo-sensors` só dá 7 dias e não roda em background. `expo-android-pedometer` + Core Motion. *Médio.*
3. **Widgets de tela inicial + complicações de relógio** — registrar água/remédio/humor **sem abrir o app** + atalho por Siri/Assistant. WidgetKit / App Widgets (nativo). *Médio.*
4. **Estabilidade de marcha / risco de queda** — ler *Walking Steadiness* do HealthKit, sinalizar declínio, avisar o cuidador (módulo família já existe). Só leitura, embarca na ponte. 7k passos/dia ≈ 28% menos quedas. *Médio.*
5. **Motor de gráficos premium (opcional)** — Skia (`react-native-graph`, `victory-native-xl`) só se a estética justificar. **Recomendado:** começar por `react-native-gifted-charts` (JS puro, OTA) e só migrar se precisar.

*Ativa por OTA assim que o build entrar: diário auto-preenchido, anéis reais, FC de repouso com baseline, índice de prontidão, ingestão de balança/oxímetro Bluetooth (via a ponte).*

## Top 5 recomendações (sequência)

1. **Disparar o lote Quick Wins OTA agora** — começar por **Tendências com setas** (maior impacto/esforço, reaproveita gráficos) + **Constância Gentil 2.0** (diferencial de marca).
2. **Fechar UM build nativo** com a **ponte HealthKit + Health Connect** no centro (+ pedômetro + widgets + walking steadiness num envio só). Planejar o consentimento LGPD antes.
3. **Enquanto compila**, entregar por OTA as de **risco clínico**: água com trava DRC/IC + peso com tendência/red-flags (funcionam com dado manual).
4. **Quando o APK sair**, ativar por OTA a camada dependente: **diário auto-preenchido, anéis gentis, FC de repouso com baseline**.
5. **Adiar (não cortar) Skia** — começar por gifted-charts (JS/OTA); só migrar se a performance visual pesar.

*(Pesquisa bruta com URLs: workflow `wf_88132f6f-bc4`, sessão 2026-07-13.)*
