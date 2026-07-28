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
    // eslint-config-expo already wires the TS plugin; only override rules here.
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Catches the `useEffect` dependency bugs that cause real runtime issues.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
