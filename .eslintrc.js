/**
 * ════════════════════════════════════════════════════════════════════════════
 * ESLINT CONFIGURATION - Enterprise Level
 * ════════════════════════════════════════════════════════════════════════════
 */

module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script' // CommonJS por defecto (require/module.exports)
  },
  rules: {
    // Errores comunes
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],
    'no-console': 'off', // Permitir console en Electron
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

    // Mejores prácticas
    'prefer-const': 'warn',
    'no-var': 'error',
    'object-shorthand': 'warn',
    'prefer-arrow-callback': 'warn',

    // Estilo (dejar a Prettier)
    indent: 'off',
    quotes: 'off',
    semi: 'off',
    'comma-dangle': 'off'
  },
  globals: {
    // Electron
    electron: 'readonly',
    ipcRenderer: 'readonly',
    ipcMain: 'readonly',
    BrowserWindow: 'readonly',
    app: 'readonly',

    // Node.js
    require: 'readonly',
    module: 'readonly',
    process: 'readonly',
    Buffer: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',

    // Renderer globals
    MODELS: 'readonly',
    window: 'readonly',
    document: 'readonly',
    navigator: 'readonly'
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'out/',
    '.electron-cache/',
    '*.min.js',
    'package.json',
    'package-lock.json',
    'nodemon.json'
  ],
  overrides: [
    {
      files: ['src/app/renderer/components/app.js'],
      rules: {
        'no-control-regex': 'off'
      }
    }
  ]
};
