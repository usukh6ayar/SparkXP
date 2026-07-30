// Mobile lint config. There was none at all before (docs/CODE_AUDIT.md §M2),
// which is why the app accumulated 71 hardcoded hex colours and dead modules
// without anything flagging them.
//
// Deliberately LENIENT to start: this codebase has never been linted, and a
// wall of errors would just get ignored. Real bug-catchers are errors; style
// debt is a warning so it stays visible while Choi/Boju work through it.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'android/**', 'ios/**', 'dist/**', '.hot-updater/**'],
  },
  {
    // TS files ONLY. eslint-config-expo registers the `@typescript-eslint`
    // plugin in a block scoped to `**/*.ts(x)`, so a rule from that plugin in an
    // unscoped block makes ESLint fail on the .js files (this very config file)
    // with "could not find plugin" — the whole lint run dies, not just those.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // The BASE rule cannot read TypeScript, so it flags the parameter names
      // inside function *types* (`onPress: (id: string) => void`) as "unused" —
      // ~70 false positives that drowned the real ones. TS-aware version only.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Catches the `useEffect` dependency bugs that cause real runtime issues.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // react-three-fiber renders 3D elements (`<ambientLight intensity>`,
    // `<primitive object>`), which the React DOM property rule does not know —
    // it flags every one. Scoped off here so real typos elsewhere still fail.
    files: ['src/components/BuddyAvatar.tsx'],
    rules: { 'react/no-unknown-property': 'off' },
  },
];
