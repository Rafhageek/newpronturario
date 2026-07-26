# Auditoria multidisciplinar — Projeto Prontuário (HubPatients)

**Data da auditoria:** 25/07/2026  
**Escopo:** aplicação web, aplicativo mobile, domínio compartilhado, Supabase/PostgreSQL, Edge Functions, segurança, privacidade, acessibilidade, qualidade, produto e experiência.  
**Método:** inspeção estática do repositório, execução de validações locais, pesquisa em fontes oficiais e benchmarking público.  
**Natureza:** relatório técnico e de produto; não constitui parecer jurídico, médico ou certificação de conformidade.

## Premissas e limites

- O produto encontrado no código é um **prontuário pessoal de saúde (PHR) centrado no paciente**, e não um prontuário eletrônico institucional (EMR/PEP) completo. Não há hoje modelo de clínica/organização, vínculo profissional assistencial, encontro clínico assinado, bloqueio/adendo ou isolamento multiempresa.
- Recomendações do CFM, guarda de prontuário institucional, telemedicina, assinatura de documento médico e S-RES são classificadas como **condicionais ao caso de uso** quando o produto não exerce aquela função.
- Nenhum segredo, arquivo de ambiente ou dado real de paciente foi lido ou exposto. Testes existentes que poderiam escrever em uma instância remota não foram executados.
- A inspeção visual autenticada ficou limitada: o servidor web limpo iniciou, mas o navegador automatizado disponível no ambiente não pôde ser inicializado. A avaliação de UI usa código, tokens, layouts, rotas, componentes, comportamento responsivo declarado e build. A validação visual em dispositivos reais continua sendo um gate obrigatório.
- O worktree já continha alterações do usuário, inclusive em `apps/web/src/app/(app)/composicao-corporal/page.tsx`; elas foram preservadas.
- Pesquisa externa consultada em 25/07/2026. Alegações comerciais de produtos servem como referência, não como validação independente.

---

## 1. Resumo executivo

O HubPatients possui uma base moderna e acima da média para um produto ainda em evolução: monorepo TypeScript, Next.js 15, Expo/React Native, Supabase/PostgreSQL, 67 tabelas com RLS, componentes compartilhados, tema claro/escuro/alto contraste, testes de domínio e uma proposta paciente-first coerente. O produto já cobre muitos momentos da jornada: diário, sinais vitais, exames, medicamentos, consultas, família, ciclos de vida, comunidade e privacidade.

O principal problema não é falta de funcionalidades. É a distância entre a **promessa de segurança/controle** e a proteção efetivamente aplicada em todos os caminhos. Antes de uma reformulação visual ampla, há bloqueadores P0 de autorização familiar, consentimento, auditoria, integridade entre pacientes e comunicação clínica. Também há lógica capaz de produzir falsa tranquilização: resultado sem referência pode ser classificado como “ok”; faixas glicêmicas usam linguagem diagnóstica sem contexto confirmado; interações de medicamentos são apresentadas a partir de uma base pequena e ainda condicionadas a plano pago.

A decisão estratégica recomendada é manter, nos próximos 90 dias, o foco em um **PHR confiável e longitudinal**. O diferencial deve ser: resumo 360° com fonte e data, linha do tempo única, direitos do paciente, compartilhamento temporário controlado, segurança familiar verificável e exportação/segunda opinião. Agenda clínica institucional, prescrição médica, assinatura de encontros e multi-clínica só devem entrar depois de uma decisão explícita de expansão para EMR/PEP.

### Decisão executiva recomendada

1. **Congelar a liberação** de análise de exames por IA, PAT público e feed de calendário até corrigir seus gates de consentimento, auditoria, autorização e exposição.
2. Corrigir primeiro os P0 de família, consentimento, medicamentos, pediatria, auditoria e segurança clínica.
3. Retirar linguagem de diagnóstico/falsa certeza e tornar recursos de segurança clínica independentes de plano.
4. Consolidar um Design System clínico compartilhado; reduzir navegação e escopo aparente antes de “embelezar” telas isoladas.
5. Entregar como núcleo premium: **Hoje**, **Resumo do paciente**, **Linha do tempo**, **Medicamentos**, **Agenda**, **Família** e **Dados & Privacidade**.
6. Só após os gates P0/P1, evoluir interoperabilidade FHIR/RNDS, compartilhamento temporário e IA assistiva com revisão humana.

### Indicadores de sucesso sugeridos

| Objetivo | Indicador | Meta inicial |
|---|---|---|
| Segurança | P0 abertos | 0 antes de produção pública |
| Autorização | Cobertura de matriz RLS por papel × recurso × ação | 100% dos recursos clínicos |
| Confiabilidade clínica | Mensagens de falsa certeza/diagnóstico sem contexto | 0 |
| Eficiência | Tempo para localizar um evento clínico | ≤ 30 s em teste moderado |
| Eficiência | Tempo para registrar tomada/medida | ≤ 15 s no mobile |
| Acessibilidade | Fluxos críticos por teclado e leitor de tela | 100% aprovados |
| Qualidade | Build, typecheck, lint e testes no CI | 100% verdes e reproduzíveis |
| Performance web | JS inicial em rotas críticas | orçamento definido e redução progressiva ≥ 25% nas rotas mais pesadas |
| Direitos | Exportação completa e retificação protocolada | sem truncamento; status e comprovante auditáveis |

---

## 2. Estado atual do projeto

### 2.1 Stack e dimensões

