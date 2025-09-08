import { ArticleStage } from '../../src/typings/article-stage.enum';
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

export const createMockLogger = (): {
  debug: jest.Mock;
  log: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  verbose: jest.Mock;
} => ({
  debug: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  verbose: jest.fn(),
});
