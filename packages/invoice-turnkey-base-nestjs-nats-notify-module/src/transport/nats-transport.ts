import { connect } from '@nats-io/transport-node';
import { jetstream } from '@nats-io/jetstream';
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

  const js = jetstream(connection);

  return {
    publish: async (subject, payload, msgId): Promise<void> => {
      // JetStream 以 msgID 去重（預設去重視窗 2 分鐘）；ack 才代表已落盤
      await js.publish(subject, payload, { msgID: msgId });
    },
    close: async (): Promise<void> => {
      // 斷線中 drain() 會 reject 且連線仍在背景重連；改用 close() 確實關閉，避免每次中斷殘留一條連線
      await connection.drain().catch(() => connection.close());
    },
  };
};
