import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Kind } from 'graphql';
import { QuadratsContentScalar } from '../src/scalars/quadrats-element.scalar';

describe('QuadratsContentScalar', () => {
  describe('definition', () => {
    it('should have the correct name', () => {
      expect(QuadratsContentScalar.name).toBe('QuadratsContent');
    });

    it('should have a description', () => {
      expect(QuadratsContentScalar.description).toBe('QuadratsContent custom scalar type (as JSON string)');
    });
  });

  describe('parseValue', () => {
    it('should parse a valid JSON string array', () => {
      const validJson = JSON.stringify([{ type: 'paragraph', children: [{ text: 'Hello' }] }]);

      const result = QuadratsContentScalar.parseValue(validJson);

      expect(result).toEqual([{ type: 'paragraph', children: [{ text: 'Hello' }] }]);
    });

    it('should throw BadRequestException for non-array JSON', () => {
      const invalidJson = JSON.stringify({ type: 'paragraph' });

      expect(() => QuadratsContentScalar.parseValue(invalidJson)).toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException for invalid JSON string', () => {
      const invalidJson = 'not valid json';

      expect(() => QuadratsContentScalar.parseValue(invalidJson)).toThrow(InternalServerErrorException);
    });

    it('should throw BadRequestException for non-string value', () => {
      expect(() => QuadratsContentScalar.parseValue(123)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for object value', () => {
      expect(() => QuadratsContentScalar.parseValue({ type: 'paragraph' })).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for null value', () => {
      expect(() => QuadratsContentScalar.parseValue(null)).toThrow(BadRequestException);
    });
  });

  describe('serialize', () => {
    it('should return string value as is', () => {
      const stringValue = '[{"type":"paragraph"}]';

      const result = QuadratsContentScalar.serialize(stringValue);

      expect(result).toBe(stringValue);
    });

    it('should stringify array value', () => {
      const arrayValue = [{ type: 'paragraph', children: [{ text: 'Hello' }] }];

      const result = QuadratsContentScalar.serialize(arrayValue);

      expect(result).toBe(JSON.stringify(arrayValue));
    });

    it('should stringify object value', () => {
      const objectValue = { key: 'value' };

      const result = QuadratsContentScalar.serialize(objectValue);

      expect(result).toBe(JSON.stringify(objectValue));
    });

    it('should throw InternalServerErrorException for circular reference', () => {
      const circularObj: Record<string, unknown> = {};

      circularObj.self = circularObj;

      expect(() => QuadratsContentScalar.serialize(circularObj)).toThrow(InternalServerErrorException);
    });
  });

  describe('parseLiteral', () => {
    it('should parse valid string literal', () => {
      const ast = {
        kind: Kind.STRING,
        value: '[{"type":"paragraph"}]',
      };

      const result = QuadratsContentScalar.parseLiteral(ast, {});

      expect(result).toEqual([{ type: 'paragraph' }]);
    });

    it('should throw InternalServerErrorException for invalid JSON in string literal', () => {
      const ast = {
        kind: Kind.STRING,
        value: 'not valid json',
      };

      expect(() => QuadratsContentScalar.parseLiteral(ast, {})).toThrow(InternalServerErrorException);
    });

    it('should throw Error for non-string kind', () => {
      const ast = {
        kind: Kind.INT,
        value: '123',
      };

      expect(() => QuadratsContentScalar.parseLiteral(ast, {})).toThrow('Expected string literal for QuadratsContent');
    });

    it('should throw Error for object kind', () => {
      const ast = {
        kind: Kind.OBJECT,
        fields: [],
      };

      expect(() => QuadratsContentScalar.parseLiteral(ast, {})).toThrow('Expected string literal for QuadratsContent');
    });
  });
});
