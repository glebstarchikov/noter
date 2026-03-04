import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const nextConfigPath = require.resolve('eslint-config-next')
const nextConfigDir = path.dirname(nextConfigPath)
const tsParser = require(require.resolve('@typescript-eslint/parser', { paths: [nextConfigDir] }))
const nextPlugin = require(require.resolve('@next/eslint-plugin-next', { paths: [nextConfigDir] }))
const reactHooksPlugin = require(require.resolve('eslint-plugin-react-hooks', { paths: [nextConfigDir] }))

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'dist/**', 'next-env.d.ts'],
  },
  {
    files: ['app/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}', 'components/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}', 'hooks/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}', 'lib/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]
