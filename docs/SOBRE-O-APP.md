# HubPatients — seu prontuário de saúde, no seu bolso

O **HubPatients** é um aplicativo de **prontuário pessoal (PHR)** brasileiro: um lugar
único para a pessoa **guardar, entender e organizar a própria saúde** — remédios,
exames, sinais vitais, consultas, diário de sintomas, saúde da família e muito
mais. Tudo em **português**, com linguagem simples, pensado também para **idosos
e pacientes crônicos**.

> **Importante:** o HubPatients **nunca dá diagnóstico nem prescrição**. Ele organiza
> e explica em linguagem simples — quem interpreta com o contexto completo é
> sempre o seu médico. Avisos permanentes reforçam isso nas telas de saúde.
> Conformidade com **LGPD + normas do CFM**.

---

## 🔐 Acesso e segurança

- **Login** por e-mail/senha ou **conta Google**, com cadastro e **aceite de
  termos (LGPD)**.
- **Desbloqueio por biometria / Face ID** (opcional): trava o app na abertura e
  ao voltar do segundo plano; **timeout por inatividade** trava sozinho.
- **Verificação em duas etapas (2FA/TOTP)** com app autenticador.
- **Proteção contra print/gravação de tela** nas telas com dados de saúde, e a
  tela some no “alternador de apps”.
- Sessão guardada de forma **criptografada** no aparelho; o app usa só a chave
  pública (RLS protege os dados no servidor).

---

## 🏠 Início (Dashboard)

Uma visão geral do dia: saudação, **próximo remédio** (com registro em 1 toque),
**última pressão** com classificação e mini-tendência, **próxima consulta**,
**bem-estar dos últimos 7 dias**, **gráfico de pressão** de 30 dias, **alertas de
alergia grave**, **lembretes de hoje**, “**primeiros passos**” (onboarding) e
ações rápidas. Puxar para atualizar.

---

## 📓 Diário de saúde

- Registro diário de **humor**, **energia** e **dor (escala 0–10)**.
- **Mapa de dor no corpo interativo**: toque a região, escolha intensidade,
  lado e tipo — vira um histórico de dor com **mapa de calor** e detecção de
  migração da dor.
- **7 sinais vitais**: pressão (sistólica/diastólica), frequência cardíaca,
  temperatura, glicemia, peso e saturação (SpO₂).
- **Sintomas** por seleção rápida + anotações livres.
- **Linha do tempo** com filtros (período e sintoma) e os **sinais vitais
  cruzados por data**.

---

## 💊 Medicamentos

- Cadastro de remédios (nome, dose, forma), abas **Ativos/Inativos**.
- **Registro de tomada** (inclusive **arrastando o card** para “Tomei”).
- **Adesão dos últimos 7 dias** com barra animada.
- **Controle de estoque** com aviso de “acabando” e reposição rápida.
- **Checador de interações** medicamentosas (recurso Plus).
- **Aviso de alergia**: se você cadastrar um remédio para o qual tem alergia
  registrada, o app pede confirmação consciente.
- **Lembretes no aparelho** (notificações locais) no horário de cada remédio,
  respeitando o “horário de silêncio”.
- Link para a **bula oficial (Anvisa)**.

---

## 🧪 Exames

- Lista com **filtros** por categoria e período; limite mensal no plano grátis.
- **Envio por foto** (vai para o armazenamento seguro) ou cadastro manual.
- **Detalhe do exame com “narrativa de saúde”**: resumo em 30 segundos,
  **painéis temáticos**, **perguntas para levar ao médico**, e **explicações por
  métrica** (o que mede / por que importa / o que pode significar / converse com
  seu médico), com **faixa de referência** e **gráfico de evolução**.
- **Banner de alerta** factual para valores fora da faixa (sem diagnóstico).

---

## 📈 Análise

Gráficos com **zonas de referência** e **tabelas de dados**: **pressão arterial**,
**glicemia**, **peso + IMC** e **humor/energia**. Estatísticas (média e
tendência) e seleção de período (7/30/90 dias, 1 ano, Tudo — períodos longos no
plano Plus).

---

## 🗓️ Consultas

Agendar (médico, **CRM**, especialidade, data/hora, tipo, local ou **link de
telemedicina**), **lembretes**, **“Entrar na chamada”**, **adicionar à agenda
(arquivo .ics)**, **anotações pós-consulta**, **anexar um exame** e marcar como
realizada/cancelada. Abas Próximas/Passadas.

---

## 👤 Perfil / Prontuário

- Dados pessoais (nome, nascimento, sexo, tipo sanguíneo, altura, **CPF**,
  telefone, **endereço completo**, **observação de emergência**).
