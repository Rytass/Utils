import { CMSBaseModuleOptionFactory } from 'cms-base-nestjs-module/src/typings/cms-base-root-module-option-factory';
import { CMSBaseModule } from '../src/cms-base.module';
import { CMS_BASE_MODULE_OPTIONS } from '../src/typings/cms-base-providers';
import { CMSBaseModuleOptionsDto } from '../src/typings/cms-base-root-module-options.dto';

describe('CMSBaseModule.forRoot', () => {
  it('should return a valid DynamicModule with config values', () => {
    const module = CMSBaseModule.forRoot({
      multipleLanguageMode: true,
      fullTextSearchMode: true,
      enableDraftMode: true,
    });

    expect(module.module).toBe(CMSBaseModule);
    expect(module.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: CMS_BASE_MODULE_OPTIONS,
          useValue: expect.objectContaining({
            multipleLanguageMode: true,
            fullTextSearchMode: true,
            enableDraftMode: true,
          }),
        }),
      ]),
    );
  });
});

describe('CMSBaseModule.forRootAsync (useFactory)', () => {
  it('should return a DynamicModule with a factory provider', () => {
    const module = CMSBaseModule.forRootAsync({
      useFactory: () => ({
        allowCircularCategories: true,
      }),
    });

    expect(module.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: CMS_BASE_MODULE_OPTIONS,
          useFactory: expect.any(Function),
        }),
      ]),
    );
  });

  it('should not include useClass provider when none of the async options are set', () => {
    const module = CMSBaseModule.forRootAsync({} as any);

    const hasUseClassProvider = module.providers?.some(
      (provider: any) => provider.useClass !== undefined,
    );

    expect(hasUseClassProvider).toBe(false);
  });
});

describe('CMSBaseModule.forRootAsync (useClass)', () => {
  class MockFactory implements CMSBaseModuleOptionFactory {
    createCMSOptions(): CMSBaseModuleOptionsDto {
      return {
        enableDraftMode: true,
      };
    }
  }

  it('should return a DynamicModule with useClass provider', () => {
    const module = CMSBaseModule.forRootAsync({
      useClass: MockFactory,
    });

    expect(module.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: CMS_BASE_MODULE_OPTIONS,
          useFactory: expect.any(Function),
          inject: [MockFactory],
        }),
        expect.objectContaining({
          provide: MockFactory,
          useClass: MockFactory,
        }),
      ]),
    );
  });

  it('should execute useFactory from useClass provider', async () => {
    class DummyFactory implements CMSBaseModuleOptionFactory {
      createCMSOptions(): CMSBaseModuleOptionsDto {
        return {
          allowMultipleParentCategories: true,
        };
      }
    }

    const module = CMSBaseModule.forRootAsync({
      useClass: DummyFactory,
    });

    const factoryProvider = (module.providers ?? []).find((p) => {
      return (
        typeof (p as any).useFactory === 'function' &&
        (p as any).provide === CMS_BASE_MODULE_OPTIONS
      );
    }) as { useFactory: (...args: any[]) => any };

    expect(factoryProvider).toBeDefined();

    const result = await factoryProvider!.useFactory(new DummyFactory());

    expect(result).toEqual({
      allowMultipleParentCategories: true,
    });
  });
});
