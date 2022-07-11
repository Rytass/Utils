import { StorageLocalService } from '@rytass/storages-adapter-local';
import { ImagesConverter } from '../src';
import { resolve } from 'path';

describe('StorageImagesConverter', () => {
  const storage = new StorageLocalService({ converters: [ImagesConverter] });
  const workingDirectory = resolve(__dirname, 'statics');

  it('should convert png to jpeg and save', async () => {
    const file = await storage.read('test-image.png', {
      directory: workingDirectory,
    });

    expect(file.mime).toBe('image/png');

    const buf = await file.to('jpeg');

    expect(buf).toBeTruthy();

    if (buf) {
      const convertedFile = await storage.readRaw(buf);

      expect(convertedFile.mime).toBe('image/jpeg');

      await convertedFile.write({
        directory: workingDirectory,
        fileName: 'test.jpeg',
      });

      const files = await storage.search(workingDirectory);

      expect(files.includes(resolve(workingDirectory, 'test.jpeg'))).toBeTruthy;
      storage.remove(resolve(workingDirectory, 'test.jpeg'));
    }
  });

  it('should convert png to jpeg with resizement and save', async () => {
    const file = await storage.read('test-image.png', {
      directory: workingDirectory,
    });

    const buf = await file.to('jpeg', { resize: { width: 50 } });

    expect(buf).toBeTruthy();
    expect(buf?.length).toBeLessThan(file.buffer.length);
  });
});
