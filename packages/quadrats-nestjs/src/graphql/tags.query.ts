export const TAGS_QUERY = `
  query Tags(
    $limit: Int = 20
    $offset: Int = 0
    $auth: AuthInput!
    $searchTerm: String
  ) {
    tags(
      limit: $limit
      offset: $offset
      auth: $auth
      searchTerm: $searchTerm
    )
  }
`;
