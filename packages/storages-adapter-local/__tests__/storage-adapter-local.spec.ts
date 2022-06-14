/**
 * @jest-environment node
 */

import { StorageLocalService } from '../src';
import { resolve } from 'path';

describe('StorageLocalService', () => {
  const storage = new StorageLocalService();
  const fileName = 'unit_test.txt';
  const unitTestString = 'test_string';

  it('should write and search file', async () => {
    const file = await storage.createFile(Buffer.from(unitTestString));

    storage.writeSync(file, { directory: __dirname, fileName });
    const directoryFiles = await storage.search(__dirname);

    expect(directoryFiles.includes(resolve(__dirname, fileName))).toBeTruthy();
  });

  it('should read file', async () => {
    const storageFile = await storage.read(fileName, {directory: __dirname})

    expect(storageFile.mime).toBe('text/plain');
    expect(storageFile.extension).toBe('txt');
  });

  it('should remove file', async() => {
    await storage.remove(resolve(__dirname, fileName))
    const directoryFiles = await storage.search(__dirname);

    expect(directoryFiles.includes(resolve(__dirname, fileName))).toBeFalsy()

  })
});
