import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export const OidcPayloadRepo = Symbol('OidcPayloadRepo');

/**
 * Single table backing every short-lived artefact oidc-provider persists:
 * sessions, grants, authorization codes, access/refresh tokens, interactions,
 * device codes. The provider addresses them all through one Adapter interface
 * keyed by (model name, id), so one table matches the contract exactly.
 *
 * Only created when the OIDC provider module is imported, which is what keeps
 * the endpoint opt-in at the schema level.
 */
@Entity('oidc_payloads')
export class OidcPayloadEntity {
  /** oidc-provider model name: 'Session', 'AccessToken', 'Grant', ... */
  @PrimaryColumn('varchar', { length: 64 })
  model: string;

  @PrimaryColumn('varchar', { length: 255 })
  id: string;

  @Column('jsonb')
  payload: Record<string, unknown>;

  /** Set on grant-issued artefacts so revoking a grant can cascade. */
  @Column('varchar', { length: 255, nullable: true })
  @Index()
  grantId: string | null;

  /** Device flow user code. */
  @Column('varchar', { length: 255, nullable: true })
  @Index()
  userCode: string | null;

  /** Session uid, used to look a session up independently of its id. */
  @Column('varchar', { length: 255, nullable: true })
  @Index()
  uid: string | null;

  @Column('timestamptz', { nullable: true })
  @Index()
  expiresAt: Date | null;

  /** Marks single-use artefacts (authorization codes) as spent. */
  @Column('timestamptz', { nullable: true })
  consumedAt: Date | null;
}
