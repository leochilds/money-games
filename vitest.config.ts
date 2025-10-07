import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    svelte({
      hot: false
    })
  ],
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
      $app: path.resolve('./.svelte-kit/runtime/app')
    },
    conditions: ['svelte', 'browser', 'module', 'import']
  },
  define: {
    'import.meta.env.SSR': 'false'
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/setupTests.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{js,ts,svelte}'],
      exclude: ['src/routes/**', 'legacy/**', 'static/**', '**/*.d.ts'],
      thresholds: {
        statements: 50,
        branches: 45,
        functions: 50,
        lines: 50
      }
    }
  }
});
