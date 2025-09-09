import { getMetadataArgsStorage } from 'typeorm';
import { BaseSignatureLevelEntity } from '../../../src/models/base-signature-level.entity';
import { ArticleSignatureEntity } from '../../../src/models/article-signature.entity';

function resolveType(type: unknown): unknown {
  return typeof type === 'function' ? type() || type : type;
}

function resolveInverseSide(value: unknown): string | undefined {
  if (typeof value === 'function') {
    const dummy = { signatureLevel: 'signatureLevel' };

    return value(dummy);
  }

  return undefined;
}

describe('BaseSignatureLevelEntity relations', () => {
  it('should have OneToMany relation to signatures with correct inverse side', () => {
    const relation = getMetadataArgsStorage().relations.find(
      r => r.target === BaseSignatureLevelEntity && r.propertyName === 'signatures',
    );

    expect(relation).toBeDefined();
    expect(resolveType(relation?.type)).toBe(ArticleSignatureEntity);
    expect(resolveInverseSide(relation?.inverseSideProperty)).toBe('signatureLevel');

    expect(relation?.relationType).toBe('one-to-many');
  });
});
