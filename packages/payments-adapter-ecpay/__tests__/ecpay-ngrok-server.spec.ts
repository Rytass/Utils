/**
 * @jest-environment node
 */

import ngrok from 'ngrok';
import { ECPayPayment } from '../src';

describe('ECPayPayment Ngrok binding', () => {
  const mockConnect = jest.spyOn(ngrok, 'connect');

  mockConnect.mockImplementation(async () => {
    return 'http://127.0.0.1';
  });

  it('should connect to ngrok', (done) => {
    const payment = new ECPayPayment({
      withServer: 'ngrok',
      onServerListen: () => {
        expect(mockConnect).toBeCalled();

        payment._server?.close(done);
      },
    });
  });

  it('should connect to ngrok with custom port', (done) => {
    const payment = new ECPayPayment({
      withServer: 'ngrok',
      serverHost: 'http://0.0.0.0',
      onServerListen: () => {
        expect(mockConnect).toBeCalled();

        payment._server?.close(done);
      },
    });
  });
});
