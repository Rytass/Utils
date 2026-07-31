// OpenID Connect provider endpoint.
//
// Isolated behind its own entry point so `oidc-provider` and the two tables it
// needs only exist for applications that actually issue identities. Importing
// the package root never reaches this module.
export { MemberBaseOidcProviderModule } from './oidc/oidc-provider.module';
export { mountMemberBaseOidcProvider } from './oidc/mount-oidc-provider';

export { OidcSsoBridge, type LocalSessionClaims } from './oidc/sso-bridge.service';
export { OidcMaintenanceService } from './oidc/oidc-maintenance.service';
export {
  OidcInteractionsController,
  type OidcInteractionDetailsView,
  type OidcConsentBody,
  type OidcAbortBody,
} from './oidc/interactions.controller';
export { OidcAdminController, type OidcClientView, type UpsertOidcClientBody } from './oidc/oidc-admin.controller';

export { OidcPayloadEntity, OidcPayloadRepo } from './oidc/models/oidc-payload.entity';
export { OidcClientEntity, OidcClientRepo } from './oidc/models/oidc-client.entity';
export { MemberBaseOidcModelsModule } from './oidc/models/oidc-models.module';

export {
  createOidcAdapterFactory,
  purgeExpiredOidcPayloads,
  countNonExpiringOidcPayloads,
  type OidcAdapter,
  type OidcAdapterConstructor,
  type AdapterPayload,
} from './oidc/oidc-adapter';

export { renderDefaultLoginPage } from './oidc/default-login-page';
export { renderDefaultConsentPage } from './oidc/default-consent-page';
export { escapeHtml } from './oidc/escape-html';

export { MEMBER_BASE_OIDC_OPTIONS, OIDC_PROVIDER_INSTANCE, OIDC_ROUTE_PREFIX } from './oidc/oidc.tokens';

export type {
  MemberBaseOidcProviderOptions,
  MemberBaseOidcProviderAsyncOptions,
  MemberBaseOidcProviderOptionsFactory,
  OidcInteractionOptions,
  OidcInteractionPageParams,
  OidcInteractionPageUrl,
  OidcLoginRenderParams,
  OidcConsentRenderParams,
  OidcClaimsOptions,
  OidcSsoBridgeOptions,
} from './oidc/oidc-provider.options';

export type {
  OidcProviderLike,
  OidcInteractionDetails,
  OidcInteractionResultOptions,
  OidcPromptDetails,
  OidcAccount,
  OidcGrant,
  OidcGrantConstructor,
  FindAccountFn,
} from './oidc/oidc.factory';
