import axios from 'axios';
import { ErrorCode, LogisticsError } from '@rytass/logistics';
import { CtcLogisticsService, CtcLogistics } from '../src';

describe('delivery-adapter-ctc', () => {
  // const get = jest.spyOn(axios, 'get');

  it('should trace single logistic', async () => {
    const logisticsService = new CtcLogisticsService(CtcLogistics);
    const logisticId = ['R25061100008'];

    // get.mockImplementationOnce(async (url: string) => {
    //   expect(url).toEqual(traceUrl(logisticId));

    // });
    try {
      const result = await logisticsService.trace(logisticId);

      console.log(`result: ${JSON.stringify(result)}`);

    } catch (error) {
      console.error(`Error occurred: ${error instanceof LogisticsError ? error.message : error}`);
    }

  });
});
