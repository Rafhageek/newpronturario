// Harness de testes do app mobile (jest-expo + @testing-library/react-native).
// Roda headless em Node — nada de toolchain nativo. Os mocks vivem em
// jest.setup.js (reanimated, gesture-handler, módulos nativos do Expo).
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Resolve o alias "@/..." (= ./src/...) usado em todo o app.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Pacotes ESM/Flow que PRECISAM ser transpilados pelo Babel. Espelha o padrão
  // do jest-expo e adiciona o que o app usa: nativewind + css-interop, lucide,
  // reanimated, gesture-handler e os pacotes do monorepo (@hubpatients/*).
  //
  // pnpm: os pacotes reais vivem em `node_modules/.pnpm/<hash>/node_modules/<pkg>`.
  // O `(?!\.pnpm/)` faz o regex IGNORAR o node_modules externo (o do .pnpm) e
  // avaliar o INTERNO (onde está o pacote de verdade) — sem isso o padrão do
  // jest-expo casa o node_modules externo e deixa, ex., @react-native/js-polyfills
  // (com sintaxe Flow) sem transpilar, quebrando tudo.
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm/)(?!((jest-)?react-native|@react-native(-community)?/|@react-native/)|expo(nent)?|@expo(nent)?/|@expo-google-fonts/|react-navigation|@react-navigation/|@sentry/react-native|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|nativewind|react-native-css-interop|lucide-react-native|@hubpatients/)',
  ],
};
