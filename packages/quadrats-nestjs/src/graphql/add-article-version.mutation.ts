import { ARTICLE_FRAGMENT } from './article.fragment';

export const ADD_ARTICLE_VERSION_MUTATION = `
  mutation AddArticleVersion(
    $title: String!
    $contents: [ArticleContentInput!]!
    $categoryIds: [ID!]!
    $tags: [String!]!
    $releasedAt: DateTime
    $rootId: ID!
    $auth: AuthInput!
  ) {
    addArticleVersion(
      title: $title
      contents: $contents
      categoryIds: $categoryIds
      tags: $tags
      releasedAt: $releasedAt
      rootId: $rootId
      auth: $auth
    ) {
      ...ArticleFields
    }
  }
  ${ARTICLE_FRAGMENT}
`;
