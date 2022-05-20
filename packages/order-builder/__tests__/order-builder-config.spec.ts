import {
  OrderBuilder,
  PercentageDiscount,
  ValueDiscount,
} from '@rytass/order-builder';
import { EveryCalculationRoundStrategy, FinalPriceOnlyRoundStrategy, NoRoundRoundStrategy, PriceWeightedAverageDiscountMethod, QuantityWeightedAverageDiscountMethod } from '../src/core/configs';

describe('OrderBuilderConfig', () => {
  describe('DiscountMethod', () => {
    const builder = new OrderBuilder({
      policies: [
        new PercentageDiscount(0.9, { id: 'P1' }),
        new ValueDiscount(50, { id: 'P2' }),
      ],
    });

    const order = builder.build({
      items: [
        {
          id: 'A',
          name: '外套A',
          unitPrice: 1000,
          quantity: 2,
          category: 'jacket',
          brand: 'AJE',
        },
        {
          id: 'B',
          name: '外套B',
          unitPrice: 1500,
          quantity: 1,
          category: 'jacket',
          brand: 'N21',
        },
      ],
    });

    it('PriceWeightedAverageDiscountMethod', () => {
      const priceWeighted = new PriceWeightedAverageDiscountMethod();

      const descriptions = priceWeighted.calculateDiscounts(order);

      expect(JSON.stringify(descriptions[0].appliedItems)).toEqual(
        JSON.stringify([
          {
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-1',
          },
          {
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-2',
          },
          {
            id: 'B',
            name: '外套B',
            unitPrice: 1500,
            quantity: 1,
            category: 'jacket',
            brand: 'N21',
            uuid: 'B-1',
          },
        ])
      );

      expect(descriptions[0].discount).toEqual(100 + 100 + 150);

      expect(JSON.stringify(descriptions[1].appliedItems)).toEqual(
        JSON.stringify([
          {
            // price-weighted-rate: 1000 / 3500 = 0.2857142857142857
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-1',
          },
          {
            // price-weighted-rate: 1000 / 3500 = 0.2857142857142857
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-2',
          },
          {
            // price-weighted-rate: 1500 / 3500 = 0.42857142857142855
            id: 'B',
            name: '外套B',
            unitPrice: 1500,
            quantity: 1,
            category: 'jacket',
            brand: 'N21',
            uuid: 'B-1',
          },
        ])
      );

      // round(350 * 0.2857142857142857) + round(350 * 0.2857142857142857) + round(350 * 0.42857142857142855)
      // = 100 + 100 + 150 = 350
      expect(descriptions[0].discount).toEqual(350);
    });

    it('PriceWeightedAverageDiscountMethod', () => {
      const priceWeighted = new PriceWeightedAverageDiscountMethod();

      const descriptions = priceWeighted.calculateDiscounts(order);

      expect(JSON.stringify(descriptions[0].appliedItems)).toEqual(
        JSON.stringify([
          {
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-1',
          },
          {
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-2',
          },
          {
            id: 'B',
            name: '外套B',
            unitPrice: 1500,
            quantity: 1,
            category: 'jacket',
            brand: 'N21',
            uuid: 'B-1',
          },
        ])
      );

      expect(JSON.stringify(descriptions[1].appliedItems)).toEqual(
        JSON.stringify([
          {
            // price-weighted-rate: 1000 / 3500 = 0.2857142857142857
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-1',
          },
          {
            // price-weighted-rate: 1000 / 3500 = 0.2857142857142857
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-2',
          },
          {
            // price-weighted-rate: 1500 / 3500 = 0.42857142857142855
            id: 'B',
            name: '外套B',
            unitPrice: 1500,
            quantity: 1,
            category: 'jacket',
            brand: 'N21',
            uuid: 'B-1',
          },
        ])
      );

      // round(350 * 0.2857142857142857) + round(350 * 0.2857142857142857) + round(350 * 0.42857142857142855)
      // = 100 + 100 + 150 = 350
      expect(descriptions[0].discount).toEqual(100 + 100 + 150);
    });

    it('PriceWeightedAverageDiscountMethod', () => {
      const quantityWeighted = new QuantityWeightedAverageDiscountMethod();

      const descriptions = quantityWeighted.calculateDiscounts(order);

      expect(JSON.stringify(descriptions[0].appliedItems)).toEqual(
        JSON.stringify([
          {
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-1',
          },
          {
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-2',
          },
          {
            id: 'B',
            name: '外套B',
            unitPrice: 1500,
            quantity: 1,
            category: 'jacket',
            brand: 'N21',
            uuid: 'B-1',
          },
        ])
      );

      expect(JSON.stringify(descriptions[1].appliedItems)).toEqual(
        JSON.stringify([
          {
            // quantity-weighted-rate: 1 / 3
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-1',
          },
          {
            // quantity-weighted-rate: 1 / 3
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-2',
          },
          {
            // quantity-weighted-rate: 1 / 3
            id: 'B',
            name: '外套B',
            unitPrice: 1500,
            quantity: 1,
            category: 'jacket',
            brand: 'N21',
            uuid: 'B-1',
          },
        ])
      );

      expect(descriptions[0].discount).toEqual(350);
    });
  });

  describe('RoundMethod', () => {
    it('FinalPriceOnly', () => {
      const finalPriceOnly = new FinalPriceOnlyRoundStrategy(1);

      expect(finalPriceOnly.round(1.34, 'FINAL_PRICE_ONLY')).toEqual(1.3);
      expect(finalPriceOnly.round(1.34, 'EVERY_CALCULATION')).toEqual(1.34);
      expect(finalPriceOnly.round(1.34, 'NO_ROUND')).toEqual(1.34);
      expect(finalPriceOnly.round(1.34, ['FINAL_PRICE_ONLY', 'EVERY_CALCULATION'])).toEqual(1.3);
    });

    it('EveryCalculation', () => {
      const everyCalculation = new EveryCalculationRoundStrategy(1);

      expect(everyCalculation.round(1.34, 'FINAL_PRICE_ONLY')).toEqual(1.34);
      expect(everyCalculation.round(1.34, 'EVERY_CALCULATION')).toEqual(1.3);
      expect(everyCalculation.round(1.34, 'NO_ROUND')).toEqual(1.34);
      expect(everyCalculation.round(1.34, ['FINAL_PRICE_ONLY', 'EVERY_CALCULATION'])).toEqual(1.3);
    });

    it('NoRound', () => {
      const everyCalculation = new NoRoundRoundStrategy(1);

      expect(everyCalculation.round(1.34, 'NO_ROUND')).toEqual(1.34);
      expect(everyCalculation.round(1.34, 'FINAL_PRICE_ONLY')).toEqual(1.34);
      expect(everyCalculation.round(1.34, 'EVERY_CALCULATION')).toEqual(1.34);
      expect(everyCalculation.round(1.34, 'NO_ROUND')).toEqual(1.34);
      expect(everyCalculation.round(1.34, ['FINAL_PRICE_ONLY', 'EVERY_CALCULATION'])).toEqual(1.34);
      expect(everyCalculation.round(1.34, ['NO_ROUND'])).toEqual(1.34);
    });
  });
});
