export const ARTICLE_IDS_QUERY = `
  query ArticleIds(
    $limit: Int = 20
    $offset: Int = 0
    $categoryIds: [ID!]
    $tags: [ID!]
    $auth: AuthInput!
  ) {
    articleIds(
      limit: $limit
      offset: $offset
      categoryIds: $categoryIds
      tags: $tags
      auth: $auth
    )
  }
`
