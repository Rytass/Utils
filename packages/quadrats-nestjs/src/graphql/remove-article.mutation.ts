export const REMOVE_ARTICLE_MUTATION = `
  mutation RemoveArticle($id: ID!, $auth: AuthInput!) {
    removeArticle(id: $id, auth: $auth)
  }
`;
