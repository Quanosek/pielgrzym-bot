const js = require('@eslint/js')
const nPlugin = require('eslint-plugin-n')
const globals = require('globals')
const prettier = require('eslint-plugin-prettier')
const prettierConfig = require('eslint-config-prettier')

const n = nPlugin.default || nPlugin

module.exports = [
  js.configs.recommended,
  n.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.node, ...globals.nodeBuiltin },
    },
    plugins: { prettier },
    rules: {
      'n/no-unpublished-require': 'off',
      'prettier/prettier': 'warn',
    },
  },
  prettierConfig,
]
