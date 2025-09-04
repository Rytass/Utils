import { Inject, Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import FormData from 'form-data';
import axios from 'axios';
import { API_HOST, QUADRATS_AUTH_CLIENT } from '../constants';
import { ImageDetailURL } from '../dtos/image-detail-url';

@Injectable()
export class QuadratsArticleImageService {
  constructor(
    @Inject(API_HOST)
    private readonly apiHost: string,
    @Inject(QUADRATS_AUTH_CLIENT)
    private readonly auth: { accessKey: string; secret: string },
  ) {}

  async uploadImage(image: Buffer | Readable, urlMode?: false): Promise<string>;
  async uploadImage(image: Buffer | Readable, urlMode?: true): Promise<ImageDetailURL>;
  async uploadImage(image: Buffer | Readable, urlMode = false): Promise<string | ImageDetailURL> {
    const formData = new FormData();

    formData.append('accessKey', this.auth.accessKey);
    formData.append('secret', this.auth.secret);
    formData.append('images', image, 'image.jpg'); // Filename is required

    if (urlMode) {
      const { data } = await axios.request<string[]>({
        url: `${this.apiHost}/images`,
        method: 'post',
        data: image instanceof Buffer ? formData.getBuffer() : formData,
        headers: {
          ...formData.getHeaders(),
          'X-CMS-RESP-TYPE': 'VARIANTS',
        },
      });

      return data[0];
    }

    const { data } = await axios.request<ImageDetailURL[]>({
      url: `${this.apiHost}/images`,
      method: 'post',
      data: image instanceof Buffer ? formData.getBuffer() : formData,
      headers: {
        ...formData.getHeaders(),
      },
    });

    return data[0];
  }
}
