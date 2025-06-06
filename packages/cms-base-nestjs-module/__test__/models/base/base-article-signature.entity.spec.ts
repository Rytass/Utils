import { getMetadataArgsStorage } from 'typeorm';
import { ArticleSignatureEntity } from '../../../src/models/base-article-signature.entity';

// Type resolver helper
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

describe('ArticleSignatureEntity relations', () => {
  it('should have a ManyToOne relation to BaseArticleVersionEntity with correct join columns', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) =>
        r.target === ArticleSignatureEntity &&
        r.propertyName === 'articleVersion',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('many-to-one');
    expect(resolveTypeName(relation?.type)).toBe('BaseArticleVersionEntity');

    const joinColumns = getMetadataArgsStorage().joinColumns.filter(
      (jc) =>
        jc.target === ArticleSignatureEntity &&
        jc.propertyName === 'articleVersion',
    );

    expect(joinColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'articleId',
          referencedColumnName: 'articleId',
        }),
        expect.objectContaining({
          name: 'version',
          referencedColumnName: 'version',
        }),
      ]),
    );
  });

  it('should have a ManyToOne relation to BaseSignatureLevelEntity (nullable)', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) =>
        r.target === ArticleSignatureEntity &&
        r.propertyName === 'signatureLevel',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('many-to-one');
    expect(resolveTypeName(relation?.type)).toBe('BaseSignatureLevelEntity');
    expect(relation?.options?.nullable).toBe(true);

    const joinColumns = getMetadataArgsStorage().joinColumns.filter(
      (jc) =>
        jc.target === ArticleSignatureEntity &&
        jc.propertyName === 'signatureLevel',
    );

    expect(joinColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'signatureLevelId',
          referencedColumnName: 'id',
        }),
      ]),
    );
  });

  it('should define inverse side for articleVersion', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) =>
        r.target === ArticleSignatureEntity &&
        r.propertyName === 'articleVersion',
    );

    expect(relation).toBeDefined();

    const inverse = relation?.inverseSideProperty;
    const fn = typeof inverse === 'function' ? inverse : undefined;

    // Simulate the inverse call
    const result = fn?.({ signatures: 'test' });
    expect(result).toBe('test');
  });

  it('should define inverse side for signatureLevel', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) =>
        r.target === ArticleSignatureEntity &&
        r.propertyName === 'signatureLevel',
    );

    expect(relation).toBeDefined();

    const inverse = relation?.inverseSideProperty;
    const fn = typeof inverse === 'function' ? inverse : undefined;

    const result = fn?.({ signatures: ['x'] });
    expect(result).toEqual(['x']);
  });
});
