import type { Gravity } from 'sharp';

type FilePath = string;

interface Watermark {
  image: FilePath | Buffer;
  gravity?: Gravity;
}

export interface ImageWatermarkOptions {
  watermarks: Watermark[];
  concurrency?: number;
}