| Camada | Estado encontrado |
|---|---|
| Monorepo | Turborepo + pnpm, TypeScript; aproximadamente 419 arquivos TS/TSX/SQL e 46,7 mil linhas |
| Web | Next.js 15 App Router, React 19, Tailwind/shadcn-like, Supabase SSR; 187 arquivos e 43 páginas |
| Mobile | Expo SDK 54, React Native 0.81.5, Expo Router, Reanimated 4, RNGH 2.28, React Native SVG; 100 arquivos |
| Domínio | `@hubpatients/core`, schemas, constantes, cálculos, regras e testes |
| Dados | Supabase/PostgreSQL, 31 migrations, 67 tabelas públicas, RLS nas 67 |
| Backend | Acesso direto Supabase por web/mobile, RPCs, Storage e sete Edge Functions |
| API própria | `GET /api/v1/me`; contrato ainda pequeno e não equivalente a FHIR |
| CI | lint, typecheck, testes, build web, E2E e pgTAP/RLS, com lacunas de cobertura e reprodutibilidade |

### 2.2 Arquitetura observada

```text
Web (Next.js) ─┐
               ├─ @hubpatients/core / ui-tokens / supabase
Mobile (Expo) ─┘                 │
                                 ├─ Supabase Auth
                                 ├─ PostgreSQL + RLS + RPC
                                 ├─ Storage privado
                                 └─ Edge Functions
                                    ├─ process-exam
                                    ├─ calendar-feed
                                    ├─ geocode-address
                                    ├─ nearby-pharmacies
                                    ├─ directions
                                    ├─ verify-crm
                                    └─ função de apoio adicional
```

O acesso direto ao Supabase reduz backend duplicado, mas dificulta auditoria de leituras, política uniforme de autorização, rate limiting durável e contratos versionados. Para PHI de maior risco, uma camada RPC/BFF bem delimitada deve substituir gradualmente o acesso livre por tabela.

### 2.3 Validações executadas

| Validação | Resultado |
|---|---|
| Typecheck recursivo | Aprovado em todos os pacotes |
| Lint web/core/supabase/ui-tokens | Aprovado |
| Lint mobile | Reprovado: 12 erros e 2 avisos; importação CommonJS e regra `react-hooks/exhaustive-deps` não carregada |
| Testes de domínio | 21 arquivos, 272 testes, todos aprovados |
| Testes mobile | Casos isolados passaram, mas a suíte foi excessivamente lenta e não encerrou de forma confiável |
| Build web de produção | Aprovado; 43 rotas; aviso de plugin Next.js ESLint não detectado |
| E2E | Não executado contra ambiente remoto: specs autenticadas criam dados e não fazem cleanup confiável |
| pgTAP/RLS | Não executado localmente por depender do stack Supabase/Docker; cobertura existente é de apenas cinco testes |
| Auditoria de dependências | Não executada: exigiria envio do inventário de dependências ao registro externo, sem autorização explícita |

O comando agregado `corepack pnpm check` não completou porque o Turbo não localizou o binário do package manager no ambiente. Isso é um problema de reprodutibilidade da ferramenta/pipeline, não uma falha funcional comprovada.

### 2.4 Performance observável pelo build

- Shared JS aproximado: 103 kB.
- Rotas mais pesadas: dashboard ~414 kB, criança ~412 kB, gestação ~403 kB, análise ~399 kB e detalhe de exame ~392 kB.
- Várias telas mobile são monolíticas: configurações ~1.112 linhas, detalhe de criança ~859, home ~848, medicamentos ~804, diário ~716 e gestação ~650.
- Consultas frequentes usam `select('*')` sem paginação; o limite padrão de mil linhas pode truncar históricos longos silenciosamente.

---

## 3. Pontos fortes encontrados

### Produto e experiência

- Princípios documentados de autonomia do paciente, linguagem cuidadosa e intenção de não diagnosticar/prescrever.
- Cobertura funcional ampla e paridade razoável entre web e mobile para os principais domínios.
- Tema claro, escuro, alto contraste, escala de fonte, foco global e `prefers-reduced-motion` já têm fundação no web.
- Mobile usa navegação nativa, SecureStore para sessão e componentes adequados ao ecossistema Expo.
- Há tokens compartilhados com azul de confiança, coral de marca e cores clínicas semânticas.

### Engenharia e segurança

- RLS habilitada em todas as 67 tabelas públicas.
- Não foi encontrada `service_role` exposta no cliente.
- Buckets de exames e documentos profissionais são privados.
- UUID, `timestamptz`, índices e hardenings específicos existem em pontos relevantes.
- Funções `SECURITY DEFINER` importantes geralmente fixam `search_path`; várias funções internas tiveram `EXECUTE` revogado.
- Existem proteções de mutação/exclusão no `audit_log`, embora o modelo ainda seja insuficiente.
- A validação da saída estruturada da análise de exame usa schema estrito, timeout e limite de bytes.
- A suíte do domínio compartilhado é um bom ativo: 272 testes aprovados.

### Arquitetura

- Separação clara entre apps e pacotes compartilhados.
- Uso consistente de TypeScript e domínio centralizado.
- Supabase simplifica autenticação, RLS, storage e realtime.
- A stack web/mobile é adequada ao estágio do produto e não precisa ser substituída para atingir qualidade premium.

---

## 4. Problemas e riscos classificados por gravidade

### 4.1 P0 — críticos/bloqueadores

