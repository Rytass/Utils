# Rytass Utils - File Converter Image Watermark Adapter

Advanced image watermarking processor that adds watermarks to images with flexible positioning, opacity control, and scaling options. Built on Sharp image processing library for high performance and quality output.

## Features

- [x] High-performance image watermarking (based on Sharp)
- [x] Flexible watermark positioning (9-point positioning system)
- [x] Opacity and transparency control
- [x] Watermark scaling and sizing options
- [x] Buffer and Stream input support
- [x] Multiple image format support
- [x] Maintains original image quality
- [x] Batch processing capabilities

## Installation

```bash
npm install @rytass/file-converter-adapter-image-watermark
# or
yarn add @rytass/file-converter-adapter-image-watermark
```

## Usage

### Basic Watermark Application

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { readFileSync } from 'fs';

// Create watermark processor
const watermarker = new ImageWatermark({
  watermarkPath: './watermark.png',
  position: 'bottom-right',
  opacity: 0.7,
  margin: 20,
});

// Apply watermark to image
const originalImage = readFileSync('original.jpg');
const watermarkedImage = await watermarker.convert<Buffer>(originalImage);
```

### Stream Processing

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';

const watermarker = new ImageWatermark({
  watermarkPath: './logo.png',
  position: 'top-left',
  opacity: 0.5,
});

const inputStream = createReadStream('input.jpg');
const outputStream = await watermarker.convert<Readable>(inputStream);

outputStream.pipe(createWriteStream('watermarked.jpg'));
```

### Advanced Configuration

```typescript
// Custom positioning with offset
const customWatermarker = new ImageWatermark({
  watermarkPath: './watermark.png',
  position: 'center',
  opacity: 0.6,
  scale: 0.2, // Scale watermark to 20% of original size
  offsetX: 50, // Horizontal offset from position
  offsetY: -30, // Vertical offset from position
});

// Watermark with specific dimensions
const sizedWatermarker = new ImageWatermark({
  watermarkPath: './logo.svg',
  position: 'bottom-center',
  width: 200, // Fixed width
  height: 100, // Fixed height
  opacity: 0.8,
  margin: 15,
});
```

## Configuration Options

### ImageWatermarkOptions

| Property        | Type                | Required | Default          | Description                            |
| --------------- | ------------------- | -------- | ---------------- | -------------------------------------- |
| `watermarkPath` | `string`            | Yes      | -                | Path to watermark image file           |
| `position`      | `WatermarkPosition` | No       | `'bottom-right'` | Watermark position on image            |
| `opacity`       | `number`            | No       | `1.0`            | Watermark opacity (0-1)                |
| `scale`         | `number`            | No       | -                | Scale watermark relative to base image |
| `width`         | `number`            | No       | -                | Fixed watermark width                  |
| `height`        | `number`            | No       | -                | Fixed watermark height                 |
| `margin`        | `number`            | No       | `0`              | Margin from edges                      |
| `offsetX`       | `number`            | No       | `0`              | Horizontal offset from position        |
| `offsetY`       | `number`            | No       | `0`              | Vertical offset from position          |

### Watermark Positions

Available position options:

- `'top-left'`
- `'top-center'`
- `'top-right'`
- `'center-left'`
- `'center'`
- `'center-right'`
- `'bottom-left'`
- `'bottom-center'`
- `'bottom-right'`

## Usage Examples

### Logo Watermark with Transparency

```typescript
const logoWatermarker = new ImageWatermark({
  watermarkPath: './company-logo.png',
  position: 'top-right',
  opacity: 0.4,
  scale: 0.15,
  margin: 30,
});

const watermarkedProduct = await logoWatermarker.convert<Buffer>(productImage);
```

### Copyright Text Overlay

```typescript
// First create a text watermark image, then apply
const copyrightWatermarker = new ImageWatermark({
  watermarkPath: './copyright-text.png',
  position: 'bottom-center',
  opacity: 0.6,
  margin: 10,
});
```

### Batch Watermarking

```typescript
const images = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
const watermarker = new ImageWatermark({
  watermarkPath: './watermark.png',
  position: 'bottom-right',
  opacity: 0.5,
});

const watermarkedImages = await Promise.all(
  images.map(async imagePath => {
    const image = readFileSync(imagePath);
    return await watermarker.convert<Buffer>(image);
  }),
);
```

## Integration with File Converter System

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { StorageS3Service } from '@rytass/storages-adapter-s3';

const storage = new StorageS3Service({
  /* S3 config */
});

// Processing pipeline: resize then watermark
const manager = new ConverterManager(
  [
    new ImageResizer({
      maxWidth: 1200,
      maxHeight: 800,
      keepAspectRatio: true,
    }),
    new ImageWatermark({
      watermarkPath: './brand-watermark.png',
      position: 'bottom-right',
      opacity: 0.7,
      scale: 0.1,
    }),
  ],
  storage,
);

const result = await manager.save(uploadedImage, 'processed-images/', 'watermarked-product.jpg');
```

## Error Handling

```typescript
try {
  const watermarker = new ImageWatermark({
    watermarkPath: './nonexistent-watermark.png',
    position: 'center',
  });

  const result = await watermarker.convert<Buffer>(imageBuffer);
} catch (error) {
  if (error.message.includes('watermark file not found')) {
    console.error('Watermark file does not exist');
  } else if (error.message.includes('invalid image format')) {
    console.error('Unsupported image format');
  } else {
    console.error('Watermarking failed:', error.message);
  }
}
```

## Best Practices

### Performance

- Use appropriately sized watermark images to avoid excessive processing
- Consider using SVG watermarks for vector-based logos
- Batch process multiple images when possible
- Use streams for large images to manage memory usage

### Quality

- Maintain watermark aspect ratio when scaling
- Use PNG format for watermarks with transparency
- Test opacity levels for different background images
- Consider watermark contrast against various image types

### Security

- Validate watermark file paths to prevent directory traversal
- Sanitize user-provided positioning parameters
- Implement rate limiting for watermarking operations
- Store watermark files in secure, read-only locations

## Supported Formats

**Input formats:** JPEG, PNG, WebP, TIFF, GIF, AVIF, HEIF
**Watermark formats:** PNG (recommended), JPEG, WebP, SVG
**Output formats:** Same as input format

## License

MIT
