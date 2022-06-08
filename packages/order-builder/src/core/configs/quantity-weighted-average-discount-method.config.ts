import { DiscountMethod, DiscountMethodType } from './typings';
import { Order } from '../order';
import { Policy, PolicyDiscountDescription } from '../../policies';
import { divided, minus, times } from '../../utils/decimal';
import { getBestDiscountPolicy } from './utils';
import { isDiscountPolicy } from '../../policies/discount/utils';

/**
 * QuantityWeightedAverageDiscountMethod
 */
export class QuantityWeightedAverageDiscountMethod implements DiscountMethod {
  readonly type: DiscountMethodType = 'QUANTITY_WEIGHTED_AVERAGE';

  calculateDiscounts(order: Order): PolicyDiscountDescription[] {
    order.itemManager.initCollectionMap();

    const handleOnePolicy = (description: PolicyDiscountDescription) => {
      // In quantity-weighted-average method item-price must be sort first to ensure
      // that lower-price items have to be handled in high-priority to prevent
      // no price-quotas to digest rest of total-discount.
      const appliedItems = [...description.appliedItems].sort((a, b) => a.unitPrice - b.unitPrice);

      // Reference to memo how many items to calculate the discountSplitRate.
      let totalItemQuantityToShared = appliedItems.length;
      // Reference to memo how much discount need to be splitted out in this policy.
      let totalDiscountToSplitOut = description.discount;

      appliedItems.forEach((item) => {
        // Core concept.
        order.itemManager.updateCollection(item, (storedRecord) => {
          // Discount shared-rate calculated by price-weighted-average method.
          const discountSplitRate = divided(
            1,
            totalItemQuantityToShared,
          );

          // Original discount for current item.
          const predictItemDiscountValue = times(totalDiscountToSplitOut, discountSplitRate);

          // In weighted-average method, maximum discount shared value of item is the value of item.
          const itemDiscountValue = order.config.roundStrategy.round(
            Math.min(
              storedRecord.currentValue,
              predictItemDiscountValue,
            ),
            'EVERY_CALCULATION',
          );

          // It means others items have to enhance their shared-discount to balance the total-discount.
          if (predictItemDiscountValue > storedRecord.currentValue) {
            // Update total-discount-to-splitted-out value and quantity.
            totalItemQuantityToShared = minus(totalItemQuantityToShared, 1);
            totalDiscountToSplitOut = minus(totalDiscountToSplitOut, itemDiscountValue);
          }

          // Update item record collection.
          storedRecord.addDiscountRecord({
            policyId: description.id,
            discountValue: itemDiscountValue,
          });

          return storedRecord;
        });
      });
    };

    return order.policies.reduce((descriptions, policy) => {
      const policies = Array.isArray(policy) ? policy : [policy];

      /** @todo will remove in next version. */
      const bestDiscount = getBestDiscountPolicy(
        policies
          .filter(isDiscountPolicy)
          .reduce(
            (candidates, candidate) =>
              candidate.resolve<PolicyDiscountDescription>(order, candidates),
            [] as PolicyDiscountDescription[]
          )
      );

      const discountPolicy: Policy | undefined = policies.find(p => p.id === bestDiscount?.id);

      const newDescriptions = discountPolicy?.resolve(order, descriptions) || descriptions;

      if (newDescriptions.length > descriptions.length) {
        handleOnePolicy(bestDiscount);
      }

      return newDescriptions as PolicyDiscountDescription[];
    }, [] as PolicyDiscountDescription[]);
  }
}