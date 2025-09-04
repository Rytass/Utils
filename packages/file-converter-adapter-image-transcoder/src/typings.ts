import type { AvifOptions, GifOptions, HeifOptions, JpegOptions, PngOptions, TiffOptions, WebpOptions } from 'sharp';

type AVIFOptions = {
  targetFormat: 'avif';
} & AvifOptions;

type HEIFOptions = {
  targetFormat: 'heif';
} & HeifOptions;

type GIFOptions = {
  targetFormat: 'gif';
} & GifOptions;

type TIFFOptions = {
  targetFormat: 'tif' | 'tiff';
} & TiffOptions;

type PNGOptions = {
  targetFormat: 'png';
} & PngOptions;

type WEBPOptions = {
  targetFormat: 'webp';
} & WebpOptions;

type JPEGOptions = {
  targetFormat: 'jpg' | 'jpeg';
} & JpegOptions;

export type ImageTranscoderOptions =
  | AVIFOptions
  | HEIFOptions
  | GIFOptions
  | TIFFOptions
  | PNGOptions
  | WEBPOptions
  | JPEGOptions;