| ID | Problema e evidência | Impacto |
|---|---|---|
| SEC-01 | Cuidador revogado ainda alcança a relação e pode restaurar `status=accepted`; policy ampla em `0001_init.sql:409-412`, guard incompleto em `0013_security_rls_hardening.sql:18-35` | Recuperação de acesso não autorizado a dados de saúde |
| SEC-02 | Permissões granulares só protegem parte dos recursos; diário, medicamentos, condições, vacinas e perfil usam acesso amplo. `profile.ts` faz `select('*')`, expondo inclusive CPF/endereço/token | Controle mostrado na UI não corresponde ao controle real |
| SEC-03 | Consentimento não tem unicidade por paciente/finalidade; read-then-write concorrente; uma concessão antiga pode manter IA habilitada | Revogação potencialmente ineficaz |
| SEC-04 | Auditoria aceita insert direto com paciente arbitrário, usa FK com cascade, não cobre leituras e falha aberta em operações críticas | Histórico forjável, removível e incompleto |
| SEC-05 | 2FA pode ser cadastrado, mas sessões AAL1 continuam acessando PHI | A interface comunica proteção que o servidor não exige |
| SEC-06 | Convite familiar confia no email do JWT; localmente confirmação de email está desligada | Se produção espelhar a configuração, convite pode ser sequestrado |
| SEC-07 | `medication_intakes.patient_id` e `medication_id` não têm integridade composta; trigger atualiza estoque pelo medicamento | Um usuário pode reduzir estoque de medicamento de outro paciente |
| SEC-08 | Policies pediátricas `FOR ALL` permitem que caregiver com acesso modifique/exclua dados da criança | Perda/adulteração de histórico pediátrico |
| SEC-09 | RPC anônima do calendário retorna `meeting_link`; Edge remove do ICS, mas chamada direta não | Vazamento de link de teleatendimento/agenda |
| CLIN-01 | Métrica sem valor ou sem referências retorna `ok`; narrativa afirma que tudo está dentro da referência (`core/src/utils/exams.ts`) | Falsa tranquilização clínica |
| CLIN-02 | Faixas estáticas de glicemia exibem “Pré-diabetes” e “Diabetes” sem confirmar jejum, contexto, unidade ou avaliação profissional | Linguagem diagnóstica indevida e risco de interpretação errada |
| CLIN-03 | Limiares críticos de exames são hardcoded sem fonte, versão, unidade e contexto | Falso negativo ou alerta incorreto |
| CLIN-04 | Segurança é declarada “sempre gratuita”, mas medicamentos/interações são limitados no plano gratuito; a base local tem poucas interações e a UI pode dizer “nenhuma interação conhecida” | Segurança clínica condicionada a pagamento e falsa completude |

### 4.2 P1 — essenciais para a experiência principal

| ID | Problema e evidência | Impacto |
|---|---|---|
| SEC-10 | Exclusão de conta só grava flags e encerra sessão, enquanto UI promete 30 dias | Direito e expectativa do usuário não são executados de ponta a ponta |
| SEC-11 | Exportação cobre poucas tabelas, não pagina, ignora falhas e pode truncar em mil registros | Portabilidade incompleta sem aviso |
| SEC-12 | `process-exam` confia em booleano do body, envia imagem à Anthropic, usa limite em memória e auditoria fail-open | Tratamento externo de PHI sem gates suficientes |
| SEC-13 | PAT customizado é emitido pelo cliente; hash armazenado funciona como bearer e RPC contorna rate limit | Comprometimento de API/tokens e controle de escopo frágil |
| SEC-14 | Upload confia em MIME do cliente, sem magic bytes, quarentena, antimalware ou transação de finalização | Arquivo malicioso, órfão ou registro parcial |
| SEC-15 | Caregiver autorizado vê metadados de exame, mas o storage não entrega o arquivo | Fluxo delegado inconsistente |
| SEC-16 | Banco aceita valores fisiologicamente inválidos/estoque negativo; refill sofre lost update | Corrupção lógica e decisões baseadas em dados ruins |
| SEC-17 | `select('*')` sem cursor e limite de mil linhas | Histórico incompleto e performance degradada |
| SEC-18 | Headers de segurança/CSP e `no-store` para PHI não estão explícitos | Superfície web desnecessária e risco de cache |
| UX-01 | Recuperação de senha não existe; link web aponta de volta para `/login`; mobile também não oferece fluxo | Usuário bloqueado fora da conta |
| UX-02 | 24 itens no menu web e cerca de 21 em “Mais” no mobile, misturando prontuário, bem-estar, social, comunidade e administração | Sobrecarga cognitiva e descoberta ruim |
| UX-03 | Formulário de exame usa grade rígida de seis colunas e inputs sem rótulos robustos | Uso mobile e acessibilidade comprometidos |
| UX-04 | Estados críticos dependem de banners/toasts e cores; identidade do paciente não é persistente em toda ação de risco | Erro de contexto/paciente e alertas perdidos |
| ENG-01 | Lint mobile quebrado e suíte Jest lenta/não terminante | Regressões e baixa confiança no CI |
| ENG-02 | E2E autenticado escreve em Supabase e não limpa; CI usa credenciais placeholder e pula fluxos | Cobertura aparente, não real, e risco de poluir dados |
| PERF-01 | Rotas críticas chegam a ~400 kB de JS; telas mobile monolíticas | Interação inicial lenta, re-render e manutenção difícil |

### 4.3 P2 — importantes

