import { CATEGORY_FRAGMENT } from './category.fragment';

export const FIND_CATEGORY_QUERY = `
  query Category($id: ID!, $auth: AuthInput!) {
    findCategory(id: $id, auth: $auth) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FRAGMENT}
`;
