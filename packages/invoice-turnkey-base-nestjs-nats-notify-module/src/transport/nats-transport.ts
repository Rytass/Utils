import { connect } from 'nats';
import type { TurnkeyNatsNotifyOptions } from '../typings/turnkey-nats-notify.options';

/** 發布端抽象；方便單元測試替換成假的 client */
export interface NatsTransport {
  /** 送到 JetStream；resolve 代表已收到 publish ack，reject 代表發布失敗 */
  publish(subject: string, payload: string, msgId: string): Promise<void>;
  close(): Promise<void>;
}

export type NatsTransportFactory = (options: TurnkeyNatsNotifyOptions) => Promise<NatsTransport>;

export const createNatsTransport: NatsTransportFactory = async ({ servers, connectionOptions }) => {
  const connection = await connect({
    ...connectionOptions,
    servers: typeof servers === 'string' ? [servers] : [...servers],
  });

  const jetstream = connection.jetstream();

  return {
    publish: async (subject, payload, msgId): Promise<void> => {
      // JetStream 以 msgID 去重（預設去重視窗 2 分鐘）；ack 才代表已落盤
      await jetstream.publish(subject, payload, { msgID: msgId });
    },
    close: async (): Promise<void> => {
      await connection.drain();
    },
  };
};
