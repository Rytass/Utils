/**
 * @jest-environment node
 */

import { StorageLocalService } from '../src';
import { ImagesConverter } from '@rytass/storages-images-converter';
import { resolve } from 'path';

describe('StorageLocalService', () => {
  const storage = new StorageLocalService({ converters: [ImagesConverter] });

  const workingDirectory = resolve(__dirname, 'test');

  it('should write and search text file', async () => {
    const fileName = 'testFile.txt';

    await storage.write('test string', {
      fileName: fileName,
      directory: workingDirectory,
      autoMkdir: true,
    });

    const files = await storage.search(workingDirectory);

    expect(files.includes(resolve(workingDirectory, fileName))).toBeTruthy();

    await storage.remove(resolve(workingDirectory));
  });

  it('should read image file', async () => {
    const fileName = 'test.png';
    const file = await storage.read(fileName, {
      directory: resolve(__dirname, 'statics'),
    });

    expect(file.mime).toEqual('image/png');
    expect(file.extension).toEqual('png');
  });

  it('should read image buffer with mime and saved', async () => {
    const fileName = 'testTruncated.png';
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02,
    ]);

    const file = await storage.readRaw(buffer);

    expect(file.mime).toEqual('image/png');

    await file.write({
      directory: __dirname,
      fileName: fileName,
    });

    const files = await storage.search(__dirname);

    expect(files.includes(resolve(__dirname, fileName))).toBeTruthy();
    await storage.remove(resolve(__dirname, fileName));
  });
});
