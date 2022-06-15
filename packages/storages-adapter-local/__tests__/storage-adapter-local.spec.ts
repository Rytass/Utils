/**
 * @jest-environment node
 */

import { StorageLocalService } from '../src';
import { resolve } from 'path';

describe('StorageLocalService', () => {
  const storage = new StorageLocalService();
  const fileName = 'unit_test.txt';
  const unitTestString = 'test_string';
  const fullPath = resolve(__dirname, 'test')

  it('should write and search file', async () => {
    const file = await storage.createFile(Buffer.from(unitTestString));

    storage.writeSync(file, { directory: fullPath, fileName, autoMkdir: true });
    const directoryFiles = await storage.search(fullPath);

    expect(directoryFiles.includes(resolve(fullPath, fileName))).toBeTruthy();
  });

  it('should read file', async () => {
    const storageFile = await storage.read(fileName, {directory: fullPath})

    expect(storageFile.mime).toBe('text/plain');
    expect(storageFile.extension).toBe('txt');
  });

  it('should remove file', async() => {
    await storage.remove(fullPath)
    const directoryFiles = await storage.search(fullPath);

    expect(directoryFiles.includes(resolve(fullPath, fileName))).toBeFalsy()

  })
});
