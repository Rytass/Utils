# Base Interfaces Reference

Complete specifications for the `@rytass/storages` base package interfaces and types.

## StorageInterface

The core interface that all storage adapters must implement.

### Complete Interface Definition

```typescript
interface StorageInterface {
  write(file: InputFile): Promise<StorageFile>;
  batchWrite(files: InputFile[]): Promise<StorageFile[]>;

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;

  remove(key: string): Promise<void>;
}
```

### Method Specifications

#### `write(file, options?)`

Upload a single file to storage.

**Signature:**
```typescript
write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile>
```

**Parameters:**
- `file`: `Buffer | Readable` - File content to upload
- `options.filename?`: `string` - Custom filename (if not provided, auto-generates hash-based name)
- `options.contentType?`: `string` - MIME type of the file

**Returns:**
- `Promise<StorageFile>` - Object containing the storage key

**Implementation Notes:**
- MUST handle both Buffer and Readable stream inputs
- MUST apply file converters if configured (`converterManager.convert()`)
- MUST use hash-based filename generation if `options.filename` not provided
- SHOULD detect file type automatically if `options.contentType` not provided

**Example Usage:**
```typescript
// Upload Buffer with custom filename
const buffer = readFileSync('./document.pdf');
const file = await storage.write(buffer, {
  filename: 'documents/report.pdf',
  contentType: 'application/pdf',
});
console.log(file.key); // 'documents/report.pdf'

// Upload Stream with auto-generated filename
const stream = createReadStream('./photo.jpg');
const file = await storage.write(stream);
console.log(file.key); // 'a3f2c1b4e5d6...abc123.jpg'
```

#### `batchWrite(files, options?)`

Upload multiple files concurrently.

**Signature:**
```typescript
batchWrite(files: InputFile[], options?: WriteFileOptions[]): Promise<StorageFile[]>
```

**Parameters:**
- `files`: `(Buffer | Readable)[]` - Array of files to upload
- `options?`: `WriteFileOptions[]` - Optional array of options for each file

**Returns:**
- `Promise<StorageFile[]>` - Array of storage results in same order as input

**Implementation Notes:**
- MUST upload files in parallel using `Promise.all()`
- MUST maintain input order in results
- MAY use provider's batch upload API if available

**Example Usage:**
```typescript
const files = [buffer1, buffer2, buffer3];
const results = await storage.batchWrite(files, [
  { filename: 'file1.pdf' },
  { filename: 'file2.jpg' },
  { filename: 'file3.txt' },
]);
```

#### `read(key, options?)`

Download a file from storage.

**Signature (overloaded):**
```typescript
read(key: string): Promise<Readable>;
read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
```

**Parameters:**
- `key`: `string` - Storage key/path of the file
- `options.format?`: `'buffer' | 'stream'` - Return format

**Returns:**
- `Promise<Readable>` - When `format` is `'stream'` or not specified
- `Promise<Buffer>` - When `format` is `'buffer'`

**Implementation Notes:**
- MUST support both Buffer and Stream return formats
- MUST throw `StorageError` with `ErrorCode.FILE_NOT_FOUND` if file doesn't exist
- Default behavior (no options) SHOULD return Stream

**Example Usage:**
```typescript
// Download as Buffer
const buffer = await storage.read('file.pdf', { format: 'buffer' });

// Download as Stream
const stream = await storage.read('file.pdf', { format: 'stream' });

// Default: returns Stream
const defaultStream = await storage.read('file.pdf');
```

#### `remove(key)`

Delete a file from storage.

**Signature:**
```typescript
remove(key: string): Promise<void>
```

**Parameters:**
- `key`: `string` - Storage key/path of file to delete

**Returns:**
- `Promise<void>`

**Implementation Notes:**
- MUST not throw error if file doesn't exist (idempotent operation)
- MAY throw `StorageError` with `ErrorCode.REMOVE_FILE_ERROR` for other errors

**Example Usage:**
```typescript
await storage.remove('old-file.pdf');
```

#### `isExists(key)`

Check if a file exists in storage.

