import { removeMultipleLanguageArticleVersionInvalidFields } from '../src/utils/remove-invalid-fields';

describe('removeMultipleLanguageArticleVersionInvalidFields', () => {
  it('should remove excluded fields but keep allowed ones like multiLanguageContents', () => {
    const input = {
      articleId: 'a1',
      article: {},
      signatures: [],
      multiLanguageContents: [{ title: 'Title A' }],
      submittedAt: new Date(),
      releasedAt: new Date(),
    };

    const result = removeMultipleLanguageArticleVersionInvalidFields(input);

    expect(result).not.toHaveProperty('articleId');
    expect(result).not.toHaveProperty('signatures');
    expect(result).toHaveProperty('multiLanguageContents');
    expect(result).toHaveProperty('submittedAt');
    expect(result).toHaveProperty('releasedAt');
  });

  it('should keep only allowed fields when all are valid', () => {
    const input = {
      version: 2,
      tags: ['env'],
      submittedBy: 'u1',
      createdAt: new Date(), // will be removed by the function
    };

    const result = removeMultipleLanguageArticleVersionInvalidFields(input);

    expect(result).toEqual({
      version: 2,
      tags: ['env'],
      submittedBy: 'u1',
    });
  });

  it('should return empty object if all fields are filtered except multiLanguageContents', () => {
    const input = {
      articleId: 'xx',
      article: {},
      signatures: [],
    } as any;

    const result = removeMultipleLanguageArticleVersionInvalidFields(input);

    expect(result).toEqual({});
  });
});
