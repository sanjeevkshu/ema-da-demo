module.exports = {
  root: true,
  extends: 'airbnb-base',
  env: {
    browser: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: true,
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'import/extensions': ['error', { js: 'always' }], // require js file extensions in imports
    'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
    'no-param-reassign': [2, { props: false }], // allow modifying properties of param
  },
  overrides: [{
    // Playwright integration specs run in Node, not the browser: for...of is
    // the idiomatic way to generate tests there.
    files: ['test/integration/**/*.js'],
    env: { node: true },
    rules: { 'no-restricted-syntax': 'off' },
  }, {
    // Design gate: Node-side Playwright specs and scripts that walk pages in order.
    files: ['test/design/**/*.js', 'test/design/**/*.mjs'],
    env: { node: true },
    rules: {
      'no-restricted-syntax': 'off',
      'no-await-in-loop': 'off',
      'no-continue': 'off',
      'no-console': 'off',
      'import/extensions': ['error', { js: 'always', mjs: 'always' }],
      'max-len': ['error', { code: 140, ignoreStrings: true, ignoreTemplateLiterals: true }],
    },
  }],
};
