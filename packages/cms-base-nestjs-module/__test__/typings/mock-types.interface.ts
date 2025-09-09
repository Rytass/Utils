import { ArticleStage } from '../../src/typings/article-stage.enum';
import { ArticleFindAllDto } from '../../src/typings/article-find-all.dto';
import { Language } from '../../src/typings/language';
import { ArticleBaseService } from '../../src/services/article-base.service';
import { MockRepository, MockSignatureService } from './mock-repository.interface';

/**
 * Mock type for article entities used in findById mock returns
 */
export interface MockArticleEntity {
  id: string;
  version: number;
  submittedAt?: Date;
  releasedAt?: Date;
  submittedBy?: string;
  releasedBy?: string;
  stage?: ArticleStage;
}

/**
 * Mock type for findById options parameter
 */
export interface MockFindByIdOptions {
  stage?: ArticleStage;
  version?: number;
  withDeleted?: boolean;
}

/**
 * Mock type for ArticleBaseDto used in approveVersion return values
 */
export interface MockArticleBaseDto {
  id: string;
  version: number;
  updatedAt: Date;
  updatedBy?: string | null;
  submittedAt?: Date | null;
  releasedAt?: Date | null;
  submittedBy?: string | null;
  releasedBy?: string | null;
  stage?: ArticleStage;
  categories?: never[];
  content?: never[];
  [key: string]: unknown;
}

/**
 * Mock type for version input objects used in tests
 */
export interface MockVersionInput {
  releasedAt: Date;
  [key: string]: unknown;
}

/**
 * Mock Repository type with minimal methods
 */
export interface MockDataLoaderRepository {
  createQueryBuilder: jest.Mock;
  [key: string]: unknown;
}

/**
 * Mock QueryBuilder for data loaders
 */
export interface MockDataLoaderQueryBuilder {
  andWhere: jest.Mock;
  orWhere: jest.Mock;
  getOne: jest.Mock;
  getMany: jest.Mock;
  withDeleted: jest.Mock;
  addOrderBy: jest.Mock;
  setLock: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  innerJoinAndSelect: jest.Mock;
  [key: string]: unknown;
}

/**
 * Mock Brackets for TypeORM
 */
export interface MockBrackets {
  __mocked: boolean;
  [key: string]: unknown;
}

/**
 * Mock callback function type
 */
export interface MockBracketsCallback {
  orWhere: jest.Mock;
  [key: string]: unknown;
}

/**
 * Mock save input for entity operations
 */
