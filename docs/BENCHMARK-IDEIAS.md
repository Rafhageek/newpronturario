# Benchmark & Ideias — HubPatients (2026-07-13)

> Pesquisa multi-agente (6 pesquisadores + 1 sintetizador, ~150 buscas/fetches):
> **apps globais** (Apple Health, Samsung, MyChart, Medisafe, Ada, Fasten…), **apps brasileiros**
> (Meu SUS Digital/RNDS, Dasa, Memed, Farmácia Popular…), **open-source no GitHub**
> (fasten-onprem, Medplum, Nightscout, uhabits…), **tendências visuais**, **engajamento ético**
> e **IA compatível com a nossa ética** (nunca diagnostica/prescreve).
> Cada pesquisador recebeu o inventário do que o app JÁ TEM — as ideias abaixo são GAPS.

**Fusões (dedupe):** relatório PDF para o médico apareceu em 5 das 6 pesquisas → 1 item ("Pacote
Consulta"); timeline unificada (2x), resumo semanal (4x), baseline pessoal/insights (4 fontes),
cartão de emergência QR (2x), bula didática (3x), streak gentil (3x), widgets (3x), wearables (2x).

**Cortados por ética/viabilidade:** triagem de urgência "para onde ir" (risco SaMD, RDC 657/2022);
gravação de áudio de consulta (risco jurídico); bot WhatsApp Business (custo/aprovação Meta);
login gov.br (credenciamento); nutrição com barcode (escopo); conectores hospitalares (sem API
aberta); mascote ilustrado (custo desproporcional agora).

---

## QUICK WINS OTA (esforço baixo/médio, sem novo APK, por impacto)

1. **Pacote Consulta: "Prepare-se" + Relatório "Leve ao Médico"** — 48h antes da consulta, card
   com o que mudou + 3-5 perguntas sugeridas editáveis; PDF de 1-2 páginas (medicamentos, adesão,
   mini-gráficos, alergias) com fonte grande, compartilhável por WhatsApp; pós-consulta, campo
   "o que o médico disse" com atalho p/ atualizar medicamentos. Responde ao "por que registrar?".
   *Inspiração: Medisafe, CareClinic, Tidepool AGP, Hedy. Esforço: médio.*
2. **Cadastro de medicamento por foto + cofre de receitas** — reusar o pipeline foto→Claude dos
   exames para ler receita/caixa e pré-preencher o cadastro (confirmação obrigatória; transcreve,
   nunca interpreta). "Minhas receitas" guarda PDF/foto + alerta de validade + validador ITI.
   *Inspiração: Memed, Cuco Health. Esforço: médio.*
3. **Check-in "Estou bem" + alertas de exceção ao cuidador** — botão grande diário; sem toque até
   o horário → push aos cuidadores autorizados (diário conta como check-in). Cuidador assina
   alertas por exceção (adesão < X%, estoque, N dias sem registro), com consentimento + log LGPD.
   Grátis para sempre (regra de segurança). *Inspiração: Snug Safety, Medisafe Medfriend. Esforço: médio.*
4. **Timeline "Minha História"** — feed cronológico único (exames, consultas, mudanças de
   medicação, diário, marcos) com filtros; fundação para relatório, resumo semanal e modo cuidador.
   *Inspiração: Fasten Health, Epic Happy Together. Esforço: médio.*
5. **Insights de baseline pessoal ("estatística detecta, IA redige")** — baseline móvel 30-60d por
   métrica; motor determinístico acha desvios/correlações; Claude só redige em PT-BR simples.
   Nunca limiar populacional, nunca causa, selo "estimativa" fixo (CFM 2.454/2026).
   *Inspiração: Apple Health Trends, Hello Heart (JAHA). Esforço: médio.*
6. **"Sua Semana de Saúde" + Boletim do Cuidador** — digest de domingo (card + push/e-mail) em
   linguagem simples, sempre 1 destaque positivo verdadeiro; versão para cuidador respeitando
   permissões; card-imagem para WhatsApp da família. *Inspiração: Withings Weekly; RCT WhatsApp
   Maringá-PR. Esforço: médio.*
7. **Constância Gentil** — escore exponencial de constância (perder 1 dia nunca zera), 1-2 folgas
   semanais embutidas, botão "pausar sem culpa" (internação/luto/viagem), micro-celebração de ~1s
   com frase adulta ("seu médico terá 30 dias de histórico"), marcos sóbrios (6 meses registrados).
   *Inspiração: uhabits, Gentler Streak, streak-freeze +48% persistência. Esforço: baixo/médio.*
8. **"Advogado financeiro" de medicamentos** — badge "grátis na Farmácia Popular" (+ farmácias
   credenciadas no mapa), preço-teto CMED + genéricos mais baratos (planilha Anvisa mensal),
   programas de desconto de laboratório. Economia real para aposentados; nenhum concorrente entrega
   junto. *Esforço: baixo/médio.*
9. **Cartão de emergência com QR (ID Médico)** — tela de 1 toque, PDF tamanho carteira e QR com
   página pública mínima (opt-in campo a campo, acessos no log LGPD), botão 192. Grátis por
   princípio. *Inspiração: Apple Medical ID, SOS QR. Esforço: médio.*
10. **Camada de letramento** — bula em linguagem simples gerada 1x por medicamento e cacheada
    (ancorada no Bulário Anvisa), glossário inline em popover, seletor de complexidade espelhando
    A/A+/A++; explica interações com pergunta pronta para o médico — nunca "pare de tomar".
    *Esforço: médio.*

## APOSTAS GRANDES (alto impacto, esforço alto)

1. **Widgets de home/lock screen ("Tomei" em 1 toque)** — maior ganho isolado de adesão. ⚠️ **APK novo.**
2. **Wearables via Health Connect + HealthKit** — passos/sono/FC/PA preenchendo os dias sem registro
   manual; exige declaração no Google Play (~2 semanas). ⚠️ **APK novo.**
3. **Chat "Pergunte ao seu prontuário" + sistema imunológico de IA** — antes do chat, a infra que
   protege tudo: red flags determinísticos (emergência nunca passa pela IA), pseudonimização,
   selo "✦ Gerado por IA", trilha de usos de IA na central LGPD. Depois, RAG de escopo fechado
   ("quando foi minha última vacina?"), recusa padrão para diagnóstico. *OTA (backend + UI JS).*
4. **Jornada 60+** — Caderneta da Pessoa Idosa (6ª ed. jan/2026, sem versão digital do MS — janela
   para ser o primeiro), IVCF-20 como estimativa educativa, quedas, alerta educativo de polifarmácia,
   vacinas do adulto (SBIm) + importação do PDF do Meu SUS Digital via pipeline Claude. *OTA em fases.*
5. **Modo cuidador "watcher" com reconhecimento** — 1º cuidador que toca "estou cuidando disso"
   silencia os demais; sem reconhecimento em X min, escalona. Padrão Nightscout (73k forks);
   nenhum concorrente BR tem. *UI OTA; push avançado pode exigir build.*
6. **Compartilhamento temporário por código (estilo Epic Share Everywhere)** — código de 6-8 dígitos
   válido ~60 min abre snapshot somente-leitura para qualquer médico; acesso no log LGPD. *OTA.*

## VISUAL / POLIMENTO (todos OTA)

1. **Faixas de zona coloridas nos gráficos + linha "seu alvo"** (evidência clínica; esforço baixo)
2. **Hero "Hoje em 5 segundos" + Anel do Dia** (trio de anéis Medicação/Registro/Bem-estar em
   coral/royal; vira a assinatura visual e a base do futuro widget)
3. **"Número gigante primeiro" nos tiles** (48-64pt + seta de tendência + frase; padrão age-friendly)
4. **Dark mode inclusivo** (texto #E8EAF0 anti-halation, 3 níveis de superfície por luminância,
   coral/royal recalibrados por superfície)
5. **Fonte Atkinson Hyperlegible Next** como toggle "Leitura Fácil" (baixa visão; asset via OTA)
6. **Pillbox visual em quadrantes** (manhã/tarde/noite/madrugada — modelo mental da caixinha física)
7. **Empty states como mini-onboarding + skeletons com formas reais**
8. **Guardrails de entrada + hápticos nomeados** (faixas de plausibilidade por vital + 5 padrões
   de vibração, sempre desligáveis)

## Top 5 recomendações (ordem de execução sugerida)

Contexto: 1 cliente real via APK, OTA disponível, paridade web+mobile obrigatória.

1. **Pacote Consulta** — citado por 5 dos 6 pesquisadores; 100% OTA; o artefato tangível que
   responde "por que registrar?" — e o médico que recebe o PDF vira promotor do app.
2. **Pacote visual de legibilidade** (faixas de zona + número gigante + dark inclusivo) — uma tarde
   de trabalho cada, evidência clínica, e é a melhoria que o cliente *nota* no dia seguinte.
3. **Cadastro de medicamento por foto** — elimina a maior fricção reusando pipeline existente.
4. **Constância Gentil** — a mecânica de retenção inteira, alinhada à ética (um dia ruim nunca zera).
5. **Check-in "Estou bem"** — resolve a angústia nº 1 de quem tem pai/mãe sozinho; gancho que traz
   o cuidador (quem paga o Plus) para dentro do produto.

**Sequência:** visual → Pacote Consulta → foto de medicamento → Constância → Check-in; Timeline
"Minha História" logo em seguida (fundação dos resumos). Widgets + wearables (APK novo) entram
num único build planejado, junto com a declaração do Health Connect no Google Play.

---

*Pesquisa bruta completa (6 relatórios com URLs): journal do workflow `wf_7b5de05f-222` na sessão
de 2026-07-13. Este documento é a síntese deduplicada e priorizada.*
