import { MultiTargetRequest, SMSRequest, SMSRequestResult, SMSSendResponse } from '@rytass/sms';

export interface Every8DSMSRequestInit {
  username: string;
  password: string;
  baseUrl?: string;
  onlyTaiwanMobileNumber?: boolean;
}

export enum Every8DError {
  UNKNOWN = -99,
}

export interface Every8DSMSSendResponse extends SMSSendResponse {
  messageId?: string;
  status: SMSRequestResult;
  mobile: string;
  errorMessage?: string;
  errorCode?: Every8DError;
}

export interface Every8DSMSRequest extends SMSRequest {
  mobile: string;
  text: string;
}

export interface Every8DSMSMultiTargetRequest extends MultiTargetRequest {
  mobileList: string[];
  text: string;
}
