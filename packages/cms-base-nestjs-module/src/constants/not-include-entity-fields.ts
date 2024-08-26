export const ArticleNotIncludeFields = ['versions', 'categories'];

export const ArticleVersionNotIncludeFields = [
  ...ArticleNotIncludeFields,
  'articleId',
  'createdAt',
  'deletedAt',
  'article',
  'multiLanguageContents',
];

export const ArticleVersionContentNotIncludeFields = [
  ...ArticleVersionNotIncludeFields,
  'version',
  'language',
  'articleVersion',
];
