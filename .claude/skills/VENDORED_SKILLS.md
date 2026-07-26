# Skills mobile vendorizadas (Expo / Software Mansion / Callstack)

Skills de terceiros copiadas para `.claude/skills/` em **2026-06-07** para dar ao Claude Code
cobertura de desenvolvimento mobile **React Native / Expo / EAS** (o app `apps/mobile` usa
Expo SDK 53, RN 0.79, expo-router 5, Reanimated 3.17, NativeWind 4.1, Supabase).

Estas pastas são **cópias upstream** — para atualizar, re-clone o repositório de origem no
commit mais novo e substitua a pasta correspondente. Não edite o conteúdo localmente (a única
alteração feita foi renomear o campo `name:` no frontmatter dos dois `react-native-best-practices`
para casar com o nome da pasta e evitar colisão).

## Origem e licença

| Origem | Repo | Commit | Licença | Copyright |
|---|---|---|---|---|
| **Expo (oficial)** | https://github.com/expo/skills | `145a923` | MIT | © 2025-present 650 Industries, Inc. (aka Expo) |
| **Software Mansion** | https://github.com/software-mansion-labs/skills | `a56a8b6` | MIT¹ | © Software Mansion |
| **Callstack** | https://github.com/callstackincubator/agent-skills | `0ba043a` | MIT | © 2026 Callstack Incubator |

¹ O repositório da Software Mansion não publica um arquivo `LICENSE`; o `SKILL.md` declara `license: MIT`.

## Skills incluídas

**Expo (10)** — `building-native-ui`, `expo-deployment`, `expo-cicd-workflows`,
`eas-update-insights`, `expo-tailwind-setup`, `native-data-fetching`, `expo-api-routes`,
`upgrading-expo`, `expo-dev-client`, `expo-observe`.

**Software Mansion (2)** — `swm-react-native-best-practices` (inclui sub-skills em
`references/`: animations, gestures, svg, jsi, multithreading, audio, on-device-ai, rich-text),
`radon-mcp`.

**Callstack (3)** — `callstack-react-native-best-practices`, `upgrading-react-native`,
`github-actions`.

## Skills do Tier 1 deliberadamente NÃO incluídas

Para manter o repo enxuto, pulei skills só relevantes fora do managed workflow:
Expo `add-app-clip`, `expo-brownfield`, `expo-module`, `expo-ui-jetpack-compose`,
`expo-ui-swift-ui`, `use-dom`; Callstack `github`, `react-native-brownfield-migration`;
SWM `expo-horizon`, `rnrepo`, `typegpu`. Re-clone do upstream se precisar de alguma.

Alternativa oficial (atualizável, fora do repo): `/plugin marketplace add expo/skills` etc.
