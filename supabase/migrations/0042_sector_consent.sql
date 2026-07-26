-- ============================================================================
-- HubPatients — Migration 0042 — Consentimento por SETOR
--
-- O QUE FAZ
--   Amplia `consent_purpose` para o titular poder autorizar, setor por setor,
--   quem pode acessar seus dados: pesquisa acadêmica, indústria farmacêutica,
--   farmácias, hospitais e órgãos públicos de saúde.
--
--   Só isto: valores de enum. A leitura continua sendo `select` em `consents`
--   (RLS já restringe ao titular) e a escrita continua pelo RPC
--   `set_patient_consent`. Nenhuma função nova referencia os valores criados
--   aqui — em PostgreSQL um valor de enum recém-adicionado não pode ser usado
--   na MESMA transação, então misturar as duas coisas quebraria a migração.
--
--   NÃO existe nenhum fluxo de saída de dados nesta migração. Aqui só se
--   REGISTRA a decisão do titular. Enquanto não houver convênio formalizado
--   com um parceiro, nada é enviado a lugar nenhum — e a tela diz isso ao
--   usuário com essas palavras, para não prometer o que não acontece.
--
-- BASE LEGAL / LGPD  (obrigatório ler antes de mexer aqui)
--   Dado de saúde é dado pessoal SENSÍVEL (art. 5º, II). O art. 11 restringe
--   o compartilhamento muito além do consentimento comum, e há DUAS vedações
--   que este desenho respeita de propósito:
--
--   · art. 11, §4º — é VEDADA a comunicação ou uso compartilhado, entre
--     controladores, de dado sensível de saúde COM OBJETIVO DE OBTER VANTAGEM
--     ECONÔMICA. As exceções são fechadas: prestação de serviços de saúde,
--     assistência farmacêutica e assistência à saúde, "em benefício dos
--     interesses dos titulares", mais (I) portabilidade a pedido do titular e
--     (II) as transações financeiras e administrativas decorrentes da própria
--     prestação do serviço.
--     CONSEQUÊNCIA DE PROJETO: não existe, e não deve existir, mecanismo que
--     dê desconto/benefício EM TROCA de dado clínico identificável. Isso não é
--     escolha de produto, é vedação legal — e consentimento não a destrava,
--     porque §4º é proibição, não base legal que o consentimento supre.
--
--   · art. 11, §5º — é VEDADO à operadora de plano de saúde tratar dado de
--     saúde para SELEÇÃO DE RISCO na contratação, e na contratação/exclusão de
--     beneficiários.
--     CONSEQUÊNCIA DE PROJETO: o setor de convênio existe SÓ para reembolso e
--     autorização de procedimento (a exceção do §4º, II). O texto na tela
--     afirma ao titular que a autorização não pode alterar preço nem
--     cobertura. Nunca transformar isso em "desconto por dados".
--
--   Pesquisa: o caminho lícito é ANONIMIZAÇÃO. Dado anonimizado não é dado
--   pessoal (art. 12), então sai do escopo da lei; e o art. 11, II, "c"
--   admite estudo por órgão de pesquisa "garantida, sempre que possível, a
--   anonimização". Por isso os setores de pesquisa aqui são marcados como
--   agregado/anonimizado no catálogo do app (packages/core), e o convite a
--   estudo é apenas AVISO ao titular — quem procura o pesquisador é ele.
--
--   Órgão público: quando há obrigação legal ou tutela da saúde por autoridade
--   sanitária (art. 11, II, "a"/"b" e art. 7º, II/III), o envio não depende de
--   consentimento. O toggle aqui cobre o que é VOLUNTÁRIO (ex.: contribuir com
--   painel epidemiológico municipal), nunca o que já é compulsório por lei.
--
--   Ética, além da lei: nosso público é idoso, crônico e de baixa renda.
--   Oferecer vantagem econômica a quem depende de medicamento, em troca de
--   dado clínico, contamina o "consentimento livre" do art. 8º. A ausência
--   desse mecanismo é uma decisão consciente, não um recurso faltando.
--
-- REVOGABILIDADE E PROVA
--   Nada de novo é preciso aqui: `set_patient_consent` (migração 0032) já
--   fazia upsert em `consents` E gravava `audit_log` com purpose/granted/
--   version a cada mudança. Isso é a prova de consentimento (art. 8º, §1º) e
--   o histórico de revogação (art. 8º, §5º). Esta migração só acrescenta os
--   setores e a função de leitura.
-- ============================================================================

-- 1) Setores novos -----------------------------------------------------------
-- `if not exists` mantém a migração idempotente (mesmo padrão da 0007).
alter type consent_purpose add value if not exists 'research_academic';
alter type consent_purpose add value if not exists 'research_pharma';
alter type consent_purpose add value if not exists 'data_sharing_pharmacy';
alter type consent_purpose add value if not exists 'data_sharing_hospital';
alter type consent_purpose add value if not exists 'data_sharing_public_health';
alter type consent_purpose add value if not exists 'study_invitations';

comment on type consent_purpose is
  'Finalidades de consentimento. Setores de compartilhamento respeitam LGPD art. 11: '
  'pesquisa só em base anonimizada/agregada (art. 12 e art. 11, II, c); convênio só '
  'para reembolso/autorização (art. 11, §4º, II) e NUNCA para seleção de risco '
  '(art. 11, §5º); jamais benefício econômico em troca de dado clínico (art. 11, §4º).';
