import { FlattenOrderItem } from '../..';
import { Policies, Policy, PolicyDiscountDescription } from '../../../policies';
import { isDiscountPolicy } from '../../../policies/discount/utils';
import { groupBy } from '../../../utils/collection';
import { CartesianProduct } from '../../../utils/combinatorics';
import { plus } from '../../../utils/decimal';
import { Order } from '../../order';
import { PolicyPickStrategy, PolicyPickStrategyType } from '../typings';

export type PolicyPickMemoRecord = {
  policy: Policy;
  item: FlattenOrderItem;
}

/**
 * ItemBasedPolicyPickStrategy
 */
export class ItemBasedPolicyPickStrategy implements PolicyPickStrategy {
  type: PolicyPickStrategyType = 'ITEM_BASED';

  pick(
    order: Order,
    policies: Policies,
  ): PolicyDiscountDescription[] {
    return Array.isArray(policies)
      ? this.pickMulti(order, policies)
      : this.pickOne(order, policies)
  }

  pickOne(
    order: Order,
    policy: Policy,
  ): PolicyDiscountDescription[] {
    return policy.resolve(order, []) as PolicyDiscountDescription[];
  }

  pickMulti(order: Order, policies: Policy[]): PolicyDiscountDescription[] {
    const itemPolicyCombinationMap = new Map<
      string,
      Set<PolicyPickMemoRecord>
    >();

    policies.filter(isDiscountPolicy).forEach((policy) => {
      policy.matchedItems(order).forEach((matchedItem) => {
        const storeItemPolicyMemoRecordSet =
          itemPolicyCombinationMap.get(matchedItem.uuid) ||
          new Set<PolicyPickMemoRecord>();

        storeItemPolicyMemoRecordSet.add({
          policy,
          item: matchedItem,
        });

        itemPolicyCombinationMap.set(
          matchedItem.uuid,
          storeItemPolicyMemoRecordSet
        );
      });
    });

    const combinations = [...itemPolicyCombinationMap.values()].map(
      itemPolicyRecordSet => Array.from(itemPolicyRecordSet.values())
    );

    // Get all sub-sets of combinations.
    const itemsCartesianProduct = new CartesianProduct(...combinations);

    const [_, descriptions] = itemsCartesianProduct
      .toArray()
      .reduce(
        ([total, descriptions], itemCombination) => {
          const policyItemsMap = groupBy(
            itemCombination,
            combination => combination.policy.id,
          );

          const subOrders: Order[] = Object.entries(policyItemsMap).map(
            ([_, policyItemRecord]) => order.subOrder({
              itemScope: 'uuid',
              subItems: policyItemRecord.map(record => record.item),
              subPolicies: policyItemRecord?.[0]?.policy,
            })
          );

          const combinationTotalDiscountValue = subOrders.reduce(
            (totalDiscount, subOrder) => plus(totalDiscount, subOrder.discountValue),
            0
          );

          // Choose the higher discountValue sub-set as the best solution so far.
          if (combinationTotalDiscountValue > total) {
            return [
              combinationTotalDiscountValue,
              subOrders.reduce(
                (total, subOrder) => [...total, ...subOrder.discounts],
                [] as PolicyDiscountDescription[]
              ),
            ] as [number, PolicyDiscountDescription[]];
          }

          return [total, descriptions] as [number, PolicyDiscountDescription[]];
        },
        [Number.NEGATIVE_INFINITY, []] as [number, PolicyDiscountDescription[]]
      );

    return descriptions;
  }
}
