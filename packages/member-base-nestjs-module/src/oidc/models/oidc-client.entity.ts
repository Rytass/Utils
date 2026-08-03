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
  /**
   * Stays bounded: it is the primary key, and a btree index key has a hard
   * limit of its own. 255 is far past any real client id and turns an absurd
   * one into a clear rejection rather than an index-level failure.
   */
  @PrimaryColumn('varchar', { length: 255 })
  clientId: string;

  /**
   * Null for public clients, which authenticate with PKCE alone.
   *
   * `text` rather than a bounded varchar: with `clients.secretCipher` the
   * stored value is whatever the application's cipher produces, and a package
   * cannot know how long that is. A KMS ciphertext blob overruns 255 on its
   * own. Postgres stores the two identically, so the bound bought nothing.
   */
  @Column('text', { nullable: true })
  clientSecret: string | null;

  /** Free text supplied by whoever registers the client. */
  @Column('text')
  name: string;

  @Column('simple-array')
  redirectUris: string[];

  @Column('simple-array', { nullable: true })
  postLogoutRedirectUris: string[] | null;

  @Column('simple-array', { nullable: true })
  grantTypes: string[] | null;

  @Column('simple-array', { nullable: true })
  responseTypes: string[] | null;

  /** Space-delimited, and a client with many resource scopes outgrows any bound. */
  @Column('text', { nullable: true })
  scope: string | null;

  /**
   * First-party clients skip the consent screen. Anything third-party must
   * leave this false so the user actually authorises the release of claims.
   */
  @Column('boolean', { default: false })
  skipConsent: boolean;

  /** Also bounded: the values are a fixed set the specs define, none over 30 characters. */
  @Column('varchar', { length: 64, nullable: true })
  tokenEndpointAuthMethod: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
