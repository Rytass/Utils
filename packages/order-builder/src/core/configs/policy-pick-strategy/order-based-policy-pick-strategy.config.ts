import { Policies, Policy, PolicyDiscountDescription } from '../../../policies';
import { isDiscountPolicy } from '../../../policies/discount/utils';
import { Order } from '../../order';
import { PolicyPickStrategy, PolicyPickStrategyType } from '../typings';

/**
 * OrderBasedPolicyPickStrategy
 */
export class OrderBasedPolicyPickStrategy implements PolicyPickStrategy {
  type: PolicyPickStrategyType = 'order-based';

  pick(order: Order, policies: Policies): PolicyDiscountDescription[] {
    return Array.isArray(policies) ? this.pickMulti(order, policies) : this.pickOne(order, policies);
  }

  pickOne(order: Order, policy: Policy): PolicyDiscountDescription[] {
    return policy.resolve(order, []) as PolicyDiscountDescription[];
  }

  pickMulti(order: Order, policies: Policy[]): PolicyDiscountDescription[] {
    return policies
      .filter(isDiscountPolicy)
      .reduce(
        (candidates, candidate) => candidate.resolve<PolicyDiscountDescription>(order, candidates),
        [] as PolicyDiscountDescription[],
      )
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 1);
  }
}
