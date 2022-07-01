/**
 * @jest-environment node
 */

import { StorageLocalService } from '../src';
import { ImagesConverter } from '@rytass/storages-images-converter';
import { resolve } from 'path';

describe('StorageLocalService', () => {
  const storage = new StorageLocalService({converters: [ImagesConverter]});
  const fullPath = resolve(__dirname, 'test');

  const textFileName = 'test.txt';

  it('should write and search text file', async () => {
    const file = await storage.readRaw(Buffer.from('test string'));

    const directoryFiles = await storage.search(fullPath);

    expect(
      directoryFiles.includes(resolve(fullPath, textFileName))
    ).toBeTruthy();
  });

  it('should read text file with mime and extension', async () => {
    const storageFile = await storage.read(textFileName, {
      directory: fullPath,
    });

    expect(storageFile.mime).toBe('text/plain');
    expect(storageFile.extension).toBe('txt');
  });

  it('should remove files', async () => {
    await storage.remove(fullPath);
    const directoryFiles = await storage.search(__dirname);

    expect(directoryFiles.includes(fullPath)).toBeFalsy();
  });
});
