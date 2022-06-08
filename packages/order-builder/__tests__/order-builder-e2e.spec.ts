import {
  ItemGiveawayDiscount,
  ItemIncluded,
  OrderBuilder,
  OrderItem,
  PercentageDiscount,
  PriceThreshold,
  QuantityThreshold,
  StepPercentageDiscount,
  StepValueDiscount,
  ValueDiscount,
} from '@rytass/order-builder';

type TestOrderItem = OrderItem<{
  category: string;
  brand: string;
}>;

describe('OrderBuilderE2E', () => {
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

  it('should have 9 items with total value $31500 in order.', () => {
    const builder = new OrderBuilder<TestOrderItem>();
    const order = builder.build({ items });

    expect(order.items.length).toEqual(9);
    expect(order.itemQuantity).toEqual(9);
    expect(order.itemValue).toEqual(31500);
  });

  /**
   * 情境編號：甲
   *
   * 情境敘述：
   * 1. 指定商品（Ａ～Ｆ）滿3件 打9折
   * 2. 指定商品（Ｃ～Ｉ）每5000元 折600元
   * 3. 指定分類（鞋子）滿4000元 送最低價商品
   * 4. 指定分類（Swell）每1件 打9折
   * 5. 全館 滿6件 贈紅利點數1000點
   * 6. 全館 滿6000元 免運
   *
   * 預期結果：
   * 取最優排列組合：2+4
   * 購物車顯示金額 24856
   */
  it('情境編號：甲', () => {
    // 指定商品（Ａ～Ｆ）滿3件 打9折
    const policy1 = new PercentageDiscount(
      0.9,
      new ItemIncluded({
        items: ['A', 'B', 'C', 'D', 'E', 'F'],
        threshold: 3,
      }),
      { id: 'SPECIFIED_A_F', onlyMatched: true }
    );

    let builder = new OrderBuilder<TestOrderItem>().addPolicy(policy1);
    let order = builder.build({ items });

    // 31500 - (1000 + 1500 + 2000 + 2500 + 3000 + 4000) * 0.1 = 31500 - 1400 = 30100
    expect(order.price).toEqual(30100);

    // 2. 指定商品（Ｃ～Ｉ）每5000元 折600元
    const policy2 = new StepValueDiscount(
      5000,
      600,
      new ItemIncluded<TestOrderItem>({
        items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
      }),
      { id: 'SPECIFIED_C_I', stepUnit: 'price', onlyMatched: true }
    );

    builder = new OrderBuilder<TestOrderItem>().addPolicy(policy2);
    order = builder.build({ items });

    // 31500 - (round(29000 / 5000) * 600) = 31500 - 3000 = 28500
    expect(order.price).toEqual(28500);

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

    builder = new OrderBuilder<TestOrderItem>().addPolicy(policy3);
    order = builder.build({ items });
    expect(order.price).toEqual(29500); // 31500 - min(2000, 2500, 3000) = 29500

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

    builder = new OrderBuilder<TestOrderItem>().addPolicy(policy4);
    order = builder.build({ items });
    // 31500 - 15000 * (1 - pow(0.9, 3))
    // 31500 - 15000 * 0.271
    // 31500 - 4065= 27435
    expect(order.price).toEqual(27435);

    // 擇優 (1|2)&(3|4)
    builder = new OrderBuilder({
      policies: [
        [policy1, policy2],
        [policy3, policy4],
      ],
    });

    order = builder.build({ items });

    expect(order.price).toEqual(24856);
  });

  /**
   * 情境編號：乙
   *
   * 情境敘述：
   * 1. 指定商品（Ｂ～Ｅ）無條件 送最低價商品
   * 2. 指定商品（Ｃ～Ｉ）每3000元 折200元
   * 3. 指定分類（N21）滿2件 折100元
   * 4. 指定分類（飾品）每2件 打9折
   * 5. 指定分類（Boyy）滿5000元 打9折
   * 6. 全館 滿6件 送最低價商品
   *
   * 預期結果： (1|2) & (3|4|5) & 6
   * 取最優排列組合：2+4+6
   * 購物車顯示金額 24868
   */
  describe('情境編號：乙', () => {
    // 指定商品（Ｂ～Ｅ）無條件 送最低價商品
    const policy1 = new ItemGiveawayDiscount(
      1,
      new ItemIncluded<TestOrderItem>({
        items: ['B', 'C', 'D', 'E'],
      }),
      { id: 'P1', onlyMatched: true }
    );

    // 指定商品（Ｃ～Ｉ）每3000元 折200元
    const policy2 = new StepValueDiscount(
      3000,
      200,
      new ItemIncluded<TestOrderItem>({
        items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
        scope: 'id',
      }),
      { id: 'P2', stepUnit: 'price', onlyMatched: true }
    );

    // 指定分類（N21）滿2件 折100元
    const policy3 = new ValueDiscount(
      100,
      new ItemIncluded<TestOrderItem>({
        items: ['N21'],
        scope: 'brand',
        threshold: 2,
      }),
      { id: 'P3', onlyMatched: true }
    );

    // 指定分類（飾品）每2件 打9折
    const policy4 = new StepPercentageDiscount(
      2,
      0.9,
      new ItemIncluded<TestOrderItem>({
        items: ['accessory'],
        scope: 'category',
      }),
      { id: 'P4', stepUnit: 'quantity', onlyMatched: true }
    );

    // 指定分類（Boyy）滿5000元 打9折
    const policy5 = new PercentageDiscount(
      0.9,
      new ItemIncluded<TestOrderItem>({
        items: ['Boyy'],
        scope: 'brand',
        conditions: [new PriceThreshold(5000)],
      }),
      { id: 'P5', onlyMatched: true }
    );

    // 全館 滿6件 送最低價商品
    const policy6 = new ItemGiveawayDiscount(
      1,
      new QuantityThreshold(6),
    );

    // 擇優 (1|2) & (3|4|5) & 6
    const builder = new OrderBuilder({
      policies: [
        [policy1, policy2],
        [policy3, policy4, policy5],
        policy6,
      ],
    });

    const order = builder.build({ items });

    expect(order.price).toEqual(24868);
  });

  /**
   * 情境編號：丙 - 1
   *
   * 情境敘述：
   * 1. 全館 滿6件 送最低價商品
   * 2. 指定分類（Boyy）滿5000元 打9折
   * 3. 指定商品（Ｂ～Ｅ）無條件 送最低價商品
   * 4. 指定商品（Ｃ～Ｉ）每3000元 折200元
   * 5. 指定分類（鞋子）滿4000元 送最低價商品
   *
   * 預期結果：1 & 2 & 3 & 4 & 5
   * 購物車顯示金額 24677
   */
  describe('情境編號：丙 - 1', () => {
    // 全館 滿6件 送最低價商品
    const policy1 = new ItemGiveawayDiscount(1, new QuantityThreshold(6));

    // 指定分類（Boyy）滿5000元 打9折
    const policy2 = new PercentageDiscount(
      0.9,
      new ItemIncluded<TestOrderItem>({
        items: ['Boyy'],
        scope: 'brand',
        conditions: [new PriceThreshold(5000)],
      }),
      { id: 'P2', onlyMatched: true }
    );

    // 指定商品（Ｂ～Ｅ）無條件 送最低價商品
    const policy3 = new ItemGiveawayDiscount(
      1,
      new ItemIncluded<TestOrderItem>({ items: ['B', 'C', 'D', 'E'] }),
      { id: 'P3', onlyMatched: true }
    );

    // 指定商品（Ｃ～Ｉ）每3000元 折200元
    const policy4 = new StepValueDiscount(
      3000,
      200,
      new ItemIncluded<TestOrderItem>({
        items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
      }),
      { id: 'P4', stepUnit: 'price', onlyMatched: true }
    );

    // 指定分類（鞋子）滿4000元 送最低價商品
    const policy5 = new ItemGiveawayDiscount(
      1,
      new ItemIncluded<TestOrderItem>({
        items: ['shoes'],
        scope: 'category',
        conditions: [new PriceThreshold(4000)],
      }),
      { id: 'P5', onlyMatched: true }
    );

    const builder = new OrderBuilder({
      policies: [
        policy1,
        policy2,
        policy3,
        policy4,
        policy5,
      ],
    });

    const order = builder.build({ items });

    expect(order.price).toEqual(24677);
  });

  /**
   * 情境編號：丙 - 2
   *
   * 情境敘述：
   * 1. 全館 滿14000元 贈最低價品
   * 2. 指定商品（Ｃ～Ｅ）無條件 送最低價商品
   * 3. 指定分類（鞋子）滿6000元 送最低價商品
   * 4. 指定分類（Boyy）滿5000元 打9折
   * 5. 全館 滿9件 送最低價商品
   * 6. 指定商品（Ｃ～Ｉ）每3000元 折200元
   *
   * 預期結果：1 & 2 & 3 & 4 & 5 & 6
   * 購物車顯示金額 26250
   */
  describe('情境編號：丙 - 2', () => {
    // 全館 滿14000元 送最低價商品
    const policy1 = new ItemGiveawayDiscount(1, new PriceThreshold(14000));

    // 指定商品（Ｃ～Ｅ）無條件 送最低價商品
    const policy2 = new ItemGiveawayDiscount(
      1,
      new ItemIncluded<TestOrderItem>({
        items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
      }),
      { id: 'P2', onlyMatched: true }
    );

    // 指定分類（鞋子）滿6000元 送最低價商品
    const policy3 = new ItemGiveawayDiscount(
      1,
      new ItemIncluded<TestOrderItem>({
        items: ['shoes'],
        scope: 'category',
        conditions: [new PriceThreshold(6000)],
      }),
      { id: 'P3', onlyMatched: true }
    );

    // 指定分類（Boyy）滿5000元 打9折
    const policy4 = new PercentageDiscount(
      0.9,
      new ItemIncluded<TestOrderItem>({
        scope: 'brand',
        items: ['Boyy'],
        conditions: [new PriceThreshold(5000)],
      }),
      { id: 'P4', onlyMatched: true }
    );

    // 全館 滿9件 送最低價商品
    const policy5 = new ItemGiveawayDiscount(1, new QuantityThreshold(9));

    // 指定商品（Ｃ～Ｉ）每3000元 折200元
    const policy6 = new StepValueDiscount(
      3000,
      200,
      new ItemIncluded({
        items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
      }),
      { id: 'P6', stepUnit: 'price', onlyMatched: true }
    );

    const builder = new OrderBuilder({
      discountMethod: 'PRICE_WEIGHTED_AVERAGE',
      policies: [
        policy1,
        policy2,
        policy3,
        policy4,
        policy5,
        policy6,
      ],
    });

    const order = builder.build({ items });

    expect(order.itemRecords.length).toEqual(order.itemQuantity);

    expect(order.price).toEqual(26250);
  });

  /**
   * 情境編號：丁
   *
   * 情境敘述：
   * 1. 指定分類（飾品）無條件 折1,000 元
   * 2. 指定分類（Swell）滿10,000元 打9折
   * 3. 全館 滿15,000元 送最低價品
   * 4. 指定商品（Ｆ～Ｉ）無條件 打9折
   * 5. 指定分類（Boyy）滿5000 打9折
   *
   * 預期結果：擇優(1&2&3)|(4&5)
   * 購物車顯示金額 28070
   */
  describe('情境編號：丁', () => {
    // 指定分類（飾品）無條件 折1,000 元
    const policy1 = new ValueDiscount(
      1000,
      new ItemIncluded<TestOrderItem>({
        scope: 'category',
        items: ['accessory'],
      }),
      { id: 'P2', onlyMatched: true }
    );

    // 指定分類（Swell）滿10,000元 打9折
    const policy2 = new PercentageDiscount(
      0.9,
      new ItemIncluded<TestOrderItem>({
        scope: 'brand',
        items: ['Swell'],
        conditions: [new PriceThreshold(10000)],
      }),
      { id: 'P2', onlyMatched: true }
    );

    // 全館 滿15,000元 送最低價品
    const policy3 = new ItemGiveawayDiscount(1, new PriceThreshold(15000));

    // 指定商品（Ｆ～Ｉ）無條件 打9折
    const policy4 = new PercentageDiscount(
      0.9,
      new ItemIncluded<TestOrderItem>({
        items: ['F', 'G', 'H', 'I'],
      }),
      { id: 'P4', onlyMatched: true }
    );

    // 指定分類（Boyy）滿5000 打9折
    const policy5 = new PercentageDiscount(
      0.9,
      new ItemIncluded<TestOrderItem>({
        scope: 'brand',
        items: ['Boyy'],
        conditions: [new PriceThreshold(5000)],
      }),
      { id: 'P5', onlyMatched: true }
    );

    const builder1 = new OrderBuilder({
      policies: [
        policy1,
        policy2,
        policy3,
      ],
    });

    const builder2 = new OrderBuilder({
      policies: [
        policy4,
        policy5,
      ],
    });

    const order1 = builder1.build({ items });
    const order2 = builder2.build({ items });

    expect(order1.price).toEqual(28070);
    expect(order2.price).toEqual(28765);

    expect(Math.min(order1.price, order2.price)).toEqual(28070);
  });

  /**
   * 情境編號：戊
   *
   * 情境敘述：
   * 1. 指定商品（Ｂ～Ｅ）無條件 送最低價商品
   * 2. 全館 滿6件 送最低價商品
   * 3. 指定分類（飾品）每2件 打9折
   * 4. 指定分類（鞋子）滿4000元 送最低價商品
   * 5. 指定分類（Boyy）滿5000元 打9折
   * 6. 全館 滿15,000元 送最低價品
   *
   * 預期結果：擇優(1&2&3)|(4&5&6)
   * 購物車顯示金額 24915
   */
  describe('情境編號：戊', () => {
    // 指定商品（Ｂ～Ｅ）無條件 送最低價商品
    const policy1 = new ItemGiveawayDiscount(
      1,
      new ItemIncluded<TestOrderItem>({
        items: ['B', 'C', 'D', 'E'],
      }),
      { id: 'P1', onlyMatched: true }
    );

    // 全館 滿6件 送最低價商品
    const policy2 = new ItemGiveawayDiscount(1, new QuantityThreshold(6));

    // 指定分類（飾品）每2件 打9折
    const policy3 = new StepPercentageDiscount(
      2,
      0.9,
      new ItemIncluded<TestOrderItem>({
        scope: 'category',
        items: ['accessory'],
      }),
      { id: 'P3', stepUnit: 'quantity', onlyMatched: true }
    );

    // 指定分類（鞋子）滿4000元 送最低價商品
    const policy4 = new ItemGiveawayDiscount(
      1,
      new ItemIncluded<TestOrderItem>({
        scope: 'category',
        items: ['shoes'],
        conditions: [new PriceThreshold(4000)],
      }),
      { id: 'P4', onlyMatched: true }
    );

    // 指定分類（Boyy）滿5000元 打9折
    const policy5 = new PercentageDiscount(
      0.9,
      new ItemIncluded<TestOrderItem>({
        scope: 'brand',
        items: ['Boyy'],
        conditions: [new PriceThreshold(5000)],
      }),
      { id: 'P5', onlyMatched: true }
    );

    // 全館 滿15,000元 送最低價品
    const policy6 = new ItemGiveawayDiscount(1, new PriceThreshold(15000));

    const builder1 = new OrderBuilder({
      policies: [policy1, policy2, policy3],
    });

    const builder2 = new OrderBuilder({
      policies: [policy4, policy5, policy6],
    });

    const order1 = builder1.build({ items });
    const order2 = builder2.build({ items });

    expect(order1.price).toEqual(24915);
    expect(order2.price).toEqual(27850);

    expect(Math.min(order1.price, order2.price)).toEqual(24915);
  });
});