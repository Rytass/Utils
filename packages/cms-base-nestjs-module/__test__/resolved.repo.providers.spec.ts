import { FactoryProvider } from '@nestjs/common';
import { ResolvedRepoProviders } from '../src/constants/resolved-repo-providers';
import { DataSource, Repository } from 'typeorm';

describe('ResolvedRepoProviders', () => {
  it('should return repository from dataSource if entity is defined', () => {
    const mockEntity = class MockEntity {};
    const mockRepo = { fromDataSource: true } as Repository<unknown>;
    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepo),
    } as unknown as DataSource;

    const provider = ResolvedRepoProviders[0] as FactoryProvider;
    const result = provider.useFactory!({} as Repository<unknown>, mockEntity, mockDataSource);

    expect(mockDataSource.getRepository).toHaveBeenCalledWith(mockEntity);
    expect(result).toBe(mockRepo);
  });

  it('should return baseRepo if entity is not defined', () => {
    const mockBaseRepo = { fromBase: true } as Repository<unknown>;
    const mockDataSource = {
      getRepository: jest.fn(),
    } as unknown as DataSource;

    const provider = ResolvedRepoProviders[0] as FactoryProvider;
    const result = provider.useFactory!(mockBaseRepo, undefined, mockDataSource);

    expect(mockDataSource.getRepository).not.toHaveBeenCalled();
    expect(result).toBe(mockBaseRepo);
  });
});
