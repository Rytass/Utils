export interface MockRepository {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  softRemove: jest.Mock;
  softDelete: jest.Mock;
  update: jest.Mock;
  create: jest.Mock;
  createQueryBuilder: jest.Mock;
  metadata: {
    tableName: string;
  };
}

export interface MockQueryRunner {
  connect: jest.Mock;
  startTransaction: jest.Mock;
  commitTransaction: jest.Mock;
  rollbackTransaction: jest.Mock;
  release: jest.Mock;
  query: jest.Mock;
  manager: {
    save: jest.Mock;
    softRemove: jest.Mock;
    softDelete: jest.Mock;
    update: jest.Mock;
  };
}

export interface MockDataSource {
  createQueryRunner: () => MockQueryRunner;
  query: jest.Mock;
}

export interface SimpleMockRepository {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  metadata: {
    tableName: string;
  };
}

export interface MockArticleDataLoader {
  loadByIds: jest.Mock;
  loadById: jest.Mock;
  clear: jest.Mock;
  clearAll: jest.Mock;
}

export interface MockSignatureService {
  checkSignatureLevel: jest.Mock;
  getSignatureLevel: jest.Mock;
  createSignature: jest.Mock;
  approveSignature: jest.Mock;
  rejectSignature: jest.Mock;
  resetSignature: jest.Mock;
}

export interface MockArticleBaseServiceParams {
  baseArticleRepo: MockRepository;
  baseArticleVersionRepo: MockRepository;
  baseArticleVersionContentRepo: MockRepository;
  baseCategoryRepo: MockRepository;
  multipleLanguageMode: boolean;
  fullTextSearchMode: boolean;
  draftMode: boolean;
  signatureLevels: string[];
  signatureLevelRepo: MockRepository;
  articleSignatureRepo: MockRepository;
  autoReleaseAfterApproved: boolean;
  dataSource: MockDataSource;
  articleDataLoader: MockArticleDataLoader;
  signatureService: MockSignatureService;
}

export type MockRepositoryFactory = (tableName?: string) => MockRepository;
export type SimpleMockRepositoryFactory = () => SimpleMockRepository;

// Helper functions to create properly typed mocks
export const createMockRepository = (tableName: string = 'mock_table'): MockRepository => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  softRemove: jest.fn(),
  softDelete: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
  metadata: { tableName },
});

export const createMockDataSource = (): MockDataSource => {
  const mockQueryRunner: MockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
    manager: {
      save: jest.fn(),
      softRemove: jest.fn(),
      softDelete: jest.fn(),
      update: jest.fn(),
    },
  };

  return {
    createQueryRunner: () => mockQueryRunner,
    query: jest.fn(),
  };
};

export const createMockArticleDataLoader = (): MockArticleDataLoader => ({
  loadByIds: jest.fn(),
  loadById: jest.fn(),
  clear: jest.fn(),
  clearAll: jest.fn(),
});

export const createMockSignatureService = (): MockSignatureService => ({
  checkSignatureLevel: jest.fn(),
  getSignatureLevel: jest.fn(),
  createSignature: jest.fn(),
  approveSignature: jest.fn(),
  rejectSignature: jest.fn(),
  resetSignature: jest.fn(),
});

export const createMockArticleBaseServiceParams = (): MockArticleBaseServiceParams => ({
  baseArticleRepo: createMockRepository('base_articles'),
  baseArticleVersionRepo: createMockRepository('base_article_versions'),
  baseArticleVersionContentRepo: createMockRepository('base_article_version_contents'),
  baseCategoryRepo: createMockRepository('base_categories'),
  multipleLanguageMode: true,
  fullTextSearchMode: true,
  draftMode: true,
  signatureLevels: ['level1', 'level2'],
  signatureLevelRepo: createMockRepository('base_signature_levels'),
  articleSignatureRepo: createMockRepository('article_signatures'),
  autoReleaseAfterApproved: true,
  dataSource: createMockDataSource(),
  articleDataLoader: createMockArticleDataLoader(),
  signatureService: createMockSignatureService(),
});
