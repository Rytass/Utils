import type { Gravity } from 'sharp';

type FilePath = string;

interface Watermark {
  image: FilePath | Buffer;
  gravity?: Gravity;
}

export interface ImageWatermarkOptions {
  watermarks: Watermark[];
  /**
   * Number of libvips threads used to process each image (`sharp.concurrency`).
   * This is a process-wide setting and is only changed when provided.
   */
  concurrency?: number;
}
