import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  settings: { react: { version: '18.3' } },
  ignores: ['dist', '.storybook', 'infra/index.ts'],
  extends: [
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    eslintConfigPrettier,
  ],
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
    parserOptions: {
      project: [
        // ordered by project file inclusivity
        './tsconfig.test.json',
        './tsconfig.app.json',
        './tsconfig.node.json',
      ],
      projectFolderIgnoreList: ['./.storybook', './infra'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  plugins: {
    react,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  rules: {
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
});
