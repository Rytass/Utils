import { HappyCardOrderItem } from '../src/happy-card-order-item';

describe('HappyCardOrderItem', () => {
  it('should create an order item with provided options', () => {
    const options = {
      name: 'Test Product',
      unitPrice: 100,
      quantity: 2,
    };

    const item = new HappyCardOrderItem(options);

    expect(item.name).toBe('Test Product');
    expect(item.unitPrice).toBe(100);
    expect(item.quantity).toBe(2);
  });

  it('should be an instance of HappyCardOrderItem', () => {
    const item = new HappyCardOrderItem({
      name: 'Product',
      unitPrice: 50,
      quantity: 1,
    });

    expect(item).toBeInstanceOf(HappyCardOrderItem);
  });

  it('should handle different price values', () => {
    const expensiveItem = new HappyCardOrderItem({
      name: 'Expensive Product',
      unitPrice: 9999,
      quantity: 1,
    });

    expect(expensiveItem.unitPrice).toBe(9999);

    const cheapItem = new HappyCardOrderItem({
      name: 'Cheap Product',
      unitPrice: 1,
      quantity: 100,
    });

    expect(cheapItem.unitPrice).toBe(1);
    expect(cheapItem.quantity).toBe(100);
  });

  it('should handle decimal prices', () => {
    const item = new HappyCardOrderItem({
      name: 'Decimal Price Product',
      unitPrice: 99.99,
      quantity: 3,
    });

    expect(item.unitPrice).toBe(99.99);
  });

  it('should handle unicode characters in name', () => {
    const item = new HappyCardOrderItem({
      name: '測試商品 Test 商品',
      unitPrice: 150,
      quantity: 1,
    });

    expect(item.name).toBe('測試商品 Test 商品');
  });
});
