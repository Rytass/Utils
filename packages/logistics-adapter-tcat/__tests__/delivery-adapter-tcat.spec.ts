import axios from 'axios';
import { ErrorCode, LogisticsError } from '@rytass/logistics';
import { TCatLogisticsService, TCatLogistics, TCatLogisticsStatusHistory, TCatLogisticsStatus } from '../src';
import { TraceCases } from './delivery-adapter-tcat-config.config';

describe('delivery-adapter-tcat', () => {
  const get = jest.spyOn(axios, 'get');
  const traceUrl = (id: string) =>
    `https://www.t-cat.com.tw/Inquire/TraceDetail.aspx?BillID=${id}&ReturnUrl=Trace.aspx`;

  it('should trace single logistic', () => {
    const logistics = new TCatLogisticsService(TCatLogistics);
    const [logisticId] = Object.keys(TraceCases);
    const [resultPage] = Object.values(TraceCases);

    get.mockImplementationOnce(async (url: string) => {
      expect(url).toEqual(traceUrl(logisticId));

      return { data: resultPage };
    });

    logistics.trace(logisticId).then((responses) => {
      responses.map((response) => {
        expect(response.logisticsId).toEqual(logisticId);
        (response.statusHistory as TCatLogisticsStatusHistory<TCatLogisticsStatus>[]).map((history, index) => {
          switch (index) {
            case 0:
              expect(history.businessPremise).toEqual('伊通營業所');
              expect(history.date).toEqual('2022/12/01 16:14');
              expect(history.status).toEqual('DELIVERED');
              break;
            case 1:
              expect(history.businessPremise).toEqual('伊通營業所');
              expect(history.date).toEqual('2022/12/01 16:14');
              expect(history.status).toEqual('DELIVERING');
              break;
            case 2:
              expect(history.businessPremise).toEqual('伊通營業所');
              expect(history.date).toEqual('2022/12/01 07:11');
              expect(history.status).toEqual('DELIVERING');
              break;
            case 3:
              expect(history.businessPremise).toEqual('北三特販一所');
              expect(history.date).toEqual('2022/11/30 19:54');
              expect(history.status).toEqual('CONSOLIDATED');
              break;
          }
        });
      });
    });
  });

  it('should trace multiple logistics', () => {
    const logistics = new TCatLogisticsService({
      ...TCatLogistics,
      ignoreNotFound: true,
    });

    const logisticIds = Object.keys(TraceCases);

    get.mockImplementation(async (url) => {
      const [logisticId] = logisticIds.filter(id => url.includes(id));

      return {
        data: TraceCases[logisticId as unknown as keyof typeof TraceCases],
      };
    });

    logistics.trace(logisticIds).then((responses) => {
      responses.map((response) => {
        switch (response.logisticsId) {
          case '800978442950':
            (response.statusHistory as TCatLogisticsStatusHistory<TCatLogisticsStatus>[]).map((history, index) => {
              switch (index) {
                case 0:
                  expect(history.businessPremise).toEqual('伊通營業所');
                  expect(history.date).toEqual('2022/04/26 14:41');
                  expect(history.status).toEqual('DELIVERED');
                  break;
                case 1:
                  expect(history.businessPremise).toEqual('伊通營業所');
                  expect(history.date).toEqual('2022/04/26 14:40');
                  expect(history.status).toEqual('DELIVERING');
                  break;
                case 2:
                  expect(history.businessPremise).toEqual('北一區轉運中心');
                  expect(history.date).toEqual('2022/04/26 11:48');
                  expect(history.status).toEqual('TRANSPORTING');
                  break;
                case 3:
                  expect(history.businessPremise).toEqual('北二特販一所');
                  expect(history.date).toEqual('2022/04/26 10:33');
                  expect(history.status).toEqual('CONSOLIDATED');
                  break;
              }
            });

            break;

          case '903404283301':
            (response.statusHistory as TCatLogisticsStatusHistory<TCatLogisticsStatus>[]).map((history, index) => {
              switch (index) {
                case 0:
                  expect(history.businessPremise).toEqual('竹圍營業所');
                  expect(history.date).toEqual('2022/05/27 09:01');
                  expect(history.status).toEqual('DELIVERED');
                  break;
                case 1:
                  expect(history.businessPremise).toEqual('竹圍營業所');
                  expect(history.date).toEqual('2022/05/27 07:55');
                  expect(history.status).toEqual('DELIVERING');
                  break;
                case 2:
                  expect(history.businessPremise).toEqual('北一區轉運中心');
                  expect(history.date).toEqual('2022/05/26 20:28');
                  expect(history.status).toEqual('TRANSPORTING');
                  break;
                case 3:
                  expect(history.businessPremise).toEqual('北三特販二所');
                  expect(history.date).toEqual('2022/05/26 14:19');
                  expect(history.status).toEqual('CONSOLIDATED');
                  break;
              }
            });

            break;
        }
      });
    });
  });

  it('should throw not found error', () => {
    const logistics = new TCatLogisticsService(TCatLogistics);
    const logisticId = 'notExsited';

    get.mockImplementationOnce(async (url: string) => {
      expect(url).toEqual(traceUrl('notExisted'));

      return { data: TraceCases['notExisted'] };
    });

    logistics.trace('notExisted').catch((error: LogisticsError) => {
      expect(error.code).toEqual(ErrorCode.NOT_FOUND_ERROR);
    });
  });
});
