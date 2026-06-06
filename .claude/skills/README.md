# Skills do Projeto Prontuário

Skills para Claude Code selecionadas via varredura dos melhores repositórios da
comunidade (jun/2026). São acionadas **automaticamente** quando a tarefa bate com a
descrição de cada uma — não precisa chamar manualmente.

**Total: 29 skills.** Algumas de animação incluem scripts Python auxiliares
(geradores de boilerplate) — autorizados explicitamente pelo usuário.

## Fontes

| Repositório | Confiança | Usado para |
|---|---|---|
| `anthropics/skills` | Oficial | frontend-design, webapp-testing, web-artifacts-builder, skill-creator, mcp-builder |
| `vercel-labs/agent-skills` | Oficial (Vercel) | web-design-guidelines |
| `affaan-m/everything-claude-code` | Comunidade | backend, frontend, segurança, testes, saúde |
| `freshtechbro/claudedesignskills` | Comunidade | animações e design visual |
| `agamm/claude-code-owasp` | Comunidade | owasp-security |

## Inventário por categoria

### Design / Visual
- `frontend-design` (Anthropic) — UI de nível produção, sem cara de IA genérica
- `web-artifacts-builder` (Anthropic) — apps web multi-componente (React/Tailwind/shadcn)
- `web-design-guidelines` (Vercel) — audita 100+ regras de acessibilidade/UX
- `modern-web-design` — padrões de design web moderno
- `design-system` — montar/manter design system

### Animações
- `motion-framer` — Framer Motion (gestos, layout, spring)
- `gsap-scrolltrigger` — GSAP + ScrollTrigger
- `animejs` — anime.js timelines
- `lottie-animations` — Lottie
- `scroll-reveal-libraries` — AOS / scroll reveal
- `animated-component-libraries` — bibliotecas de componentes animados

### Frontend
- `frontend-patterns` — padrões de arquitetura de frontend
- `frontend-a11y` — acessibilidade (WCAG/ARIA)

### Backend
- `backend-patterns` — padrões de backend
- `api-design` — design de APIs REST/GraphQL
- `database-migrations` — migrações de banco
- `postgres-patterns` — boas práticas PostgreSQL
- `error-handling` — tratamento de erros
- `docker-patterns` — Docker
- `deployment-patterns` — deploy/CI-CD
- `mcp-builder` (Anthropic) — servidores MCP p/ integrar APIs externas

### Segurança
- `owasp-security` — OWASP Top 10 / ASVS (referência viva)
- `security-review` — revisão de segurança de código
- `security-scan` — varredura de vulnerabilidades

### Testes
- `webapp-testing` (Anthropic) — testar app em navegador real (Playwright)
- `e2e-testing` — testes end-to-end

### Saúde (específico do Prontuário)
- `healthcare-emr-patterns` — padrões de prontuário eletrônico (EMR)
- `healthcare-phi-compliance` — conformidade com dados sensíveis de saúde (PHI)
  > Nota: foca em HIPAA (EUA). No Brasil, o equivalente é a **LGPD** + normas do CFM —
  > use como base de boas práticas e adapte à legislação brasileira.

### Meta
- `skill-creator` (Anthropic) — criar/editar/otimizar skills do projeto

## Pendentes (instalar se o stack for React/Next.js)

De `vercel-labs/agent-skills/skills/`:
- `react-best-practices`, `composition-patterns`, `react-view-transitions`, `deploy-to-vercel`

De `freshtechbro/claudedesignskills` (3D, se precisar): `threejs-webgl`,
`react-three-fiber`, `spline-interactive`, `pixijs-2d`, etc.

```powershell
git clone --depth 1 https://github.com/vercel-labs/agent-skills.git $env:TEMP\vsk
Copy-Item -Recurse "$env:TEMP\vsk\skills\react-best-practices" ".claude\skills\react-best-practices"
Remove-Item -Recurse -Force $env:TEMP\vsk
```
