import {
  isModuleNotFound,
  toTypeORMAdapterLoadError,
  TYPEORM_ADAPTER_MISSING_MESSAGE,
} from '../src/constants/load-typeorm-adapter';

const withCode = (code: string): NodeJS.ErrnoException => Object.assign(new Error(`boom: ${code}`), { code });

describe('typeorm-adapter optional peer dependency loading', () => {
  describe('isModuleNotFound', () => {
    // CJS 走 MODULE_NOT_FOUND、ESM dynamic import 走 ERR_MODULE_NOT_FOUND，
    // 使用者的 app 可能是任一種，兩個都必須認得。
    it.each(['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'])('should recognize %s', code => {
      expect(isModuleNotFound(withCode(code))).toBe(true);
    });

    it.each([
      ['other error codes', withCode('ERR_INVALID_ARG_TYPE')],
      ['errors without a code', new Error('no code')],
      ['non-error throwables', 'just a string'],
      ['null', null],
      ['undefined', undefined],
    ])('should not treat %s as a missing module', (_label, ex) => {
      expect(isModuleNotFound(ex)).toBe(false);
    });
  });

  describe('toTypeORMAdapterLoadError', () => {
    it.each(['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'])(
      'should replace %s with actionable install guidance',
      code => {
        const original = withCode(code);
        const mapped = toTypeORMAdapterLoadError(original);

        expect(mapped).toBeInstanceOf(Error);
        expect((mapped as Error).message).toBe(TYPEORM_ADAPTER_MISSING_MESSAGE);
        expect((mapped as Error).message).toContain('npm i typeorm-adapter');
        // 原始錯誤必須保留，否則使用者無法看到真正的解析失敗路徑。
        expect((mapped as Error).cause).toBe(original);
      },
    );

    // 這是這段邏輯存在的主要理由：把所有錯誤都換成安裝訊息，會讓
    // 「已安裝但初始化失敗」（例如資料庫連不上）被誤導成「你沒裝套件」。
    it('should pass through non-module-resolution failures untouched', () => {
      const original = withCode('ECONNREFUSED');

      expect(toTypeORMAdapterLoadError(original)).toBe(original);
    });

    it('should pass through errors that carry no code untouched', () => {
      const original = new Error('adapter blew up during initialization');

      expect(toTypeORMAdapterLoadError(original)).toBe(original);
    });

    it('should pass through non-error throwables untouched', () => {
      expect(toTypeORMAdapterLoadError('string throwable')).toBe('string throwable');
    });
  });
});
