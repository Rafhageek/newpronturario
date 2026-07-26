#!/usr/bin/env node
/**
 * Guard do runtimeVersion — substituto caseiro da policy 'fingerprint'.
 *
 * POR QUE EXISTE: o EAS Update só entrega um OTA a binários com o MESMO
 * runtimeVersion. Se alguém adiciona uma biblioteca nativa (ou muda plugin /
 * permissão / minSdk) e esquece de bumpar o runtimeVersion, o OTA vai para um
 * APK que não tem aquele código nativo e o app QUEBRA NO BOOT em produção.
 *
 * A policy oficial 'fingerprint' resolveria isso, mas neste monorepo pnpm ela
 * falha no build (hash local ≠ hash do servidor). Ver comentário no
 * app.config.ts. Então calculamos um hash das entradas que realmente afetam o
 * binário e travamos quando ele muda sem bump.
 *
 * Uso:
 *   node scripts/check-runtime-version.mjs           # verifica (falha se mudou)
 *   node scripts/check-runtime-version.mjs --update  # aceita o estado atual
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const mobileDir = join(here, '..');
const LOCK = join(mobileDir, 'native-fingerprint.json');

/** Pacotes que NÃO têm código nativo — mudar a versão deles não exige APK novo. */
const PURE_JS = new Set([
  '@hubpatients/core',
  '@hubpatients/supabase',
  '@hubpatients/ui-tokens',
  '@supabase/supabase-js',
  '@tanstack/react-query',
  'zod',
  'nativewind',
  'lucide-react-native',
  'react',
  'react-dom',
]);

/** Só o que muda o binário: deps nativas + config nativa. */
function collectNativeInputs() {
  const pkg = JSON.parse(readFileSync(join(mobileDir, 'package.json'), 'utf8'));
  const deps = Object.entries(pkg.dependencies ?? {})
    .filter(([name]) => !PURE_JS.has(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, version]) => `${name}@${version}`);

  // Do app.config.ts lemos só as seções que viram configuração nativa. Ler o
  // arquivo como texto evita executá-lo (ele depende de variáveis de ambiente).
  const cfg = readFileSync(join(mobileDir, 'app.config.ts'), 'utf8');
  const nativeConfig = [
    /plugins:\s*\[[\s\S]*?\n\s*\],/m,
    /permissions:\s*\[[\s\S]*?\n\s*\],/m,
    /newArchEnabled:.*/,
    /minSdkVersion:.*/,
    /package:.*/,
    /bundleIdentifier:.*/,
    /scheme:.*/,
  ]
    .map((re) => (cfg.match(re) ?? [''])[0].replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const runtimeVersion = (cfg.match(/runtimeVersion:\s*'([^']+)'/) ?? [])[1] ?? '(não encontrado)';
  return { deps, nativeConfig, runtimeVersion };
}

const { deps, nativeConfig, runtimeVersion } = collectNativeInputs();
const hash = createHash('sha256')
  .update(JSON.stringify({ deps, nativeConfig }))
  .digest('hex')
  .slice(0, 16);

const shouldUpdate = process.argv.includes('--update');

if (shouldUpdate || !existsSync(LOCK)) {
  writeFileSync(
    LOCK,
    `${JSON.stringify({ runtimeVersion, hash, updatedAt: new Date().toISOString().slice(0, 10), deps }, null, 2)}\n`,
  );
  console.log(`✔ native-fingerprint.json gravado (runtime ${runtimeVersion}, hash ${hash}).`);
  process.exit(0);
}

const saved = JSON.parse(readFileSync(LOCK, 'utf8'));

if (saved.hash === hash) {
  console.log(`✔ Nada nativo mudou desde o runtime ${saved.runtimeVersion}. OTA é seguro.`);
  process.exit(0);
}

if (saved.runtimeVersion !== runtimeVersion) {
  console.log(
    `✔ Mudança nativa detectada E runtimeVersion bumpado (${saved.runtimeVersion} → ${runtimeVersion}).\n` +
      `  Rode com --update depois de gerar o APK novo.`,
  );
  process.exit(0);
}

const antes = new Set(saved.deps ?? []);
const agora = new Set(deps);
const add = deps.filter((d) => !antes.has(d));
const rem = (saved.deps ?? []).filter((d) => !agora.has(d));

console.error(
  [
    '',
    '✖ BLOQUEADO: o código NATIVO mudou, mas o runtimeVersion continua ' + runtimeVersion + '.',
    '',
    add.length ? '  Entrou:  ' + add.join(', ') : null,
    rem.length ? '  Saiu:    ' + rem.join(', ') : null,
    !add.length && !rem.length ? '  (mudou a configuração nativa: plugins, permissões, minSdk ou similar)' : null,
    '',
    '  Publicar OTA agora entregaria código novo a um APK que não tem esse',
    '  módulo nativo — o app quebra no boot para quem já instalou.',
    '',
    '  O que fazer:',
    '    1. Suba o runtimeVersion em app.config.ts (ex.: ' + bump(runtimeVersion) + ').',
    '    2. Gere um APK novo (eas build -p android --profile preview).',
    '    3. Rode: node scripts/check-runtime-version.mjs --update',
    '',
  ]
    .filter((l) => l !== null)
    .join('\n'),
);
process.exit(1);

function bump(v) {
  const p = v.split('.').map(Number);
  if (p.length !== 3 || p.some(Number.isNaN)) return '0.4.0';
  return `${p[0]}.${p[1] + 1}.0`;
}
