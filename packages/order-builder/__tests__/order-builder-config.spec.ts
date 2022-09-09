import {
  ItemGiveawayDiscount,
  ItemIncluded,
  OrderBuilder,
  OrderItem,
  PercentageDiscount,
  PriceThreshold,
  StepPercentageDiscount,
  StepValueDiscount,
  ValueDiscount,
} from '@rytass/order-builder';
import {
  EveryCalculationRoundStrategy,
  FinalPriceOnlyRoundStrategy,
  NoRoundRoundStrategy,
  OrderBasedPolicyPickStrategy,
  PriceWeightedAverageDiscountMethod,
  QuantityWeightedAverageDiscountMethod,
} from '../src/core/configs';

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
            unitPrice: 900,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-1',
          },
          {
            // price-weighted-rate: 1000 / 3500 = 0.2857142857142857
            id: 'A',
            name: '外套A',
            unitPrice: 900,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-2',
          },
          {
            // price-weighted-rate: 1500 / 3500 = 0.42857142857142855
            id: 'B',
            name: '外套B',
            unitPrice: 1350,
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
            unitPrice: 900,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-1',
          },
          {
            // price-weighted-rate: 1000 / 3500 = 0.2857142857142857
            id: 'A',
            name: '外套A',
            unitPrice: 900,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-2',
          },
          {
            // price-weighted-rate: 1500 / 3500 = 0.42857142857142855
            id: 'B',
            name: '外套B',
            unitPrice: 1350,
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
            unitPrice: 883,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-1',
          },
          {
            // quantity-weighted-rate: 1 / 3
            id: 'A',
            name: '外套A',
            unitPrice: 883,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-2',
          },
          {
            // quantity-weighted-rate: 1 / 3
            id: 'B',
            name: '外套B',
            unitPrice: 1383,
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

      expect(finalPriceOnly.round(1.34, 'final-price-only')).toEqual(1.3);
      expect(finalPriceOnly.round(1.34, 'every-calculation')).toEqual(1.34);
      expect(finalPriceOnly.round(1.34, 'no-round')).toEqual(1.34);
      expect(
        finalPriceOnly.round(1.34, ['final-price-only', 'every-calculation'])
      ).toEqual(1.3);
    });

    it('EveryCalculation', () => {
      const everyCalculation = new EveryCalculationRoundStrategy(1);

      expect(everyCalculation.round(1.34, 'final-price-only')).toEqual(1.34);
      expect(everyCalculation.round(1.34, 'every-calculation')).toEqual(1.3);
      expect(everyCalculation.round(1.34, 'no-round')).toEqual(1.34);
      expect(
        everyCalculation.round(1.34, ['final-price-only', 'every-calculation'])
      ).toEqual(1.3);
    });

    it('NoRound', () => {
      const everyCalculation = new NoRoundRoundStrategy(1);

      expect(everyCalculation.round(1.34, 'no-round')).toEqual(1.34);
      expect(everyCalculation.round(1.34, 'final-price-only')).toEqual(1.34);
      expect(everyCalculation.round(1.34, 'every-calculation')).toEqual(1.34);
      expect(everyCalculation.round(1.34, 'no-round')).toEqual(1.34);
      expect(
        everyCalculation.round(1.34, ['final-price-only', 'every-calculation'])
      ).toEqual(1.34);

      expect(everyCalculation.round(1.34, ['no-round'])).toEqual(1.34);
    });
  });

  describe('PolicyPick', () => {
    type TestOrderItem = OrderItem<{
      category: string;
      brand: string;
    }>;

    const items: TestOrderItem[] = [
      {
        id: 'A',
        name: '外套A',
        unitPrice: 1000,
        quantity: 1,
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
      {
        id: 'C',
        name: '鞋子C',
        unitPrice: 2000,
        quantity: 1,
        category: 'shoes',
        brand: 'N21',
      },
      {
        id: 'D',
        name: '鞋子D',
        unitPrice: 2500,
        quantity: 1,
        category: 'shoes',
        brand: 'Preen',
      },
      {
        id: 'E',
        name: '鞋子E',
        unitPrice: 3000,
        quantity: 1,
        category: 'shoes',
        brand: 'Preen',
      },
      {
        id: 'F',
        name: '飾品F',
        unitPrice: 4000,
        quantity: 1,
        category: 'accessory',
        brand: 'Swell',
      },
      {
        id: 'G',
        name: '飾品G',
        unitPrice: 5000,
        quantity: 1,
        category: 'accessory',
        brand: 'Swell',
      },
      {
        id: 'H',
        name: '飾品H',
        unitPrice: 6000,
        quantity: 1,
        category: 'accessory',
        brand: 'Swell',
      },
      {
        id: 'I',
        name: '飾品I',
        unitPrice: 6500,
        quantity: 1,
        category: 'accessory',
        brand: 'Boyy',
      },
    ];

    it('OrderBased', () => {
      // 指定商品（Ａ～Ｆ）滿3件 打9折
      const policy1 = new PercentageDiscount(
        0.9,
        new ItemIncluded({
          items: ['A', 'B', 'C', 'D', 'E', 'F'],
          threshold: 3,
        }),
        { id: 'SPECIFIED_A_F', onlyMatched: true }
      );

      // 2. 指定商品（Ｃ～Ｉ）每5000元 折600元
      const policy2 = new StepValueDiscount(
        5000,
        600,
        new ItemIncluded<TestOrderItem>({
          items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
        }),
        { id: 'SPECIFIED_C_I', stepUnit: 'price', onlyMatched: true }
      );

      // 3. 指定分類（鞋子）滿4000元 送最低價商品
      const policy3 = new ItemGiveawayDiscount(
        1,
        new ItemIncluded<TestOrderItem>({
          scope: 'category',
          items: ['shoes'],
          conditions: [new PriceThreshold(4000)],
        }),
        { id: 'GIVEAWAY_BY_SHOES', onlyMatched: true }
      );

      // * 4. 指定分類（Swell）每1件 打9折
      const policy4 = new StepPercentageDiscount(
        1,
        0.9,
        new ItemIncluded<TestOrderItem>({
          scope: 'brand',
          items: ['Swell'],
        }),
        {
          id: 'SPECIFIED_BRAND_BY_Swell',
          stepUnit: 'quantity',
          onlyMatched: true,
        }
      );

      const builder = new OrderBuilder<TestOrderItem>({
        policies: [
          [policy1, policy2],
          [policy3, policy4],
        ],
      });

      const order = builder.build({ items });
      // 31500 - 15000 * (1 - pow(0.9, 3))
      // 31500 - 15000 * 0.271
      // 31500 - 4065= 27435

      const policyPick = new OrderBasedPolicyPickStrategy();

      policyPick.pick(order, [policy1, policy2]);
    });
  });
});
