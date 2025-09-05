import { PolicyDiscountDescription } from '../../../policies';
import { divided, minus, times } from '../../../utils/decimal';
import { Order } from '../../order';
import { DiscountMethod, DiscountMethodType } from '../typings';

/**
 * QuantityWeightedAverageDiscountMethod
 */
export class QuantityWeightedAverageDiscountMethod implements DiscountMethod {
  readonly type: DiscountMethodType = 'quantity-weighted-average';

  handleOneDescription(order: Order, description: PolicyDiscountDescription): void {
    // In quantity-weighted-average method item-price must be sort first to ensure
    // that lower-price items have to be handled in high-priority to prevent
    // no price-quotas to digest rest of total-discount.
    const appliedItems = [...description.appliedItems].sort((a, b) => a.unitPrice - b.unitPrice);

    // Reference to memo how many items to calculate the discountSplitRate.
    let totalItemQuantityToShared = appliedItems.length;
    // Reference to memo how much discount need to be splitted out in this policy.
    let totalDiscountToSplitOut = description.discount;

    appliedItems.forEach(item => {
      // Core concept.
      order.itemManager.updateCollection(item, storedRecord => {
        // Discount shared-rate calculated by price-weighted-average method.
        const discountSplitRate = divided(1, totalItemQuantityToShared);

        // Original discount for current item.
        const predictItemDiscountValue = times(totalDiscountToSplitOut, discountSplitRate);

        // In weighted-average method, maximum discount shared value of item is the value of item.
        const itemDiscountValue = order.config.roundStrategy.round(
          Math.min(storedRecord.currentValue, predictItemDiscountValue),
          'every-calculation',
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
          itemId: item.uuid,
          // SubOrder need to be considered.
          discountValue: itemDiscountValue,
        });

        return storedRecord;
      });
    });
  }

  calculateDiscounts(order: Order): PolicyDiscountDescription[] {
    order.itemManager.initCollectionMap();

    return order.policies.reduce((descriptions, policy) => {
      const appendDescriptions = order.config.policyPickStrategy.pick(order, policy);

      appendDescriptions.forEach(description => this.handleOneDescription(order, description));

      descriptions.push(...appendDescriptions);

      return descriptions;
    }, [] as PolicyDiscountDescription[]);
  }
}
