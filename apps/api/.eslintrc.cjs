module.exports = {
  root: true,
  extends: ['../../packages/eslint-config/index.js'],
  parserOptions: {
    project: false,
  },
  rules: {
    // Legacy Nest/Prisma code uses intentional `any` in places; warn, don't block CI.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'prettier/prettier': 'off',
    'no-console': 'off',
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.js', '*.cjs'],
};
