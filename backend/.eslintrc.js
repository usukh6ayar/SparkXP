/**
 * ESLint config for the NestJS API.
 *
 * This file was MISSING — `package.json` declared a `lint` script but running
 * it failed with "ESLint couldn't find a configuration file", so the
 * commit checklist in CODING_RULES.md §6 could never actually be run
 * (docs/CODE_AUDIT.md §M1).
 *
 * Rules are deliberately close to the NestJS default preset: the goal is to
 * catch real mistakes on a 17k-line codebase that has never been linted, not
 * to force a style rewrite. Anything noisy-but-harmless is a warning.
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // tsconfig.json EXCLUDES test/, so linting {src,test} against it alone
    // fails with "parserOptions.project has been provided". tsconfig.test.json
    // includes both, which is exactly the lint surface.
    project: ['tsconfig.json', 'tsconfig.test.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: ['.eslintrc.js', 'dist/**', 'node_modules/**'],
  rules: {
    // Nest relies on decorator metadata and DI; explicit return types on every
    // controller method would be noise.
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // `any` appears in AI-provider payloads and jsonb columns where the shape
    // genuinely isn't known. Warn so it stays visible without blocking.
    '@typescript-eslint/no-explicit-any': 'warn',

    // Real bug catchers — these stay as errors.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-floating-promises': 'error',

    // Formatting is Prettier's job, not a review argument.
    'prettier/prettier': 'warn',
  },
};