**Signature:**
```typescript
isExists(key: string): Promise<boolean>
```

**Parameters:**
- `key`: `string` - Storage key/path to check

**Returns:**
- `Promise<boolean>` - `true` if file exists, `false` otherwise

**Implementation Notes:**
- MUST return `false` if file doesn't exist (don't throw)
- SHOULD use efficient HEAD request if supported by provider

**Example Usage:**
```typescript
if (await storage.isExists('file.pdf')) {
  console.log('File exists');
}
```

## Storage<O> Base Class

Base implementation providing helper methods and file converter integration.

> **注意：** `Storage` 不是 `abstract class`，而是普通 class。方法透過 `throw new Error('Method not implemented.')` 強制子類別覆寫。

### Complete Class Definition

```typescript
class Storage<O extends Record<string, unknown> = Record<string, unknown>>
  implements StorageInterface {
  // Provided properties
  readonly converterManager: ConverterManager;
  readonly hashAlgorithm: FilenameHashAlgorithm;

  constructor(options?: StorageOptions<O>) {
    this.converterManager = new ConverterManager(options?.converters ?? []);
    this.hashAlgorithm = options?.hashAlgorithm || 'sha256';
  }

  // Helper methods (provided by base class)
  public getExtension(file: InputFile): Promise<FileTypeResult | undefined>;
  async getBufferFilename(buffer: Buffer): Promise<[string, string | undefined]>;
  getStreamFilename(stream: Readable): Promise<[string, string | undefined]>;

  // Methods to override (throw Error if not implemented)
  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    throw new Error('Method not implemented.');
  }
  batchWrite(files: InputFile[], options?: WriteFileOptions[]): Promise<StorageFile[]> {
    throw new Error('Method not implemented.');
  }
  read(key: string, options?): Promise<Readable | Buffer> {
    throw new Error('Method not implemented.');
  }
  remove(key: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  isExists(key: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
}
```

### Constructor

```typescript
constructor(options?: StorageOptions<O>)
```

**What it does:**
- Initializes `converterManager` with provided converters (or empty array)
- Sets `hashAlgorithm` to provided value or defaults to `'sha256'`

**Subclass Implementation:**
```typescript
class MyStorage extends Storage<MyStorageOptions> {
  constructor(options: MyStorageOptions) {
    super(options); // MUST call super first

    // Then initialize provider-specific properties
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint;
  }
}
```

### Helper Methods

#### `getExtension(file)`

Detect file type from Buffer or Stream.

**Signature:**
```typescript
getExtension(file: InputFile): Promise<FileTypeResult | undefined>
```

**Returns:**
- `FileTypeResult` - Object with `ext` and `mime` properties
- `undefined` - If file type cannot be detected

**Usage:**
```typescript
const extension = await this.getExtension(buffer);
console.log(extension?.ext);  // 'jpg'
console.log(extension?.mime); // 'image/jpeg'
```

#### `getBufferFilename(buffer)`

Generate hash-based filename from Buffer content.

**Signature:**
```typescript
getBufferFilename(buffer: Buffer): Promise<[string, string | undefined]>
```

**Returns:**
- Tuple: `[filename, mimeType]`
- `filename`: Hash of buffer content with detected extension (e.g., `'a3f2...b1c4.jpg'`)
- `mimeType`: Detected MIME type (e.g., `'image/jpeg'`) or `undefined`

**Usage:**
```typescript
const [filename, mimeType] = await this.getBufferFilename(buffer);
console.log(filename); // 'a3f2c1b4e5d6789...abc123def456.jpg'
console.log(mimeType); // 'image/jpeg'
```

#### `getStreamFilename(stream)`

Generate hash-based filename from Stream content.

**Signature:**
```typescript
getStreamFilename(stream: Readable): Promise<[string, string | undefined]>
```

**Returns:**
- Tuple: `[filename, mimeType]`
- Same as `getBufferFilename()` but for streams

**Implementation Notes:**
- This method consumes the stream, so you MUST use PassThrough streams
- The stream is piped through hash and file-type detection in parallel

