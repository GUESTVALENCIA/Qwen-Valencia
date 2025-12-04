/**
 * ════════════════════════════════════════════════════════════════════════════
 * LINT-STAGED CONFIGURATION - Pre-commit hooks
 * ════════════════════════════════════════════════════════════════════════════
 */

module.exports = {
  '*.js': [
    'eslint --fix',
    'prettier --write'
  ],
  '*.json': [
    'prettier --write'
  ],
  '*.{html,css,md}': [
    'prettier --write'
  ]
};

