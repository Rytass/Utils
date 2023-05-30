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
    const fakeFileBuffer = Buffer.from([0x1F, 0x49, 0xF2]);
    const sampleFileBuffer = readFileSync(sampleFilePath);

    const fakeFilename = createHash('sha256').update(fakeFileBuffer).digest('hex');
    const filename = `${createHash('sha256').update(sampleFileBuffer).digest('hex')}.png`;

    const localStorage = new LocalStorage({
      directory: workingDirectory,
      autoMkdir: true,
    });

    describe('Write File', () => {
      it('should write buffer file', (done) => {
        localStorage.write(sampleFileBuffer).then(() => {
          expect(lstatSync(resolve(workingDirectory, filename)).isFile()).toBeTruthy();

          done();
        });
      });

      it('should write stream file', (done) => {
        const stream = createReadStream(sampleFilePath);

        localStorage.write(stream).then(() => {
          expect(lstatSync(resolve(workingDirectory, filename)).isFile()).toBeTruthy();

          done();
        });
      });

      it('should batch write files', (done) => {
        const stream = createReadStream(sampleFilePath);

        localStorage.batchWrite([stream, fakeFileBuffer]).then(async (uploadFiles) => {
          expect(uploadFiles[0].key).toBe(filename);
          expect(uploadFiles[1].key).toBe(fakeFilename);

          const savedBuffer = await localStorage.read(filename, { format: 'buffer' });

          expect(savedBuffer.compare(sampleFileBuffer)).toBe(0);

          const savedFakeBuffer = await localStorage.read(fakeFilename, { format: 'buffer' });

          expect(savedFakeBuffer.compare(fakeFileBuffer)).toBe(0);

          rmSync(resolve(workingDirectory, fakeFilename));

          done();
        });
      });

      it('should use some disk space', (done) => {
        localStorage.getUsageInfo().then((usage) => {
          expect(usage.used).toBeGreaterThan(0);

          done();
        });
      });

      afterEach(() => {
        rmSync(resolve(workingDirectory, filename));
      });
    });

    describe('Write File w/ Custom Filename', () => {
      const customFilename = 'aaa.png';

      it('should use custom filename when write buffer file', async () => {
        const { key } = await localStorage.write(sampleFileBuffer, { filename: customFilename });

        expect(key).toBe(customFilename);
      });

      it('should use custom filename when write stream file', async () => {
        const stream = createReadStream(sampleFilePath);

        const { key } = await localStorage.write(stream, { filename: customFilename });

        expect(key).toBe(customFilename);
      });

      afterEach(() => {
        rmSync(resolve(workingDirectory, customFilename));
      });
    });

    describe('Read File', () => {
      it('should read file buffer', (done) => {
        localStorage.write(sampleFileBuffer).then(async () => {
          const savedBuffer = await localStorage.read(filename, { format: 'buffer' });

          expect(savedBuffer.compare(sampleFileBuffer)).toBe(0);

          done();
        });
      });

      it('should read file stream', (done) => {
        localStorage.write(sampleFileBuffer).then(async () => {
          const stream = await localStorage.read(filename);

          expect(stream).toBeInstanceOf(Readable);

          let buffer = Buffer.from([]);

          stream.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
          });

          stream.on('end', () => {
            expect(buffer.compare(sampleFileBuffer)).toBe(0);

            done();
          });
        });
      });

      afterEach(() => {
        rmSync(resolve(workingDirectory, filename));
      });
    });

    describe('Remove File', () => {
      it('should remove file', (done) => {
        localStorage.write(sampleFileBuffer).then(async () => {
          await localStorage.remove(filename);

          expect(() => lstatSync(resolve(workingDirectory, filename))).toThrow();

          done();
        });
      });
    });

    describe('File exists', () => {
      it('should check file exists', async () => {
        const localStorage = new LocalStorage({
          directory: workingDirectory,
          autoMkdir: true,
        });

        await localStorage.write(sampleFileBuffer);

        const notFound = await localStorage.isExists('not-found');
        const exists = await localStorage.isExists(filename);

        expect(notFound).toBeFalsy();
        expect(exists).toBeTruthy();
      });
    });

    afterAll(() => {
      rmSync(workingDirectory, { recursive: true, force: true });
    });
  });

  describe('Error handlers', () => {
    it('should throw if directory not exists and no auto mkdir config', () => {
      expect(() => new LocalStorage({
        directory: workingDirectory,
      })).toThrow();
    });

    it('should throw if directory is a file', (done) => {
      writeFile(workingDirectory, Buffer.from([0x00, 0x01]), () => {
        expect(() => new LocalStorage({
          directory: workingDirectory,
        })).toThrow();

        rmSync(workingDirectory, { recursive: true, force: true });

        done();
      });
    });

    it('should throw when read not exists file', () => {
      const localStorage = new LocalStorage({
        directory: workingDirectory,
        autoMkdir: true,
      });

      expect(() => localStorage.read('notexistsfile.txt')).toThrow();

      rmSync(workingDirectory, { recursive: true, force: true });
    });

    it('should throw when read a folder', () => {
      const localStorage = new LocalStorage({
        directory: workingDirectory,
        autoMkdir: true,
      });

      const fakeDir = resolve(workingDirectory, 'fakeDir');

      mkdirSync(fakeDir);

      expect(() => localStorage.read(fakeDir)).toThrow();

      rmSync(workingDirectory, { recursive: true, force: true });
    });
  });
});