- **Convênio**, **alergias** (com gravidade), **condições de saúde + CID-10**,
  **cirurgias** e **antecedentes familiares**.
- **QR Code de emergência** com dados essenciais.
- **Exportar o prontuário em PDF** (plano Plus).

---

## 👶 Crianças

Cadastro de filhos e, no detalhe de cada criança:
- **Curva de crescimento da OMS** (percentis P3–P97) para peso/idade,
  altura/idade, IMC/idade e perímetro cefálico.
- **Vacinas (calendário PNI)**: pendentes, atrasadas e registrar dose.
- **Marcos do desenvolvimento** por categoria.

---

## 🤰 Gestação

Iniciar o acompanhamento (DPP/DUM, risco, obstetra, maternidade), **idade
gestacional** e trimestre, **registro de movimentos do bebê**, **gráfico de ganho
de peso** com a faixa recomendada (IOM), **linha do tempo de marcos** por
trimestre e **contatos de emergência** (ligar para obstetra/maternidade).

---

## 🌸 Ciclo menstrual

Fase atual e previsão, **calendário navegável** com as fases estimadas e
legenda, registro do dia (fluxo, humor, sintomas, notas) tocando em qualquer dia,
e **aviso de privacidade**. Disponível para perfis femininos; pausa durante a
gestação.

---

## 👪 Família e cuidadores

Convidar pessoas (com **tipo de vínculo** e **permissões granulares**) por
**link/convite**, **aceitar convite** (inclusive por link), ver “**quem cuido**”
e “**quem cuida de mim**”, **editar permissões** dos vínculos e acompanhar os
**convites enviados**.

---

## 💬 Comunidade e Rede Social

- **Comunidade** por categorias/condições: criar tópicos, responder (com
  aninhamento), **reações**, **marcar resposta útil**, **seguir tópico** e
  **atualização em tempo real**.
- **Diretório de médicos verificados**, **regras da comunidade** e **perfil
  público** do membro com **nível de reputação**.
- **Rede social** (fórum geral) com **“melhor resposta”**.
- Conteúdo em **Markdown**, selos de **profissional/equipe/assinante**, modo
  anônimo e avisos de segurança (crise).
- **Moderação** (denúncias, ocultar, advertir, fixar, trancar) para a equipe.

---

## 📚 Educação

Conteúdos recomendados conforme suas condições (CID), **glossário** com termos
clicáveis (tocou, explicou), lista de **salvos** e link para as fontes.

---

## 💳 Planos e benefícios

Plano **Free** (com os recursos de segurança **sempre gratuitos**) e **Plus**,
com **resgate de voucher**. Todo usuário começa com um período de avaliação do
plano pago.

---

## 🤖 Acesso de IA ao prontuário

Geração de **token somente-leitura** com **escopos** selecionáveis e validade,
protegido por **reautenticação por senha** — para você conectar assistentes de
forma controlada.

---

## 🩺 Verificação profissional

Profissionais podem solicitar verificação informando **CRM + UF** e **anexando um
documento comprobatório**, com acompanhamento do status.

---

## 🛡️ Privacidade (LGPD)

Central de **consentimentos** por finalidade (com as **categorias de dados** de
cada um), **registro de acessos (auditoria)**, **exportar todos os seus dados**
(arquivo) e **excluir a conta** (com reautenticação).

---

## ⚙️ Configurações

Notificações (push, e-mail, WhatsApp — Plus, **lembretes no aparelho**, horário
de silêncio), **idioma**, **tema Claro/Escuro/Sistema**, acessibilidade, segurança
(biometria, 2FA, sair de outros dispositivos), **calendário externo** (assinar o
feed) e privacidade do ciclo.

---

## ✨ Qualidades que atravessam o app

- **Modo escuro** completo (claro/escuro/seguir o sistema), mantendo a identidade
  visual “warm”.
- **Acessibilidade**: respeita o **tamanho de fonte do sistema** (Dynamic Type),
  rótulos e anúncios para **leitor de tela**, respeito a “**reduzir movimento**”,
  contraste cuidado e **alvos de toque grandes** — pensado para idosos.
- **Micro-interações e fluidez**: resposta tátil ao toque, animações sutis,
  **bottom sheets arrastáveis**, **puxar-para-atualizar**, **deslizar para ações**,
  **toasts** discretos no lugar de pop-ups, e até **confete** ao concluir o dia.
- **Robustez**: nada de “tela branca” (tela de erro amigável), aviso de **sem
  conexão**, e atualizações de correção **sem precisar de nova versão na loja**.
- **Gráficos próprios** leves e animados, e **performance** com memoização
  automática.

---

*Documento gerado a partir do estado atual do app (mobile, Expo). Mantém
paridade com a versão web.*
