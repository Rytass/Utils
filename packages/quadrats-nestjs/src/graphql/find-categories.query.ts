import { CATEGORY_FRAGMENT } from './category.fragment';

export const FIND_CATEGORIES_QUERY = `
  query Categories($auth: AuthInput!) {
    findCategories(auth: $auth) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FRAGMENT}
`;
