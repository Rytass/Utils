import { plus, minus, times, divided } from '../src/utils/decimal';

describe('Decimal', () => {
  describe('plus', () => {
    it('should return a number', () => {
      const result = plus(1, 2);

      expect(typeof result).toEqual('number');
    });

    it('should be 1.2 but 1.2000000000000002', () => {
      const result = plus(1.1, 0.1);

      expect(result).toEqual(1.2);
    });

    it('should be 0.8 but 0.7999999999999999', () => {
      const result = plus(0.7, 0.1);

      expect(result).toEqual(0.8);
    });
  });

  describe('minus', () => {
    it('should return a number', () => {
      const result = minus(1, 2);

      expect(typeof result).toEqual('number');
    });

    it('should be 0.2 but 0.19999999999999998', () => {
      const result = minus(0.3, 0.1);

      expect(result).toEqual(0.2);
    });

    it('should be 0.2', () => {
      const result = minus(0.3, 0.1);

      expect(result).toEqual(0.2);
    });

    it('should be 1.1 but 1.0999999999999943', () => {
      const result = minus(200, 198.9);

      expect(result).toEqual(1.1);
    });
  });

  describe('times', () => {
    it('should return a number', () => {
      const result = times(1, 2);

      expect(typeof result).toEqual('number');
    });

    it('should be 600.9 but 600.9000000000001', () => {
      const result = times(200.30, 3);

      expect(result).toEqual(600.9);
    });

    it('should be -600.9 but -600.9000000000001', () => {
      const result = times(-200.30, 3);

      expect(result).toEqual(-600.9);
    });

    it('should be 0.9 but 0.8999999999999999', () => {
      const result = times(.3, 3);

      expect(result).toEqual(0.9);
    });

    it('should be -2.222 but 2.2220000000000004', () => {
      const result = times(-2.2, -1.01);

      expect(result).toEqual(2.222);
    });
  });

  describe('divided', () => {
    it('should return a number', () => {
      const result = divided(1, 2);

      expect(typeof result).toEqual('number');
    });

    it('should be 2', () => {
      const result = divided(2, 1);

      expect(result).toEqual(2);
    });

    it('should be 200.3 but 200.29999999999998', () => {
      const result = divided(600.90, 3);

      expect(result).toEqual(200.3);
    });
  });
});
