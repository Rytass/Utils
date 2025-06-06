import { getMetadataArgsStorage } from 'typeorm';
import { BaseArticleVersionEntity } from '../../../src/models/base-article-version.entity';

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

describe('BaseArticleVersionEntity relations', () => {
  it('should have a ManyToOne relation to BaseArticleEntity with correct join column', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) =>
        r.target === BaseArticleVersionEntity && r.propertyName === 'article',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('many-to-one');
    expect(resolveTypeName(relation?.type)).toBe('BaseArticleEntity');

    const joinColumn = getMetadataArgsStorage().joinColumns.find(
      (jc) =>
        jc.target === BaseArticleVersionEntity && jc.propertyName === 'article',
    );

    expect(joinColumn).toEqual(
      expect.objectContaining({
        name: 'articleId',
        referencedColumnName: 'id',
      }),
    );
  });

  it('should define inverse side for article', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) =>
        r.target === BaseArticleVersionEntity && r.propertyName === 'article',
    );

    expect(relation).toBeDefined();

    if (typeof relation?.inverseSideProperty === 'function') {
      const result = relation.inverseSideProperty({ versions: 'mock' });
      expect(result).toBe('mock');
    } else {
      fail('inverseSideProperty is not a function');
    }
  });

  it('should have a OneToMany relation to BaseArticleVersionContentEntity with correct inverse side', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) =>
        r.target === BaseArticleVersionEntity &&
        r.propertyName === 'multiLanguageContents',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('one-to-many');
    expect(resolveTypeName(relation?.type)).toBe(
      'BaseArticleVersionContentEntity',
    );

    const inverse = relation?.inverseSideProperty;
    const fn = typeof inverse === 'function' ? inverse : undefined;
    const result = fn?.({ articleVersion: 'mock' });
    expect(result).toBe('mock');
  });

  it('should have a OneToMany relation to ArticleSignatureEntity with correct inverse side', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) =>
        r.target === BaseArticleVersionEntity &&
        r.propertyName === 'signatures',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('one-to-many');
    expect(resolveTypeName(relation?.type)).toBe('ArticleSignatureEntity');

    const inverse = relation?.inverseSideProperty;
    const fn = typeof inverse === 'function' ? inverse : undefined;
    const result = fn?.({ articleVersion: 'mock' });
    expect(result).toBe('mock');
  });
});
