export const CATEGORY_FRAGMENT = `
  fragment CategoryFields on Category {
    id
    name
    subCategories {
      id
      name
    }
  }
`;
