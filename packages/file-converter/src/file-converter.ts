import { Readable } from 'stream';

export type ConvertableFile = Readable | Buffer;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface FileConverter<O = Record<string, unknown>> {
  convert<Buffer>(file: ConvertableFile): Promise<Buffer>;
  convert<Readable>(file: ConvertableFile): Promise<Readable>;
}
