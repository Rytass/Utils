export enum SMSRequestResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface SMSSendResponse {
  messageId?: string;
  status: SMSRequestResult;
  mobile: string;
}

export interface SMSRequest {
  mobile: string;
  text: string;
}

export interface MultiTargetRequest {
  mobileList: string[];
  text: string;
}

export interface SMSService<Request extends SMSRequest, SendResponse extends SMSSendResponse, MultiTarget extends MultiTargetRequest> {
  send(request: Request[]): Promise<SendResponse[]>;
  send(request: Request): Promise<SendResponse>;
  send(request: MultiTarget): Promise<SendResponse[]>;
}
