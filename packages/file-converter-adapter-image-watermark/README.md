# Rytass Utils - File Converter Image Watermark Adapter

Image watermarking processor that adds watermarks to images using Sharp's gravity-based positioning system. Built on Sharp image processing library for high performance and quality output.

## Features

- [x] High-performance image watermarking (based on Sharp)
- [x] Gravity-based positioning (9-point positioning system)
- [x] Support for multiple watermarks
- [x] Buffer and file path input for watermarks
- [x] Buffer and Stream input support for source images
- [x] Multiple image format support
- [x] Concurrency control for batch processing

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
import { gravity } from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

// Create watermark processor with gravity positioning
const watermarker = new ImageWatermark({
  watermarks: [
    {
      image: readFileSync('./watermark.png'), // Can be Buffer or file path
      gravity: gravity.southeast, // Position: bottom-right
    },
  ],
});

// Apply watermark to image
const originalImage = readFileSync('original.jpg');
const watermarkedImage = await watermarker.convert<Buffer>(originalImage);
writeFileSync('watermarked.jpg', watermarkedImage);
```

### Stream Processing

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';
import { gravity } from 'sharp';

const watermarker = new ImageWatermark({
  watermarks: [
    {
      image: './logo.png', // File path also works
      gravity: gravity.northwest, // Position: top-left
    },
  ],
});

const inputStream = createReadStream('input.jpg');
const outputStream = await watermarker.convert<Readable>(inputStream);

outputStream.pipe(createWriteStream('watermarked.jpg'));
```

### Multiple Watermarks

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';

// Add multiple watermarks at different positions
const watermarker = new ImageWatermark({
  watermarks: [
    {
      image: readFileSync('./logo.png'),
      gravity: gravity.southeast, // Bottom-right
    },
    {
      image: readFileSync('./copyright.png'),
      gravity: gravity.south, // Bottom-center
    },
  ],
  concurrency: 4, // Optional: parallel processing
});

const watermarkedImage = await watermarker.convert<Buffer>(originalImage);
```

## Configuration Options

### ImageWatermarkOptions

| Property      | Type          | Required | Default | Description                          |
| ------------- | ------------- | -------- | ------- | ------------------------------------ |
| `watermarks`  | `Watermark[]` | Yes      | -       | Array of watermark configurations    |
| `concurrency` | `number`      | No       | `1`     | Number of parallel processing threads |

### Watermark

| Property  | Type                   | Required | Default | Description                                |
| --------- | ---------------------- | -------- | ------- | ------------------------------------------ |
| `image`   | `string` \| `Buffer`   | Yes      | -       | Watermark image (file path or Buffer)      |
| `gravity` | `Gravity`              | No       | -       | Position using Sharp's gravity constants   |

### Gravity Positions (from Sharp)

Import gravity from Sharp and use these positioning options:

```typescript
import { gravity } from 'sharp';
```

| Position           | Gravity Constant      | Description      |
| ------------------ | --------------------- | ---------------- |
| Top-Left (左上)    | `gravity.northwest`   | Northwest corner |
| Top-Center (上中)  | `gravity.north`       | Top center       |
| Top-Right (右上)   | `gravity.northeast`   | Northeast corner |
| Middle-Left (中左) | `gravity.west`        | Middle left      |
| Center (中央)      | `gravity.center`      | Center           |
| Middle-Right (中右)| `gravity.east`        | Middle right     |
| Bottom-Left (左下) | `gravity.southwest`   | Southwest corner |
| Bottom-Center (下中)| `gravity.south`      | Bottom center    |
| Bottom-Right (右下)| `gravity.southeast`   | Southeast corner |

## Usage Examples

### Logo Watermark

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const logoWatermarker = new ImageWatermark({
  watermarks: [
    {
      image: readFileSync('./company-logo.png'),
      gravity: gravity.northeast, // Top-right corner
    },
  ],
});

const productImage = readFileSync('product.jpg');
const watermarkedProduct = await logoWatermarker.convert<Buffer>(productImage);
writeFileSync('product-watermarked.jpg', watermarkedProduct);
```

### Batch Watermarking

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const images = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
const watermarker = new ImageWatermark({
  watermarks: [
    {
      image: './watermark.png',
      gravity: gravity.southeast,
    },
  ],
  concurrency: 4, // Process 4 images in parallel
});

const watermarkedImages = await Promise.all(
  images.map(async (imagePath) => {
    const image = readFileSync(imagePath);
    return await watermarker.convert<Buffer>(image);
  }),
);

watermarkedImages.forEach((img, index) => {
  writeFileSync(`output-${index}.jpg`, img);
});
```

## Integration with File Converter System

```typescript
import { ConverterManager } from '@rytass/file-converter';
import { ImageResizer } from '@rytass/file-converter-adapter-image-resizer';
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { ImageTranscoder } from '@rytass/file-converter-adapter-image-transcoder';
import { gravity } from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

// Processing pipeline: resize → watermark → convert to WebP
const pipeline = new ConverterManager([
  new ImageResizer({
    maxWidth: 1200,
    maxHeight: 800,
    keepAspectRatio: true,
  }),
  new ImageWatermark({
    watermarks: [
      {
        image: readFileSync('./brand-watermark.png'),
        gravity: gravity.southeast,
      },
    ],
  }),
  new ImageTranscoder({
    targetFormat: 'webp',
    quality: 85,
  }),
]);

const originalImage = readFileSync('photo.jpg');
const processedImage = await pipeline.convert<Buffer>(originalImage);
writeFileSync('processed.webp', processedImage);
```

## Error Handling

```typescript
import { ImageWatermark } from '@rytass/file-converter-adapter-image-watermark';
import { gravity } from 'sharp';

try {
  const watermarker = new ImageWatermark({
    watermarks: [
      {
        image: './nonexistent-watermark.png',
        gravity: gravity.center,
      },
    ],
  });

  const result = await watermarker.convert<Buffer>(imageBuffer);
} catch (error) {
  console.error('Watermarking failed:', error.message);
}
```

## Best Practices

### Performance

- Use appropriately sized watermark images to avoid excessive processing
- Set `concurrency` option based on CPU cores for batch processing
- Use Buffer input for watermarks when processing many images (avoids repeated file reads)
- Use streams for large source images to manage memory usage

### Quality

- Use PNG format for watermarks with transparency
- Pre-resize watermark images to appropriate dimensions
- Test watermark visibility against various image backgrounds

## Supported Formats

**Input formats:** JPEG, PNG, WebP, TIFF, GIF, AVIF, HEIF
**Watermark formats:** PNG (recommended for transparency), JPEG, WebP
**Output formats:** Same as input format

## License

MIT
