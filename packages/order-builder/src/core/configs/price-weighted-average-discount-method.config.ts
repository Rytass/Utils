import { DiscountMethod, DiscountMethodType } from './typings';
import { Order } from '../order';
import { Policy, PolicyDiscountDescription } from '../../policies';
import { divided, minus, plus, times } from '../../utils/decimal';
import { getBestDiscountPolicy } from './utils';
import { isDiscountPolicy } from '../../policies/discount/utils';

/**
 * Will split discountValue by price-weighted-average strategy.
 */
export class PriceWeightedAverageDiscountMethod implements DiscountMethod {
  readonly type: DiscountMethodType = 'PRICE_WEIGHTED_AVERAGE';

  calculateDiscounts(order: Order): PolicyDiscountDescription[] {
    order.itemManager.initCollectionMap();

    const handleOnePolicy = (description: PolicyDiscountDescription) => {
      const itemValue = description.appliedItems.reduce(
        (total, item) =>
          plus(
            total,
            minus(
              times(item.quantity, item.unitPrice),
              order.itemManager.collectionMap.get(item.uuid)?.discountValue || 0
            )
          ),
        0
      );

      description.appliedItems.forEach((item) => {
        // Core concept.
        order.itemManager.updateCollection(item, (storedRecord) => {
          // Discount be splitted by price-weighted-average method.
          const discountSplitRate = divided(
            storedRecord.currentValue,
            itemValue
          );

          const itemDiscountValue = order.config.roundStrategy.round(
            times(description.discount, discountSplitRate),
            'EVERY_CALCULATION',
          );

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
