// Metro config para monorepo (Turborepo + pnpm) + NativeWind.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Observa a raiz do monorepo (para resolver os packages compartilhados).
config.watchFolders = [monorepoRoot];

// 2. Resolve módulos do projeto e da raiz.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. pnpm usa symlinks — necessário para os packages workspace.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

module.exports = withNativeWind(config, { input: './global.css' });
