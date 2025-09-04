import { Inject, Injectable } from '@nestjs/common';
import { API_HOST, QUADRATS_AUTH_CLIENT } from '../constants';
import { QuadratsArticleCategory } from '../dtos/quadrats-article-category';
import { FIND_CATEGORIES_QUERY } from '../graphql/find-categories.query';
import { FIND_CATEGORY_QUERY } from '../graphql/find-category.query';
import { CREATE_CATEGORY_MUTATION } from '../graphql/create-category.mutation';
import { RENAME_CATEGORY_MUTATION } from '../graphql/rename-category.mutation';
import axios from 'axios';

@Injectable()
export class QuadratsArticleCategoryService {
  constructor(
    @Inject(API_HOST)
    private readonly apiHost: string,
    @Inject(QUADRATS_AUTH_CLIENT)
    private readonly auth: { accessKey: string; secret: string },
  ) {}

  public async getAll(): Promise<QuadratsArticleCategory[]> {
    const { data } = await axios.request<{ data: { findCategories: QuadratsArticleCategory[] } }>({
      url: `${this.apiHost}/graphql`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        query: FIND_CATEGORIES_QUERY,
        variables: { auth: this.auth },
      }),
    });

    return data.data.findCategories;
  }

  public async get(id: string): Promise<QuadratsArticleCategory | null> {
    const { data } = await axios.request<{ data: { findCategory: QuadratsArticleCategory | null } }>({
      url: `${this.apiHost}/graphql`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        query: FIND_CATEGORY_QUERY,
        variables: { id, auth: this.auth },
      }),
    });

    return data.data.findCategory;
  }

  public async create(name: string, parentId?: string): Promise<QuadratsArticleCategory> {
    const { data } = await axios.request<{ data: { createCategory: QuadratsArticleCategory } }>({
      url: `${this.apiHost}/graphql`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        query: CREATE_CATEGORY_MUTATION,
        variables: {
          name,
          parentId,
          auth: this.auth,
        },
      }),
    });

    return data.data.createCategory;
  }

  public async rename(id: string, newName: string): Promise<QuadratsArticleCategory> {
    const { data } = await axios.request<{ data: { renameCategory: QuadratsArticleCategory } }>({
      url: `${this.apiHost}/graphql`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        query: RENAME_CATEGORY_MUTATION,
        variables: {
          id,
          name: newName,
          auth: this.auth,
        },
      }),
    });

    return data.data.renameCategory;
  }
}
