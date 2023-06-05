export const ARTICLE_FRAGMENT = `
  fragment ArticleFields on Article {
    id
    versionId
    title
    categories {
      id
      name
    }
    contents {
      language
      elements
    }
    tags
  }
`;
