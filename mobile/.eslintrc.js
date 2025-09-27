module.exports = {
  extends: ['expo'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
    'react-native/no-inline-styles': 'warn',
    'no-unused-vars': 'warn',
    'no-console': 'warn',
  },
  ignorePatterns: ['node_modules/', 'dist/', '*.config.js', 'jest.setup.js'],
};