export default {
  extends: ['@commitlint/config-conventional', '@commitlint/config-lerna-scopes'],
  rules: {
    'subject-case': [0], // 允許任何大小寫格式
    'header-max-length': [2, 'always', 100],
  },
};