export interface MockSaveInput {
  version?: number;
  articleId?: string;
  language?: string;
  title?: string;
  content?: unknown;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Mock saved entity result
 */
export interface MockSavedEntity {
  id: string;
  createdAt: Date;
  [key: string]: unknown;
}

/**
 * Extended Mock Article Data Loader with all required properties
 */
export interface MockArticleDataLoaderFull {
  articleRepo: MockRepository;
  articleVersionRepo: MockRepository;
  signatureService: MockSignatureService;
  stageLoader: {
    load: jest.Mock;
    clear: jest.Mock;
    clearAll: jest.Mock;
  };
  stageCache: Map<string, unknown>;
  categoryLoader: {
    load: jest.Mock;
    loadMany: jest.Mock;
    clear: jest.Mock;
    clearAll: jest.Mock;
  };
  versionLoader: {
    load: jest.Mock;
    loadMany: jest.Mock;
    clear: jest.Mock;
    clearAll: jest.Mock;
  };
  loadByIds: jest.Mock;
  loadById: jest.Mock;
  clear: jest.Mock;
  clearAll: jest.Mock;
}

/**
 * Mock type for Query Runner used in transactions
 */
export interface MockQueryRunnerFull {
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
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
}

/**
 * Partial mock repository for minimal mocking needs
 */
export interface MockRepositoryPartial {
  metadata: {
    tableName: string;
  };
  find?: jest.Mock;
  findOne?: jest.Mock;
  save?: jest.Mock;
  create?: jest.Mock;
  update?: jest.Mock;
  softRemove?: jest.Mock;
  softDelete?: jest.Mock;
  createQueryBuilder?: jest.Mock;
}

/**
 * Mock data source with partial implementation
 */
export interface MockDataSourcePartial {
  createQueryRunner: () => MockQueryRunnerFull;
  query?: jest.Mock;
  getRepository?: jest.Mock;
  manager?: {
    save?: jest.Mock;
    find?: jest.Mock;
    findOne?: jest.Mock;
  };
}

/**
 * Mock signature service with minimal implementation
 */
export interface MockSignatureServicePartial {
  signatureEnabled: boolean;
  checkSignatureLevel?: jest.Mock;
  getSignatureLevel?: jest.Mock;
  createSignature?: jest.Mock;
  approveSignature?: jest.Mock;
  rejectSignature?: jest.Mock;
  resetSignature?: jest.Mock;
}

/**
 * Mock for ArticleBaseService with typed methods
 */
export interface MockArticleBaseService {
  findById: jest.Mock;
  approveVersion: jest.Mock;
  signature: jest.Mock;
  multipleLanguageMode?: boolean;
  signatureService?: MockSignatureServicePartial;
  logger?: MockLogger;
  bindSearchTokens?: jest.Mock;
  [key: string]: unknown;
}

/**
 * Type for casting service to access private properties
 */
export interface ArticleBaseServiceWithPrivates {
  logger: MockLogger;
  multipleLanguageMode: boolean;
  signatureService: {
    finalSignatureLevel: { name: string };
  };
  approveVersion: jest.Mock;
  bindSearchTokens: jest.Mock;
  findById: jest.Mock;
  [key: string]: unknown;
}

/**
 * Mock for DataSource with typed methods
 */
export interface MockDataSource {
  createQueryRunner: () => MockQueryRunnerFull;
  query?: jest.Mock;
  getRepository?: jest.Mock;
  manager?: {
    save?: jest.Mock;
    find?: jest.Mock;
    findOne?: jest.Mock;
  };
  entityMetadatas?: unknown[];
  options?: unknown;
}

/**
 * Mock for DataLoader with typed methods
 */
export interface MockDataLoader {
  articleRepo: MockRepositoryPartial;
  articleVersionRepo: MockRepositoryPartial;
  signatureService: MockSignatureServicePartial;
  stageLoader: {
    load: jest.Mock;
    clear?: jest.Mock;
    clearAll?: jest.Mock;
  };
  stageCache: Map<string, unknown>;
  categoryLoader: {
    load: jest.Mock;
    loadMany?: jest.Mock;
    clear?: jest.Mock;
    clearAll?: jest.Mock;
  };
  versionLoader: {
    load: jest.Mock;
    loadMany?: jest.Mock;
    clear?: jest.Mock;
    clearAll?: jest.Mock;
  };
}

/**
 * Mock Logger interface
 */
export interface MockLogger {
  debug: jest.Mock;
  log: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  verbose: jest.Mock;
}

// Helper functions to create properly typed mocks
export const createMockArticleEntity = (overrides: Partial<MockArticleEntity> = {}): MockArticleEntity => ({
  id: 'mock-article-id',
  version: 1,
  ...overrides,
});

export const createMockFindByIdOptions = (overrides: Partial<MockFindByIdOptions> = {}): MockFindByIdOptions => ({
  ...overrides,
});

export const createMockArticleDataLoaderFull = (): MockArticleDataLoaderFull => ({
  articleRepo: {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    softDelete: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
    metadata: { tableName: 'articles' },
  },
  articleVersionRepo: {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    softDelete: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
    metadata: { tableName: 'article_versions' },
  },
  signatureService: {
    checkSignatureLevel: jest.fn(),
    getSignatureLevel: jest.fn(),
    createSignature: jest.fn(),
    approveSignature: jest.fn(),
    rejectSignature: jest.fn(),
    resetSignature: jest.fn(),
  },
  stageLoader: {
    load: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
  },
  stageCache: new Map(),
  categoryLoader: {
    load: jest.fn(),
    loadMany: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
  },
  versionLoader: {
    load: jest.fn(),
    loadMany: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
  },
  loadByIds: jest.fn(),
  loadById: jest.fn(),
  clear: jest.fn(),
  clearAll: jest.fn(),
});

export const createMockQueryRunnerFull = (): MockQueryRunnerFull => ({
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
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  },
});

export const createMockRepositoryPartial = (tableName: string = 'mock_table'): MockRepositoryPartial => ({
  metadata: { tableName },
});

export const createMockDataSourcePartial = (): MockDataSourcePartial => ({
  createQueryRunner: () => createMockQueryRunnerFull(),
});

export const createMockSignatureServicePartial = (signatureEnabled: boolean = true): MockSignatureServicePartial => ({
  signatureEnabled,
});

