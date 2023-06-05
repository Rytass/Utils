import { CATEGORY_FRAGMENT } from './category.fragment';

export const RENAME_CATEGORY_MUTATION = `
  mutation RenameCategory($id: ID!, $name: String!, $auth: AuthInput!) {
    renameCategory(id: $id, name: $name, auth: $auth) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FRAGMENT}
`;
