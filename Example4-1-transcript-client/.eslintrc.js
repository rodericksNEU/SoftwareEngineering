module.exports = {
  plugins: ['prettier'],
  extends: [
    // 'airbnb-typescript',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parserOptions: {
    project: './tsconfig.json',
    warnOnUnsupportedTypeScriptVersion: false,
  },
  settings: {
    react: {
      version: 'latest',
    },
  },
  ignorePatterns: ['/*.*'],
  rules: {
    'no-underscore-dangle': 0,
    'no-console': 0,
    '@typescript-eslint/no-unused-vars': 0,
  },
};
