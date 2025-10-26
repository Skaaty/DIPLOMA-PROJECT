import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginImport from 'eslint-plugin-import';
import pluginPromise from 'eslint-plugin-promise';
import pluginJsdoc from 'eslint-plugin-jsdoc';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        window: 'readonly',
        navigator: 'readonly',
        GPUDevice: 'readonly',
        GPUAdapter: 'readonly',
        GPUBuffer: 'readonly',
        GPUTexture: 'readonly',
        WebGL2RenderingContext: 'readonly',
      },
    },
    plugins: {
      import: pluginImport,
      promise: pluginPromise,
      jsdoc: pluginJsdoc,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // Allow for WebGPU descriptors etc.
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',

      'import/order': [
        'warn',
        {
          'newlines-between': 'always',
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
        },
      ],

      'no-console': 'off', // WebGPU debugging
      'no-undef': 'off', // TypeScript already checks this
      'no-constant-condition': ['error', { checkLoops: false }],

      'no-bitwise': 'off', // GPU flags/masks
      'no-plusplus': 'off',
      'no-new': 'off',
    },
    settings: {
      jsdoc: {
        mode: 'typescript',
      },
    },
  },

  {
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
);