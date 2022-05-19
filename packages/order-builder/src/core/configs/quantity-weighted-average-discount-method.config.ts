import { DiscountMethod, DiscountMethodType } from './typings';
import { Order } from '../order';
import { Policy, PolicyDiscountDescription } from '../../policies';
import { divided, minus, times } from '../../utils/decimal';
import { getBestDiscountPolicy } from './utils';
import { isDiscountPolicy } from '../../policies/discount/utils';

export class QuantityWeightedAverageDiscountMethod implements DiscountMethod {
  readonly type: DiscountMethodType = 'QUANTITY_WEIGHTED_AVERAGE';

  calculateDiscounts(order: Order): PolicyDiscountDescription[] {
    order.itemManager.initCollectionMap();

    const handleOnePolicy = (description: PolicyDiscountDescription) => {
      const totalItemQuantity = description.appliedItems.length;
      // Reference to memo how much discount need to be splitted out in this policy.
      let totalDiscountToSplitOut = description.discount;

      description.appliedItems.forEach((item) => {
        // Core concept.
        order.itemManager.updateCollection(item, (storedRecord) => {
          // Discount be splitted by quantity-weighted-average method.
          const discountSplitRate = divided(
            1,
            totalItemQuantity,
          );

          // In weighted-average method, maximum discount shared value of item is the value of item.
          const itemDiscountValue = order.config.roundStrategy.round(
            Math.min(
              storedRecord.currentValue,
              times(description.discount, discountSplitRate),
            ),
            'EVERY_CALCULATION',
          );

          // Update total-discount-to-splitted-out value.
          totalDiscountToSplitOut = minus(totalDiscountToSplitOut, itemDiscountValue);

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
