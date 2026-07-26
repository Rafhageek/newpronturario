# Decisão de negócio — histórico/medicamentos ilimitados (B2C vs B2B)

> **Para o dono do produto decidir.** Não implementamos nada aqui — este
> documento existe porque há um **conflito estratégico** real entre duas falas
> suas, e a escolha muda a arquitetura de monetização.

## O conflito
- **18/05 — visão B2B:** "histórico e medicamentos **ilimitados** são o
  diferencial para atrair patrocinadores (laboratórios, farmácias)". Quanto mais
  dado consentido, mais valor para parceiros.
- **Estratégia Free/Plus atual — B2C:** o app **limita** para converter ao Plus
  (hoje: histórico do diário/análise em janelas e **3 medicamentos** no Free;
  upload de exames limitado/mês). Limite = gatilho de upgrade.

Os dois puxam para lados opostos: **limitar para vender assinatura** vs
**liberar tudo para captar dados/base**.

## Opção A — B2C (assinatura, com limites) — *estado atual*
**Como é:** Free limitado; Plus paga pra liberar histórico, medicamentos, OCR,
interações, WhatsApp.

| Prós | Contras |
|---|---|
| Receita recorrente direta (MRR) previsível | Limite atrita logo no começo → menos retenção/base |
| Modelo conhecido, fácil de comunicar | Menos dado consentido → proposta B2B mais fraca |
| Não depende de fechar parceiros | Converte só quem paga (no Brasil, conversão de saúde é baixa) |

## Opção B — B2C-grátis + B2B (dados consentidos, tudo ilimitado)
**Como é:** histórico/medicamentos **ilimitados de graça**; monetiza com receita
**B2B de dados anonimizados consentidos** (labs, farmácias, pesquisa).

| Prós | Contras |
|---|---|
| Base cresce rápido (sem atrito) → mais dado → mais valor B2B | Receita depende de **fechar parceiros** (ciclo longo, incerto) |
| Alinha com sua visão de patrocinadores | LGPD/CFM: exige consentimento robusto, anonimização, governança |
| Diferencial de marketing ("seu histórico, sempre, de graça") | Sem MRR no começo → fluxo de caixa mais arriscado |

## Opção C — HÍBRIDO (recomendado avaliar)
**Tese:** **histórico e medicamentos ilimitados de graça** (atrai base e dado) +
monetização **por conveniência e B2B**, não por limite de dado:
- **Grátis sempre:** registro ilimitado de medicamentos, histórico ilimitado,
  segurança (já é grátis), comunidade.
- **Plus pago (conveniência, não limite):** OCR de exames por IA, lembretes por
  WhatsApp, interações medicamentosas, relatórios PDF, **assistente de IA**,
  insights — coisas que **custam** (IA/infra) ou dão comodidade.
- **B2B:** receita de dados anonimizados **consentidos** (opt-in real), e o
  **voucher/VIP** já pronto serve para cortesia a parceiros/investidores.
- **Ponte já construída:** `has_ai_assistant_access()` libera o assistente de IA
  para **quem é Plus OU quem compartilha dados** — exatamente a mecânica
  "compartilhou → ganhou benefício".

Assim você **não limita o dado** (mantém a visão B2B) e ainda tem **MRR** pela
conveniência. Limite vira "features que custam", não "seu próprio histórico".

## Impacto estimado (qualitativo)
| Escolha | MRR (assinatura) | Captação de dados | Risco de caixa | Esforço de mudança |
|---|---|---|---|---|
| A — B2C limites | **Alto** (direto) | Baixo | Baixo | Nenhum (atual) |
| B — B2B grátis | Baixo (curto prazo) | **Alto** | Alto | Médio (remover limites + governança B2B) |
| C — Híbrido | Médio (conveniência) | **Alto** | Médio | Médio (mover paywall de "dado" → "conveniência") |

## O que muda no código conforme a escolha
- **A:** nada (já é assim).
- **B/C:** remover os limites de histórico/medicamentos no Free (constantes
  `FREE_MEDICATION_LIMIT`, janelas de histórico) e **repaginar** o paywall do
  Plus para conveniência (OCR, WhatsApp, IA, relatórios). O entitlement já existe
  (`has_plus_access` via voucher); o assistente de IA já tem a flag de
  elegibilidade. A governança B2B (anonimização/consentimento) é trabalho à parte.

## Recomendação
**Avaliar a Opção C (híbrido).** Ela honra a sua tese de "dados ilimitados atraem
patrocinadores" **sem** abrir mão de receita: o paywall sai de "seu histórico" e
vai para "features que custam dinheiro (IA/WhatsApp/OCR) + B2B de dados
consentidos". É a que melhor combina **crescimento de base**, **valor B2B** e
**MRR**. Mas a decisão é sua — principalmente o apetite por **fechar parceiros
B2B** (Opção B/C) vs **receita de assinatura imediata** (Opção A).

**Pergunta-chave para você responder:** o produto vive primeiro de **assinatura
(B2C)** ou de **dados consentidos (B2B)**? A resposta define A vs C.
