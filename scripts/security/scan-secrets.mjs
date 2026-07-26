import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ALLOWED_ENV_FILES = new Set([
  '.env.example',
  'apps/mobile/.env.example',
  'apps/web/.env.example',
]);
const SKIPPED_EXTENSIONS = new Set([
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.lock',
  '.pdf',
  '.png',
  '.svg',
  '.webp',
  '.woff',
  '.woff2',
]);

// Regras deliberadamente específicas para reduzir falsos positivos. O scanner
// nunca imprime o valor encontrado: somente regra, arquivo e linha.
const RULES = [
  ['anthropic_api_key', /sk-ant-[A-Za-z0-9_-]{20,}/g],
  ['openai_api_key', /sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/g],
  ['google_api_key', /AIza[0-9A-Za-z_-]{30,}/g],
  ['github_token', /gh[pousr]_[A-Za-z0-9]{36,}/g],
  ['aws_access_key', /AKIA[0-9A-Z]{16}/g],
  ['stripe_live_key', /(?:sk|rk)_live_[A-Za-z0-9]{20,}/g],
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  [
    'supabase_service_role_jwt',
    /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*InJvbGUiOiJzZXJ2aWNlX3JvbGUi[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/g,
  ],
];

const SKIPPED_DIRECTORIES = new Set([
  '.agents',
  '.claude',
  '.codex',
  '.expo',
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'coverage',
  'dist',
  'dist-test',
  'node_modules',
  'playwright-report',
  'test-results',
]);

function listProjectFiles(directory = '.') {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name))
        files.push(...listProjectFiles(join(directory, entry.name)));
    } else if (entry.isFile()) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

let usingGitIndex = true;
let projectFiles;
try {
  projectFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
} catch {
  // Alguns sandboxes bloqueiam subprocessos. O CI sempre usa o índice Git;
  // localmente, o fallback ainda examina fontes sem tocar em artefatos/segredos.
  usingGitIndex = false;
  projectFiles = listProjectFiles().sort();
}

const findings = [];
for (const file of projectFiles) {
  const normalized = file.replace(/^\.\\/, '').replaceAll('\\', '/');
  const baseName = normalized.split('/').at(-1) ?? normalized;

  if (baseName.startsWith('.env') && !ALLOWED_ENV_FILES.has(normalized)) {
    if (usingGitIndex) findings.push({ rule: 'tracked_env_file', file: normalized, line: 1 });
    continue;
  }
  if (SKIPPED_EXTENSIONS.has(extname(normalized).toLowerCase()) || baseName === 'pnpm-lock.yaml') {
    continue;
  }

  let content;
  try {
    content = readFileSync(normalized, 'utf8');
  } catch {
    continue;
  }

  for (const [rule, pattern] of RULES) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const line = content.slice(0, match.index).split('\n').length;
      findings.push({ rule, file: normalized, line });
    }
  }
}

if (findings.length > 0) {
  console.error('Possíveis segredos detectados; os valores foram ocultados:');
  for (const finding of findings) {
    console.error(`- ${finding.rule}: ${finding.file}:${finding.line}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Scanner concluído: ${projectFiles.length} arquivos ${usingGitIndex ? 'versionados' : 'de fonte'}, nenhum segredo conhecido.`,
  );
}
