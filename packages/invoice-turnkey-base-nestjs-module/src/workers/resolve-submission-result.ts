import { TurnkeySubmissionStatus } from '../typings/turnkey-enums';
import { TurnkeyUpCastRecord } from './turnkey-log-reader';

export const ACCEPTED_CODE = '00000';
/** 平台判定重複，表示先前已收下 */
export const DUPLICATE_CODE = 'E0201';

/** Turnkey 本機就擋下（沒送到平台）的步驟 */
const LOCAL_TASKS = new Set(['UpCast', 'Pack']);

export interface SubmissionResult {
  readonly status: TurnkeySubmissionStatus.ACCEPTED | TurnkeySubmissionStatus.REJECTED | TurnkeySubmissionStatus.FAILED;
  readonly code: string;
  readonly message: string | null;
}

const CODE_PATTERN = /\[(E\d{4}|\d{4})\]/;

/** 從 sysevent 訊息擷取 [E1002]、[7001] 這類代碼；沒有就用 errorcode（例如 -002 空檔） */
export const extractErrorCode = (
  events: TurnkeyUpCastRecord['events'],
): { readonly code: string; readonly message: string | null } => {
  const coded = events.find(event => CODE_PATTERN.test(event.message));

  if (coded) {
    return { code: (CODE_PATTERN.exec(coded.message) as RegExpExecArray)[1], message: coded.message };
  }

  const last = events[events.length - 1];

  return { code: last?.errorCode ?? 'UNKNOWN', message: last?.message || null };
};

/** null 表示還在處理中 */
export const resolveSubmissionResult = (record: TurnkeyUpCastRecord | null): SubmissionResult | null => {
  if (!record) return null;

  if (record.status === 'C') {
    return { status: TurnkeySubmissionStatus.ACCEPTED, code: ACCEPTED_CODE, message: null };
  }

  if (record.status !== 'E') return null;

  const { code, message } = extractErrorCode(record.events);

  if (code === DUPLICATE_CODE) {
    return { status: TurnkeySubmissionStatus.ACCEPTED, code, message };
  }

  // E0145（平台拒收檔案）與本機各步驟的錯誤都屬於沒送進平台
  const isLocal = (record.failedTask !== null && LOCAL_TASKS.has(record.failedTask)) || code === 'E0145';

  return { status: isLocal ? TurnkeySubmissionStatus.FAILED : TurnkeySubmissionStatus.REJECTED, code, message };
};
