export { FusionClientModule } from './fusion-client.module';
export { NoopFusionCallLogSink } from './noop-call-log.sink';
export { FUSION_CALL_LOG_SINK, FUSION_CLIENT_OPTIONS } from './constants';
export type {
  FusionCallLogSinkOptions,
  FusionClientModuleAsyncOptions,
  FusionClientModuleConfig,
  FusionClientModuleOptions,
} from './interfaces';

// 便利轉出：消費端多數情況只需要 import 本套件即可拿到 client 與型別。
export {
  buildFindCriteria,
  FusionApiOperation,
  FusionApiOutcome,
  FusionAuthError,
  FusionCustomerAccountService,
  FusionCustomerProfileService,
  FusionFbdiService,
  FusionRestClient,
  FusionSoapClient,
  FusionSoapFaultError,
  FusionTransientError,
  FusionValidationError,
  isFusionRequestError,
} from '@rytass/erp-oracle-fusion';
export type {
  CustomerAccount,
  CustomerAccountInput,
  CustomerAccountSiteInput,
  CustomerProfile,
  CustomerProfileInput,
  FusionAuthConfig,
  FusionCallContext,
  FusionCallLogEntry,
  FusionCallLogSink,
  FusionClientOptions,
  FusionFindCriteriaOptions,
  FusionRequestOptions,
  FusionSoapAttributeError,
  FusionSoapService,
  FusionWriteOptions,
} from '@rytass/erp-oracle-fusion';
