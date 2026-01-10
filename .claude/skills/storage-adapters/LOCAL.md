# Local File System Adapter Reference

Complete API reference for `@rytass/storages-adapter-local`.

## Installation

```bash
npm install @rytass/storages @rytass/storages-adapter-local
```

## Constructor & Configuration

### `LocalStorage`

```typescript
import { LocalStorage } from '@rytass/storages-adapter-local';

const storage = new LocalStorage(options: StorageLocalOptions);
```

### `StorageLocalOptions`

Configuration options for local file system storage adapter.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `directory` | `string` | **Yes** | Local directory path where files will be stored |
| `autoMkdir` | `boolean` | No | Automatically create directory if it doesn't exist (default: `false`) |
| `converters` | `FileConverter<O>[]` | No | Array of file converters to process files before upload |
| `hashAlgorithm` | `'sha1' \| 'sha256'` | No | Hash algorithm for auto-generated filenames (default: `'sha256'`) |

**Example:**

```typescript
// Basic configuration
const storage = new LocalStorage({
  directory: './uploads',
  autoMkdir: true,
});

// Absolute path
const storage = new LocalStorage({
  directory: '/var/www/app/storage',
  autoMkdir: true,
});

// Development environment
const storage = new LocalStorage({
  directory: process.env.NODE_ENV === 'production'
    ? '/var/www/app/storage'
    : './dev-uploads',
  autoMkdir: true,
});
```

## Methods

### Standard Methods

