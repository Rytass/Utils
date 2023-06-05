import { ARTICLE_FRAGMENT } from './article.fragment';

export const CREATE_ARTICLE_MUTATION = `
  mutation CreateArticle(
    $title: String!
    $contents: [ArticleContentInput!]!
    $categoryIds: [ID!]!
    $tags: [String!]!
    $releasedAt: DateTime
    $auth: AuthInput!
  ) {
    createArticle(
      title: $title
      contents: $contents
      categoryIds: $categoryIds
      tags: $tags
      releasedAt: $releasedAt
      auth: $auth
    ) {
      ...ArticleFields
    }
  }
  ${ARTICLE_FRAGMENT}
`;
