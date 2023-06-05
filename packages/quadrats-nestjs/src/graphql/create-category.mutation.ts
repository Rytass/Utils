import { CATEGORY_FRAGMENT } from './category.fragment';

export const CREATE_CATEGORY_MUTATION = `
  mutation CreateCategory($name: String!, $parentId: ID, $auth: AuthInput!) {
    createCategory(name: $name, parentId: $parentId, auth: $auth) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FRAGMENT}
`;
