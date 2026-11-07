module.exports = {
  root: true,
  env: { browser: true, es2022: true, worker: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  settings: { react: { version: '18.2' } },
  rules: { 'react/prop-types': 'off' },
  ignorePatterns: ['dist/', 'node_modules/', '.tools/', 'bridge/runtime/', 'test-results/'],
  overrides: [{ files: ['*.config.js', '*.config.mjs', '*.config.cjs', 'bridge/**', 'scripts/**', 'tests/**'], env: { node: true } }],
};
