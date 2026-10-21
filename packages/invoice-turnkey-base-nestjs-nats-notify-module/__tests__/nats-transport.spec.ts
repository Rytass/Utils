import { createNatsTransport } from '../src/transport/nats-transport';

const connection = {
  drain: jest.fn<Promise<void>, []>(),
  close: jest.fn<Promise<void>, []>(),
};

jest.mock('@nats-io/transport-node', () => ({
  connect: jest.fn(async (): Promise<typeof connection> => connection),
}));

jest.mock('@nats-io/jetstream', () => ({
  jetstream: jest.fn((): { publish: jest.Mock } => ({ publish: jest.fn() })),
}));

describe('createNatsTransport close', () => {
  beforeEach((): void => {
    connection.drain.mockReset();
    connection.close.mockReset().mockResolvedValue(undefined);
  });

  it('drains the connection when it is healthy', async (): Promise<void> => {
    connection.drain.mockResolvedValue(undefined);

    const transport = await createNatsTransport({ servers: 'nats://localhost:4222' });

    await transport.close();

    expect(connection.drain).toHaveBeenCalledTimes(1);
    expect(connection.close).not.toHaveBeenCalled();
  });

  it('force closes the connection when drain is rejected while disconnected', async (): Promise<void> => {
    connection.drain.mockRejectedValue(new Error('connection disconnected'));

    const transport = await createNatsTransport({ servers: ['nats://localhost:4222'] });

    await transport.close();

    expect(connection.close).toHaveBeenCalledTimes(1);
  });
});
