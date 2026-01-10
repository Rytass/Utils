# Azure Blob Storage Adapter Reference

Complete API reference for `@rytass/storages-adapter-azure-blob`.

## Installation

```bash
npm install @rytass/storages @rytass/storages-adapter-azure-blob
```

## Constructor & Configuration

### `StorageAzureBlobService`

```typescript
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';

const storage = new StorageAzureBlobService(options: AzureBlobOptions);
```

### `AzureBlobOptions`

Configuration options for Azure Blob Storage adapter.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `connectionString` | `string` | **Yes** | Azure Storage account connection string |
| `container` | `string` | **Yes** | Blob container name where files will be stored |
| `converters` | `FileConverter<O>[]` | No | Array of file converters to process files before upload |
| `hashAlgorithm` | `'sha1' \| 'sha256'` | No | Hash algorithm for auto-generated filenames (default: `'sha256'`) |

**Example:**

```typescript
const storage = new StorageAzureBlobService({
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
  container: 'my-container',
});

// Connection string format:
// DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=...;EndpointSuffix=core.windows.net
```

## Methods

All standard methods (`write`, `read`, `remove`, `isExists`) are identical to [S3 adapter methods](S3.md#methods).

### `batchWrite(files)`

Upload multiple files in parallel with auto-generated hash filenames.

**Signature:**
```typescript
batchWrite(files: InputFile[]): Promise<StorageFile[]>
```

**Note:** Azure Blob `batchWrite` does NOT support options array. All filenames are auto-generated using hash algorithm. For custom filenames, use `write()` in a loop (see [S3 adapter](S3.md#batchwritefiles) for details).

### `url(key, expires?)`

Generate a SAS (Shared Access Signature) token URL for temporary file access.

**Signature:**
```typescript
url(key: string, expires?: number): Promise<string>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | File key (path) to generate URL for |
| `expires` | `number` | Optional expiration timestamp in milliseconds (default: 24 hours from now) |

**Returns:** `Promise<string>` - SAS token URL valid until expiration time

**Example:**

```typescript
// Default: 24 hours expiration
const url1 = await storage.url('documents/report.pdf');

// Custom: 2 hours expiration
const twoHoursFromNow = Date.now() + 1000 * 60 * 60 * 2;
const url2 = await storage.url('documents/report.pdf', twoHoursFromNow);

// Custom: 7 days expiration
const sevenDaysFromNow = Date.now() + 1000 * 60 * 60 * 24 * 7;
const url3 = await storage.url('documents/report.pdf', sevenDaysFromNow);

console.log('SAS URL:', url1);
// Output: https://myaccount.blob.core.windows.net/my-container/documents/report.pdf?sv=...&sig=...
```

## Types

Same as [S3 adapter types](S3.md#types).

## Complete Example

```typescript
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';
import { StorageError, ErrorCode } from '@rytass/storages';
import { readFileSync } from 'fs';

async function main() {
  // 1. Initialize Azure Blob storage
  const storage = new StorageAzureBlobService({
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
    container: 'application-files',
  });

  try {
    // 2. Upload a file
    const documentBuffer = readFileSync('./contract.pdf');
    const uploadedFile = await storage.write(documentBuffer, {
      filename: 'contracts/2024/contract-001.pdf',
      contentType: 'application/pdf',
    });
    console.log('File uploaded:', uploadedFile.key);

    // 3. Generate SAS URL with default expiration (24 hours)
    const defaultUrl = await storage.url(uploadedFile.key);
    console.log('SAS URL (24h):', defaultUrl);

    // 4. Generate SAS URL with custom expiration (1 hour)
    const oneHourLater = Date.now() + 1000 * 60 * 60;
    const shortUrl = await storage.url(uploadedFile.key, oneHourLater);
    console.log('SAS URL (1h):', shortUrl);

    // 5. Download file as Buffer
    const downloadedBuffer = await storage.read(uploadedFile.key, {
      format: 'buffer',
    });
    console.log('Downloaded size:', downloadedBuffer.length);

    // 6. Download file as Stream
    const downloadedStream = await storage.read(uploadedFile.key, {
      format: 'stream',
    });
    console.log('Download stream ready');

    // 7. Check if file exists
    const exists = await storage.isExists(uploadedFile.key);
    console.log('File exists:', exists); // true

    // 8. Upload multiple files (auto-generated hash filenames)
    const files = [
      readFileSync('./invoice-1.pdf'),
      readFileSync('./invoice-2.pdf'),
      readFileSync('./invoice-3.pdf'),
    ];

    // Azure Blob batchWrite does NOT support options array
    const batchResults = await storage.batchWrite(files);
    console.log('Batch uploaded:', batchResults.length, 'files');

    // For custom filenames, use write() in a loop:
    const customFiles = [
      { buffer: readFileSync('./invoice-1.pdf'), filename: 'invoices/2024/invoice-001.pdf' },
      { buffer: readFileSync('./invoice-2.pdf'), filename: 'invoices/2024/invoice-002.pdf' },
      { buffer: readFileSync('./invoice-3.pdf'), filename: 'invoices/2024/invoice-003.pdf' },
    ];
    await Promise.all(
      customFiles.map(f => storage.write(f.buffer, { filename: f.filename, contentType: 'application/pdf' }))
    );

    // 9. Delete old file
    await storage.remove('contracts/2023/old-contract.pdf');
    console.log('Old file deleted');

    // 10. Verify deletion
    const stillExists = await storage.isExists('contracts/2023/old-contract.pdf');
    console.log('Old file still exists:', stillExists); // false
  } catch (error) {
    if (error instanceof StorageError) {
      console.error('Storage error:', error.code, error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

main();
```

## Azure Setup

### 1. Create Storage Account

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Storage accounts"
3. Click "Create"
4. Fill in:
   - **Resource group**: Select or create new
   - **Storage account name**: Unique name
   - **Region**: Choose closest to your users
   - **Performance**: Standard or Premium
   - **Redundancy**: LRS, GRS, or ZRS
5. Click "Review + create"

### 2. Create Container

1. Open your storage account
2. Navigate to "Containers" under "Data storage"
3. Click "+ Container"
4. Enter container name (e.g., `my-container`)
5. Set **Public access level**:
   - **Private**: No anonymous access (recommended)
   - **Blob**: Anonymous read access for blobs only
   - **Container**: Anonymous read access for containers and blobs
6. Click "Create"

### 3. Get Connection String

1. In your storage account, navigate to "Access keys"
2. Under "key1" or "key2", click "Show keys"
3. Copy the **Connection string**
4. Store it securely in environment variable

**Example connection string:**
```
DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=abc123...xyz789==;EndpointSuffix=core.windows.net
```

### 4. Use in Application

```typescript
// .env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=...
AZURE_CONTAINER=my-container

// app.ts
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';

const storage = new StorageAzureBlobService({
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
  container: process.env.AZURE_CONTAINER!,
});
```

## Security Best Practices

1. **Use Managed Identities**: For Azure-hosted applications, use Managed Identities instead of connection strings
2. **Rotate Keys Regularly**: Periodically regenerate access keys
3. **Set Short SAS Expiration**: Use short expiration times for SAS URLs
4. **Use HTTPS Only**: Always use `DefaultEndpointsProtocol=https`
5. **Limit Container Access**: Set container public access level to "Private" unless public access is required
6. **Monitor Access**: Enable Azure Storage Analytics logging

## SAS Token Permissions

The SAS tokens generated by `url()` method have **read** permission only, allowing:
- ✓ Read blob content
- ✗ Write or modify blob
- ✗ Delete blob
- ✗ List blobs in container

This ensures shared URLs can only be used to download files, not modify or delete them.