**Usage:**
```typescript
const passThrough = new PassThrough();
stream.pipe(passThrough);

const [filename, mimeType] = await this.getStreamFilename(stream);
console.log(filename); // 'b4e5f6...xyz789.png'

// passThrough can still be used for upload
await uploadToProvider(passThrough);
```

### ConverterManager Integration

All files pass through the converter pipeline before upload:

```typescript
// In your write() implementation
const convertedFile = await this.converterManager.convert(inputFile);
// Then upload convertedFile to provider
```

## Type Definitions

### InputFile

```typescript
type InputFile = ConvertableFile; // Buffer | Readable
```

Files accepted for upload can be:
- **Buffer**: In-memory file content
- **Readable**: Node.js stream for large files

### StorageFile

```typescript
interface StorageFile {
  readonly key: FileKey;
}

type FileKey = string;
```

Result object containing the file's storage key (path).

### StorageOptions<O>

```typescript
interface StorageOptions<O extends Record<string, unknown> = Record<string, unknown>> {
  converters?: FileConverter<O>[];
  hashAlgorithm?: FilenameHashAlgorithm;
}

type FilenameHashAlgorithm = 'sha1' | 'sha256';
```

Base configuration options:
- `converters`: Array of file converters to apply before upload
- `hashAlgorithm`: Hash function for filename generation (default: `'sha256'`)

**Generic Parameter `O`:**
The type parameter `O` represents provider-specific options. Provider option interfaces should extend `StorageOptions<O>`:

```typescript
interface MyProviderOptions extends StorageOptions<MyProviderOptions> {
  apiKey: string;
  endpoint: string;
  timeout?: number;
}
```

### WriteFileOptions

```typescript
interface WriteFileOptions {
  filename?: string;
  contentType?: string;
}
```

Optional configuration for file uploads:
- `filename`: Custom storage key/path (overrides hash-based generation)
- `contentType`: MIME type (overrides auto-detection)

### ReadBufferFileOptions

```typescript
interface ReadBufferFileOptions {
  format: 'buffer';
}
```

Specifies download should return a Buffer.

### ReadStreamFileOptions

```typescript
interface ReadStreamFileOptions {
  format: 'stream';
}
```

Specifies download should return a Readable stream.

## Error Handling

### StorageError

```typescript
class StorageError extends Error {
  readonly code: ErrorCode;
  readonly message: string;

  constructor(code: ErrorCode, message?: string);
}
```

Custom error class for storage operations.

**Usage:**
```typescript
import { StorageError, ErrorCode } from '@rytass/storages';

// Throw error
throw new StorageError(ErrorCode.FILE_NOT_FOUND, 'File does not exist');

// Catch error
try {
  await storage.read('missing-file.pdf');
} catch (error) {
  if (error instanceof StorageError) {
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
  }
}
```

### ErrorCode

```typescript
enum ErrorCode {
  WRITE_FILE_ERROR = '101',
  READ_FILE_ERROR = '102',
  REMOVE_FILE_ERROR = '103',
  UNRECOGNIZED_ERROR = '104',
  DIRECTORY_NOT_FOUND = '201',
  FILE_NOT_FOUND = '202',
}
```

Error codes and their meanings:

| Code | Value | When to Use |
|------|-------|-------------|
| `WRITE_FILE_ERROR` | `'101'` | Failed to upload file to provider |
| `READ_FILE_ERROR` | `'102'` | Failed to download file from provider |
| `REMOVE_FILE_ERROR` | `'103'` | Failed to delete file from provider |
| `UNRECOGNIZED_ERROR` | `'104'` | Unknown error occurred |
| `DIRECTORY_NOT_FOUND` | `'201'` | Local directory doesn't exist (Local adapter only) |
| `FILE_NOT_FOUND` | `'202'` | File doesn't exist in storage |

