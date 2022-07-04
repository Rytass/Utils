import { Converter, ErrorCode, StorageError } from '@rytass/storages';
import sharp from 'sharp';

type ConvertImageExtensionType =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'avif'
  | 'gif'
  | 'tiff';

const ConvertImageExtension: ConvertImageExtensionType[] = [
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'tiff',
];

export interface ImageConverterOptions {
  resize?: {
    width?: number, height?: number
  },
  quality?: number
}

export const ImagesConverter: Converter<
  ConvertImageExtensionType,
  ConvertImageExtensionType,
  ImageConverterOptions
> = {
  from: ConvertImageExtension,
  to: ConvertImageExtension,
  load: (extension, buffer, options) => {
    if (!ConvertImageExtension.includes(extension))
      throw new StorageError(
        ErrorCode.UNRECOGNIZED_ERROR,
        `${extension} not found in ${ConvertImageExtension.join(', ')}`
      );
    const input = sharp(buffer);

    if (options?.resize)
        input.resize(options.resize)
    switch (extension) {
      case 'jpeg':
        input.jpeg({quality: options?.quality});
        break;
      case 'png':
        input.png({quality: options?.quality});
        break;
      case 'webp':
        input.webp({quality: options?.quality});
        break;
      case 'avif':
        input.avif({quality: options?.quality});
        break;
      case 'gif':
        input.gif();
        break;
      case 'tiff':
        input.tiff({quality: options?.quality});
        break;
    }

    return input.toBuffer();
  },
};