# Google Cloud Storage Adapter Reference

Complete API reference for `@rytass/storages-adapter-gcs`.

## Installation

```bash
npm install @rytass/storages @rytass/storages-adapter-gcs
```

## Constructor & Configuration

### `StorageGCSService`

```typescript
import { StorageGCSService } from '@rytass/storages-adapter-gcs';

const storage = new StorageGCSService(options: GCSOptions);
```

### `GCSOptions`

Configuration options for Google Cloud Storage adapter.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `bucket` | `string` | **Yes** | GCS bucket name where files will be stored |
| `projectId` | `string` | **Yes** | Google Cloud project ID |
| `credentials` | `object` | **Yes** | Service account credentials object |
| `credentials.client_email` | `string` | **Yes** | Service account email address |
| `credentials.private_key` | `string` | **Yes** | Service account private key (PEM format) |
| `converters` | `FileConverter<O>[]` | No | Array of file converters to process files before upload |
| `hashAlgorithm` | `'sha1' \| 'sha256'` | No | Hash algorithm for auto-generated filenames (default: `'sha256'`) |

**Example:**

```typescript
const storage = new StorageGCSService({
  bucket: 'my-gcs-bucket',
  projectId: 'my-project-123456',
  credentials: {
    client_email: 'my-service-account@my-project.iam.gserviceaccount.com',
    private_key: process.env.GCS_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
});

// Using service account JSON file
import serviceAccount from './service-account.json';

const storage = new StorageGCSService({
  bucket: 'my-gcs-bucket',
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
});
```

## Methods

All methods are identical to [S3 adapter methods](S3.md#methods), with the following difference:

### `url(key, expires?)`

Generate a signed URL for temporary file access with custom expiration.

**Signature:**
```typescript
url(key: string, expires?: number): Promise<string>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | File key (path) to generate URL for |
| `expires` | `number` | Optional expiration timestamp in milliseconds (default: 24 hours from now) |

**Returns:** `Promise<string>` - Signed URL valid until expiration time

**Example:**

```typescript
// Default: 24 hours expiration
const url1 = await storage.url('documents/report.pdf');

// Custom: 1 hour expiration
const oneHourFromNow = Date.now() + 1000 * 60 * 60;
const url2 = await storage.url('documents/report.pdf', oneHourFromNow);

// Custom: 7 days expiration
const sevenDaysFromNow = Date.now() + 1000 * 60 * 60 * 24 * 7;
const url3 = await storage.url('documents/report.pdf', sevenDaysFromNow);
```

### `batchWrite(files)`

Upload multiple files in parallel with auto-generated hash filenames.

**Signature:**
```typescript
batchWrite(files: InputFile[]): Promise<StorageFile[]>
```

**Note:** GCS `batchWrite` does NOT support options array. All filenames are auto-generated using hash algorithm. For custom filenames, use `write()` in a loop (see [S3 adapter](S3.md#batchwritefiles) for details).

For all other methods (`write`, `read`, `remove`, `isExists`), see the [S3 adapter reference](S3.md#methods) as they have identical behavior.

## Types

Same as [S3 adapter types](S3.md#types).

## Complete Example

```typescript
import { StorageGCSService } from '@rytass/storages-adapter-gcs';
import { StorageError, ErrorCode } from '@rytass/storages';
import { readFileSync } from 'fs';

async function main() {
  // 1. Initialize GCS storage with service account
  const storage = new StorageGCSService({
    bucket: 'my-app-storage',
    projectId: 'my-project-123456',
    credentials: {
      client_email: process.env.GCS_CLIENT_EMAIL!,
      private_key: process.env.GCS_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    },
  });

  try {
    // 2. Upload a file
    const imageBuffer = readFileSync('./product.jpg');
    const uploadedFile = await storage.write(imageBuffer, {
      filename: 'products/images/product-001.jpg',
      contentType: 'image/jpeg',
    });
    console.log('File uploaded:', uploadedFile.key);

    // 3. Generate signed URL with default expiration (24 hours)
    const defaultUrl = await storage.url(uploadedFile.key);
    console.log('Download URL (24h):', defaultUrl);

    // 4. Generate signed URL with custom expiration (1 hour)
    const oneHourLater = Date.now() + 1000 * 60 * 60;
    const shortUrl = await storage.url(uploadedFile.key, oneHourLater);
    console.log('Download URL (1h):', shortUrl);

    // 5. Download file
    const downloadedBuffer = await storage.read(uploadedFile.key, {
      format: 'buffer',
    });
    console.log('Downloaded size:', downloadedBuffer.length);

    // 6. Check existence
    const exists = await storage.isExists(uploadedFile.key);
    console.log('File exists:', exists); // true

    // 7. Delete file
    await storage.remove(uploadedFile.key);
    console.log('File deleted');
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

## Service Account Setup

To use GCS adapter, you need a service account with appropriate permissions:

1. **Create Service Account:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Navigate to IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Give it a name and description

2. **Grant Permissions:**
   - Add role: "Storage Object Admin" (for full read/write access)
   - Or "Storage Object Viewer" (for read-only access)

3. **Create Key:**
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose JSON format
   - Download the JSON file

4. **Use Credentials:**

```typescript
// Option 1: Load from JSON file
import serviceAccount from './service-account.json';

const storage = new StorageGCSService({
  bucket: 'my-bucket',
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
});

// Option 2: Use environment variables
const storage = new StorageGCSService({
  bucket: process.env.GCS_BUCKET!,
  projectId: process.env.GCS_PROJECT_ID!,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL!,
    private_key: process.env.GCS_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
});
```

**Environment Variables:**

```bash
# .env
GCS_BUCKET=my-gcs-bucket
GCS_PROJECT_ID=my-project-123456
GCS_CLIENT_EMAIL=service-account@my-project.iam.gserviceaccount.com
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

**Note:** When storing private key in environment variable, ensure newlines are properly escaped as `\n`.
