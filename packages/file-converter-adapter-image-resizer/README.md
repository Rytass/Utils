# Rytass Utils - File Converter Image Resizer Adapter

Powerful and efficient image resizing processor based on the Sharp image processing library. Supports resizing operations for various image formats with aspect ratio preservation or forced sizing capabilities.

## Features

- [x] High-performance image resizing processing (based on Sharp)
- [x] Aspect ratio preservation support
- [x] Forced sizing with cropping mode
- [x] Buffer and Stream input support
- [x] Configurable concurrency processing
- [x] Prevents upscaling low-resolution images
- [x] Supports various image formats (JPEG, PNG, WebP, TIFF, GIF, etc.)

## Installation

```bash
npm install @rytass/file-converter-adapter-image-resizer
# or
yarn add @rytass/file-converter-adapter-image-resizer
```

## Usage

### Basic Usage with Buffer

```typescript
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { readFileSync } from 'fs';

// Create image resizer instance
const resizer = new ImageResizer({
  maxWidth: 800,
  maxHeight: 600,
  keepAspectRatio: true,  // Maintain aspect ratio
  concurrency: 4         // Concurrent processing count
});

// Process Buffer
const imageBuffer = readFileSync('input.jpg');
const resizedBuffer = await resizer.convert<Buffer>(imageBuffer);
```

### Usage with Readable Stream

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';

const inputStream = createReadStream('input.jpg');
const resizedStream = await resizer.convert<Readable>(inputStream);

// Save processed stream to file
resizedStream.pipe(createWriteStream('output.jpg'));
```

### Advanced Configuration

```typescript
// Forced sizing mode (no aspect ratio preservation, with cropping)
const cropResizer = new ImageResizer({
  maxWidth: 400,
  maxHeight: 400,
  keepAspectRatio: false,  // No aspect ratio preservation, use cropping mode
  concurrency: 2
});

// Width only specification, height auto-calculated
const widthOnlyResizer = new ImageResizer({
  maxWidth: 1200,
  keepAspectRatio: true
});

// Height only specification, width auto-calculated
const heightOnlyResizer = new ImageResizer({
  maxHeight: 800,
  keepAspectRatio: true
});
```

## Configuration Options

### ImageResizerOptions

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `maxWidth` | `number` | No | - | Maximum width in pixels |
| `maxHeight` | `number` | No | - | Maximum height in pixels |
| `keepAspectRatio` | `boolean` | No | `true` | Whether to maintain aspect ratio |
| `concurrency` | `number` | No | `1` | Sharp concurrent processing count |

**Note:** At least one of `maxWidth` or `maxHeight` must be specified.

## Integration with File Converter System

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { StorageS3Service } from '@rytass/storages-adapter-s3';

// Setup storage service
const storage = new StorageS3Service({
  bucket: 'my-images',
  accessKey: 'ACCESS_KEY',
  secretKey: 'SECRET_KEY',
  region: 'ap-northeast-1'
});

// Setup image processing pipeline
const manager = new ConverterManager(
  [
    new ImageResizer({
      maxWidth: 1200,
      maxHeight: 800,
      keepAspectRatio: true
    })
  ],
  storage
);

// Process uploaded image
const result = await manager.save(
  imageFile,
  'images/processed/',
  'image.jpg'
);

console.log('Processed image URL:', result.url);
```

## Performance Considerations

- **Concurrent Processing:** Control Sharp's concurrent processing count through the `concurrency` option
- **Memory Caching:** Sharp caching is disabled by default to prevent memory leaks
- **Stream Processing:** Recommended for large images to reduce memory usage
- **Upscaling Prevention:** Automatically prevents upscaling small images to maintain quality

## Error Handling

```typescript
try {
  const resizer = new ImageResizer({
    maxWidth: 800,
    maxHeight: 600
  });
  
  const result = await resizer.convert<Buffer>(imageBuffer);
} catch (error) {
  if (error.message.includes('Please provide at least one')) {
    console.error('Must specify either maxWidth or maxHeight');
  } else {
    console.error('Image processing failed:', error.message);
  }
}
```

## Supported Image Formats

Supported input formats:
- JPEG
- PNG
- WebP
- TIFF
- GIF
- AVIF
- HEIF
- SVG

Output format is automatically determined based on input format, or can be specified in subsequent processing steps.

## License

MIT