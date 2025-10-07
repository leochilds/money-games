import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

const ignores = {
  ignores: [
    '.svelte-kit',
    'build',
    'node_modules',
    'legacy',
    'static/assets',
    'eslint.config.js',
    'svelte.config.js'
  ]
};

const tsProjectConfig = {
  files: ['**/*.ts'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: import.meta.dirname
    }
  }
};

const svelteProjectConfig = {
  files: ['**/*.svelte'],
  languageOptions: {
    parserOptions: {
      parser: tseslint.parser,
      project: './tsconfig.json',
      tsconfigRootDir: import.meta.dirname,
      extraFileExtensions: ['.svelte']
    }
  }
};

const svelteConfigs = svelte.configs['flat/recommended'].map((config) => {
  if (config.files && config.files.includes('**/*.svelte')) {
    return {
      ...config,
      languageOptions: {
        ...config.languageOptions,
        parserOptions: {
          ...config.languageOptions?.parserOptions,
          parser: tseslint.parser,
          project: './tsconfig.json',
          tsconfigRootDir: import.meta.dirname,
          extraFileExtensions: ['.svelte']
        }
      }
    };
  }

  return config;
});

export default [
  ignores,
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  tsProjectConfig,
  ...svelteConfigs,
  svelteProjectConfig,
  prettier
];
