import { PolicyDiscountDescription } from '../../policies';

/**
 * Get best discount policy logic. `Will remove in next version.`
 * @param descriptions PolicyDiscountDescription[]
 * @returns PolicyDiscountDescription
 */
export function getBestDiscountPolicy(
  descriptions: PolicyDiscountDescription[]
): PolicyDiscountDescription {
  return [...descriptions].sort((a, b) => b.discount - a.discount)[0];
}
