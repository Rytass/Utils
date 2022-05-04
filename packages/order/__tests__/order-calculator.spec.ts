import { OrderCalculator } from '../src/order-calculator';

describe('OrderCalculator', () => {
  describe('countDecimals', () => {
    it('`countDecimals` should return a number', () => {
      const decimal = OrderCalculator.countDecimals(23.453453453);

      expect(typeof decimal).toEqual('number');
    });

    it('decimals of 23.453453453 should be 9', () => {
      const decimal = OrderCalculator.countDecimals(23.453453453);

      expect(decimal).toEqual(9);
    });

    it('decimals of 0.0000000001 should be 10', () => {
      const decimal = OrderCalculator.countDecimals(0.0000000001);

      expect(decimal).toEqual(10);
    });

    it('decimals of 0.000000000000270 should be 13', () => {
      const decimal = OrderCalculator.countDecimals(0.00000000000027);

      expect(decimal).toEqual(13);
    });

    it('decimals of Integer should be 0', () => {
      const decimal = OrderCalculator.countDecimals(101);

      expect(decimal).toEqual(0);
    });

    it('decimals of -0.000001 should be 6', () => {
      const decimal = OrderCalculator.countDecimals(-0.000001);

      expect(decimal).toEqual(6);
    });

    it('decimals of 8e-7 should be 7', () => {
      const decimal = OrderCalculator.countDecimals(8e-7);

      expect(decimal).toEqual(7);
    });

    it('decimals of -8e-7 should be 7', () => {
      const decimal = OrderCalculator.countDecimals(-8e-7);

      expect(decimal).toEqual(7);
    });
  });

  describe('multiplier', () => {
    it('should return a number', () => {
      const multiplier = OrderCalculator.multiplier(1.1, 2.23);

      expect(typeof multiplier).toEqual('number');
    });

    it('should return 1000 if a = 1.2, b = 2.345', () => {
      const multiplier = OrderCalculator.multiplier(1.2, 2.345);

      expect(multiplier).toEqual(1000);
    });

    it('should return 10000 if a = 2.2345, b = 0.345', () => {
      const multiplier = OrderCalculator.multiplier(2.2345, 0.345);

      expect(multiplier).toEqual(10000);
    });

    it('should return 1 if a = 2, b = 1', () => {
      const multiplier = OrderCalculator.multiplier(2, 1);

      expect(multiplier).toEqual(1);
    });

    it('should return 10 if a = -2.1, b = 1', () => {
      const multiplier = OrderCalculator.multiplier(-2.1, 1);

      expect(multiplier).toEqual(10);
    });

    it('should return 10 if a = 2.1, b = -1', () => {
      const multiplier = OrderCalculator.multiplier(2.1, -1);

      expect(multiplier).toEqual(10);
    });

    it('should return 10 if a = -2.1, b = -1', () => {
      const multiplier = OrderCalculator.multiplier(-2.1, -1);

      expect(multiplier).toEqual(10);
    });
  });

  describe('plus', () => {
    it('should return a number', () => {
      const result = OrderCalculator.plus(1, 2);

      expect(typeof result).toEqual('number');
    });

    it('should be 1.2 but 1.2000000000000002', () => {
      const result = OrderCalculator.plus(1.1, 0.1);

      expect(result).toEqual(1.2);
    });

    it('should be 0.8 but 0.7999999999999999', () => {
      const result = OrderCalculator.plus(0.7, 0.1);

      expect(result).toEqual(0.8);
    });
  });

  describe('minus', () => {
    it('should return a number', () => {
      const result = OrderCalculator.minus(1, 2);

      expect(typeof result).toEqual('number');
    });

    it('should be 0.2 but 0.19999999999999998', () => {
      const result = OrderCalculator.minus(0.3, 0.1);

      expect(result).toEqual(0.2);
    });

    it('should be 0.2', () => {
      const result = OrderCalculator.minus(0.3, 0.1);

      expect(result).toEqual(0.2);
    });

    it('should be 1.1 but 1.0999999999999943', () => {
      const result = OrderCalculator.minus(200, 198.9);

      expect(result).toEqual(1.1);
    });
  });

  describe('times', () => {
    it('should return a number', () => {
      const result = OrderCalculator.times(1, 2);

      expect(typeof result).toEqual('number');
    });

    it('should be 600.9 but 600.9000000000001', () => {
      const result = OrderCalculator.times(200.30, 3);

      expect(result).toEqual(600.9);
    });

    it('should be -600.9 but -600.9000000000001', () => {
      const result = OrderCalculator.times(-200.30, 3);

      expect(result).toEqual(-600.9);
    });

    it('should be 0.9 but 0.8999999999999999', () => {
      const result = OrderCalculator.times(.3, 3);

      expect(result).toEqual(0.9);
    });

    it('should be -2.222 but 2.2220000000000004', () => {
      const result = OrderCalculator.times(-2.2, -1.01);

      expect(result).toEqual(2.222);
    });
  });

  describe('divided', () => {
    it('should return a number', () => {
      const result = OrderCalculator.divided(1, 2);

      expect(typeof result).toEqual('number');
    });

    it('should be 2', () => {
      const result = OrderCalculator.divided(2, 1);

      expect(result).toEqual(2);
    });

    it('should be 200.3 but 200.29999999999998', () => {
      const result = OrderCalculator.divided(600.90, 3);

      expect(result).toEqual(200.3);
    });
  });
});
