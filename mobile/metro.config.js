// Metro bundler config. Expo's defaults + one resolver fix.
//
// ⚠️ Native/build config — lead-owned (see CLAUDE.md). After pulling a change
// here everyone must restart Metro with a cleared cache (`npm run go`, which
// already passes `-c`).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// --- One copy of three.js -----------------------------------------------
// three ships two builds and lists both in its `exports` map: `three.module.js`
// (import) and `three.cjs` (require). Metro honours the condition of whoever is
// asking, so our ESM importers (BuddyAvatar.tsx, three-stdlib) pulled the ESM
// build while @react-three/fiber's prebuilt CJS pulled the CJS one — both ended
// up in the bundle. Two copies means two sets of classes, so `instanceof`
// checks across the boundary fail, and three itself logs
// "WARNING: Multiple instances of Three.js being imported."
//
// Pinning the bare `three` specifier to a single build makes every importer
// share one instance. Subpaths (`three/examples/jsm/...`) are left alone.
const THREE_ENTRY = path.resolve(__dirname, 'node_modules/three/build/three.module.js');

const expoResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: THREE_ENTRY };
  }
  // Chain to Expo's resolver if it has one, otherwise Metro's default.
  const next = typeof expoResolveRequest === 'function' ? expoResolveRequest : context.resolveRequest;
  return next(context, moduleName, platform);
};

module.exports = config;
