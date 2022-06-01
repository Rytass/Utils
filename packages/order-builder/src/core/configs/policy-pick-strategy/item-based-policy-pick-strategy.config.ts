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
};

/**
 * ItemBasedPolicyPickStrategy
 */
export class ItemBasedPolicyPickStrategy implements PolicyPickStrategy {
  type: PolicyPickStrategyType = 'ITEM_BASED';

  pick(order: Order, policies: Policies): PolicyDiscountDescription[] {
    return Array.isArray(policies)
      ? this.pickMulti(order, policies)
      : this.pickOne(order, policies);
  }

  pickOne(order: Order, policy: Policy): PolicyDiscountDescription[] {
    return policy.resolve(order, []) as PolicyDiscountDescription[];
  }

  pickMulti(order: Order, policies: Policy[]): PolicyDiscountDescription[] {
    const discountPolicies = policies.filter(isDiscountPolicy);

    const itemPolicyCombinationMap = discountPolicies.reduce((map, policy) => {
      policy.matchedItems(order).forEach((matchedItem) => {
        const storeItemPolicyMemoRecordSet =
          map.get(matchedItem.uuid) ||
          new Set<PolicyPickMemoRecord | null>([null]);

        // remove null if policies of currentItem is greater than 2.
        if (
          storeItemPolicyMemoRecordSet.size === 2 &&
          storeItemPolicyMemoRecordSet.has(null)
        ) {
          storeItemPolicyMemoRecordSet.delete(null);
        }

        storeItemPolicyMemoRecordSet.add({
          policy,
          item: matchedItem,
        });

        map.set(matchedItem.uuid, storeItemPolicyMemoRecordSet);
      });

      return map;
    }, new Map<string, Set<PolicyPickMemoRecord | null>>());

    // Get all sub-sets of combinations.
    const itemsCartesianProduct = new CartesianProduct(
      ...itemPolicyCombinationMap.values()
    );

    const [_, descriptions] = itemsCartesianProduct.toArray().reduce(
      ([currentBestDiscountValue, descriptions], itemCombination) => {
        const policyItemsMap = groupBy(
          itemCombination,
          combination => combination.policy.id
        );

        const subOrders = Object.values(policyItemsMap).map(
          policyItemRecord =>
            order.subOrder({
              itemScope: 'uuid',
              subItems: policyItemRecord.map(record => record.item),
              subPolicies: policyItemRecord?.[0]?.policy,
            })
        );

        const combinationTotalDiscountValue = subOrders.reduce(
          (totalDiscount, subOrder) =>
            plus(totalDiscount, subOrder.discountValue),
          0
        );

        // Choose the higher discountValue sub-set as the best solution so far.
        if (combinationTotalDiscountValue > currentBestDiscountValue) {
          return [
            combinationTotalDiscountValue,
            subOrders.reduce(
              (total, subOrder) => [...total, ...subOrder.discounts],
              [] as PolicyDiscountDescription[]
            ),
          ] as [number, PolicyDiscountDescription[]];
        }

        return [currentBestDiscountValue, descriptions] as [
          number,
          PolicyDiscountDescription[]
        ];
      },
      [Number.NEGATIVE_INFINITY, []] as [number, PolicyDiscountDescription[]]
    );

    return descriptions;
  }
}
