import { ARTICLE_FRAGMENT } from './article.fragment';

export const ARTICLE_QUERY = `
  query Article($id: ID!, $auth: AuthInput!, $versionId: ID) {
    article(id: $id, auth: $auth, versionId: $versionId) {
      ...ArticleFields
    }
  }
  ${ARTICLE_FRAGMENT}
`;
