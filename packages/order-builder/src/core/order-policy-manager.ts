import { Policies, Policy } from '../policies';

/**
 * RemovePolicy
 * @description Policy | String;
 * @description Policy or id of the policy interface.
 */
export type RemovePolicy = Policy | string;

/**
 * OrderPolicyManager
 */
export class OrderPolicyManager {
  private _policies: Policies[];

  get policies(): Policies[] {
    return this._policies;
  }

  constructor(policies: Policies[]) {
    this._policies = policies;
  }

  addPolicy(policy: Policies): void;
  addPolicy(policies: Policies[]): void;
  addPolicy(arg0: Policies | Policies[]): void;
  addPolicy(arg0: Policies | Policies[]): any {
    const policies = Array.isArray(arg0) ? arg0 : [arg0];

    this._policies = [...this._policies, ...policies];
  }

  removePolicy<PT extends RemovePolicy>(policy: PT): void;
  removePolicy<PT extends RemovePolicy>(policies: PT[]): void;
  removePolicy<PT extends RemovePolicy>(arg0: PT | PT[]): void;
  removePolicy<PT extends RemovePolicy>(arg0: PT | PT[]): void {
    const policies = Array.isArray(arg0) ? arg0 : [arg0];

    const toRemovePolicyIdSet = new Set(
      policies.map(policy =>
        typeof policy === 'string' ? policy : policy?.id
      )
    );

    this._policies = this._policies.reduce((total, policy) => {
      if (Array.isArray(policy)) {
        return [
          ...total,
          policy.filter(candidatePolicy => !toRemovePolicyIdSet.has(candidatePolicy.id)),
        ]
      }

      return toRemovePolicyIdSet.has(policy.id)
          ? total
          : [...total, policy];
    }, [] as Policies[]);
  }

  /**
   * Get the policy reference map.
   */
  get policyMap(): Map<string, Policy> {
    const flattenPolicies = this._policies.reduce((total: Policy[], policy) => {
      return Array.isArray(policy)
        ? [...total, ...policy]
        : [...total, policy]
    }, [] as Policy[]);

    return new Map<string, Policy>(flattenPolicies.map(policy => [
      policy.id,
      policy,
    ] as [string, Policy]));
  }
}
