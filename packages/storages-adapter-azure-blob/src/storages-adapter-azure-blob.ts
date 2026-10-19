import {
  ErrorCode,
  StorageError,
  InputFile,
  StorageFile,
  Storage,
  WriteFileOptions,
  ReadBufferFileOptions,
  ReadStreamFileOptions,
} from '@rytass/storages';
import { v4 as uuid } from 'uuid';
import { Readable, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { AzureBlobOptions } from './typings';
import { ContainerClient } from '@azure/storage-blob';

export class StorageAzureBlobService extends Storage<AzureBlobOptions> {
  private readonly client: BlobServiceClient;

  private readonly container: ContainerClient;

  constructor(options: AzureBlobOptions) {
    super(options);

    this.client = BlobServiceClient.fromConnectionString(options.connectionString);

    this.container = this.client.getContainerClient(options.container);
  }

  async url(key: string, expires = Date.now() + 1000 * 60 * 60 * 24): Promise<string> {
    const permissions = new BlobSASPermissions();

    permissions.read = true;

    const blobClient = this.container.getBlobClient(key);

    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.container.containerName,
        blobName: key,
        permissions,
        startsOn: new Date(),
        expiresOn: new Date(expires),
      },
      blobClient.credential as StorageSharedKeyCredential,
    ).toString();

    return `${blobClient.url}?${sas}`;
  }

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  async read(key: string, options?: ReadBufferFileOptions | ReadStreamFileOptions): Promise<Buffer | Readable> {
    const file = this.container.getBlockBlobClient(key);

    try {
      const response = await file.download();

      if (options?.format === 'buffer') {
        const blob = await response.blobBody;
        const arrayBuffer = (await blob?.arrayBuffer()) as ArrayBuffer;

        return Buffer.from(arrayBuffer);
      }

      return response.readableStreamBody as Readable;
    } catch (ex: unknown) {
      if (
        ex &&
        typeof ex === 'object' &&
        'message' in ex &&
        /does not exist/.test((ex as { message: string }).message)
      ) {
        throw new StorageError(ErrorCode.READ_FILE_ERROR, 'File not found');
      }

      throw ex;
    }
  }

  private async writeStreamFile(stream: Readable, options?: WriteFileOptions): Promise<StorageFile> {
    const givenFilename = options?.filename;

    if (givenFilename) {
      const file = this.container.getBlockBlobClient(givenFilename);

      await file.uploadStream(stream, undefined, undefined, {
        blobHTTPHeaders: {
          ...(options?.contentType ? { blobContentType: options?.contentType } : {}),
        },
      });

      return { key: givenFilename };
    }

    const tempFilename = uuid();
    const uploadStream = new PassThrough();

    const getFilenamePromise = this.getStreamFilename(stream);

    const tempFile = this.container.getBlockBlobClient(tempFilename);

    const uploadTask = tempFile.uploadStream(uploadStream, undefined, undefined, {
      blobHTTPHeaders: {
        ...(options?.contentType ? { blobContentType: options?.contentType } : {}),
      },
    });

    try {
      // pipeline forwards source errors into uploadStream so the upload settles instead of hanging
      const [[filename, mime]] = await Promise.all([getFilenamePromise, pipeline(stream, uploadStream), uploadTask]);

      if (!options?.contentType && mime) {
        await tempFile.setHTTPHeaders({ blobContentType: mime });
      }

      const destFile = this.container.getBlockBlobClient(filename);

      const copyPoller = await destFile.beginCopyFromURL(tempFile.url);
      const copyResult = await copyPoller.pollUntilDone();

      if (copyResult.copyStatus && copyResult.copyStatus !== 'success') {
        throw new StorageError(ErrorCode.WRITE_FILE_ERROR, `Copy temp blob failed: ${copyResult.copyStatus}`);
      }

      await tempFile.delete();

      return { key: filename };
    } catch (ex: unknown) {
      // Destroy with the error: Azure's uploader only listens for 'data'/'end'/'error', so a bare destroy()
      // would leave it pending forever. Then wait for it so it cannot recreate the temp blob after cleanup.
      uploadStream.on('error', (): void => undefined);
      uploadStream.destroy(ex instanceof Error ? ex : new Error(String(ex)));

      await uploadTask.catch((): undefined => undefined);

      // Best-effort cleanup of the temp blob; never mask the original error.
      try {
        await tempFile.deleteIfExists();
      } catch {
        // ignore cleanup failure
      }

      throw ex;
    }
  }

  private async writeBufferFile(buffer: Buffer, options?: WriteFileOptions): Promise<StorageFile> {
    const fileInfo = options?.filename || (await this.getBufferFilename(buffer));

    const filename = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;

    const file = this.container.getBlockBlobClient(filename);

    await file.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        ...(Array.isArray(fileInfo) && fileInfo[1] ? { blobContentType: fileInfo[1] } : {}),
        ...(options?.contentType ? { blobContentType: options?.contentType } : {}),
      },
    });

    return { key: filename };
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    if (file instanceof Buffer) {
      return this.writeBufferFile(file, options);
    }

    return this.writeStreamFile(file as Readable, options);
  }

  batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return Promise.all(files.map(file => this.write(file)));
  }

  async remove(key: string): Promise<void> {
    await this.container.deleteBlob(key);
  }

  isExists(filename: string): Promise<boolean> {
    const file = this.container.getBlockBlobClient(filename);

    return file.exists();
  }
}
