import { getMetadataArgsStorage } from 'typeorm';
import { BaseCategoryMultiLanguageNameEntity } from '../../../src/models/base-category-multi-language-name.entity';
import { BaseCategoryEntity } from '../../../src/models/base-category.entity';

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

describe('BaseCategoryMultiLanguageNameEntity relation: category', () => {
  const relation = getMetadataArgsStorage().relations.find(
    (r) =>
      r.target === BaseCategoryMultiLanguageNameEntity &&
      r.propertyName === 'category',
  );

  const joinColumn = getMetadataArgsStorage().joinColumns.find(
    (jc) =>
      jc.target === BaseCategoryMultiLanguageNameEntity &&
      jc.propertyName === 'category',
  );

  it('should have a ManyToOne relation to BaseCategoryEntity', () => {
    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('many-to-one');
    expect(resolveTypeName(relation?.type)).toBe('BaseCategoryEntity');
  });

  it('should define inverse side properly', () => {
    const inverse = relation?.inverseSideProperty;
    const fn = typeof inverse === 'function' ? inverse : undefined;

    const result = fn?.({ multiLanguageNames: ['中文', 'English'] });
    expect(result).toEqual(['中文', 'English']);
  });

  it('should use correct join column definition', () => {
    expect(joinColumn).toEqual(
      expect.objectContaining({
        name: 'categoryId',
        referencedColumnName: 'id',
      }),
    );
  });

  it('should have correct cascade and orphan settings', () => {
    expect(relation?.options?.onDelete).toBe('CASCADE');
    expect(relation?.options?.onUpdate).toBe('CASCADE');
    expect(relation?.options?.orphanedRowAction).toBe('delete');
  });
});
