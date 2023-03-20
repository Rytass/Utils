import { PaymentGateway } from '@rytass/payments';
import { EventEmitter } from 'events';
import { HwaNanOrder } from './hwanan-order';
import { HwaNanCommitMessage, HwaNanCreditCardCommitMessage, HwaNanOrderInput } from './typings';

export class HwaNanPayment<CM extends HwaNanCommitMessage = HwaNanCreditCardCommitMessage> implements PaymentGateway<CM, HwaNanOrder<CM>> {
  readonly emitter = new EventEmitter();

  prepare<NCM extends CM>(input: HwaNanOrderInput<NCM>): HwaNanOrder<NCM> {
    return new HwaNanOrder({
      id: '',
      items: [],
      gateway: this,
      makePayload: {},
    }) as HwaNanOrder<NCM>;
  }

  async query<T extends HwaNanOrder<CM>>(id: string, amount: number): Promise<T> {
    throw new Error('Hwa Nan Bank does not support query');
  }
}
