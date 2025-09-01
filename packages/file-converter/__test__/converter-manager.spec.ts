import { ConvertableFile, FileConverter } from '../src';
import { ConverterManager } from '../src/converter-manager';

describe('ConverterManager', () => {
  const convert1 = jest.fn<Promise<Buffer>, [file: ConvertableFile]>();
  const convert2 = jest.fn<Promise<Buffer>, [file: ConvertableFile]>();

  convert1.mockImplementation(
    async (file: ConvertableFile): Promise<Buffer> => {
      return Buffer.concat([file as Buffer, Buffer.from([0x01])]);
    },
  );

  convert2.mockImplementation(
    async (file: ConvertableFile): Promise<Buffer> => {
      return Buffer.concat([file as Buffer, Buffer.from([0x02])]);
    },
  );

  const converter1 = {
    convert: convert1,
  } as FileConverter;

  const converter2 = {
    convert: convert2,
  } as FileConverter;

  const converterManager = new ConverterManager([converter1, converter2]);

  it('should convert method can iterator its converters', (done) => {
    converterManager
      .convert(Buffer.from([0x00]))
      .then((resultFile) => {
        expect(convert1).toHaveBeenCalledTimes(1);
        expect(convert2).toHaveBeenCalledTimes(1);

        expect(
          Buffer.compare(resultFile as Buffer, Buffer.from([0x00, 0x01, 0x02])),
        ).toBe(0);

        done();
      })
      .catch((error) => {
        done(error);
      });
  });
});
