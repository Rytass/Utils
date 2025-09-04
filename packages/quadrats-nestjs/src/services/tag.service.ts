import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { API_HOST, QUADRATS_AUTH_CLIENT } from '../constants';
import { FindTagsOptions } from '../dtos/find-tags-options';
import { TAGS_QUERY } from '../graphql/tags.query';

@Injectable()
export class QuadratsArticleTagService {
  constructor(
    @Inject(API_HOST)
    private readonly apiHost: string,
    @Inject(QUADRATS_AUTH_CLIENT)
    private readonly auth: { accessKey: string; secret: string },
  ) {}

  public async getAll(options: FindTagsOptions = {}): Promise<string[]> {
    const { data } = await axios.request<{ data: { tags: string[] } }>({
      url: `${this.apiHost}/graphql`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        query: TAGS_QUERY,
        variables: {
          limit: options.limit,
          offset: options.offset,
          searchTerm: options.searchTerm,
          auth: this.auth,
        },
      }),
    });

    return data!.data.tags;
  }
}