**Default Error Messages:**
```typescript
const ErrorDefaultMessage = {
  [ErrorCode.WRITE_FILE_ERROR]: 'WRITE_FILE_ERROR',
  [ErrorCode.READ_FILE_ERROR]: 'READ_FILE_ERROR',
  [ErrorCode.REMOVE_FILE_ERROR]: 'REMOVE_FILE_ERROR',
  [ErrorCode.UNRECOGNIZED_ERROR]: 'UNRECOGNIZED_ERROR',
  [ErrorCode.DIRECTORY_NOT_FOUND]: 'DIRECTORY_NOT_FOUND',
  [ErrorCode.FILE_NOT_FOUND]: 'FILE_NOT_FOUND',
};
```

### Error Handling Best Practices

**1. Provider Error Translation:**
Convert provider-specific errors to `StorageError`:

```typescript
try {
  await providerSDK.upload(file);
} catch (error) {
  if (isProviderNotFoundError(error)) {
    throw new StorageError(ErrorCode.FILE_NOT_FOUND, 'File not found');
  }
  throw new StorageError(ErrorCode.WRITE_FILE_ERROR, error.message);
}
```

**2. Error Context:**
Include helpful context in error messages:

```typescript
throw new StorageError(
  ErrorCode.READ_FILE_ERROR,
  `Failed to read file from S3: ${s3Error.message}`
);
```

**3. Idempotent Operations:**
Don't throw errors for expected scenarios:

```typescript
// remove() should not throw if file doesn't exist
async remove(key: string): Promise<void> {
  try {
    await providerSDK.delete(key);
  } catch (error) {
    // Ignore not-found errors (idempotent)
    if (!isNotFoundError(error)) {
      throw new StorageError(ErrorCode.REMOVE_FILE_ERROR, error.message);
    }
  }
}

// isExists() should return false, not throw
async isExists(key: string): Promise<boolean> {
  try {
    await providerSDK.head(key);
    return true;
  } catch (error) {
    return false; // Don't throw, return false
  }
}
```

## File Converter System

### FileConverter Interface

```typescript
// From @rytass/file-converter
type ConvertableFile = Readable | Buffer;

interface FileConverter<O = Record<string, unknown>> {
  convert<Buffer>(file: ConvertableFile): Promise<Buffer>;
  convert<Readable>(file: ConvertableFile): Promise<Readable>;
}
```

> **注意：** Generic parameter `O` 保留用於未來擴展，目前 `convert` 方法不接受 options 參數。

File converters transform files before upload. Examples:
- Resize images
- Add watermarks
- Compress files
- Transcode formats

### ConverterManager

```typescript
class ConverterManager {
  constructor(converters: FileConverter[]);

  convert<ConvertableFileFormat extends ConvertableFile>(
    file: ConvertableFile
  ): Promise<ConvertableFileFormat>;
}
```

The converter manager executes all converters in sequence.

**Usage in Adapter:**
```typescript
class MyStorage extends Storage<MyStorageOptions> {
  async write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    // Apply converters
    const convertedFile = await this.converterManager.convert(file);

    // Upload converted file to provider
    await this.uploadToProvider(convertedFile);

    return { key: filename };
  }
}
```

### Example: Custom File Converter

```typescript
import { FileConverter, ConvertableFile } from '@rytass/file-converter';
import { Readable } from 'stream';

class UppercaseTextConverter implements FileConverter {
  async convert<T extends ConvertableFile>(file: ConvertableFile): Promise<T> {
    if (file instanceof Buffer) {
      const text = file.toString('utf-8');
      return Buffer.from(text.toUpperCase(), 'utf-8') as T;
    }

    // For streams, you'd need to transform the stream
    // This is simplified example
    return file as T;
  }
}

// Use in storage
const storage = new MyStorage({
  apiKey: 'key',
  endpoint: 'https://api.example.com',
  converters: [new UppercaseTextConverter()],
});
```

### Converter Chain Execution

Multiple converters execute in sequence:

```typescript
const storage = new MyStorage({
  apiKey: 'key',
  endpoint: 'https://api.example.com',
  converters: [
    new ImageResizerConverter(),    // 1. Resize image
    new WatermarkConverter(),        // 2. Add watermark
    new ImageCompressorConverter(),  // 3. Compress
  ],
});

// File passes through all converters before upload
const result = await storage.write(imageBuffer);
```
