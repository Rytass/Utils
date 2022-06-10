/**
 * @jest-environment node
 */

import { StorageLocalService } from '../src';
import fs from 'fs';
import { join } from 'path';

describe('StorageLocalService', () => {
  const storage = new StorageLocalService();
  const fileName = 'unit_test.txt';
  const unitTestString = 'test_string';

  it('should write file', async () => {
    const file = await storage.createFile(Buffer.from(unitTestString));

    storage.writeSync(file, { directory: __dirname, fileName });
    const directoryFiles = await storage.find(__dirname);

    expect(directoryFiles.includes(fileName)).toBeTruthy();
  });

  it('should read file', async () => {
    const storageFile = await storage.createFile(
      fs.readFileSync(join(__dirname, fileName))
    );

    expect(storageFile.mime).toBe('text/plain');
    expect(storageFile.extension).toBe('txt');
  });
});
