import { CartesianProduct } from '../src/utils/combinatorics';
import { groupBy } from '../src/utils/collection';
import { plus, minus, times, divided, pow, round } from '../src/utils/decimal';

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

  describe('pow', () => {
    it('should return a number', () => {
      const result = pow(1, 2);

      expect(typeof result).toEqual('number');
    });

    it('should be 2', () => {
      const result = pow(2, 1);

      expect(result).toEqual(2);
    });

    it('should be 0.01', () => {
      const result = pow(0.1, 2);

      expect(result).toEqual(0.01);
    });
  });

  describe('round', () => {
    it('should return a number', () => {
      const result = round(0.12, 2);

      expect(typeof result).toEqual('number');
    });

    it('should be 2', () => {
      const result = round(2.123, 0);

      expect(result).toEqual(2);
    });

    it('should be 2.12', () => {
      const result = round(2.123, 2);

      expect(result).toEqual(2.12);
    });

    it('should be 2.125', () => {
      const result = round(2.1245, 3);

      expect(result).toEqual(2.125);
    });

    it('should be -2.124', () => {
      const result = round(-2.1245, 3);

      expect(result).toEqual(-2.124);
    });

    it('should throw Error if digitAfterDecimalPoint is not integer', () => {
      try {
        round(10.10, 1.1);
      } catch (ex: any) {
        expect(ex).toBeDefined();
        expect(ex).toBeInstanceOf(Error);
        expect(ex.message).toEqual(`${1.1} is not an integer number.`);
      }
    })
  });
});

describe('Collection', () => {
  it('groupBy', () => {
    const dictionary = groupBy(
      [
        {
          id: 1,
          name: '1',
        },
        {
          id: 1,
          name: '2',
        },
        {
          id: 2,
          name: '3',
        },
      ],
      obj => obj.id,
    );

    expect(JSON.stringify(
      Object.entries(dictionary).map(([_, v]) => v)
    )).toEqual(JSON.stringify(
      [
        [{
          id: 1,
          name: '1',
        },
        {
          id: 1,
          name: '2',
        }],
        [{
          id: 2,
          name: '3',
        }],
      ]
    ))
  })
})

describe('Combinatorics', () => {
  it('CartesianProduct', () => {
    const it = new CartesianProduct('012','abc','xyz');

    expect(it.length).toEqual(27);
    expect(JSON.stringify(it.toArray())).toEqual(JSON.stringify([
      [ '0', 'a', 'x' ], [ '1', 'a', 'x' ],
      [ '2', 'a', 'x' ], [ '0', 'b', 'x' ],
      [ '1', 'b', 'x' ], [ '2', 'b', 'x' ],
      [ '0', 'c', 'x' ], [ '1', 'c', 'x' ],
      [ '2', 'c', 'x' ], [ '0', 'a', 'y' ],
      [ '1', 'a', 'y' ], [ '2', 'a', 'y' ],
      [ '0', 'b', 'y' ], [ '1', 'b', 'y' ],
      [ '2', 'b', 'y' ], [ '0', 'c', 'y' ],
      [ '1', 'c', 'y' ], [ '2', 'c', 'y' ],
      [ '0', 'a', 'z' ], [ '1', 'a', 'z' ],
      [ '2', 'a', 'z' ], [ '0', 'b', 'z' ],
      [ '1', 'b', 'z' ], [ '2', 'b', 'z' ],
      [ '0', 'c', 'z' ], [ '1', 'c', 'z' ],
      [ '2', 'c', 'z' ],
    ]));
  })
})