- Design System fragmentado: tokens royal/coral coexistem com gradientes sky/cyan legados; foram encontrados 147 hex crus no web e 144 no mobile.
- Cinco ocorrências de `transition-all`; várias remoções de outline não deixam substituição de foco claramente local.
- Reanimated 4 ainda usa `runOnJS` em `apps/mobile/src/components/sheet.tsx`; o gesto é recriado por render.
- `PanResponder` global captura toques para inatividade e pode conflitar com gestos/gerar custo.
- Limites `maxFontSizeMultiplier` entre 1,3 e 1,6 podem impedir Dynamic Type suficiente.
- Documentação está desatualizada: README cita Expo 53, projeto usa 54; panorama cita 26 migrations, existem 31; paridade/progresso se contradizem.
- Root `pnpm.overrides` é ignorado pelo pnpm 11; hoje React está alinhado, mas há risco futuro de drift.
- `_import_all.sql` termina na migration 0013 e não é uma fonte segura para bootstrap.
- CI não fixa todas as actions/CLI por SHA/versão e não inclui cobertura suficiente de Edge Functions, RLS, mobile, SBOM e restauração.
- Observabilidade e recuperação de desastre não estão materializadas com RPO/RTO, redaction, alertas e restore drill.

### 4.4 P3 — evolução futura

- Modo escuro validado em contexto clínico, não apenas tecnicamente disponível.
- Offline seletivo com criptografia, expiração, conflito e wipe remoto.
- OAuth 2.1/OIDC para integrações, substituindo PAT customizado.
- Adaptador FHIR/RNDS versionado e Provenance.
- Teleatendimento integrado, somente se o escopo regulatório/operacional for assumido.
- IA assistiva depois dos gates clínicos, legais, de privacidade e observabilidade.

---

## 5. Mapa atual de telas, fluxos e arquitetura

### 5.1 Web — 43 páginas

| Grupo | Rotas |
|---|---|
| Autenticação | `/login`, `/cadastro` |
| Núcleo de saúde | `/dashboard`, `/diario`, `/diario/novo`, `/diario/dor`, `/diario-alimentar`, `/medicamentos`, `/exames`, `/exames/[id]`, `/analise`, `/consultas` |
| Medidas e metas | `/composicao-corporal`, `/circunferencias`, `/metas` |
| Jornadas de vida | `/ciclo`, `/gestacao`, `/criancas`, `/criancas/[id]` |
| Família e privacidade | `/familia`, `/familia/aceitar`, `/consentimento`, `/configuracoes`, `/configuracoes/acesso-ia`, `/perfil`, `/assinatura` |
| Bem-estar e utilidades | `/respirar`, `/educacao`, `/locais/[type]`, `/planos` |
| Comunidade/social | `/comunidade`, categorias, tópicos, profissionais, regras, perfis; `/rede-social` e detalhe; `/moderacao` |
| Administração | `/admin/locais`, `/admin/vouchers`, verificação profissional |

### 5.2 Mobile — rotas Expo

| Grupo | Rotas |
|---|---|
| Tabs | Hoje/início, diário, medicamentos, perfil e “Mais” |
| Saúde | análise, ciclo, circunferências, composição corporal, consultas, crianças, diário alimentar/dor, exames, gestação, metas |
| Conta/privacidade | configurações, consentimento, família/aceite, acesso à IA, planos, notificações, verificação profissional |
| Conteúdo/social | comunidade, profissionais, regras, tópicos/perfis, rede social, educação, respirar, locais |
| Administração | locais e vouchers |

### 5.3 Fluxos atuais e diagnóstico

| Fluxo | Estado/problema | Risco/oportunidade | Proposta |
|---|---|---|---|
| Login/recuperação | Login/cadastro existem; recuperação não | Abandono e suporte manual | Recuperação por link/OTP, confirmação, revogação de sessões e MFA acessível |
| Cadastro/busca de pacientes | Produto cadastra o próprio usuário/dependentes; não há busca clínica institucional | Escopo pode ser confundido com EMR | Nomear claramente “meu perfil/dependentes”; busca global só sobre dados autorizados |
| Agenda/atendimento | Consultas e calendário; sem encounter clínico institucional | Agenda pessoal é válida; atendimento assinado não existe | Melhorar agenda PHR; não prometer prontuário profissional sem modelo novo |
| Abertura do prontuário | Dashboard fragmenta módulos | Informação crítica exige navegação | Resumo 360° com dados atuais, fonte, data e acesso à origem |
| Anamnese/evolução/histórico | Diário é paciente-first; não é evolução assinada | Boa ferramenta pessoal, mas sem valor documental institucional | Manter como diário; criar timeline; “evolução médica” apenas em futura expansão EMR |
| Medicamentos | Registro, horários, tomada e estoque; segurança/paywall e integridade falham | Dano clínico direto | Motor validado, segurança gratuita, alergia consistente, FK composta, provenance |
| Exames/documentos | Upload, métricas e análise; referências opcionais/IA externa | Falsa certeza, PHI externa, upload parcial | Estado “sem referência”, revisão campo a campo, arquivo em quarentena e gates de IA |
| Alertas clínicos | Semântica não possui governança uniforme | Alert fatigue ou falso negativo | Severidade, persistência, fonte/versão, acknowledgement e override justificado |
| Anexos | Storage privado, upload não atômico | Órfãos/malware/falha parcial | Pipeline upload → inspeção → finalize transacional → auditoria |
| Consentimentos | UI rica, efeito de backend parcial | Controle enganoso | Matriz de finalidade/base/escopo/versão, revogação imediata e comprovante |
| Assinatura/encerramento | “Assinatura” existe como recurso, mas não há encounter/lock/addendum | Pode sugerir validade que o modelo não entrega | Renomear conforme função atual; desenhar assinatura qualificada só com escopo jurídico |
| Configuração/admin | Muito conteúdo e segurança misturados | Descoberta ruim | Separar Conta, Segurança, Dados & Privacidade, Compartilhamento e Administração |
| Auditoria/histórico | Log existe, mas incompleto e forjável | Sem prova confiável | Audit gateway append-only e central legível pelo paciente |

