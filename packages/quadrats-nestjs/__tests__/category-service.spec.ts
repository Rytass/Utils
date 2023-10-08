import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { QuadratsModule } from '../src/module';
import { QuadratsArticleCategoryService } from '../src/services/category.service';

const HOST = 'https://custom-url.com';
const ACCESS_KEY = '1111111111111';
const SECRET = '398h50w49g8042380f3e4irj4if3';

describe('Quadrats Nestjs Module - Category Service', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        QuadratsModule.forRoot({
          host: HOST,
          accessKey: ACCESS_KEY,
          secret: SECRET,
        }),
      ],
    }).compile();
  });

  it('should get all categories in account', async () => {
    const categoryService = await moduleRef.resolve(QuadratsArticleCategoryService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return {
        data: {
          data: {
            findCategories: [{
              id: '02500000031350000000',
              name: 'Test Category',
              subCategories: [],
            }],
          },
        },
      };
    });

    const categories = await categoryService.getAll();

    expect(categories.length).toBe(1);
    expect(categories[0].id).toBe('02500000031350000000');
  });

  it('should get category info', async () => {
    const categoryService = await moduleRef.resolve(QuadratsArticleCategoryService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          id: string;
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.id).toBe('02500000031350000000');
      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return {
        data: {
          data: {
            findCategory: {
              id: '02500000031350000000',
              name: 'Test Category',
              subCategories: [],
            },
          },
        },
      };
    });

    const category = await categoryService.get('02500000031350000000');

    expect(category!.id).toBe('02500000031350000000');
  });

  it('should get null on category not fo', async () => {
    const categoryService = await moduleRef.resolve(QuadratsArticleCategoryService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return {
        data: {
          data: {
            findCategory: null,
          },
        },
      };
    });

    const category = await categoryService.get('02500000031350000009');

    expect(category).toBeNull();
  });

  it('should create category', async () => {
    const categoryService = await moduleRef.resolve(QuadratsArticleCategoryService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          name: string,
          parentId: string | null,
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.name).toBe('New Category');
      expect(data.variables.parentId).toBeUndefined();
      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return {
        data: {
          data: {
            createCategory: {
              id: '02500000031350000002',
              name: data.variables.name,
            },
          },
        },
      };
    });

    const category = await categoryService.create('New Category');

    expect(category).not.toBeNull();
    expect(category.name).toBe('New Category');
  });

  it('should rename category method change the name', async () => {
    const categoryService = await moduleRef.resolve(QuadratsArticleCategoryService);

    const request = jest.spyOn(axios, 'request');

    let originName = 'Test Category';

    request.mockImplementation(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          id: string;
          name?: string,
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      if (/RenameCategory/.test(data.query)) {
        expect(data.variables.name).toBe('Next Name');
      }

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      if (/RenameCategory/.test(data.query)) {
        originName = data.variables.name as string;

        return {
          data: {
            data: {
              renameCategory: {
                id: data.variables.id,
                name: data.variables.name,
              },
            },
          },
        };
      }

      return {
        data: {
          data: {
            findCategory: {
              id: data.variables.id,
              name: originName,
            },
          },
        },
      };
    });

    const originCategory = await categoryService.get('02500000031350000000');

    expect(originCategory!.name).toBe('Test Category');

    const category = await categoryService.rename('02500000031350000000', 'Next Name');

    expect(category.name).toBe('Next Name');

    const nextCategory = await categoryService.get('02500000031350000000');

    expect(nextCategory!.name).toBe('Next Name');
  });
});
