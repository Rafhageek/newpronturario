# Projeto Prontuário — Instruções para o Codex

## Regra principal: SEMPRE consultar as skills

Antes de qualquer tarefa de desenvolvimento, **consulte as skills instaladas em `.Codex/skills/`** e use a(s) relevante(s). Não improvise quando existe uma skill que cobre o assunto.

Mapa rápido (inventário completo em [.Codex/skills/README.md](.Codex/skills/README.md)):

- **UI / Design / Visual** → `frontend-design`, `modern-web-design`, `design-system`, `web-design-guidelines`, `web-artifacts-builder`
- **Animações** → `motion-framer`, `gsap-scrolltrigger`, `animejs`, `lottie-animations`, `scroll-reveal-libraries`, `animated-component-libraries`
- **Frontend** → `frontend-patterns`, `frontend-a11y`
- **Backend / API / Banco** → `backend-patterns`, `api-design`, `database-migrations`, `postgres-patterns`, `error-handling`, `docker-patterns`, `deployment-patterns`, `mcp-builder`
- **Segurança** → `owasp-security`, `security-review`, `security-scan`
- **Testes** → `webapp-testing`, `e2e-testing`
- **Saúde / Prontuário** → `healthcare-emr-patterns`, `healthcare-phi-compliance` ⚠️ (foco HIPAA/EUA — adaptar à **LGPD + normas CFM**)
- **Criar/editar skills** → `skill-creator`

Se nenhuma skill cobrir bem o caso e for algo recorrente, criar uma nova com `skill-creator`.

## Registro no Obsidian

Cada atualização importante (decisão de stack, instalação, mudança de arquitetura, deploy, bug relevante) deve ser anexada em `D:\Obsidian\Projeto Prontuário\Histórico de Atualizações.md` (estilo: `## AAAA-MM-DD — título`, wikilinks, `#tags`, PT-BR, sem YAML).

## Contexto do projeto

- Sistema de **prontuário** (registros). Stack a definir.
- Idioma: PT-BR. Conformidade de dados de saúde: **LGPD + CFM** (Brasil).
