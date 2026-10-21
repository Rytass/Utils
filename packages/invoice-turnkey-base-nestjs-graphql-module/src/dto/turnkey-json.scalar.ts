import { CustomScalar, Scalar } from '@nestjs/graphql';
import { valueFromASTUntyped, type ValueNode } from 'graphql';

/** 事件 data 這類任意結構的 JSON；不引入額外的 scalar 套件 */
@Scalar('TurnkeyJSON', () => Object)
export class TurnkeyJSONScalar implements CustomScalar<unknown, unknown> {
  description = 'Arbitrary JSON object';

  parseValue(value: unknown): unknown {
    return value;
  }

  serialize(value: unknown): unknown {
    return value;
  }

  parseLiteral(ast: ValueNode): unknown {
    return valueFromASTUntyped(ast);
  }
}
