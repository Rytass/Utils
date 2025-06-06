import { getMetadataArgsStorage } from 'typeorm';
import { BaseCategoryEntity } from '../../../src/models/base-category.entity';

function resolveTypeName(type: any): string {
  try {
    const resolved = typeof type === 'function' ? type() : type;
    return resolved?.name || type.name || '';
  } catch {
    return type?.name || '';
  }
}

function resolveInverseSide(value: any): string | undefined {
  if (typeof value === 'function') {
    const mockEntity = new Proxy(
      {},
      {
        get(_, prop) {
          return prop;
        },
      },
    );
    return value(mockEntity);
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

describe('BaseCategoryEntity relations', () => {
  it('should have ManyToMany relation to children with correct options', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) => r.target === BaseCategoryEntity && r.propertyName === 'children',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('many-to-many');
    expect(resolveTypeName(relation?.type)).toBe('BaseCategoryEntity');
    expect(relation?.options?.onDelete).toBe('CASCADE');
    expect(relation?.options?.onUpdate).toBe('CASCADE');
    expect(relation?.options?.orphanedRowAction).toBe('delete');
    expect(resolveInverseSide(relation?.inverseSideProperty)).toBe('parents');
  });

  it('should have ManyToMany relation to parents with correct JoinTable', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) => r.target === BaseCategoryEntity && r.propertyName === 'parents',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('many-to-many');
    expect(resolveTypeName(relation?.type)).toBe('BaseCategoryEntity');
    expect(resolveInverseSide(relation?.inverseSideProperty)).toBe('children');

    const joinTable = getMetadataArgsStorage().joinTables.find(
      (jt) => jt.target === BaseCategoryEntity && jt.propertyName === 'parents',
    );

    expect(joinTable).toBeDefined();
    expect(joinTable?.name).toBe('category_relations');
    expect(joinTable?.joinColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'childId',
          referencedColumnName: 'id',
        }),
      ]),
    );
    expect(joinTable?.inverseJoinColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'parentId',
          referencedColumnName: 'id',
        }),
      ]),
    );
  });

  it('should have OneToMany relation to multiLanguageNames', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) =>
        r.target === BaseCategoryEntity &&
        r.propertyName === 'multiLanguageNames',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('one-to-many');
    expect(resolveTypeName(relation?.type)).toBe(
      'BaseCategoryMultiLanguageNameEntity',
    );
    expect(resolveInverseSide(relation?.inverseSideProperty)).toBe('category');
  });

  it('should have ManyToMany relation to articles with correct options', () => {
    const relation = getMetadataArgsStorage().relations.find(
      (r) => r.target === BaseCategoryEntity && r.propertyName === 'articles',
    );

    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('many-to-many');
    expect(resolveTypeName(relation?.type)).toBe('BaseArticleEntity');
    expect(relation?.options?.onDelete).toBe('CASCADE');
    expect(relation?.options?.onUpdate).toBe('CASCADE');
    expect(relation?.options?.orphanedRowAction).toBe('delete');
    expect(resolveInverseSide(relation?.inverseSideProperty)).toBe(
      'categories',
    );
  });
});
