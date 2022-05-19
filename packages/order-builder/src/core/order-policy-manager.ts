import { Policies, Policy } from '../policies';

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

  removePolicy<PT extends Policy | string = Policy | string>(
    policy: PT
  ): void;
  removePolicy<PT extends Policy | string = Policy | string>(
    policies: PT[]
  ): void;
  removePolicy<PT extends Policy | string = Policy | string>(
    arg0: PT | PT[]
  ): void;
  removePolicy<PT extends Policy | string = Policy | string>(
    arg0: PT | PT[]
  ): void {
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
