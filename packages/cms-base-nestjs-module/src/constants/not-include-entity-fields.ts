export const ArticleNotIncludeFields = ['id', 'createdAt', 'deletedAt', 'versions', 'categories'];

export const ArticleVersionNotIncludeFields = [
  ...ArticleNotIncludeFields,
  'articleId',
  'article',
  'multiLanguageContents',
  'signatures',
];

export const ArticleVersionContentNotIncludeFields = [
  ...ArticleVersionNotIncludeFields,
  'version',
  'language',
  'articleVersion',
];
