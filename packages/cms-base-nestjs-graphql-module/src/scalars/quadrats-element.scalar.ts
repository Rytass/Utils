import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { QuadratsElement } from '@quadrats/core';
import { GraphQLScalarType, Kind, ValueNode } from 'graphql';

export const QuadratsContentScalar = new GraphQLScalarType({
  name: 'QuadratsContent',
  description: 'QuadratsContent custom scalar type (as JSON string)',

  parseValue: (value: unknown): QuadratsElement => {
    if (typeof value === 'string') {
      let parsedValue: QuadratsElement;

      try {
        parsedValue = JSON.parse(value);
      } catch (error) {
        Logger.error(`Error parsing QuadratsContent (parseValue): ${error}`);

        throw new InternalServerErrorException('Invalid QuadratsElement value');
      }

      if (!Array.isArray(parsedValue)) {
        throw new BadRequestException(
          'Expected a JSON string for QuadratsContent',
        );
      }

      return parsedValue;
    }

    throw new BadRequestException('Expected a JSON string for QuadratsContent');
  },

  serialize: (value: unknown): string => {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      Logger.error(`Error serializing QuadratsContent: ${error}`);
      throw new InternalServerErrorException(
        'Error serializing QuadratsElement',
      );
    }
  },

  parseLiteral: (ast: ValueNode): QuadratsElement => {
    try {
      if (ast.kind === Kind.STRING) {
        return JSON.parse(ast.value);
      }
    } catch (error) {
      Logger.error(`Error parsing QuadratsContent (parseLiteral): ${error}`);
      throw new InternalServerErrorException('Invalid QuadratsElement value');
    }

    throw new Error('Expected string literal for QuadratsContent');
  },
});
