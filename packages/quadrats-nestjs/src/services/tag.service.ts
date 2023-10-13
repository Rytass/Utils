import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { API_HOST, QUADRATS_AUTH_CLIENT } from '../constants';
import { FindTagsOptions } from '../dtos/find-tags-options';
import { TAGS_QUERY } from '../graphql/tags.query';
import {QuadratsModule} from '../module';

@Injectable()
export class QuadratsArticleTagService {
  private readonly apiHost: string;
  constructor(
    @Inject(API_HOST)
    private readonly hostConfig: { host: string },
    @Inject(QUADRATS_AUTH_CLIENT)
    private readonly auth: { accessKey: string, secret: string },
  ) {
    this.apiHost = this.hostConfig.host ?? QuadratsModule.DEFAULT_HOST
  }

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
