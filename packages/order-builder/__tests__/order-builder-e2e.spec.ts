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
   * 情境編號：甲 - 1
   *
   * 決策法：擇優取一 (order-based)
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
  it('情境編號：甲 - 2', () => {
    // 指定商品（Ａ～Ｆ）滿3件 打9折
    const policy1 = new PercentageDiscount(
      0.9,
      new ItemIncluded({
        items: ['A', 'B', 'C', 'D', 'E', 'F'],
        threshold: 3,
      }),
      { id: 'SPECIFIED_A_F', onlyMatched: true }
    );

    let builder = new OrderBuilder<TestOrderItem>({
      policyPickStrategy: 'order-based',
      policies: [policy1],
    });

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

    builder = new OrderBuilder<TestOrderItem>({
      policyPickStrategy: 'order-based',
      policies: [policy2],
    });

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

    builder = new OrderBuilder<TestOrderItem>({
      policyPickStrategy: 'order-based',
      policies: [policy3],
    });

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

    builder = new OrderBuilder<TestOrderItem>({
      policyPickStrategy: 'order-based',
      policies: [policy4],
    });

    order = builder.build({ items });
    // 31500 - 15000 * (1 - pow(0.9, 3))
    // 31500 - 15000 * 0.271
    // 31500 - 4065= 27435
    expect(order.price).toEqual(27435);

    // 擇優 (1|2)&(3|4)
    builder = new OrderBuilder({
      policyPickStrategy: 'order-based',
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
   * 決策法：擇優取一 (order-based)
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
  it('情境編號：乙', () => {
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
    const policy6 = new ItemGiveawayDiscount(1, new QuantityThreshold(6));

    // 擇優 (1|2) & (3|4|5) & 6
    const builder = new OrderBuilder({
      policyPickStrategy: 'order-based',
      policies: [[policy1, policy2], [policy3, policy4, policy5], policy6],
    });

    const order = builder.build({ items });

    expect(order.price).toEqual(24868);
  });

  /**
   * 情境編號：丙 - 1
   *
   * 決策法：擇優取一 (order-based)
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
  it('情境編號：丙 - 1', () => {
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
      policyPickStrategy: 'order-based',
      policies: [policy1, policy2, policy3, policy4, policy5],
    });

    const order = builder.build({ items });

    expect(order.price).toEqual(24677);
  });

  /**
   * 情境編號：丙 - 2
   *
   * 決策法：擇優取一 (order-based)
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
  it('情境編號：丙 - 2', () => {
    // 全館 滿14000元 送最低價商品
    const policy1 = new ItemGiveawayDiscount(1, new PriceThreshold(14000), { id: 'POLICY1' });

    // 指定商品（Ｃ～Ｅ）無條件 送最低價商品
    const policy2 = new ItemGiveawayDiscount(
      1,
      new ItemIncluded<TestOrderItem>({
        items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
      }),
      { id: 'POLICY2', onlyMatched: true }
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
      policyPickStrategy: 'order-based',
      discountMethod: 'price-weighted-average',
      policies: [policy1, policy2, policy3, policy4, policy5, policy6],
    });

    const order = builder.build({ id: '26250', items });

    expect(order.itemRecords.length).toEqual(order.itemQuantity);

    expect(order.price).toEqual(26250);
  });

  /**
   * 情境編號：丁
   *
   * 決策法：擇優取一 (order-based)
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
  it('情境編號：丁', () => {
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
      policyPickStrategy: 'order-based',
      policies: [policy1, policy2, policy3],
    });

    const builder2 = new OrderBuilder({
      policyPickStrategy: 'order-based',
      policies: [policy4, policy5],
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
   * 決策法：擇優取一 (order-based)
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
   * 購物車顯示金額 25915
   */
  it('情境編號：戊', () => {
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

    const order1 = builder1.build({ id: '24915', items });
    const order2 = builder2.build({ items });

    expect(order1.price).toEqual(24915);
    expect(order2.price).toEqual(27850);
    expect(Math.min(order1.price, order2.price)).toEqual(24915);
  });

  /**
   * 情境編號：甲 - 2
   *
   * 決策法：最適組合 (item-based)
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
   it('情境編號：甲 - 1', () => {
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
      { id: 'GIVEAWAY_BY_SHOES_1', onlyMatched: true }
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
        id: 'SPECIFIED_BRAND_BY_Swell_1',
        stepUnit: 'quantity',
        onlyMatched: true,
      }
    );

    // (1|2)&(3|4)
    const builder1 = new OrderBuilder<TestOrderItem>({
      policyPickStrategy: 'item-based',
      policies: [
        [policy1, policy2],
        [policy3, policy4],
      ],
    });

    const order1 = builder1.build({ items });

    const builder2 = new OrderBuilder<TestOrderItem>({
      policyPickStrategy: 'item-based',
      policies: [
        [policy1, policy2],
        policy3,
        policy4,
      ],
    });

    const order2 = builder2.build({ items });

    // expect(order1.price).toEqual(22051);
    expect(order2.price).toEqual(22491);
  });
});

describe('TAST v0.0.2', () => {
  type TestOrderItem = OrderItem<{
    category: string,
    brand: string,
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
      quantity: 2,
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
      quantity: 3,
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
      quantity: 2,
      category: 'accessory',
      brand: 'Boyy',
    },
  ];

  it('Initial item value', () => {
    const order = new OrderBuilder().build({ items });

    expect(order.itemValue).toEqual(48500);
  })

  /**
   *  根據設定此情境為：
   *    a) 一個層級裡若有多個促銷活動，採擇優計算 [不可疊加]
   *    b) 不同層級之間採優惠疊加計算 [可疊加]
   *
   *  1	指定商品（Ｂ～Ｅ）滿2件 送最低價商品
 	 *	2	指定商品（Ｃ～Ｉ）每 4000元 折 200元
 	 *	3	指定分類（N21）滿2件 折100元
 	 *	4	指定分類（飾品）每3件 打9折，至多打 2 次
 	 *	5	指定分類（Swell）滿 4000元 打8折
 	 *	6	全館 滿6件 送最低價商品
 	 *	7	全館 每5件 折600元
   */
  it('Case 1', () => {
    const policy1 = new ItemGiveawayDiscount(
      1,
      new ItemIncluded({
        items: ['B', 'C', 'D', 'E'],
        threshold: 2,
      }),
      { id: 'POLICY_1', onlyMatched: true },
    );

    const policy2 = new StepValueDiscount(
      4000,
      200,
      new ItemIncluded({
        items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
      }),
      { id: 'POLICY_2', stepUnit: 'price', onlyMatched: true }
    );

    const policy3 = new ValueDiscount(
      100,
      new ItemIncluded<TestOrderItem>({
        scope: 'brand',
        items: ['N21'],
        threshold: 2,
        // or
        // conditions: [new QuantityThreshold(2)],
      }),
      { id: 'POLICY_3', onlyMatched: true }
    );

    const policy4 = new StepPercentageDiscount(
      3,
      0.9,
      new ItemIncluded<TestOrderItem>({
        scope: 'category',
        items: ['accessory'],
      }),
      { id: 'POLICY_4', stepUnit: 'quantity', onlyMatched: true }
    );

    const policy5 = new PercentageDiscount(
      0.8,
      new ItemIncluded<TestOrderItem>({
        scope: 'brand',
        items: ['Swell'],
        conditions: [new PriceThreshold(4000)],
      }),
      { id: 'POLICY_5', onlyMatched: true }
    );

    const policy6 = new ItemGiveawayDiscount(
      1,
      new QuantityThreshold(5),
      { id: 'POLICY_6' }
    );

    const policy7 = new StepValueDiscount(
      7,
      200,
      { id: 'POLICY_7', stepUnit: 'quantity' }
    );

    const builder = new OrderBuilder({
      policies: [
        [policy1, policy2],
      ],
    });

    const order = builder.build({ id: 'TDD', items });

    expect(order.price).toEqual(44000);

    const order2 = new OrderBuilder(order.builder)
      .addPolicy([
        [policy3, policy4, policy5],
      ])
      .build({ items });

    expect(order2.price).toEqual(37341);

    /**
     * @todo
     * improve algorithm.
     */
    const order3 = new OrderBuilder(order2.builder)
      .addPolicy([
        [policy6, policy7],
      ])
      .build({ id: 'TDD3', items });

    expect(order3.price).toEqual(34261);
  })

  it('Logistics Fee', () => {
    const originItems: TestOrderItem[] = [
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
    ];

    let order = new OrderBuilder()
      .setLogistics({ price: 200 })
      // 指定商品 B, C, D, E 滿兩件
      .addPolicy(
        new ItemGiveawayDiscount(
          1,
          new ItemIncluded<TestOrderItem>({
            items: ['B', 'C', 'D', 'E'],
            threshold: 2,
          }),
          { onlyMatched: true }
        )
      )
      .build({
        items: originItems,
      });

    // 4500 + 200 - 1500 = 3200
    expect(order.price).toEqual(3200);

    order = new OrderBuilder(order.builder)
    .setLogistics({
      price: 200,
      threshold: 2000,
    })
    .build({ items: originItems });

    // 4500 + 200 - 1500 - 200 = 3000
    expect(order.price).toEqual(3000);

    const order2 = new OrderBuilder({
      logistics: { price: 5000 }, // will be overwrite at build time.
    })
      // 指定商品 B, C, D, E 滿兩件送最低價品
      .addPolicy(
        new ItemGiveawayDiscount(
          1,
          new ItemIncluded<TestOrderItem>({
            items: ['B', 'C', 'D', 'E'],
            threshold: 2,
          }),
          { onlyMatched: true }
        )
      )
      .build({
        items: originItems,
        logistics: {
          price: 200,
          threshold: 2000,
        },
      });

    expect(order2.price).toEqual(3000);

    // The condition of free-logistics is not satisfied.
    expect(
      new OrderBuilder({
        logistics: {
          price: 200,
          threshold: 2000,
        },
      }).build({
        items: [
          {
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
          },
        ],
      }).price
    ).toEqual(1000 + 200);

    const originItems3: TestOrderItem[] = [
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
    ];

    const order3 = new OrderBuilder()
      // 滿 2000 免運
      .setLogistics({
        price: 200,
        threshold: 2000,
        name: '運費',
      })
      // 指定商品 B, C, D, E 滿兩件送最低價品
      .addPolicy(
        new ItemGiveawayDiscount(
          1,
          new ItemIncluded<TestOrderItem>({
            items: ['B', 'C', 'D', 'E'],
            threshold: 2,
          }),
          { onlyMatched: true }
        )
      )
      .build({ items: originItems3 });

    // 4500 + 200 - 1500 - 200 = 3000
    expect(order3.price).toEqual(3000);
  });

  /**
   * 需要能單純判斷是否滿足特定條件、滿足幾次，不影響訂單計算的類似 policy 功能
   * 使用情境：滿足條件贈送紅利點數、滿足條件可加購商品
   *
   * 目前 TAST 這邊只需要判斷到有沒有符合就好，不需要知道滿足幾次
   *
   * 情境敘述：
   * 新增一個只判斷是否符合條件的 policy
   * 透過 order.onlyMatchedPolicies 回傳 policy 是否符合條件
   *
   * ```typescript
   * const policy = new OnlyMatchedDiscount(conditions);
   *
   * const order = new OrderBuilder().addPolicy(policy).build({ items });
   *
   * order.onlyMatchedPolicies // [{ id: 'only-matched-policy', matchedTimes: 1 }]
   * ```
   */
  it('Only Matched Policy', () => {
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
    ];

    // 每 2000 元折 200 元 -> 滿足 2 次

    const policy1 = new StepValueDiscount(
      2000,
      200,
      { id: 'only-matched-policy', stepUnit: 'price' },
    );

    const builder = new OrderBuilder();

    const policy1MatchedTimes = builder
      .addPolicy(policy1)
      .build({ items })
      .discounts
      .find(discount => discount.id === policy1.id)
      ?.matchedTimes || 0;

    expect(policy1MatchedTimes).toBe(2); // step(4500, 2000) = 2

    expect(
      builder
        .build({ items })
        .discountValue
    ).toBe(policy1.value * policy1MatchedTimes);

    expect(
      new OrderBuilder()
        .addPolicy(
          new StepPercentageDiscount(1499, 0.8, { id: 'p2', stepUnit: 'price' })
        )
        .build({ items })
        .discounts.find(discount => discount.id === 'p2')?.matchedTimes
    ).toBe(3);

    let ob = new OrderBuilder()
      .addPolicy(
        new StepPercentageDiscount(1499, 0.8, {
          id: 'p3',
          stepUnit: 'price',
          excludedInCalculation: true,
        })
      )
      .build({ items });

    expect(ob.price).toBe(4500);
    expect(JSON.stringify(ob.discounts)).toBe(  JSON.stringify([
      {
        id: 'p3',
        step: 1499,
        value: 0.8,
        type: 'STEP_PERCENTAGE',
        discount: 0,
        conditions: [],
        appliedItems: [
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
            id: 'B',
            name: '外套B',
            unitPrice: 1500,
            quantity: 1,
            category: 'jacket',
            brand: 'N21',
            uuid: 'B-1',
          },
          {
            id: 'C',
            name: '鞋子C',
            unitPrice: 2000,
            quantity: 1,
            category: 'shoes',
            brand: 'N21',
            uuid: 'C-1',
          },
        ],
        matchedTimes: 3,
      },
    ]));

    ob = new OrderBuilder()
      .addPolicy(
        new StepValueDiscount(1499, 200, {
          id: 'p4',
          stepUnit: 'price',
          excludedInCalculation: true,
        })
      )
      .build({ items });

    expect(ob.price).toBe(4500);
    expect(JSON.stringify(ob.discounts)).toBe(  JSON.stringify([
      {
        id: 'p4',
        step: 1499,
        value: 200,
        type: 'STEP_VALUE',
        discount: 0,
        conditions: [],
        appliedItems: [
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
            id: 'B',
            name: '外套B',
            unitPrice: 1500,
            quantity: 1,
            category: 'jacket',
            brand: 'N21',
            uuid: 'B-1',
          },
          {
            id: 'C',
            name: '鞋子C',
            unitPrice: 2000,
            quantity: 1,
            category: 'shoes',
            brand: 'N21',
            uuid: 'C-1',
          },
        ],
        matchedTimes: 3,
      },
    ]));

    ob = new OrderBuilder()
      .addPolicy(
        new ValueDiscount(1499, {
          id: 'p5',
          excludedInCalculation: true,
        })
      )
      .build({ items });

    expect(ob.price).toBe(4500);
    expect(JSON.stringify(ob.discounts)).toBe(JSON.stringify([
      {
        id: 'p5',
        value: 1499,
        type: 'VALUE',
        discount: 0,
        conditions: [],
        appliedItems: [
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
            id: 'B',
            name: '外套B',
            unitPrice: 1500,
            quantity: 1,
            category: 'jacket',
            brand: 'N21',
            uuid: 'B-1',
          },
          {
            id: 'C',
            name: '鞋子C',
            unitPrice: 2000,
            quantity: 1,
            category: 'shoes',
            brand: 'N21',
            uuid: 'C-1',
          },
        ],
        matchedTimes: 1,
      },
    ]));

    ob = new OrderBuilder()
      .addPolicy(
        new ItemGiveawayDiscount(1, {
          id: 'p6',
          excludedInCalculation: true,
        })
      )
      .build({ items });

    expect(ob.price).toBe(4500);
    expect(JSON.stringify(ob.discounts)).toBe(JSON.stringify([
      {
        id: 'p6',
        value: 1,
        strategy: 'LOW_PRICE_FIRST',
        type: 'ITEM_GIVEAWAY',
        discount: 0,
        conditions: [],
        appliedItems: [
          {
            id: 'A',
            name: '外套A',
            unitPrice: 1000,
            quantity: 1,
            category: 'jacket',
            brand: 'AJE',
            uuid: 'A-1',
          },
        ],
        matchedTimes: 1,
      },
    ]));

    ob = new OrderBuilder()
      .addPolicy(
        new PercentageDiscount(0.8, {
          id: 'p7',
          excludedInCalculation: true,
        })
      )
      .build({ items });

    expect(ob.price).toBe(4500);
    expect(JSON.stringify(ob.discounts)).toBe(JSON.stringify([
      {
        id: 'p7',
        value: 0.8,
        type: 'PERCENTAGE',
        discount: 0,
        conditions: [],
        appliedItems: [
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
            id: 'B',
            name: '外套B',
            unitPrice: 1500,
            quantity: 1,
            category: 'jacket',
            brand: 'N21',
            uuid: 'B-1',
          },
          {
            id: 'C',
            name: '鞋子C',
            unitPrice: 2000,
            quantity: 1,
            category: 'shoes',
            brand: 'N21',
            uuid: 'C-1',
          },
        ],
        matchedTimes: 1,
      },
    ]));
  })
})
