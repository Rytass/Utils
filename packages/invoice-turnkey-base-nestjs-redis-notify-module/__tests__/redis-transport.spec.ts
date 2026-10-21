import { createRedisTransport } from '../src/transport/redis-transport';

const client = {
  on: jest.fn(),
  quit: jest.fn<Promise<'OK'>, []>(),
  disconnect: jest.fn<void, []>(),
};

jest.mock('ioredis', () => ({
  Redis: jest.fn((): typeof client => client),
}));

describe('createRedisTransport close', () => {
  beforeEach((): void => {
    client.quit.mockReset();
    client.disconnect.mockReset();
  });

  it('quits the connection when it is healthy', async (): Promise<void> => {
    client.quit.mockResolvedValue('OK');

    const transport = await createRedisTransport({ redis: 'redis://localhost:6379' });

    await transport.close();

    expect(client.quit).toHaveBeenCalledTimes(1);
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects when quit fails while reconnecting', async (): Promise<void> => {
    client.quit.mockRejectedValue(new Error('Command timed out'));

    const transport = await createRedisTransport({ redis: 'redis://localhost:6379' });

    await transport.close();

    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });
});
