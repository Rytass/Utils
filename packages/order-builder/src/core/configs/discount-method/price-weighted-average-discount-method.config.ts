import { PolicyDiscountDescription } from '../../../policies';
import { divided, minus, plus, times } from '../../../utils/decimal';
import { Order } from '../../order';
import { DiscountMethod, DiscountMethodType } from '../typings';

/**
 * PriceWeightedAverageDiscountMethod.
 */
export class PriceWeightedAverageDiscountMethod implements DiscountMethod {
  readonly type: DiscountMethodType = 'PRICE_WEIGHTED_AVERAGE';

  handleOneDescription(order: Order, description: PolicyDiscountDescription) {
    const itemValue = description.appliedItems.reduce(
      (total, item) =>
        plus(
          total,
          times(item.quantity, item.unitPrice),
        ),
      0
    );

    description.appliedItems.forEach((item) => {
      // Core concept.
      order.itemManager.updateCollection(item, (storedRecord) => {
        // Discount shared-rate calculated by price-weighted-average method.
        const discountSplitRate = divided(storedRecord.currentValue, itemValue);

        const itemDiscountValue = order.config.roundStrategy.round(
          times(description.discount, discountSplitRate),
          'EVERY_CALCULATION'
        );

        storedRecord.addDiscountRecord({
          policyId: description.id,
          itemId: item.uuid,
          // SubOrder need to be considered.
          discountValue: minus(
            itemDiscountValue,
            order.parent?.itemManager.collectionMap?.get(item.uuid)
              ?.discountValue || 0
          ),
        });

        return storedRecord;
      });
    });
  }

  calculateDiscounts(order: Order): PolicyDiscountDescription[] {
    order.itemManager.initCollectionMap();

    return order.policies.reduce((descriptions, policy) => {
      const appendDescriptions = order.config.policyPickStrategy.pick(
        order,
        policy
      );

      appendDescriptions.forEach(description =>
        this.handleOneDescription(order, description)
      );

      return [...descriptions, ...appendDescriptions];
    }, [] as PolicyDiscountDescription[]);
  }
}
