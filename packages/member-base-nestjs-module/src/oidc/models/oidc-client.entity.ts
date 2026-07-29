import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const OidcClientRepo = Symbol('OidcClientRepo');

/**
 * A service provider registered against this issuer.
 *
 * Kept separate from oidc_payloads because clients are long-lived
 * administered records rather than expiring artefacts, and because the admin
 * API needs to list and audit them.
 */
@Entity('oidc_clients')
export class OidcClientEntity {
  @PrimaryColumn('varchar', { length: 255 })
  clientId: string;

  /** Null for public clients, which authenticate with PKCE alone. */
  @Column('varchar', { length: 255, nullable: true })
  clientSecret: string | null;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('simple-array')
  redirectUris: string[];

  @Column('simple-array', { nullable: true })
  postLogoutRedirectUris: string[] | null;

  @Column('simple-array', { nullable: true })
  grantTypes: string[] | null;

  @Column('simple-array', { nullable: true })
  responseTypes: string[] | null;

  @Column('varchar', { length: 512, nullable: true })
  scope: string | null;

  /**
   * First-party clients skip the consent screen. Anything third-party must
   * leave this false so the user actually authorises the release of claims.
   */
  @Column('boolean', { default: false })
  skipConsent: boolean;

  @Column('varchar', { length: 64, nullable: true })
  tokenEndpointAuthMethod: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
