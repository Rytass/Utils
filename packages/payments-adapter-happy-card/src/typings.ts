import { OrderCommitMessage, PrepareOrderInput } from '@rytass/payments';
import { HappyCardOrderItem } from './happy-card-order-item';
import { HappyCardPayment } from './happy-card-payment';

export interface HappyCardPaymentInitOptions {
  baseUrl?: HappyCardBaseUrls;
  cSource: string;
  key: string;
  posId?: string;
}

export interface HappyCardCommitMessage extends OrderCommitMessage {}

export interface HappyCardOrderInitOptions<
  OCM extends HappyCardCommitMessage = HappyCardCommitMessage,
> {
  id: string;
  items: HappyCardOrderItem[];
  gateway: HappyCardPayment<OCM>;
  createdAt: Date;
  posTradeNo?: string;
  isIsland?: boolean;
  payload: Omit<HappyCardPayRequest, 'basedata'>;
}

export interface HappyCardAPIBaseData {
  check: string;
  source: string;
  version: string;
  store_id: string;
  pos_id: string;
  createdate: string;
  area: number;
}

export enum HappyCardRecordType {
  AMOUNT = 1,
  BONUS = 2,
}

export interface HappyCardUseRecord {
  id: number;
  type?: HappyCardRecordType; // default to 1 (AMOUNT)
  amount: number;
}

export interface HappyCardPayOptions
  extends PrepareOrderInput<HappyCardOrderItem> {
  id?: string;
  posTradeNo?: string;
  uniMemberGID?: string;
  isIsland?: boolean;
  type?: HappyCardRecordType;
  cardSerial: string;
  useRecords: HappyCardUseRecord[];
}

export interface HappyCardPayRequest {
  basedata: HappyCardAPIBaseData;
  trade_date: string;
  request_no: string;
  is_own_cup: 0 | 1;
  cup_count: number;
  pos_trade_no?: string;
  MemberGid?: string;
  card_list: {
    card_sn: string;
    record_list: {
      type: 2;
      amt: number;
      use_limit_date: string;
    }[];
    use_list: {
      record_id: number;
      type: HappyCardRecordType;
      amt: number;
      tax_type: '116' | '117';
    }[];
  }[];
}

export interface HappyCardPayResponse {
  data: {
    trade_date: string;
    request_no: string;
    get_cup_count: number;
    card_list: {
      card_sn: string;
      use_total_amt: number;
      use_total_bonus: number;
      get_total_bonus: number;
    }[];
  };
  resultCode: string;
  resultMsg: string;
}

export interface HappyCardSearchCardRequest {
  basedata: HappyCardAPIBaseData;
  card_sn: string;
}

export interface HappyCardSearchCardResponse {
  data: {
    card_list: {
      orderSn: string;
      card_sn: string;
      memberGid: string;
      productType: '1' | '2' | '3' | '4' | '5' | '6';
      productTypeName: string;
      original_amt: number;
      original_bonus: number;
      amt: number;
      bonus: number;
      is_deposit: 0 | 1;
      deposit_datetime: string | null;
      is_refund: 0 | 1;
      fee: number;
      paymentNo: string;
      itemNo: string;
      resultMsg: string;
      action_list: {
        action_type: 1 | 2 | 3;
        action_no: string;
      }[];
      record_list: {
        record_id: number;
        type: HappyCardRecordType;
        action_no: string | null;
        original_amt: number;
        get_date: string;
        use_limit_date: string;
        amt: number;
      }[];
    }[];
  };
  resultCode: string;
  resultMsg: string;
}

export interface HappyCardRefundRequest {
  basedata: HappyCardAPIBaseData;
  type: 1 | 2;
  card_list: {
    request_no: string;
    pos_trade_no: string;
    card_sn: string;
  }[];
}

export interface HappyCardRefundResponse {
  data: {
    card_list: {
      card_sn: string;
      paymentNo: string;
      record_list: {
        record_id: number;
        type: HappyCardRecordType;
        action_no: string | null;
        original_amt: number;
        get_date: string;
        use_limit_date: string;
        amt: number;
      }[];
    }[];
  };
  resultCode: string;
  resultMsg: string;
}

export interface HappyCardRecord {
  id: number;
  type: HappyCardRecordType;
  amount: number;
}

export enum HappyCardBaseUrls {
  PRODUCTION = 'https://prd-jp-posapi.azurewebsites.net/api/Pos',
  DEVELOPMENT = 'https://uat-pos-api.azurewebsites.net/api/Pos',
}

export enum HappyCardResultCode {
  FAILED = '0',
  SUCCESS = '1',
}
