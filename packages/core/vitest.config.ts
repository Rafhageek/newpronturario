import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      /**
       * `@hubpatients/ui-tokens` não é dependência de runtime do core (o core é
       * domínio, não desenho) — mas os testes de contraste precisam medir os
       * VALORES REAIS dos tokens, não uma cópia deles. O alias espelha o `paths`
       * que o tsconfig.base.json já declara, então tsc e vitest resolvem igual e
       * o pnpm-lock não muda.
       */
      '@hubpatients/ui-tokens': fileURLToPath(
        new URL('../ui-tokens/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
    },
  },
});