---

## 6. Benchmark de produtos e referências

### 6.1 Produtos

| Produto | Padrão útil | Aplicação ao HubPatients | Cuidado |
|---|---|---|---|
| [iClinic](https://iclinic.com.br/sistema-medico/) | Modelos, agenda e atendimento simples | Referência de eficiência caso haja futura expansão profissional | Não importar complexidade de clínica para o PHR atual |
| [Feegow](https://feegowclinic.com.br/) | Agenda, fila, timeline, portal e integrações | Linha do tempo e continuidade de jornada | Amplitude pode repetir a navegação densa atual |
| [MV SOUL](https://mv.com.br/mvsistemas/pt/solucao/soul-mv-saude-publica) | Multiunidade, integração e continuidade offline | Referência de resiliência e domínios | Escopo hospitalar incompatível com curto prazo |
| [Philips Tasy](https://www.philips.com.br/healthcare/resource-catalog/landing/solucao-tasy) | Integração clínica/gestão enterprise | Separação de domínios e interoperabilidade | Não usar como modelo de MVP |
| [Meu SUS Digital](https://www.gov.br/saude/pt-br/composicao/seidigi/meususdigital/meususdigital) | Histórico, vacinação, exames e família | Autonomia e visão longitudinal do cidadão | Integrações RNDS exigem habilitação/perfis oficiais |
| [Epic MyChart](https://www.mychart.org/l/en-us/explore/) | Hub do paciente | Jornada integrada e resultados compreensíveis | Contexto regulatório dos EUA |
| [Share Everywhere](https://www.mychart.org/l/en-us/features/share/) | Compartilhamento temporário | Código/link com escopo, expiração e revogação | Exigir AAL2, token em hash e auditoria |
| [athenaPatient](https://www.athenahealth.com/patient-login) | Agenda, resultados, resumo e mensagens | Continuidade pré/pós-consulta | Localizar para LGPD/CFM |
| [NHS Single Patient Record](https://www.england.nhs.uk/digitaltechnology/the-single-patient-record/) | Visão longitudinal interoperável | Direção estratégica | Programa ainda em implantação |

### 6.2 Projetos GitHub

| Projeto | Stack/finalidade | Atividade consultada | Licença | Uso como referência | Risco/compatibilidade |
|---|---|---|---|---|---|
| [OpenEMR](https://github.com/openemr/openemr) | PHP/JS; EHR/gestão/FHIR | Release 8.0.0.3 em 25/03/2026 | GPL-3.0 | Agenda, formulários e lições de segurança | Copyleft, legado e histórico recente de vulnerabilidades; não copiar fundação |
| [Medplum](https://github.com/medplum/medplum) | TS/React/Node/PostgreSQL/Redis; plataforma FHIR | 5.1.8 em 14/04/2026 | Apache-2.0 | Melhor referência conceitual para stack atual e adapter FHIR | Adaptar perfis brasileiros, LGPD e autorização |
| [OpenMRS](https://github.com/openmrs/openmrs-core) | Java + React/TS; EHR modular | Ativo em 2026 | MPL-2.0 | Chart modular, filas e extensibilidade | Pesado; obrigações MPL por arquivo |
| [HAPI FHIR](https://github.com/hapifhir/hapi-fhir) | Java; servidor/validador FHIR | 8.10.0 em 21/05/2026 | Apache-2.0 | Validação/interoperabilidade como serviço | Acrescenta JVM; FHIR não resolve autorização/compliance |
| [Android FHIR SDK](https://github.com/ohs-foundation/android-fhir) | Kotlin; FHIR offline-first | Ativo/migrado para OHS | Apache-2.0 | Padrões de sync seletivo e offline | Android-only; não é reutilização direta em Expo |
| [EHRbase](https://github.com/ehrbase/ehrbase) | Java/PostgreSQL/openEHR | Ativo | Apache-2.0 | Versionamento semântico longitudinal | Complexidade alta; somente decisão estratégica |
| [LibreHealth](https://github.com/orgs/LibreHealthIO/repositories) | Ecossistema aberto | Principais repositórios pouco ativos | Variável | Referência histórica | Não recomendado como base atual |

Não copiar interface ou código sem revisão de licença. A recomendação é preservar o domínio interno e construir adapters versionados, não converter o banco inteiro em FHIR/openEHR.

### 6.3 Design systems e pesquisa

- [NHS Service Manual](https://service-manual.nhs.uk/): conteúdo e padrões pesquisados para serviços de saúde.
- [VA Design System](https://design.va.gov/): acessibilidade e jornadas complexas web/mobile.
- [CMS Design System](https://design.cms.gov/): padrões React/CSS e acessibilidade.
- [NICE Design System](https://design-system.nice.org.uk/): orientação de quando usar/não usar.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): referência técnica de acessibilidade.

### 6.4 Sinais de Reddit/comunidades — hipóteses, não fatos universais

- [Organização do prontuário no Brasil](https://www.reddit.com/r/MedicinaBrasil/comments/1tfvogv/): dificuldade de localizar dados e receio de instabilidade.
- [Erro de transcrição por IA](https://www.reddit.com/r/MedicinaBrasil/comments/1v02op6/atendimento_particular_online/): reforça revisão obrigatória de medicamento e negação.
- [Documentação excessiva](https://www.reddit.com/r/nursing/comments/1rdfwcj/charting_is_getting_excessive/): registro redundante compete com o cuidado.
- [Alert fatigue](https://www.reddit.com/r/medicine/comments/w9pmcw): alertas indiscriminados perdem credibilidade.
- [Integração entre EHR, laboratório e imagem](https://www.reddit.com/r/healthIT/comments/1s7tedc/how_are_you_unifying_ehr_labs_imaging_and/): contexto dentro do fluxo vale mais que outro painel.
- [Mensagens de portal em excesso](https://www.reddit.com/r/healthcare/comments/1pvzzhd/patient_portal_messages_getting_out_of_control/): comunicação precisa de triagem, SLA e dono.
- [Registros pouco compreensíveis](https://www.reddit.com/r/healthcare/comments/1t6i3mv/medical_records_in_patient_portals_online/): paciente precisa de narrativa simples e acesso à fonte.
- [Exposição de outro paciente](https://www.reddit.com/r/nhs/comments/1oj9og5/seeing_another_patients_record_in_online_nhs_app/): identidade e autorização são riscos de primeira ordem.

---

## 7. Principais necessidades dos usuários

### Paciente titular

- Saber rapidamente “o que exige minha atenção hoje?” sem receber diagnóstico automatizado.
- Encontrar qualquer registro por data, categoria, origem e pessoa.
- Entender origem, unidade, referência e atualização de cada dado.
- Corrigir, exportar, compartilhar e revogar acesso com comprovante.
- Registrar uma tomada, medida ou sintoma com pouquíssimos toques.
- Ter confiança de que família, IA e integrações veem apenas o autorizado.

### Familiar/cuidador

- Alternar de forma inequívoca o perfil acompanhado.
- Saber exatamente o que pode ver/fazer e quando o acesso expira.
- Acessar arquivos compatíveis com a permissão concedida.
- Nunca confundir dados do titular e do dependente.

### Paciente com baixa visão, limitação motora ou cognitiva

- Fluxo por teclado/leitor de tela, reflow/zoom, linguagem simples e alvos amplos.
- Não depender de cor, gesto, memória ou animação.
- Receber erros junto ao campo, com instrução de correção.

### Administração/moderação

- Verificação profissional correta por conselho e profissão.
- Ações críticas com justificativa, AAL2, auditoria e escopo mínimo.
- Monitorar abuso sem registrar PHI em logs gerais.

### Profissional de saúde — somente em compartilhamento ou futura expansão

- Resumo conciso, fonte e data; pacote de segunda opinião; acesso temporário.
- Se o produto virar EMR: identidade persistente, encontro, assinatura, lock/adendo, ordens e break-glass. Esses elementos não devem ser simulados no PHR atual.

---

## 8. Proposta de UX para web e mobile

### 8.1 Princípios

1. **Segurança antes de conveniência:** ações críticas mostram pessoa, objeto e consequência.
2. **Fonte antes de interpretação:** todo dado clínico exibe origem, data, unidade e referência.
3. **Divulgação progressiva:** o básico primeiro; detalhe e módulos de jornada aparecem quando relevantes.
4. **Velocidade mensurável:** reduzir passos e digitação, não apenas pixels.
5. **Controle verificável:** permissão/consentimento muda o backend imediatamente e gera comprovante.
6. **Humano no comando:** IA cria rascunho, nunca verdade clínica silenciosa.

### 8.2 Arquitetura de informação proposta

**Web — navegação primária**

- Hoje
- Meu prontuário: Resumo, Linha do tempo, Diário, Medidas, Exames
- Medicamentos
- Agenda
- Família
- Dados & Privacidade
- Mais: jornadas de vida, educação, comunidade e recursos secundários

**Mobile — cinco tabs**

- Hoje
- Registros
- Medicamentos
- Agenda
- Mais

Perfil fica em “Mais” e também no avatar. Gestação, ciclo, crianças, respiração e comunidade são módulos contextuais/opt-in, não competidores permanentes da navegação principal. Administração só aparece a quem possui o papel.

### 8.3 Fluxos redesenhados

#### Login e recuperação

```text
Email → senha/OTP → se MFA ativo: challenge → Hoje
              └→ Esqueci a senha → link seguro → nova senha → revogar outras sessões
```

- Mensagem neutra para evitar enumeração de conta.
- Challenge acessível, códigos com autocomplete correto e alternativa de recuperação.
- Step-up AAL2 para exportar, excluir, compartilhar, criar token ou administrar.

#### Resumo e timeline

```text
[Pessoa ativa + foto/iniciais + nascimento]
[Atenção hoje: somente alertas validados e pendências]
[Medicamentos atuais] [Próxima consulta] [Últimos resultados]
[Linha do tempo filtrável]
  24 jul • Exame • Laboratório X • fonte/arquivo
  22 jul • Tomada registrada • usuário
  20 jul • Diário • autorrelato
```

- Cada cartão abre o registro original.
- Estados: atual, histórico, corrigido/adendo, sem referência, pendente de revisão.
- Busca e filtros persistem em URL no web e estado restaurável no app.

#### Medicamento

```text
Buscar/registrar → confirmar nome/apresentação → dose/horário → alergia/interação
→ resumo “você vai salvar” → salvar → próximo horário/estoque
```

- Nenhum alerta de segurança é pago.
- “Base não encontrou interação” substitui “nenhuma interação conhecida”, com fonte, versão e limite.
- Conflito exige confirmação explícita e, em cenário profissional futuro, justificativa.

#### Exame

```text
Selecionar arquivo → validar/inspecionar → dados básicos → métricas
→ cada métrica: valor + unidade + referência + origem → revisão → finalizar
```

- Sem referência = “não classificado”, nunca “normal”.
- Extração por IA mostra imagem/origem ao lado de cada campo, com aceitar/rejeitar.
- Nenhum dado é salvo automaticamente; cancelamento remove temporários.

#### Família e compartilhamento

```text
Escolher pessoa → escolher recursos → escolher ver/registrar → validade
→ confirmar com AAL2 → convite de uso único → aceite → comprovante
```

- Revogar tem efeito imediato e encerra acesso derivado.
- “Representante legal” e “cuidador convidado” são conceitos distintos.
- Compartilhamento temporário para profissional: escopo, expiração curta, revogação e histórico.

#### Direitos e privacidade

Uma central única deve reunir:

- baixar cópia completa;
- solicitar retificação/adendo;
- consultar acessos e compartilhamentos;
- gerenciar consentimentos e IA;
- representante/diretivas, quando aplicável;
- solicitar exclusão/restrição com explicação de retenções legais/contratuais;
- acompanhar protocolo e receber comprovante.

### 8.4 Estados obrigatórios

- **Loading:** skeleton com mesma geometria do conteúdo; sem bloquear toda a tela quando apenas um card recarrega.
- **Vazio:** explicar valor e oferecer uma ação única; nunca parecer erro.
- **Erro recuperável:** mensagem ao lado da área, causa em linguagem simples, “tentar novamente” e preservação do que foi digitado.
- **Offline:** indicar o que está disponível, última sincronização e não prometer salvamento sem confirmação.
- **Sucesso:** confirmação discreta e persistente quando relevante; toast não substitui estado.
- **Crítico:** banner persistente, ícone + texto + severidade; não depender de cor.

---

## 9. Proposta visual e Design System

### 9.1 Direção de arte

**“Calma clínica, calor humano e precisão.”** Premium significa organizado, silencioso, responsivo e seguro — não vidro, brilho ou movimento excessivo. Azul royal comunica confiança; coral fica reservado à identidade/acentos, e cores clínicas são exclusivas de estado.

### 9.2 Tokens recomendados

| Categoria | Proposta |
|---|---|
| Primária | Royal `#0442BF`; hover `#0537A0`; fundo suave `#EEF2FF` |
| Acento de marca | Coral `#F24B59`; não usar como erro clínico |
| Superfície | Branco `#FFFFFF`, canvas `#F8FAFC`, elevado `#FFFFFF` |
| Texto | Principal `#0F172A`, secundário `#475569`, muted validado `#64748B` |
| Borda | `#E2E8F0`, 1 px; foco elétrico `#0511F2` com offset |
| Clínico | sucesso `#10B981`, atenção `#F59E0B`, crítico `#EF4444`, sempre com ícone/texto |
| Tipografia | Inter/system para leitura e dados; Bricolage somente em marca/hero, não em tabelas clínicas |
| Escala | 12, 14, 16, 18, 20, 24, 30, 36; corpo padrão 16; line-height 1,5 |
| Espaçamento | Base 4 px; ritmo de layout 8 px; densidade compacta opcional no desktop |
| Raios | 8 px em campos, 12 px em cards, 16 px em modais; evitar pílulas em tudo |
| Elevação | 0/1/2 com sombras sutis; borda primeiro, sombra apenas para sobreposição |
| Alvos | Preferência 44×44 px em web touch/mobile |

Consolidar esses valores em `@hubpatients/ui-tokens` e eliminar gradualmente gradientes sky/cyan e hex crus. Gradiente fica restrito a momentos de marca, nunca a ações ou estado clínico.

### 9.3 Componentes prioritários

- `PatientContextBar`: pessoa ativa, nascimento/idade, relação e troca explícita.
- `ClinicalAlert`: severidade, título, ação, fonte, data, persistência e acknowledgement.
- `MetricValue`: valor, unidade, referência, status/“não classificado”, tendência e provenance.
- `TimelineEvent`: tipo, momento clínico, data de registro, origem, autor e correção.
- `PermissionMatrix`: recurso × ver/registrar × validade, com resumo em linguagem simples.
- `FileUpload`: validação, progresso, quarentena, erro e cancelamento.
- `FormField`: label real, descrição, obrigatório/opcional, erro e unidade.
- `DataTable`: cabeçalhos, ordenação anunciada, paginação/cursor e versão em cards no mobile.
- `ConfirmCriticalAction`: pessoa, objeto, consequência, step-up e texto de confirmação quando necessário.
- `EmptyState`, `InlineError`, `Skeleton`, `Progress`, `Toast` e `StatusBanner` com contratos claros.

### 9.4 Responsividade

- Desktop ≥ 1280: sidebar compacta, conteúdo central 960–1200 px, painel contextual opcional.
- Tablet 768–1279: sidebar recolhível; master/detail quando houver espaço; formulários em uma ou duas colunas.
- Mobile < 768: navegação inferior; uma coluna; CTA sticky sem encobrir foco/conteúdo; tabelas viram cards rotulados.
- Grade rígida de exame em seis colunas deve virar linhas semânticas; no mobile, valor/unidade/referência empilham com labels visíveis.

### 9.5 Movimento

- 120–200 ms para feedback e transição de estado; 200–280 ms para sheet/modal.
- Animar apenas opacity/transform quando possível.
- Sem `transition-all`; respeitar redução de movimento em web e configuração do sistema no app.
- Nunca atrasar confirmação de ação clínica por animação.

### 9.6 Wireframes textuais

**Hoje — web**

```text
┌ Sidebar ─────┬ Pessoa ativa / busca / privacidade ───────────────┐
│ Hoje         │ Bom dia. O que precisa de atenção                 │
│ Prontuário   │ [Pendência] [Próxima consulta] [Medicamentos]     │
│ Medicamentos │                                                   │
│ Agenda       │ Linha do tempo recente           Atalhos          │
│ Família      │ • exame recebido                 + registrar      │
│ Privacidade  │ • tomada registrada              + anexar exame   │
└──────────────┴───────────────────────────────────────────────────┘
```

**Resumo — mobile**

```text
[Pessoa ativa ▾]                       [privacidade]
Hoje
[1 pendência que requer revisão]
[Próxima consulta]
Medicamentos agora                         Ver todos
[08:00 Losartana — Registrar tomada]
Linha do tempo
[Exame • 24 jul • não classificado]
[Diário • 23 jul • autorrelato]
Hoje | Registros | Medicamentos | Agenda | Mais
```

---

## 10. Funcionalidades novas recomendadas

| Pri. | Funcionalidade | Valor | Condição de segurança |
|---|---|---|---|
| P1 | Resumo 360° + linha do tempo | Reduz tempo para compreender histórico | Fonte/data/unidade; não inferir diagnóstico |
| P1 | Central de direitos e privacidade | Cumpre autonomia, acesso, retificação e controle | Protocolo, AAL2, auditoria e regras de retenção |
| P1 | Identidade/pessoa ativa persistente | Evita erro de contexto familiar | Confirmação em ação crítica |
| P1 | Alertas e pendências governados | Foco no que é acionável | Fonte/versionamento, severidade e teste de falso negativo |
| P1 | Exportação/segunda opinião | Portabilidade e continuidade do cuidado | Completa, paginada, checksum, manifesto e compartilhamento seguro |
| P2 | Compartilhamento temporário | Evita PDF por email/WhatsApp | Escopo, token em hash, expiração, revogação, AAL2 e auditoria |
| P2 | Modelos pessoais de registro | Reduz digitação repetida | Usuário controla; não criar conteúdo clínico implícito |
| P2 | Busca/comandos rápidos | Reduz navegação densa | Somente dados autorizados; resultado mostra pessoa ativa |
| P2 | Agenda avançada pessoal | Lembretes, preparo e continuidade | Fuso horário, privacidade e link de reunião protegido |
| P2 | Adaptador FHIR/RNDS | Interoperabilidade gradual | Perfis BR, validação, versionamento, consentimento e Provenance |
| P2 | Comunicação segura | Continuidade entre paciente e serviço | Triagem, SLA, escopo e aviso de urgência; só com operação responsável |
| P3 | Offline seletivo | Resiliência em baixa conectividade | Criptografia, mínimo de PHI, expiração, conflito, wipe e auditoria |
| P3 | Teleatendimento | Jornada integrada | Assumir CFM, contrato, registro, assinatura e responsabilidade técnica |

### IA: recomendação responsável

| Uso | Benefício | Risco clínico/privacidade | Supervisão humana | Local/on-device? |
|---|---|---|---|---|
| Extração de exame | Evita digitação | Campo/unidade/paciente errado; imagem enviada a terceiro | Aceitar/rejeitar campo a campo; sem autosave | OCR/extração limitada pode ser avaliada localmente |
| Resumo longitudinal | Reduz leitura | Omissão ou dado antigo tratado como atual | Links para fonte/data; confirmação antes de compartilhar | Modelos pequenos podem atender subconjuntos após benchmark |
| Triagem de mensagens | Organiza fila | Urgência classificada como rotina | Nunca descartar; fila de exceção e medição de falso negativo | Regras/classificadores pequenos são candidatos |
| Lembretes personalizados | Melhora adesão | Nudging inadequado ou exposição em notificação | Preferências explícitas e conteúdo mínimo na tela bloqueada | Regras locais são preferíveis |
| Interação/dose | Prevenção de dano | Falso negativo/alert fatigue | Base farmacológica validada e versionada; não usar LLM como autoridade | Motor de regras local/servidor |
| Diagnóstico/prescrição autônomos | — | Risco alto e possível enquadramento regulatório | **Não implementar autonomia** | Não aplicável |

**Gates antes de qualquer IA:** proprietário e finalidade; classificação de risco; RIPD; base legal; DPA e proibição de treino/retenção indevida; transferência internacional; validação brasileira e por subgrupo; métricas de falso negativo/alucinação; kill switch; versionamento de modelo/prompt; auditoria redigida; comunicação e recusa; avaliação CFM/Anvisa/SBIS quando aplicável.

