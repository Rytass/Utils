import { ArticleSearchMode } from '../../src/typings/article-search-mode.enum';
import { BaseSignatureLevelEntity } from '../../src/models/base-signature-level.entity';
import { ArticleBaseService } from '../../src/services/article-base.service';
import * as jieba from '@node-rs/jieba';

describe('ArticleBaseService - Bootstrap Properties', () => {
  let service: ArticleBaseService;

  const mockDeps = {
    repo: {} as any,
    boolean: true,
    signatureRepo: {} as any,
    dataSource: { query: jest.fn() } as any,
  };

  beforeEach(() => {
    service = new ArticleBaseService(
      mockDeps.repo,
      mockDeps.repo,
      mockDeps.repo,
      mockDeps.repo,
      mockDeps.boolean,
      mockDeps.boolean,
      mockDeps.boolean,
      [],
      mockDeps.repo,
      mockDeps.repo,
      mockDeps.boolean,
      mockDeps.dataSource,
    );
  });

  describe('signatureEnabled (private getter)', () => {
    it('should return true when signatureLevels has at least one item', () => {
      (service as any).signatureLevels = ['level1'];
      expect((service as any).signatureEnabled).toBe(true);
    });

    it('should return false when signatureLevels is empty', () => {
      (service as any).signatureLevels = [];
      expect((service as any).signatureEnabled).toBe(false);
    });
  });

  describe('finalSignatureLevel (getter)', () => {
    it('should return the last signature level in the cache', () => {
      const level1 = new BaseSignatureLevelEntity();

      level1.name = 'L1';
      const level2 = new BaseSignatureLevelEntity();

      level2.name = 'L2';

      (service as any).signatureLevelsCache = [level1, level2];

      expect(service.finalSignatureLevel).toBe(level2);
    });

    it('should return null if cache is empty', () => {
      (service as any).signatureLevelsCache = [];
      expect(service.finalSignatureLevel).toBeNull();
    });
  });

  describe('onApplicationBootstrap', () => {
    let service: ArticleBaseService;
    const mockQuery = jest.fn();
    const mockLogger = { log: jest.fn() };
    const mockRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        delete: jest.fn(),
        softDelete: jest.fn(),
        save: jest.fn(),
      },
    };

    beforeEach(() => {
      service = new ArticleBaseService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        true, // fullTextSearchMode
        true, // multilingualMode
        true, // versionMode
        [],
        {} as any,
        {} as any,
        true, // signatureEnabled
        { query: mockQuery } as any,
      );

      (service as any).logger = mockLogger;
      (service as any).getDefaultQueryBuilder = jest.fn().mockReturnValue({
        orWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            versions: [
              {
                tags: ['tagA'],
                multiLanguageContents: [
                  {
                    articleId: '1',
                    version: 1,
                    language: 'en',
                    title: 'title',
                    description: 'desc',
                    content: [],
                  },
                ],
              },
            ],
          },
        ]),
      });

      (service as any).bindSearchTokens = jest
        .fn()
        .mockResolvedValue(undefined);

      (service as any).dataSource = {
        query: mockQuery,
        createQueryRunner: () => mockRunner,
      };

      (service as any).baseArticleVersionContentRepo = {
        metadata: { tableName: 'article_versions' },
      };

      (service as any).signatureLevelRepo = {
        find: jest.fn().mockResolvedValue([
          { id: 1, name: 'Editor' },
          { id: 2, name: 'Chief' },
        ]),
        target: 'signature_levels',
        create: jest.fn().mockImplementation((x) => x),
      };

      (service as any).articleSignatureRepo = {
        target: 'article_signatures',
      };

      Object.defineProperty(service, 'signatureLevels', {
        get: () => ['Editor', 'NewReviewer'],
      });
    });

    it('should index articles and update signature levels on bootstrap', async () => {
      await service.onApplicationBootstrap();

      // Full-text indexing expectations
      expect(mockLogger.log).toHaveBeenCalledWith('Start indexing articles...');
      expect(service['bindSearchTokens']).toHaveBeenCalled();

      expect(mockQuery.mock.calls[0][0]).toContain('CREATE INDEX');

      expect(mockLogger.log).toHaveBeenCalledWith('Indexing articles done.');

      // Signature level expectations
      expect(mockRunner.connect).toHaveBeenCalled();
      expect(mockRunner.startTransaction).toHaveBeenCalled();
      expect(mockRunner.manager.delete).toHaveBeenCalledWith(
        'article_signatures',
        {
          signatureLevelId: 2, // Chief should be deleted
        },
      );

      expect(mockRunner.manager.softDelete).toHaveBeenCalledWith(
        'signature_levels',
        {
          id: 2,
        },
      );

      // Save for existing level (Editor)
      expect(mockRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Editor', required: true }),
      );

      // Save for new level
      expect(mockRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NewReviewer', required: true }),
      );

      expect(mockRunner.commitTransaction).toHaveBeenCalled();
      expect(mockRunner.release).toHaveBeenCalled();
    });

    it('should handle level instanceof BaseSignatureLevelEntity', async () => {
      class CustomLevel extends BaseSignatureLevelEntity {
        name = 'Editor';
      }

      const existing = new CustomLevel();

      (service as any).signatureLevelRepo.find.mockResolvedValue([]);
      jest
        .spyOn(service as any, 'signatureLevels', 'get')
        .mockReturnValue([existing]);

      await service.onApplicationBootstrap();

      expect(mockRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Editor',
          required: true,
          sequence: 0,
        }),
      );
    });

    it('should update and save existing level from existedMap', async () => {
      (service as any).signatureLevelRepo.find.mockResolvedValue([
        { id: 1, name: 'Editor' },
      ]);

      jest
        .spyOn(service as any, 'signatureLevels', 'get')
        .mockReturnValue(['Editor']);

      await service.onApplicationBootstrap();

      expect(mockRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Editor',
          required: true,
          sequence: 0,
        }),
      );
    });

    it('should create and save new level if not found in existedMap', async () => {
      (service as any).signatureLevelRepo.find.mockResolvedValue([]);
      jest
        .spyOn(service as any, 'signatureLevels', 'get')
        .mockReturnValue(['Reviewer']);

      await service.onApplicationBootstrap();

      expect(service['signatureLevelRepo'].create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Reviewer',
          required: true,
          sequence: 0,
        }),
      );

      expect(mockRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Reviewer', required: true }),
      );
    });

    it('should rollback transaction and rethrow error on failure', async () => {
      (service as any).signatureLevelRepo.find.mockResolvedValue([]);
      jest
        .spyOn(service as any, 'signatureLevels', 'get')
        .mockReturnValue(['Reviewer']);

      mockRunner.manager.save.mockRejectedValue(new Error('Save failed'));

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        'Save failed',
      );

      expect(mockRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockRunner.release).toHaveBeenCalled();
    });
  });

  describe('bindSearchTokens', () => {
    jest.mock('@node-rs/jieba', () => ({
      cut: jest.fn(() => ['token1', 'token2']),
    }));

    class MockBaseArticleVersionContentRepo {
      metadata = { tableName: 'article_versions' };
    }

    const mockCut = jest.fn().mockName('jieba.cut');

    jest.mock('@node-rs/jieba', () => ({
      cut: mockCut,
    }));

    let service: ArticleBaseService;
    let mockQuery: jest.Mock;

    beforeEach(() => {
      jest.resetAllMocks();
      mockQuery = jest.fn();
      mockCut.mockReset();

      service = new ArticleBaseService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        true,
        true,
        true,
        [],
        {} as any,
        {} as any,
        true,
        { query: mockQuery } as any,
      );

      (service as any).dataSource = { query: mockQuery };
      (service as any).baseArticleVersionContentRepo =
        new MockBaseArticleVersionContentRepo();
    });

    it('should extract tokens and call query with expected arguments', async () => {
      mockCut.mockReturnValue(['token1', 'token2']);

      const contentInput = {
        articleId: '1',
        version: 2,
        language: 'en',
        title: 'Test Title',
        description: 'Test Desc',
        content: [
          {
            type: 'p',
            children: [{ text: 'Hello' }, { text: 'World' }],
          },
          {
            type: 'h1',
            children: [{ text: 'Ignored' }],
          },
        ],
      };

      await (service as any).bindSearchTokens(contentInput, ['tagX', 'tagY']);

      const [sql, values] = mockQuery.mock.calls[0];

      expect(sql).toContain('UPDATE "article_versions" SET');
      expect(values[0]).toBe('Test Title');
      expect(values[1]).toBe('tagX tagY');
      expect(values[2]).toBe('Test Desc');
      expect(values[3]).toContain('token');
      expect(values[4]).toBe('1');
      expect(values[5]).toBe(2);
      expect(values[6]).toBe('en');
    });

    it('should fallback to empty string when tags is undefined', async () => {
      mockCut.mockReturnValue([]);

      await (service as any).bindSearchTokens({
        content: [],
        title: 'Test',
        description: 'Desc',
        articleId: 'id1',
        version: 1,
        language: 'en',
      });

      const args = mockQuery.mock.calls[0][1];

      expect(args[1]).toBe('');
    });

    it('should fallback to empty string when description is undefined', async () => {
      mockCut.mockReturnValue([]);

      await (service as any).bindSearchTokens(
        {
          content: [],
          title: 'Test',
          description: undefined,
          articleId: 'id2',
          version: 2,
          language: 'en',
        },
        [],
      );

      const args = mockQuery.mock.calls[0][1];

      expect(args[2]).toBe('');
    });

    it('should use runner.query when runner is provided', async () => {
      const mockRunner = { query: jest.fn() };

      mockCut.mockReturnValue([]);

      await (service as any).bindSearchTokens(
        {
          content: [],
          title: 'Test',
          description: 'Desc',
          articleId: 'id4',
          version: 4,
          language: 'en',
        },
        [],
        mockRunner,
      );

      expect(mockRunner.query).toHaveBeenCalled();
    });

    it('should fallback to empty string when tokens are empty', async () => {
      mockCut.mockReturnValue([]);

      await (service as any).bindSearchTokens(
        {
          content: [],
          title: 'Test',
          description: 'Desc',
          articleId: 'id3',
          version: 3,
          language: 'en',
        },
        [],
      );

      const args = mockQuery.mock.calls[0][1];

      expect(args[3]).toBe('');
    });
  });

  describe('refreshSignatureLevelsCache', () => {
    let mockRepo: any;

    beforeEach(() => {
      mockRepo = {
        find: jest.fn(),
      };

      (service as any).signatureLevelRepo = mockRepo;
    });

    it('sets signatureLevelsCache to ordered signature levels', async () => {
      const mockLevels = [
        { id: 'lvl-1', name: 'L1', sequence: 1 },
        { id: 'lvl-2', name: 'L2', sequence: 2 },
      ];

      mockRepo.find.mockResolvedValue(mockLevels);

      await service.refreshSignatureLevelsCache();

      expect((service as any).signatureLevelsCache).toEqual(mockLevels);
      expect(mockRepo.find).toHaveBeenCalledWith({
        order: { sequence: 'ASC' },
      });
    });

    it('sets signatureLevelsCache to empty array if repo returns nothing', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.refreshSignatureLevelsCache();

      expect((service as any).signatureLevelsCache).toEqual([]);
    });

    it('throws if signatureLevelRepo.find fails', async () => {
      mockRepo.find.mockRejectedValue(new Error('DB error'));

      await expect(service.refreshSignatureLevelsCache()).rejects.toThrow(
        'DB error',
      );
    });
  });
});
