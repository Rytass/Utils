import { getMetadataArgsStorage } from 'typeorm';
import { BaseArticleEntity } from '../../../src/models/base-article.entity';

function resolveTypeName(type: any): string {
  try {
    if (typeof type === 'function') {
      const resolved = type();

      return resolved?.name || type.name || '';
    }

    return type?.name || '';
  } catch {
    return type?.name || '';
  }
}

describe('BaseArticleEntity relations', () => {
  it('should have OneToMany relation to BaseArticleVersionEntity with correct inverse', () => {
    const relation = getMetadataArgsStorage().relations.find(
      r => r.target === BaseArticleEntity && r.propertyName === 'versions',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('one-to-many');
    expect(resolveTypeName(relation?.type)).toBe('BaseArticleVersionEntity');

    const inverse = relation?.inverseSideProperty;
    const result = typeof inverse === 'function' ? inverse({ article: 'mock' }) : undefined;

    expect(result).toBe('mock');
  });

  it('should have ManyToMany relation to BaseCategoryEntity with correct join table', () => {
    const relation = getMetadataArgsStorage().relations.find(
      r => r.target === BaseArticleEntity && r.propertyName === 'categories',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('many-to-many');
    expect(resolveTypeName(relation?.type)).toBe('BaseCategoryEntity');

    const joinTable = getMetadataArgsStorage().joinTables.find(
      jt => jt.target === BaseArticleEntity && jt.propertyName === 'categories',
    );

    expect(joinTable).toBeDefined();
    expect(joinTable?.name).toBe('article_categories');
    expect(joinTable?.joinColumns).toEqual([
      expect.objectContaining({
        name: 'articleId',
        referencedColumnName: 'id',
      }),
    ]);

    expect(joinTable?.inverseJoinColumns).toEqual([
      expect.objectContaining({
        name: 'categoryId',
        referencedColumnName: 'id',
      }),
    ]);
  });

  it('should define inverse side for categories relation correctly', () => {
    const relation = getMetadataArgsStorage().relations.find(
      r => r.target === BaseArticleEntity && r.propertyName === 'categories',
    );

    const inverse = relation?.inverseSideProperty;
    const fn = typeof inverse === 'function' ? inverse : undefined;

    const result = fn?.({ articles: 'mock' });

    expect(result).toBe('mock');
  });
});
