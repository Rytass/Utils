import { Policy } from '../policies';

/**
 * OrderPolicyManager
 */
export class OrderPolicyManager {
  private _policies: Policy[];

  get policies(): Policy[] {
    return this._policies;
  }

  constructor(policies: Policy[]) {
    this._policies = policies;
  }

  addPolicy(policy: Policy): void;
  addPolicy(policies: Policy[]): void;
  addPolicy(arg0: Policy | Policy[]): void;
  addPolicy(arg0: Policy | Policy[]): any {
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

    this._policies = this._policies.filter(
      policy => toRemovePolicyIdSet.has(policy?.id) === false
    );
  }
}
