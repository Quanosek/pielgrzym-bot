const js = require('@eslint/js')
const n = require('eslint-plugin-n')
const globals = require('globals')
const prettierConfig = require('eslint-config-prettier')
const prettier = require('eslint-plugin-prettier')

module.exports = [
  js.configs.recommended,
  n.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.node, ...globals.nodeBuiltin },
    },
  },
  {
    files: ['*.config.js', 'ecosystem.config.js'],
    rules: { 'n/no-unpublished-require': 'off' },
  },
  prettierConfig,
  {
    plugins: { prettier },
    rules: { 'prettier/prettier': 'warn' },
  },
]
