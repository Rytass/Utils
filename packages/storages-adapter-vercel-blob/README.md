# @rytass/storages-adapter-vercel-blob

Vercel Blob storage adapter for `@rytass/storages`.

## Installation

```bash
npm install @rytass/storages-adapter-vercel-blob
# or
yarn add @rytass/storages-adapter-vercel-blob
```

## Usage

```typescript
import { StorageVercelBlobService } from '@rytass/storages-adapter-vercel-blob';

const storage = new StorageVercelBlobService({
  token: 'your-blob-read-write-token', // or set BLOB_READ_WRITE_TOKEN env var
  pathPrefix: 'uploads', // optional, default: 'uploads'
});

// Write a file
const { key } = await storage.write(buffer);

// Write with custom filename
const { key } = await storage.write(buffer, { filename: 'my-file.png' });

// Read as buffer
const buffer = await storage.read(key, { format: 'buffer' });

// Read as stream
const stream = await storage.read(key);

// Get file URL
const url = await storage.url(key);

// Check existence
const exists = await storage.isExists(key);

// Remove file
await storage.remove(key);

// Batch write
const results = await storage.batchWrite([buffer1, buffer2]);
```

## Private Blobs

Set `access: 'private'` to store blobs that are not publicly accessible. Private
blobs require authentication, so the adapter behaves differently for reads and URLs:

- `url(key)` returns a short-lived **presigned URL** (signed via `issueSignedToken` +
  `presignUrl`) instead of a permanent public URL. The presigned URL is cached and
  only re-issued once it nears expiry, so repeated calls avoid redundant API requests.
- `read(key)` fetches the blob through that presigned URL transparently.
- `isExists(key)` / `remove(key)` resolve the blob by its pathname using the token.

```typescript
import { StorageVercelBlobService } from '@rytass/storages-adapter-vercel-blob';

const storage = new StorageVercelBlobService({
  token: 'your-blob-read-write-token',
  pathPrefix: 'private-uploads',
  access: 'private',
  signedUrlExpiresIn: 3600, // optional, presigned URL lifetime in seconds (default: 3600)
});

const { key } = await storage.write(buffer, { filename: 'secret.pdf' });

// Returns a presigned URL valid for `signedUrlExpiresIn` seconds
const signedUrl = await storage.url(key);

// Reads the private blob through the presigned URL
const content = await storage.read(key, { format: 'buffer' });
```

## Options

| Option               | Type                     | Default                             | Description                                                          |
|----------------------|--------------------------|-------------------------------------|----------------------------------------------------------------------|
| `token`              | `string`                 | `process.env.BLOB_READ_WRITE_TOKEN` | Vercel Blob read-write token                                         |
| `pathPrefix`         | `string`                 | `'uploads'`                         | Path prefix for stored files                                         |
| `access`             | `'public' \| 'private'`  | `'public'`                          | Blob access level                                                    |
| `signedUrlExpiresIn` | `number`                 | `3600`                              | Presigned URL lifetime in seconds (private blobs only)               |
