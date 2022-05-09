# `OrderBuilder`

> TODO: other common order-related methods.

## Usage

```typescript

import { OrderManager } from '@rytass/order-builder';

const orderBuilder = OrderManager.createOrderBuilder(); // current value: 0

// Basic Operations
orderBuilder
  .plus(200) // current value: 200
  .minus(198.9) // current value 1.1 (not 1.0999999999999943)
  .plus(0.1); // current value 1.2 (not 1.2000000000000002)

orderBuilder.getValue(); // 1.2

orderBuilder
  .times(2.5) // 3
  .divided(0.3) // 10

orderBuilder.getValue(); // 10;

// will omit any mutations after this method been called
orderBuilder.lock();

// will unlock the mutations
orderBuilder.unLock();

// check value status
orderBuilder.isGreaterThan(10); // false -> 10 is not greater than 10

orderBuilder.isGreaterEqualThan(10); // true -> 10 >= 10

orderBuilder.isLessThan(10); // false -> 10 is not less than 10

orderBuilder.isLessEqualThan(10); // true -> 10 <= 10

```
