import { OrderItem } from '../../core/typings';
import { ItemSpecifiedInput, ItemSpecifiedResolvedFnInput, QuantityRequiredInput } from './typings';

export function isItemSpecifiedResolvedFnInput<Item extends OrderItem>(
  options: ItemSpecifiedInput<Item>,
): options is ItemSpecifiedResolvedFnInput<Item> {
  return typeof (options as any)?.isMatchedItem === 'function';
}

export function itemSpecifiedItems<Item extends OrderItem>(options: ItemSpecifiedInput<Item>): string[] {
  if (isItemSpecifiedResolvedFnInput(options)) return [];

  return Array.isArray(options.items) ? options.items : [options.items];
}

export function itemSpecifiedScope<Item extends OrderItem>(options: ItemSpecifiedInput<Item>): (keyof Item)[] | null {
  if (isItemSpecifiedResolvedFnInput(options)) return null;

  return Array.isArray(options.scope) ? options.scope : [options.scope || ('id' as keyof Item)];
}

export function itemIsMatchedItemFn<Item extends OrderItem>(
  options: ItemSpecifiedInput<Item>,
): ItemSpecifiedResolvedFnInput<Item>['isMatchedItem'] | null {
  return isItemSpecifiedResolvedFnInput(options) ? options.isMatchedItem : null;
}

export function quantityRequiredOptions<Options>(
  arg1: (QuantityRequiredInput | string)[] | Options | undefined,
  arg2: Options | undefined,
): Options | undefined {
  if (Array.isArray(arg1)) return arg2;

  return arg1 || arg2;
}
