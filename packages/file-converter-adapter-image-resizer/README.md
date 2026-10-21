# Rytass Utils - File Converter Image Resizer Adapter

Powerful and efficient image resizing processor based on the Sharp image processing library. Supports resizing operations for various image formats with aspect ratio preservation or forced sizing capabilities.

## Features

- [x] High-performance image resizing processing (based on Sharp)
- [x] Aspect ratio preservation support
- [x] Forced sizing with cropping mode
- [x] Buffer and Stream input support
- [x] Configurable libvips thread count per image
- [x] Prevents upscaling low-resolution images
- [x] Auto-orients images by EXIF `Orientation` (portrait photos stay portrait)
- [x] Keeps all frames of animated GIF / WebP
- [x] Optional input pixel limit (`limitInputPixels`)
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
  keepAspectRatio: true, // Maintain aspect ratio
  concurrency: 4, // libvips threads per image (process-wide sharp setting)
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
  keepAspectRatio: false, // No aspect ratio preservation, use cropping mode
  concurrency: 2,
});

// Width only specification, height auto-calculated
const widthOnlyResizer = new ImageResizer({
  maxWidth: 1200,
  keepAspectRatio: true,
});

// Height only specification, width auto-calculated
const heightOnlyResizer = new ImageResizer({
  maxHeight: 800,
  keepAspectRatio: true,
});
```

## Configuration Options

### ImageResizerOptions

| Property           | Type                | Required | Default                           | Description                                                                                                              |
| ------------------ | ------------------- | -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `maxWidth`         | `number`            | No       | -                                 | Maximum width in pixels                                                                                                  |
| `maxHeight`        | `number`            | No       | -                                 | Maximum height in pixels                                                                                                 |
| `keepAspectRatio`  | `boolean`           | No       | `true`                            | Whether to maintain aspect ratio                                                                                         |
| `concurrency`      | `number`            | No       | Sharp default (CPU cores)         | libvips threads per image; process-wide, only set when provided                                                          |
| `limitInputPixels` | `number \| boolean` | No       | Sharp default (`0x3FFF x 0x3FFF`) | Reject inputs whose pixel count exceeds this limit (all frames combined for animated images); `false` disables the check |

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
  region: 'ap-northeast-1',
});

// Setup image processing pipeline
const manager = new ConverterManager(
  [
    new ImageResizer({
      maxWidth: 1200,
      maxHeight: 800,
      keepAspectRatio: true,
    }),
  ],
  storage,
);

// Process uploaded image
const result = await manager.save(imageFile, 'images/processed/', 'image.jpg');

console.log('Processed image URL:', result.url);
```

## Performance Considerations

- **Threads per Image:** `concurrency` sets `sharp.concurrency()`, the number of libvips threads used for **each** image. It is a process-wide setting shared by every sharp user in the same process, so it is only changed when provided. The number of images processed in parallel is limited by libuv's `UV_THREADPOOL_SIZE` (default 4) instead
- **Memory Caching:** Importing this package calls `sharp.cache(false)`, which disables the libvips operation cache for the whole process to prevent memory growth
- **Stream Processing:** Recommended for large images to reduce memory usage
- **Upscaling Prevention:** Automatically prevents upscaling small images to maintain quality

## Error Handling

```typescript
try {
  const resizer = new ImageResizer({
    maxWidth: 800,
    maxHeight: 600,
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

### Orientation and Animation

- EXIF `Orientation` is applied to the pixels before resizing and the tag is removed from the output, so photos taken in portrait mode are still portrait after resizing.
- Animated GIF and WebP inputs (detected by file signature, for both Buffer and Stream) keep all frames; each frame is resized to fit the target size. Other multi-page formats such as TIFF are resized using the first page only.
- For Stream input, `convert()` reads the first few bytes to detect the format before it resolves, so start writing to the source stream before awaiting `convert()`. Errors from the source stream are emitted on the output stream.

## License

MIT
