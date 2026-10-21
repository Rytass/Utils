import { FindOptionsWhere } from 'typeorm';
import { parseInboundMessage } from '../inbound/parse-inbound-message';
import {
  TurnkeyReceivedDocumentEntity,
  TurnkeyReceivedDocumentStatus,
} from '../models/turnkey-received-document.entity';
import { TurnkeyMigMessageType } from '../typings/turnkey-enums';

/** 收到的文件 → 我方回覆的訊息與回覆後的狀態 */
export const REPLIES = {
  confirmInvoice: {
    received: TurnkeyMigMessageType.A0101,
    reply: TurnkeyMigMessageType.A0102,
    status: TurnkeyReceivedDocumentStatus.CONFIRMED,
  },
  rejectInvoice: {
    received: TurnkeyMigMessageType.A0101,
    reply: TurnkeyMigMessageType.A0301,
    status: TurnkeyReceivedDocumentStatus.REJECTED,
  },
  confirmInvoiceVoid: {
    received: TurnkeyMigMessageType.A0201,
    reply: TurnkeyMigMessageType.A0202,
    status: TurnkeyReceivedDocumentStatus.CONFIRMED,
  },
  confirmAllowance: {
    received: TurnkeyMigMessageType.B0101,
    reply: TurnkeyMigMessageType.B0102,
    status: TurnkeyReceivedDocumentStatus.CONFIRMED,
  },
  confirmAllowanceVoid: {
    received: TurnkeyMigMessageType.B0201,
    reply: TurnkeyMigMessageType.B0202,
    status: TurnkeyReceivedDocumentStatus.CONFIRMED,
  },
} as const;

export type TurnkeyReplyAction = keyof typeof REPLIES;

export interface ReceivedReplyTarget {
  /** 回覆對應的那一份收件（不含 status） */
  readonly where: FindOptionsWhere<TurnkeyReceivedDocumentEntity>;
  /** 回覆被收下後收件的狀態 */
  readonly repliedStatus: TurnkeyReceivedDocumentStatus;
}

/**
 * 從我方回覆的送件（A0102、A0202、A0301、B0102、B0202）找回對應的收件：
 * 送件只存買方統編與號碼，賣方統編與日期從送出的 XML 取回。不是回覆類送件時回傳 null。
 */
export const findReceivedReplyTarget = (submission: {
  readonly companyTaxId: string;
  readonly messageType: TurnkeyMigMessageType;
  readonly documentNumber: string;
  readonly xml: string;
}): ReceivedReplyTarget | null => {
  const spec = Object.values(REPLIES).find(item => item.reply === submission.messageType);
  const reply = spec ? parseInboundMessage(submission.xml) : null;

  if (!spec || !reply) return null;

  return {
    where: {
      buyerTaxId: submission.companyTaxId,
      sellerTaxId: reply.sellerTaxId,
      messageType: spec.received,
      documentNumber: submission.documentNumber,
      documentDate: reply.documentDate,
    },
    repliedStatus: spec.status,
  };
};
