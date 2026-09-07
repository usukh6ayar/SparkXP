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

      // --- React Compiler rules, new in eslint-config-expo 57 (SDK 57) ---
      //
      // These arrived as ERRORS on ~100 existing, correct call sites the day the
      // SDK was upgraded — no code had changed. They assume render-pure,
      // compiler-friendly components, and the two libraries this app is built on
      // require exactly the patterns they forbid:
      //
      //  • Reanimated worklets ARE mutation (`sharedValue.value = x`, and gesture
      //    handlers writing to refs) → `immutability` / `refs`;
      //  • react-three-fiber's `useFrame` mutates the scene graph every frame,
      //    which is the entire point of a frame loop → `purity` / `immutability`;
      //  • `set-state-in-effect` fires on the ordinary "load, then show" effect
      //    used all over the screens.
      //
      // Kept as WARNINGS so the advice stays visible without failing `npm run
      // lint` for everyone, which is how a lint run gets ignored (see the note
      // at the top of this file). Turn one back into an error only together with
      // the work to clear it.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
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
