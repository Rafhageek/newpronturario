// Metro config para monorepo (Turborepo + pnpm) + NativeWind.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Observa a raiz do monorepo (mantendo os defaults do Expo).
config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot];

// 2. Resolve módulos do projeto e da raiz.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// (SDK 54: symlinks do pnpm já são default — não precisa mais setar.)

module.exports = withNativeWind(config, { input: './global.css' });
