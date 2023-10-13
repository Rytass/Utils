import { Inject, Injectable } from '@nestjs/common';
import { API_HOST, QUADRATS_AUTH_CLIENT } from '../constants';
import { QuadratsArticle } from '../dtos/quadrats-article';
import { CreateArticleOptions } from '../dtos/create-article-options';
import { CREATE_ARTICLE_MUTATION } from '../graphql/create-article.mutation';
import { ARTICLE_QUERY } from '../graphql/article.query';
import { FindArticleIdsOptions } from '../dtos/find-article-ids-options';
import { ARTICLE_IDS_QUERY } from '../graphql/article-ids.query';
import { REMOVE_ARTICLE_MUTATION } from '../graphql/remove-article.mutation';
import { AddArticleVersionOptions } from '../dtos/add-article-version-options';
import { ADD_ARTICLE_VERSION_MUTATION } from '../graphql/add-article-version.mutation';
import axios from 'axios';
import { Language } from '../language';
import {QuadratsModule} from '../module';

@Injectable()
export class QuadratsArticleService {
  private readonly apiHost: string;
  constructor(
    @Inject(API_HOST)
    private readonly hostConfig: { host: string },
    @Inject(QUADRATS_AUTH_CLIENT)
    private readonly auth: { accessKey: string, secret: string },
  ) {
    this.apiHost = this.hostConfig.host ?? QuadratsModule.DEFAULT_HOST
  }

  public async addVersion(options: AddArticleVersionOptions): Promise<QuadratsArticle> {
    if (!Array.isArray(options.contents) && !Array.isArray(options.languageContents)) {
      throw new Error('`contents` or `languageContents` should be set');
    }

    const { data } = await axios.request<{ data: { addArticleVersion: QuadratsArticle } }>({
      url: `${this.apiHost}/graphql`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        query: ADD_ARTICLE_VERSION_MUTATION,
        variables: {
          rootId: options.id,
          title: options.title,
          contents: Array.isArray(options.languageContents) ? (options.languageContents)
            .map(content => ({
              ...content,
              language: content.language,
            })) : [
            {
              language: options.language ?? Language.DEFAULT,
              elements: options.contents,
            },
          ],
          categoryIds: options.categoryIds,
          tags: options.tags,
          releasedAt: options.releasedAt || null,
          auth: this.auth,
        },
      }),
    });

    return data.data.addArticleVersion;
  }

  public async create(options: CreateArticleOptions): Promise<QuadratsArticle> {
    if (!Array.isArray(options.contents) && !Array.isArray(options.languageContents)) {
      throw new Error('`contents` or `languageContents` should be set');
    }

    const { data } = await axios.request<{ data: { createArticle: QuadratsArticle } }>({
      url: `${this.apiHost}/graphql`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        query: CREATE_ARTICLE_MUTATION,
        variables: {
          title: options.title,
          contents: Array.isArray(options.languageContents) ? (options.languageContents)
            .map(content => ({
              ...content,
              language: content.language,
            })) : [
            {
              language: options.language ?? Language.DEFAULT,
              elements: options.contents,
            },
          ],
          categoryIds: options.categoryIds,
          tags: options.tags,
          releasedAt: options.releasedAt || null,
          auth: this.auth,
        },
      }),
    });

    return data.data.createArticle;
  }

  public async get(id: string, versionId?: string): Promise<QuadratsArticle | null> {
    const { data } = await axios.request<{ data: { article: QuadratsArticle } }>({
      url: `${this.apiHost}/graphql`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        query: ARTICLE_QUERY,
        variables: {
          id,
          versionId: versionId ?? null,
          auth: this.auth,
        },
      }),
    });

    return data.data.article;
  }

  public async remove(id: string): Promise<string | null> {
    const { data } = await axios.request<{ data: { removeArticle: string } }>({
      url: `${this.apiHost}/graphql`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        query: REMOVE_ARTICLE_MUTATION,
        variables: {
          id,
          auth: this.auth,
        },
      }),
    });

    return data.data.removeArticle;
  }

  public async getIds(options: FindArticleIdsOptions = {}): Promise<string[]> {
    const { data } = await axios.request<{ data: { articleIds: string[] } }>({
      url: `${this.apiHost}/graphql`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        query: ARTICLE_IDS_QUERY,
        variables: {
          limit: options.limit,
          offset: options.offset,
          categoryIds: options.categoryIds,
          tags: options.tags,
          auth: this.auth,
        },
      }),
    });

    return data.data.articleIds;
  }
}
