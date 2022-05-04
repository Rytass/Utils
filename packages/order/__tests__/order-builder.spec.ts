
import { OrderBuilder } from '../src/order-builder';

describe('OrderBuilder', () => {
  it('should create be an instance of OrderBuilder', () => {
    const orderBuilder = new OrderBuilder();

    expect(orderBuilder).toBeDefined();
    expect(orderBuilder).toBeInstanceOf(OrderBuilder);
  })

  it('should be 1000 as initial value was given', () => {
    const orderBuilder = new OrderBuilder(1000);

    expect(orderBuilder.getValue()).toEqual(1000);
  })

  describe('plus', () => {
    it('should be 1100.10', () => {
      const orderBuilder = new OrderBuilder(1000);

      orderBuilder.plus(100.10);
      expect(orderBuilder.getValue()).toEqual(1100.10);
    })

    it('should be 1100.10', () => {
      const orderBuilder = new OrderBuilder(1000);

      orderBuilder.plus(100.10);
      expect(orderBuilder.getValue()).toEqual(1100.10);
    })

    it('should be 1200.20', () => {
      const orderBuilder = new OrderBuilder(1000);

      orderBuilder
        .plus(100.10)
        .plus(100.10);

      expect(orderBuilder.getValue()).toEqual(1200.20);
    })

    it('should be 2.4', () => {
      const orderBuilder = new OrderBuilder(1.1);

      orderBuilder
        .plus(0.1)
        .plus(1.1)
        .plus(0.1);

      expect(orderBuilder.getValue()).toEqual(2.4);
    })
  })

  describe('minus', () => {
    it('should be 0.2', () => {
      const orderBuilder = new OrderBuilder(0.3);

      orderBuilder.minus(0.1);
      expect(orderBuilder.getValue()).toEqual(0.2);
    })

    it('should be 899.9', () => {
      const orderBuilder = new OrderBuilder(1000);

      orderBuilder.minus(100.10);
      expect(orderBuilder.getValue()).toEqual(899.9);
    })

    it('should be 799.8', () => {
      const orderBuilder = new OrderBuilder(1000);

      orderBuilder
        .minus(100.10)
        .minus(100.10);

      expect(orderBuilder.getValue()).toEqual(799.8);
    })
  })

  describe('times', () => {
    it('should be 600.09', () => {
      const orderBuilder = new OrderBuilder(200.03);

      orderBuilder.times(3);
      expect(orderBuilder.getValue()).toEqual(600.09);
    })

    it('should be 0', () => {
      const orderBuilder = new OrderBuilder(1000);

      orderBuilder.times(0);
      expect(orderBuilder.getValue()).toEqual(0);
    })

    it('should be -2.2', () => {
      const orderBuilder = new OrderBuilder(1.1);

      orderBuilder.times(-2);
      expect(orderBuilder.getValue()).toEqual(-2.2);
    })

    it('should be allowed to chain and mutable', () => {
      const orderBuilder = new OrderBuilder(1.1);

      orderBuilder.times(-2);
      expect(orderBuilder.getValue()).toEqual(-2.2);

      orderBuilder.times(-1.01);
      expect(orderBuilder.getValue()).toEqual(2.222);

      orderBuilder.times(-.4);
      expect(orderBuilder.getValue()).toEqual(-0.8888);
    });
  })

  describe('divided', () => {
    it('should be 200.03', () => {
      const orderBuilder = new OrderBuilder(600.09);

      orderBuilder.divided(3);
      expect(orderBuilder.getValue()).toEqual(200.03);
    })

    it('should be 0', () => {
      const orderBuilder = new OrderBuilder();

      orderBuilder.divided(2);
      expect(orderBuilder.getValue()).toEqual(0);
    })

    it('should be Infinity', () => {
      const orderBuilder = new OrderBuilder(10);

      orderBuilder.divided(0);
      expect(orderBuilder.getValue()).toEqual(Infinity);
    })
  })

  describe('operation chain tests', () => {
    it('0 + 200 - 198.9 + 0.1 should = 1.2', () => {
      const orderBuilder = new OrderBuilder();

      orderBuilder
      .plus(200) // current value: 200
      .minus(198.9) // current value 1.1 (not 1.0999999999999943)
      .plus(0.1);

      expect(orderBuilder.getValue()).toEqual(1.2);
    })
  })

  describe('lock status', () => {
    const orderBuilder = new OrderBuilder(10);

    expect(orderBuilder.locked).toEqual(false);

    orderBuilder.times(-.1);
    orderBuilder.plus(100);

    expect(orderBuilder.getValue()).toEqual(99);

    orderBuilder.lock();
    expect(orderBuilder.locked).toEqual(true);
    orderBuilder.plus(0.3);
    orderBuilder.minus(0.3);
    orderBuilder.times(0.3);
    orderBuilder.divided(0.3);
    expect(orderBuilder.getValue()).toEqual(99);
    orderBuilder.unLock();
    expect(orderBuilder.locked).toEqual(false);
    orderBuilder.divided(0.3);
    expect(orderBuilder.getValue()).toEqual(330);
  })

  describe('boolean status', () => {
    const orderBuilder = new OrderBuilder(10);

    expect(orderBuilder.isEqual(10)).toEqual(true);

    orderBuilder.times(-.1);
    orderBuilder.plus(100);

    expect(orderBuilder.isEqual(99)).toEqual(true);
    expect(orderBuilder.getValue()).toEqual(99);

    orderBuilder
      .times(2.01) // 198.99
      .minus(0.99); // 198

    expect(orderBuilder.getValue()).toEqual(198);
    expect(orderBuilder.isGreaterThan(198)).toEqual(false);
    expect(orderBuilder.isGreaterEqualThan(198)).toEqual(true);

    orderBuilder.divided(2.05); // 96.58536585365854
    expect(orderBuilder.isLessThan(96.6)).toEqual(true);
    expect(orderBuilder.isLessThan(96.58536585365854)).toEqual(false);
    expect(orderBuilder.isLessEqualThan(96.58536585365854)).toEqual(true);
  })
});
