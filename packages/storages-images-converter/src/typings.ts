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

export const ImagesConverter: Converter<
  ConvertImageExtensionType,
  ConvertImageExtensionType
> = {
  from: ConvertImageExtension,
  to: ConvertImageExtension,
  load: (extension, buffer) => {
    if (!ConvertImageExtension.includes(extension))
      throw new StorageError(
        ErrorCode.UNRECOGNIZED_ERROR,
        `${extension} not found in ${ConvertImageExtension.join(', ')}`
      );
    const input = sharp(buffer);

    switch (extension) {
      case 'png':
        input.png();
        break;
      case 'webp':
        input.webp();
        break;
      case 'avif':
        input.avif();
        break;
      case 'gif':
        input.gif();
        break;
      case 'tiff':
        input.tiff();
        break;
    }

    return input.toBuffer();
  },
};
