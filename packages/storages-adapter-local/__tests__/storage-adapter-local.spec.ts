/**
 * @jest-environment node
 */

import { LocalStorage } from '../src';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { lstatSync, rmSync, mkdirSync, writeFile, readFileSync, createReadStream } from 'fs';

describe('StorageLocalService', () => {
  const workingDirectory = resolve(__dirname, 'tmp');

  describe('Basic Features', () => {
    const sampleFilePath = resolve(__dirname, '../__fixtures__/test-image.png');
    const fakeFileBuffer = Buffer.from([0x1f, 0x49, 0xf2]);
    const sampleFileBuffer = readFileSync(sampleFilePath);

    const filename = `${createHash('sha256').update(sampleFileBuffer).digest('hex')}.png`;

    const localStorage = new LocalStorage({
      directory: workingDirectory,
      autoMkdir: true,
    });

    describe('Write File', () => {
      let batchTestFiles: string[] = [];

      it('should write buffer file', async () => {
        await localStorage.write(sampleFileBuffer);
        expect(lstatSync(resolve(workingDirectory, filename)).isFile()).toBeTruthy();
      });

      it('should write stream file', async () => {
        const stream = createReadStream(sampleFilePath);

        await localStorage.write(stream);

        expect(lstatSync(resolve(workingDirectory, filename)).isFile()).toBeTruthy();
      });

      it('should batch write files', async () => {
        const result = await localStorage.batchWrite([sampleFileBuffer, fakeFileBuffer]);

        expect(result).toHaveLength(2);
        expect(result[0].key).toBeTruthy();
        expect(result[1].key).toBeTruthy();

        // Verify files exist
        expect(lstatSync(resolve(workingDirectory, result[0].key)).isFile()).toBeTruthy();
        expect(lstatSync(resolve(workingDirectory, result[1].key)).isFile()).toBeTruthy();

        // Store file keys for cleanup in afterEach
        batchTestFiles = result.map(r => r.key);
      });

      afterEach(() => {
        try {
          const filePath = resolve(workingDirectory, filename);

          if (lstatSync(filePath).isFile()) {
            rmSync(filePath);
          }
        } catch {
          // File might not exist, ignore cleanup error
        }

        // Clean up batch test files

        batchTestFiles.forEach(fileKey => {
          try {
            const batchFilePath = resolve(workingDirectory, fileKey);

            if (lstatSync(batchFilePath).isFile()) {
              rmSync(batchFilePath);
            }
          } catch {
            // Ignore cleanup errors
          }
        });

        batchTestFiles = [];
      });
    });

    describe('Write File w/ Custom Filename', () => {
      const customFilename = 'aaa.png';

      it('should use custom filename when write buffer file', async () => {
        const { key } = await localStorage.write(sampleFileBuffer, {
          filename: customFilename,
        });

        expect(key).toBe(customFilename);
      });

      it('should use custom filename when write stream file', async () => {
        const stream = createReadStream(sampleFilePath);

        const { key } = await localStorage.write(stream, {
          filename: customFilename,
        });

        expect(key).toBe(customFilename);
      });

      afterEach(() => {
        try {
          rmSync(resolve(workingDirectory, customFilename));
        } catch {
          // File might not exist, ignore the error
        }
      });
    });

    describe('Read File', () => {
      it('should read file buffer', async () => {
        await localStorage.write(sampleFileBuffer);
        const savedBuffer = await localStorage.read(filename, {
          format: 'buffer',
        });

        expect(savedBuffer.compare(sampleFileBuffer)).toBe(0);
      });

      it('should read file stream', async () => {
        await localStorage.write(sampleFileBuffer);
        const stream = await localStorage.read(filename);

        expect(stream).toBeInstanceOf(Readable);

        return new Promise<void>(resolve => {
          let buffer = Buffer.from([]);

          stream.on('data', chunk => {
            buffer = Buffer.concat([buffer, chunk]);
          });

          stream.on('end', () => {
            expect(buffer.compare(sampleFileBuffer)).toBe(0);
            resolve();
          });
        });
      });

      afterEach(() => {
        try {
          const filePath = resolve(workingDirectory, filename);

          if (lstatSync(filePath).isFile()) {
            rmSync(filePath);
          }
        } catch {
          // File might not exist, ignore cleanup error
        }
      });
    });

    describe('Remove File', () => {
      it('should remove file', async () => {
        await localStorage.write(sampleFileBuffer);
        await localStorage.remove(filename);

        expect(() => lstatSync(resolve(workingDirectory, filename))).toThrow();
      });
    });

    describe('File exists', () => {
      it('should check file exists', async () => {
        await localStorage.write(sampleFileBuffer);

        const notFound = await localStorage.isExists('not-found');
        const exists = await localStorage.isExists(filename);

        expect(notFound).toBeFalsy();
        expect(exists).toBeTruthy();
      });

      afterEach(() => {
        try {
          const filePath = resolve(workingDirectory, filename);

          if (lstatSync(filePath).isFile()) {
            rmSync(filePath);
          }
        } catch {
          // File might not exist, ignore cleanup error
        }
      });
    });

    afterAll(() => {
      rmSync(workingDirectory, { recursive: true, force: true });
    });
  });

  describe('Error handlers', () => {
    it('should throw if directory not exists and no auto mkdir config', () => {
      expect(
        () =>
          new LocalStorage({
            directory: workingDirectory,
          }),
      ).toThrow();
    });

    it('should throw if directory is a file', async () => {
      return new Promise<void>(resolve => {
        writeFile(workingDirectory, Buffer.from([0x00, 0x01]), () => {
          expect(
            () =>
              new LocalStorage({
                directory: workingDirectory,
              }),
          ).toThrow();

          resolve();
        });
      });
    });

    it('should throw when read not exists file', () => {
      const localStorage = new LocalStorage({
        directory: workingDirectory,
        autoMkdir: true,
      });

      expect(() => localStorage.read('nonexistent-file.txt')).toThrow();
    });

    it('should throw when read a folder', () => {
      const localStorage = new LocalStorage({
        directory: workingDirectory,
        autoMkdir: true,
      });

      const fakeDir = resolve(workingDirectory, 'fakeDir');

      mkdirSync(fakeDir);

      expect(() => localStorage.read(fakeDir)).toThrow();
    });

    afterEach(() => {
      try {
        rmSync(workingDirectory, { recursive: true, force: true });
      } catch {
        // Directory might not exist or be inaccessible, ignore cleanup error
      }
    });
  });
});
