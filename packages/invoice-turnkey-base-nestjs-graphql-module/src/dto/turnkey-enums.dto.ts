import { registerEnumType } from '@nestjs/graphql';
import {
  TurnkeyAllowanceStatus,
  TurnkeyCarrierType,
  TurnkeyCustomsClearance,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceStatus,
  TurnkeyMessageCategory,
  TurnkeyMigMessageType,
  TurnkeyNumberStatus,
  TurnkeyReceivedDocumentStatus,
  TurnkeySubmissionStatus,
  TurnkeyTaxType,
} from '@rytass/invoice-turnkey-base-nestjs-module';

registerEnumType(TurnkeyDeliveryMode, { name: 'TurnkeyDeliveryMode' });
registerEnumType(TurnkeyInvoiceStatus, { name: 'TurnkeyInvoiceStatus' });
registerEnumType(TurnkeyAllowanceStatus, { name: 'TurnkeyAllowanceStatus' });
registerEnumType(TurnkeyTaxType, { name: 'TurnkeyTaxType' });
registerEnumType(TurnkeyCarrierType, { name: 'TurnkeyCarrierType' });
registerEnumType(TurnkeyCustomsClearance, { name: 'TurnkeyCustomsClearance' });
registerEnumType(TurnkeySubmissionStatus, { name: 'TurnkeySubmissionStatus' });
registerEnumType(TurnkeyMigMessageType, { name: 'TurnkeyMigMessageType' });
registerEnumType(TurnkeyMessageCategory, { name: 'TurnkeyMessageCategory' });
registerEnumType(TurnkeyReceivedDocumentStatus, { name: 'TurnkeyReceivedDocumentStatus' });
registerEnumType(TurnkeyNumberStatus, { name: 'TurnkeyNumberStatus' });
