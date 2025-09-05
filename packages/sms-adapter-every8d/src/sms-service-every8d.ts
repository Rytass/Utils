import { normalizedTaiwanMobilePhoneNumber, SMSRequestResult, SMSService, TAIWAN_PHONE_NUMBER_RE } from '@rytass/sms';
import axios from 'axios';
import {
  Every8DError,
  Every8DSMSMultiTargetRequest,
  Every8DSMSRequest,
  Every8DSMSRequestInit,
  Every8DSMSSendResponse,
} from './typings';

export class SMSServiceEvery8D
  implements SMSService<Every8DSMSRequest, Every8DSMSSendResponse, Every8DSMSMultiTargetRequest>
{
  private readonly username: string;
  private readonly password: string;
  private readonly baseUrl: string = 'https://api.e8d.tw';
  private readonly onlyTaiwanMobileNumber: boolean = false;

  constructor(options: Every8DSMSRequestInit) {
    this.username = options.username;
    this.password = options.password;
    this.baseUrl = options.baseUrl || this.baseUrl;
    this.onlyTaiwanMobileNumber = options.onlyTaiwanMobileNumber || this.onlyTaiwanMobileNumber;
  }

  async send(requests: Every8DSMSRequest[]): Promise<Every8DSMSSendResponse[]>;
  async send(request: Every8DSMSRequest): Promise<Every8DSMSSendResponse>;
  async send(request: Every8DSMSMultiTargetRequest): Promise<Every8DSMSSendResponse[]>;

  async send(
    requests: Every8DSMSMultiTargetRequest | Every8DSMSRequest | Every8DSMSRequest[],
  ): Promise<Every8DSMSSendResponse | Every8DSMSSendResponse[]> {
    if (
      (Array.isArray(requests) && !requests.length) ||
      ((requests as Every8DSMSMultiTargetRequest).mobileList &&
        !(requests as Every8DSMSMultiTargetRequest).mobileList?.length)
    ) {
      throw new Error('No target provided.');
    }

    const batches = (Array.isArray(requests) ? requests : [requests]).reduce<Map<string, string[]>>(
      (batchMap, request) => {
        if ((request as Every8DSMSMultiTargetRequest).mobileList) {
          return (request as Every8DSMSMultiTargetRequest).mobileList.reduce<Map<string, string[]>>((batch, mobile) => {
            const targetBatch = batch.get((request as Every8DSMSMultiTargetRequest).text) || [];

            if (TAIWAN_PHONE_NUMBER_RE.test(mobile)) {
              const taiwanMobile = normalizedTaiwanMobilePhoneNumber(mobile);

              batch.set((request as Every8DSMSMultiTargetRequest).text, [...targetBatch, taiwanMobile]);

              return batch;
            } else if (this.onlyTaiwanMobileNumber) {
              throw new Error(`${mobile} is not taiwan mobile phone (\`onlyTaiwanMobileNumber\` option is true)`);
            }

            batch.set((request as Every8DSMSMultiTargetRequest).text, [...targetBatch, mobile]);

            return batch;
          }, batchMap);
        }

        const targetBatch = batchMap.get((request as Every8DSMSRequest).text) || [];

        if (TAIWAN_PHONE_NUMBER_RE.test((request as Every8DSMSRequest).mobile)) {
          const taiwanMobile = normalizedTaiwanMobilePhoneNumber((request as Every8DSMSRequest).mobile);

          batchMap.set((request as Every8DSMSMultiTargetRequest).text, [...targetBatch, taiwanMobile]);

          return batchMap;
        } else if (this.onlyTaiwanMobileNumber) {
          throw new Error(
            `${(request as Every8DSMSRequest).mobile} is not taiwan mobile phone (\`onlyTaiwanMobileNumber\` option is true)`,
          );
        }

        batchMap.set((request as Every8DSMSMultiTargetRequest).text, [
          ...targetBatch,
          (request as Every8DSMSRequest).mobile,
        ]);

        return batchMap;
      },
      new Map<string, string[]>(),
    );

    const result = await Array.from(batches.entries())
      .map(([message, mobileList]) => async (resultMap: Map<string, Every8DSMSSendResponse>) => {
        const { data } = await axios.post<string>(
          `${this.baseUrl}/API21/HTTP/SendSMS.ashx`,
          new URLSearchParams({
            UID: this.username,
            PWD: this.password,
            MSG: message,
            DEST: mobileList.join(','),
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        );

        const [credit, sended, _cost, unsend, batchId] = data.split(/,/);

        if (batchId) {
          return mobileList.reduce((map, mobile, index) => {
            const sent = index < mobileList.length - Number(unsend);

            map.set(`${message}:${mobile}`, {
              messageId: batchId,
              status: sent ? SMSRequestResult.SUCCESS : SMSRequestResult.FAILED,
              mobile,
            } as Every8DSMSSendResponse);

            return map;
          }, resultMap);
        }

        return mobileList.reduce((map, mobile) => {
          map.set(`${message}:${mobile}`, {
            messageId: batchId,
            status: SMSRequestResult.FAILED,
            mobile,
            errorMessage: sended,
            errorCode: Number(credit) as Every8DError,
          } as Every8DSMSSendResponse);

          return map;
        }, resultMap);
      })
      .reduce<Promise<Map<string, Every8DSMSSendResponse>>>(
        (prev, next) => prev.then(next),
        Promise.resolve(new Map<string, Every8DSMSSendResponse>()),
      );

    if ((requests as Every8DSMSMultiTargetRequest).mobileList) {
      return (requests as Every8DSMSMultiTargetRequest).mobileList.map(mobile => {
        const sendMobile = TAIWAN_PHONE_NUMBER_RE.test(mobile) ? normalizedTaiwanMobilePhoneNumber(mobile) : mobile;

        return result.get(`${(requests as Every8DSMSMultiTargetRequest).text}:${sendMobile}`)!;
      });
    }

    if (Array.isArray(requests)) {
      return requests.map(request => {
        const sendMobile = TAIWAN_PHONE_NUMBER_RE.test(request.mobile)
          ? normalizedTaiwanMobilePhoneNumber(request.mobile)
          : request.mobile;

        return result.get(`${request.text}:${sendMobile}`)!;
      });
    }

    return Array.from(result.values())[0];
  }
}