Standard methods (`write`, `read`, `remove`, `isExists`) work identically to [S3 adapter methods](S3.md#methods), except:

- **No `url()` method**: Local storage does not support generating presigned URLs since files are stored locally
- Files are stored directly on the file system

### `batchWrite(files, options?)`

**Unique to Local adapter:** Upload multiple files with optional per-file options.

**Signature:**
```typescript
batchWrite(files: InputFile[], options?: WriteFileOptions[]): Promise<StorageFile[]>
```

**Note:** LocalStorage is the **ONLY adapter** that supports the `options` array parameter. Other adapters (S3, GCS, R2, Azure Blob) only accept `files` array.

### `getUsageInfo()`

**Unique to Local adapter:** Get disk usage information for the storage directory.

**Signature:**
```typescript
getUsageInfo(): Promise<StorageLocalUsageInfo>
```

**Returns:** `Promise<StorageLocalUsageInfo>` - Disk usage statistics

**Example:**

```typescript
const usage = await storage.getUsageInfo();
console.log(`Used: ${usage.used}MB`);
console.log(`Free: ${usage.free}MB`);
console.log(`Total: ${usage.total}MB`);
console.log(`Usage: ${((usage.used / usage.total) * 100).toFixed(2)}%`);

// Check if disk is almost full
if (usage.free < 1000) { // Less than 1GB free
  console.warn('Low disk space!');
}
```

## Types

Same as [S3 adapter types](S3.md#types), plus:

### `StorageLocalUsageInfo`

```typescript
interface StorageLocalUsageInfo {
  used: number;  // Used space in megabytes (MB)
  free: number;  // Free space in megabytes (MB)
  total: number; // Total space in megabytes (MB)
}
```

Disk usage information in 1MB blocks.

**Note:** This feature uses Unix commands (`du`, `df`, `awk`) and is designed for *NIX systems (Linux, macOS). It may not work correctly on Windows.

## Complete Example

```typescript
import { LocalStorage } from '@rytass/storages-adapter-local';
import { StorageError, ErrorCode } from '@rytass/storages';
import { readFileSync, createWriteStream } from 'fs';
import { join } from 'path';

async function main() {
  // 1. Initialize local storage
  const storage = new LocalStorage({
    directory: './app-storage',
    autoMkdir: true, // Creates ./app-storage if it doesn't exist
  });

  try {
    // 2. Check disk usage before uploading
    const beforeUsage = await storage.getUsageInfo();
    console.log('Disk usage before:', {
      used: `${beforeUsage.used}MB`,
      free: `${beforeUsage.free}MB`,
      total: `${beforeUsage.total}MB`,
    });

    // 3. Upload a file
    const docBuffer = readFileSync('./document.pdf');
    const uploadedFile = await storage.write(docBuffer, {
      filename: 'documents/2024/important.pdf',
      contentType: 'application/pdf',
    });
    console.log('File uploaded:', uploadedFile.key);
    // File is now at: ./app-storage/documents/2024/important.pdf

    // 4. Upload with auto-generated filename
    const imageBuffer = readFileSync('./photo.jpg');
    const autoFile = await storage.write(imageBuffer);
    console.log('Auto filename:', autoFile.key);
    // File is now at: ./app-storage/a3f2c1...b4e5.jpg

    // 5. Download file as Buffer
    const downloadedBuffer = await storage.read(uploadedFile.key, {
      format: 'buffer',
    });
    console.log('Downloaded size:', downloadedBuffer.length);

    // 6. Download file as Stream
    const downloadedStream = await storage.read(uploadedFile.key, {
      format: 'stream',
    });
    downloadedStream.pipe(createWriteStream('./copy-of-document.pdf'));

    // 7. Check if file exists
    const exists = await storage.isExists(uploadedFile.key);
    console.log('File exists:', exists); // true

    // 8. Batch upload multiple files
    const files = [
      readFileSync('./file1.txt'),
      readFileSync('./file2.jpg'),
      readFileSync('./file3.json'),
    ];

    const batchResults = await storage.batchWrite(files, [
      { filename: 'texts/file1.txt', contentType: 'text/plain' },
      { filename: 'images/file2.jpg', contentType: 'image/jpeg' },
      { filename: 'data/file3.json', contentType: 'application/json' },
    ]);

    console.log('Batch uploaded:', batchResults.length, 'files');

    // 9. Check disk usage after uploading
    const afterUsage = await storage.getUsageInfo();
    console.log('Disk usage after:', {
      used: `${afterUsage.used}MB`,
      free: `${afterUsage.free}MB`,
      total: `${afterUsage.total}MB`,
    });
    console.log('Space used by uploads:', `${afterUsage.used - beforeUsage.used}MB`);

    // 10. Delete old file
    await storage.remove('documents/2023/old-document.pdf');
    console.log('Old file deleted');

    // 11. Verify deletion
    const stillExists = await storage.isExists('documents/2023/old-document.pdf');
    console.log('Old file still exists:', stillExists); // false

    // 12. Monitor disk usage
    const finalUsage = await storage.getUsageInfo();
    const usagePercent = (finalUsage.used / finalUsage.total) * 100;

    if (usagePercent > 90) {
      console.warn('Warning: Disk usage above 90%!');
    } else if (usagePercent > 80) {
      console.warn('Warning: Disk usage above 80%');
    } else {
      console.log(`Disk usage: ${usagePercent.toFixed(2)}% (OK)`);
    }
  } catch (error) {
    if (error instanceof StorageError) {
      switch (error.code) {
        case ErrorCode.DIRECTORY_NOT_FOUND:
          console.error('Storage directory not found');
          break;
        case ErrorCode.FILE_NOT_FOUND:
          console.error('File not found');
          break;
        default:
          console.error('Storage error:', error.code, error.message);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

main();
```

## Use Cases

### 1. Development Environment

Perfect for local development without cloud dependencies:

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

const storage = isDevelopment
  ? new LocalStorage({
      directory: './dev-uploads',
      autoMkdir: true,
    })
  : new StorageS3Service({
      accessKey: process.env.AWS_ACCESS_KEY_ID!,
      secretKey: process.env.AWS_SECRET_ACCESS_KEY!,
      bucket: process.env.S3_BUCKET!,
      region: process.env.AWS_REGION!,
    });
```

### 2. Testing

Use local storage in tests to avoid external dependencies:

```typescript
// test/file-upload.test.ts
import { LocalStorage } from '@rytass/storages-adapter-local';
import { tmpdir } from 'os';
import { join } from 'path';

describe('File Upload', () => {
  let storage: LocalStorage;

  beforeEach(() => {
    storage = new LocalStorage({
      directory: join(tmpdir(), 'test-storage'),
      autoMkdir: true,
    });
  });

  it('should upload file', async () => {
    const file = Buffer.from('test content');
    const result = await storage.write(file, { filename: 'test.txt' });
    expect(result.key).toBe('test.txt');
  });
});
```

### 3. Private Server Deployment

For applications deployed on private servers without cloud access:

```typescript
const storage = new LocalStorage({
  directory: '/var/www/app/storage',
  autoMkdir: false, // Assume directory already exists
});

// Serve files via Express
app.get('/files/:filename', async (req, res) => {
  try {
    const stream = await storage.read(req.params.filename, { format: 'stream' });
    stream.pipe(res);
  } catch (error) {
    res.status(404).send('File not found');
  }
});
```

### 4. Disk Usage Monitoring

Monitor and manage disk space:

```typescript
async function checkDiskSpace(storage: LocalStorage) {
  const usage = await storage.getUsageInfo();
  const usagePercent = (usage.used / usage.total) * 100;

  if (usagePercent > 95) {
    throw new Error('Critical: Disk usage above 95%!');
  }

  if (usagePercent > 85) {
    console.warn('Warning: Disk usage above 85%. Consider cleaning up old files.');
  }

  return usage;
}

// Run before large uploads
await checkDiskSpace(storage);
const result = await storage.write(largeFile);
```

## Best Practices

1. **Use Absolute Paths in Production:**
   ```typescript
   const storage = new LocalStorage({
     directory: process.env.NODE_ENV === 'production'
       ? '/var/www/app/storage'  // Absolute path
       : './dev-uploads',         // Relative path for dev
     autoMkdir: true,
   });
   ```

2. **Set Proper Permissions:**
   ```bash
   # Ensure directory is writable by app
   sudo chown -R app-user:app-group /var/www/app/storage
   sudo chmod -R 755 /var/www/app/storage
   ```

3. **Monitor Disk Usage:**
   ```typescript
   // Periodic disk usage check
   setInterval(async () => {
     const usage = await storage.getUsageInfo();
     console.log(`Disk usage: ${usage.used}MB / ${usage.total}MB`);
   }, 3600000); // Every hour
   ```

4. **Implement File Cleanup:**
   ```typescript
   // Clean up old files to free space
   async function cleanupOldFiles(storage: LocalStorage, olderThanDays: number) {
     // Implement your cleanup logic
     // e.g., remove files older than N days
   }
   ```

5. **Use with Backup Strategy:**
   ```typescript
   // Backup local storage to cloud periodically
   async function backupToCloud(localStorage: LocalStorage, cloudStorage: StorageS3Service) {
     // Read from local, upload to cloud
   }
   ```

## Limitations

- **No Presigned URLs**: Cannot generate temporary URLs for file access
- **Single Server Only**: Files are local to one server (not distributed)
- **No Auto-Scaling**: Does not work with horizontally scaled applications
- **Platform Dependent**: `getUsageInfo()` uses Unix commands (Linux/macOS only)
- **Manual Backup**: Requires manual backup strategy

## When to Use Local Storage

**Use Local Storage when:**
- ✓ Developing locally
- ✓ Running tests
- ✓ Single-server deployment
- ✓ Files don't need to be shared across servers
- ✓ You want to avoid cloud costs
- ✓ You have control over server storage

**Avoid Local Storage when:**
- ✗ Multi-server deployment
- ✗ Auto-scaling is required
- ✗ Files need to be accessed from multiple regions
- ✗ You need CDN distribution
- ✗ You need built-in redundancy and backups
