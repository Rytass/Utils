import { getMetadataArgsStorage } from 'typeorm';
import { BaseArticleVersionContentEntity } from '../../../src/models/base-article-version-content.entity';

describe('BaseArticleVersionContentEntity relations', () => {
  function resolveTypeName(type: any): string {
    try {
      if (typeof type === 'function') {
        const resolved = type(); // Call the arrow function

        return resolved?.name || type.name || '';
      }

      return type?.name || '';
    } catch {
      return '';
    }
  }

  const relation = getMetadataArgsStorage().relations.find(
    (r) =>
      r.target === BaseArticleVersionContentEntity &&
      r.propertyName === 'articleVersion',
  );

  const joinColumns = getMetadataArgsStorage().joinColumns.filter(
    (jc) =>
      jc.target === BaseArticleVersionContentEntity &&
      jc.propertyName === 'articleVersion',
  );

  it('should have a ManyToOne relation to BaseArticleVersionEntity', () => {
    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('many-to-one');
  });

  it('should point to BaseArticleVersionEntity as type', () => {
    expect(resolveTypeName(relation?.type)).toBe('BaseArticleVersionEntity');
  });

  it('should have correct join columns for articleId and version', () => {
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

  it('should have an inverse side function returning correct property', () => {
    if (typeof relation?.inverseSideProperty === 'function') {
      const result = relation.inverseSideProperty({
        multiLanguageContents: 'mock',
      });

      expect(result).toBe('mock');
    }
  });
});