export const createMockArticleBaseDto = (overrides: Partial<MockArticleBaseDto> = {}): MockArticleBaseDto => ({
  id: 'mock-article-id',
  version: 1,
  updatedAt: new Date(),
  updatedBy: null,
  submittedAt: null,
  releasedAt: null,
  submittedBy: null,
  releasedBy: null,
  stage: ArticleStage.DRAFT,
  ...overrides,
});

export const createMockQueryBuilder = (): {
  andWhere: jest.Mock;
  orWhere: jest.Mock;
  getOne: jest.Mock;
  getMany: jest.Mock;
  withDeleted: jest.Mock;
  addOrderBy: jest.Mock;
  setLock: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  innerJoinAndSelect: jest.Mock;
} => ({
  andWhere: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
  getMany: jest.fn(),
  withDeleted: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  setLock: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  innerJoinAndSelect: jest.fn().mockReturnThis(),
});

export const createMockLogger = (): MockLogger => ({
  debug: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  verbose: jest.fn(),
});

export const createMockDataSource = (): MockDataSource => ({
  createQueryRunner: () => createMockQueryRunnerFull(),
  query: jest.fn(),
  getRepository: jest.fn(),
  manager: {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  },
  entityMetadatas: [],
  options: {},
});

export const createMockDataLoader = (): MockDataLoader => ({
  articleRepo: createMockRepositoryPartial('articles'),
  articleVersionRepo: createMockRepositoryPartial('article_versions'),
  signatureService: createMockSignatureServicePartial(),
  stageLoader: {
    load: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
  },
  stageCache: new Map(),
  categoryLoader: {
    load: jest.fn(),
    loadMany: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
  },
  versionLoader: {
    load: jest.fn(),
    loadMany: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
  },
});

export const createMockDataLoaderRepository = (): MockDataLoaderRepository => ({
  createQueryBuilder: jest.fn(),
});

export const createMockDataLoaderQueryBuilder = (): MockDataLoaderQueryBuilder => ({
  andWhere: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
  getMany: jest.fn(),
  withDeleted: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  setLock: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  innerJoinAndSelect: jest.fn().mockReturnThis(),
});

/**
 * Extended ArticleBaseService type for testing private properties
 */
export interface TestableArticleBaseService extends ArticleBaseService {
  multipleLanguageMode: boolean;
  draftMode: boolean;
  autoReleaseAfterApproved: boolean;
  fullTextSearchMode: boolean;
}

/**
 * Type for findCollection method parameters in tests
 */
export interface FindCollectionTestOptions extends Partial<ArticleFindAllDto> {
  language?: Language;
}

/**
 * Type for article objects in test results
 */
export interface TestArticleResult {
  id: string;
  contentField?: string;
  [key: string]: unknown;
}

/**
 * Mock repository metadata for ArticleBaseService constructor
 */
export interface MockRepositoryMetadata {
  schema?: string;
  tableName?: string;
  targetName?: string;
  tablePath?: string;
  manyToManyRelations?: unknown[];
}

/**
 * Mock repository type for ArticleBaseService constructor
 */
export interface MockRepositoryForService {
  metadata: MockRepositoryMetadata;
  [key: string]: unknown;
}

/**
 * Mock DataSource for ArticleBaseService constructor
 */
export interface MockServiceDataSource {
  createQueryBuilder: jest.Mock;
  [key: string]: unknown;
}

/**
 * Mock DataLoader for ArticleBaseService constructor
 */
export interface MockServiceDataLoader {
  stageCache: {
    set: jest.Mock;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Mock QueryBuilder for data loader tests
 */
export interface MockQueryBuilder {
  andWhere: jest.Mock;
  orWhere: jest.Mock;
  where: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  innerJoinAndSelect: jest.Mock;
  setLock: jest.Mock;
  getMany: jest.Mock;
  getOne: jest.Mock;
  addOrderBy: jest.Mock;
  withDeleted: jest.Mock;
  innerJoin: jest.Mock;
  [key: string]: unknown;
}

/**
 * Mock Repository for service utils tests
 */
export interface MockUtilsRepository {
  createQueryBuilder: jest.Mock;
  [key: string]: unknown;
}

/**
 * Mock QueryRunner for service utils tests
 */
export interface MockUtilsQueryRunner {
  connect: jest.Mock;
  startTransaction: jest.Mock;
  commitTransaction: jest.Mock;
  rollbackTransaction: jest.Mock;
  release: jest.Mock;
  manager: {
    save: jest.Mock;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
