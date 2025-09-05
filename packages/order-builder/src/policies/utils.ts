import { uuid } from '../utils/uuid';

/** Generate a new Policy unique Id */
export function generateNewPolicyId(): string {
  return `POLICY:${uuid()}`;
}
