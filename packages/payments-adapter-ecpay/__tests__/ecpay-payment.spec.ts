/**
 * @jest-environment jsdom
 */

import request from 'supertest';
import { addMac } from '../__utils__/add-mac';
import http, { createServer, IncomingMessage, ServerResponse } from 'http';
import { ECPayOrder, ECPayPayment, ECPayChannelCreditCard, ECPayCommitMessage, ECPayCallbackPaymentType } from '@rytass/payments-adapter-ecpay';
import { Channel, OrderState, PaymentPeriodType } from '@rytass/payments';

describe('ECPayPayment', () => {
  const originCreateServer = createServer;
  const mockedCreateServer = jest.spyOn(http, 'createServer');

  mockedCreateServer.mockImplementation((requestHandler) => {
    const mockServer = originCreateServer(requestHandler);

    const mockedListen = jest.spyOn(mockServer, 'listen');

    mockedListen.mockImplementationOnce((port?: any, hostname?: any, listeningListener?: () => void) => {
      mockServer.listen(0, listeningListener);

      return mockServer;
    });

    const mockedClose = jest.spyOn(mockServer, 'close');

    mockedClose.mockImplementationOnce((onClosed) => {
      mockServer.close(onClosed);

      return mockServer;
    });

    return mockServer;
  });

  // Form Page HTML
  describe('Generate Form Page HTML', () => {
    const payment = new ECPayPayment();

    const order = payment.prepare<ECPayChannelCreditCard>({
      channel: Channel.CREDIT_CARD,
      items: [{
        name: 'Test',
        unitPrice: 10,
        quantity: 1,
      }, {
        name: '中文',
        unitPrice: 15,
        quantity: 4,
      }],
    });

    document.body.innerHTML = order.formHTML;

    it('should only one form in page', () => {
      expect(document.forms).toHaveLength(1);
    });

    it('should set form submit action target', () => {
      const actionURL = document.forms[0].getAttribute('action');

      expect(actionURL).toMatch(/\/Cashier\/AioCheckOut\/V5$/);
    });

    it('should set form submit method to post', () => {
      const method = document.forms[0].getAttribute('method');

      expect(method).toBe('POST');
    });
  });

  describe('Price amount range', () => {
    it('should throw if total aomunt between 5 and 199999', () => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          items: [{
            name: 'Test',
            unitPrice: 3,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          items: [{
            name: 'Test',
            unitPrice: 200000,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });
  });

  describe('Failed message', () => {
    it('should return null if not failed', () => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>();

      const order = payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test',
          unitPrice: 500,
          quantity: 1,
        }],
      });

      expect(order.state).toBe(OrderState.INITED);
      expect(order.failedMessage).toBeNull();
    });
  });

  describe('Serve checkout server', () => {
    let payment: ECPayPayment<ECPayChannelCreditCard>;

    beforeAll(() => {
      return new Promise<void>((resolve) => {
        payment = new ECPayPayment({
          withServer: true,
          serverHost: 'http://localhost',
          onServerListen: resolve,
        });
      });
    });

    it('should serve checkout url', (done) => {
      const order = payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }, {
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }],
      });

      request(payment._server)
        .get(`/payments/ecpay/checkout/${order.id}`)
        .expect('Content-Type', 'text/html')
        .expect(200)
        .then((res) => {
          expect(res.text).toEqual(order.formHTML);

          done();
        });
    });

    afterAll(() => new Promise(resolve => payment._server?.close(resolve)));
  });

  describe('Serve callback handler server', () => {
    it('should response 404 on undefined path request', (done) => {
      const payment = new ECPayPayment({
        withServer: true,
        serverHost: 'http://localhost:3005',
        onServerListen: () => {
          request(payment._server)
            .get('/payments/ecpay/notAPath')
            .expect(404)
            .then(() => {
              payment._server?.close(done);
            });
        },
      });
    });

    it('should handle successful request', (done) => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>({
        withServer: true,
        serverHost: 'http://localhost:3005',
        onServerListen: () => {
          const order = payment.prepare({
            channel: Channel.CREDIT_CARD,
            items: [{
              name: 'Test',
              unitPrice: 10,
              quantity: 1,
            }, {
              name: '中文',
              unitPrice: 15,
              quantity: 4,
            }],
          });

          // Get HTML to trigger pre commit
          // eslint-disable-next-line no-unused-vars
          const html = order.formHTML;

          const successfulResponse = addMac({
            amount: '70',
            auth_code: '777777',
            card4no: '2222',
            card6no: '431195',
            CustomField1: '',
            CustomField2: '',
            CustomField3: '',
            CustomField4: '',
            eci: '0',
            gwsr: '11943076',
            MerchantID: '2000132',
            MerchantTradeNo: order.id,
            PaymentDate: '2022/04/18 19:15:33',
            PaymentType: 'Credit_CreditCard',
            process_date: '2022/04/18 19:15:33',
            RtnCode: '1',
            RtnMsg: '交易成功',
            SimulatePaid: '0',
            TradeAmt: '70',
            TradeDate: '2022/04/18 19:14:51',
            TradeNo: '2204181914513433',
          });

          request(payment._server)
            .post('/payments/ecpay/callback')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200)
            .then((res) => {
              expect(res.text).toEqual('1|OK');

              payment._server?.close(done);
            });
        },
      });
    });

    it('should reject committed order', (done) => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>({
        withServer: true,
        serverHost: 'http://localhost:3005',
        onServerListen: () => {
          const order = payment.prepare({
            channel: Channel.CREDIT_CARD,
            items: [{
              name: 'Test',
              unitPrice: 10,
              quantity: 1,
            }, {
              name: '中文',
              unitPrice: 15,
              quantity: 4,
            }],
          });

          // Get HTML to trigger pre commit
          // eslint-disable-next-line no-unused-vars
          const html = order.formHTML;

          const successfulResponse = addMac({
            amount: '70',
            auth_code: '777777',
            card4no: '2222',
            card6no: '431195',
            CustomField1: '',
            CustomField2: '',
            CustomField3: '',
            CustomField4: '',
            eci: '0',
            gwsr: '11943076',
            MerchantID: '2000132',
            MerchantTradeNo: order.id,
            PaymentDate: '2022/04/18 19:15:33',
            PaymentType: 'Credit_CreditCard',
            process_date: '2022/04/18 19:15:33',
            RtnCode: '1',
            RtnMsg: '交易成功',
            SimulatePaid: '0',
            TradeAmt: '70',
            TradeDate: '2022/04/18 19:14:51',
            TradeNo: '2204181914513433',
          });

          request(payment._server)
            .post('/payments/ecpay/callback')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200)
            .then((res) => {
              expect(res.text).toEqual('1|OK');

              request(payment._server)
                .post('/payments/ecpay/callback')
                .send(new URLSearchParams(successfulResponse).toString())
                .expect('Content-Type', 'text/plain')
                .expect(400)
                .then((failedResponse) => {
                  expect(failedResponse.text).toEqual('0|OrderNotFound');

                  payment._server?.close(done);
                });
            });
        },
      });
    });

    it('should reject not found order', (done) => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>({
        withServer: true,
        serverHost: 'http://localhost:3005',
        onServerListen: () => {
          const order = payment.prepare({
            channel: Channel.CREDIT_CARD,
            items: [{
              name: 'Test',
              unitPrice: 10,
              quantity: 1,
            }, {
              name: '中文',
              unitPrice: 15,
              quantity: 4,
            }],
          });

          // Get HTML to trigger pre commit
          // eslint-disable-next-line no-unused-vars
          const html = order.formHTML;

          const successfulResponse = addMac({
            amount: '70',
            auth_code: '777777',
            card4no: '2222',
            card6no: '431195',
            CustomField1: '',
            CustomField2: '',
            CustomField3: '',
            CustomField4: '',
            eci: '0',
            gwsr: '11943076',
            MerchantID: '2000132',
            MerchantTradeNo: 'not-found-id',
            PaymentDate: '2022/04/18 19:15:33',
            PaymentType: 'Credit_CreditCard',
            process_date: '2022/04/18 19:15:33',
            RtnCode: '1',
            RtnMsg: '交易成功',
            SimulatePaid: '0',
            TradeAmt: '70',
            TradeDate: '2022/04/18 19:14:51',
            TradeNo: '2204181914513433',
          });

          request(payment._server)
            .post('/payments/ecpay/callback')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(400)
            .then((failedResponse) => {
              expect(failedResponse.text).toEqual('0|OrderNotFound');

              payment._server?.close(done);
            });
        },
      });
    });

    it('should check CheckMacValue on callback payload', (done) => {
      const payment = new ECPayPayment({
        withServer: true,
        serverHost: 'http://localhost:3004',
        onServerListen: () => {
          const successfulResponse = {
            amount: '70',
            auth_code: '777777',
            card4no: '2222',
            card6no: '431195',
            CustomField1: '',
            CustomField2: '',
            CustomField3: '',
            CustomField4: '',
            eci: '0',
            gwsr: '11943076',
            MerchantID: '2000132',
            MerchantTradeNo: 'ORDERID',
            PaymentDate: '2022/04/18 19:15:33',
            PaymentType: 'Credit_CreditCard',
            process_date: '2022/04/18 19:15:33',
            RtnCode: '1',
            RtnMsg: '交易成功',
            SimulatePaid: '0',
            TradeAmt: '70',
            TradeDate: '2022/04/18 19:14:51',
            TradeNo: '2204181914513433',
            CheckMacValue: '3CD5424E742BF5AB43D52A9E43F30F176A655F271730E1F5DBC13A03B346CBDCCCC', // Wrong
          };

          request(payment._server)
            .post('/payments/ecpay/callback')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(400)
            .then((res) => {
              expect(res.text).toEqual('0|CheckSumInvalid');

              payment._server?.close(done);
            });
        },
      });
    });

    it('should order commit with callback server', (done) => {
      const mockedOnCommit = jest.fn<void, [ECPayOrder<ECPayCommitMessage>]>(() => { });

      const payment = new ECPayPayment<ECPayChannelCreditCard>({
        withServer: true,
        serverHost: 'http://localhost:3003',
        onCommit: mockedOnCommit,
        onServerListen: () => {
          const order = payment.prepare({
            channel: Channel.CREDIT_CARD,
            items: [{
              name: 'Test',
              unitPrice: 10,
              quantity: 1,
            }, {
              name: '中文',
              unitPrice: 15,
              quantity: 4,
            }],
          });

          // Get HTML to trigger pre commit
          // eslint-disable-next-line no-unused-vars
          const html = order.formHTML;

          const successfulResponse = addMac({
            amount: '70',
            auth_code: '777777',
            card4no: '2222',
            card6no: '431195',
            CustomField1: '',
            CustomField2: '',
            CustomField3: '',
            CustomField4: '',
            eci: '0',
            gwsr: '11943076',
            MerchantID: '2000132',
            MerchantTradeNo: order.id,
            PaymentDate: '2022/04/18 19:15:33',
            PaymentType: 'Credit_CreditCard',
            process_date: '2022/04/18 19:15:33',
            RtnCode: '1',
            RtnMsg: '交易成功',
            SimulatePaid: '0',
            TradeAmt: '70',
            TradeDate: '2022/04/18 19:14:51',
            TradeNo: '2204181914513433',
          });

          request(payment._server)
            .post('/payments/ecpay/callback')
            .send(new URLSearchParams(successfulResponse).toString())
            .then(() => {
              expect(mockedOnCommit.mock.calls.length).toBe(1);
              expect((mockedOnCommit.mock.calls[0][0] as unknown as ECPayOrder<ECPayCommitMessage>).id).toBe(order.id);

              payment._server?.close(done);
            });
        },
      });
    });
  });

  describe('Custom server listener', () => {
    let payment: ECPayPayment<ECPayChannelCreditCard>;

    const serverListenerMock = jest.fn<void, [IncomingMessage, ServerResponse]>((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
      });

      res.end('1|OK');
    });

    beforeAll(() => {
      return new Promise<void>((resolve) => {
        payment = new ECPayPayment({
          withServer: true,
          serverHost: 'http://localhost:3007',
          onServerListen: resolve,
          serverListener: serverListenerMock,
        });
      });
    });

    it('should provide custom server listener', (done) => {
      const order = payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }, {
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }],
      });

      const successfulResponse = addMac({
        amount: '70',
        auth_code: '777777',
        card4no: '2222',
        card6no: '431195',
        CustomField1: '',
        CustomField2: '',
        CustomField3: '',
        CustomField4: '',
        eci: '0',
        gwsr: '11943076',
        MerchantID: '2000132',
        MerchantTradeNo: order.id,
        PaymentDate: '2022/04/18 19:15:33',
        PaymentType: 'Credit_CreditCard',
        process_date: '2022/04/18 19:15:33',
        RtnCode: '1',
        RtnMsg: '交易成功',
        SimulatePaid: '0',
        TradeAmt: '70',
        TradeDate: '2022/04/18 19:14:51',
        TradeNo: '2204181914513433',
      });

      request(payment._server)
        .get(`/payments/ecpay/callback/${order.id}`)
        .expect(200)
        .then(() => {
          expect(serverListenerMock.mock.calls.length).toBe(1);

          request(payment._server)
            .post('/payments/ecpay/callback')
            .send(new URLSearchParams(successfulResponse).toString())
            .then(async () => {
              expect(serverListenerMock.mock.calls.length).toBe(2);

              done();
            });
        });
    });

    afterAll(() => new Promise(resolve => payment._server?.close(resolve)));
  });

  describe('Memory cards', () => {
    const payment = new ECPayPayment<ECPayChannelCreditCard>();

    it('should memory card only works on credit channel', () => {
      expect(() => {
        payment.prepare({
          // @ts-ignore: Unreachable code error
          channel: Channel.VIRTUAL_ACCOUNT,
          memory: true,
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should reject if no memberId', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          memory: true,
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should memory provide form key', () => {
      const order = payment.prepare({
        channel: Channel.CREDIT_CARD,
        memory: true,
        memberId: 'M_ID',
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      expect(order.form.BindingCard).toBe('1');
      expect(order.form.MerchantMemberID).toBe('M_ID');
    });
  });

  describe('Union Pay', () => {
    const payment = new ECPayPayment<ECPayChannelCreditCard>();

    it('should throw on not credit card channel allow union pay', () => {
      expect(() => {
        payment.prepare({
          // @ts-ignore: Unreachable code error
          channel: Channel.VIRTUAL_ACCOUNT,
          allowUnionPay: true,
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should allow union pay represent on form data', () => {
      const order = payment.prepare({
        channel: Channel.CREDIT_CARD,
        allowUnionPay: true,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      expect(order.form.UnionPay).toBe('0');
    });
  });

  describe('Credit Card Redeem', () => {
    const payment = new ECPayPayment<ECPayChannelCreditCard>();

    it('should throw on not credit card channel allow redeem', () => {
      expect(() => {
        payment.prepare({
          // @ts-ignore: Unreachable code error
          channel: Channel.VIRTUAL_ACCOUNT,
          allowCreditCardRedeem: true,
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should allow union pay represent on form data', () => {
      const order = payment.prepare<ECPayChannelCreditCard>({
        channel: Channel.CREDIT_CARD,
        allowCreditCardRedeem: true,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      expect(order.form.Redeem).toBe('Y');
    });
  });

  describe('Credit Card Installments', () => {
    const payment = new ECPayPayment<ECPayChannelCreditCard>();

    it('should throw on not credit card channel use installments', () => {
      expect(() => {
        payment.prepare({
          // @ts-ignore: Unreachable code error
          channel: Channel.VIRTUAL_ACCOUNT,
          installments: '3,6',
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should throw if allow redeem or period when using installments', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          allowCreditCardRedeem: true,
          installments: '3,6',
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.DAY,
            frequency: 1,
            times: 3,
          },
          installments: '3,6',
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should reject invalid installments format', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          installments: '3,6y',
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          installments: '3,',
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should installments config represent on form data', () => {
      const order = payment.prepare({
        channel: Channel.CREDIT_CARD,
        installments: '3,6',
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      expect(order.form.CreditInstallment).toBe('3,6');
    });
  });

  describe('Credit Card Period Payments', () => {
    const payment = new ECPayPayment<ECPayChannelCreditCard>({
      serverHost: 'http://localhost:9999',
      callbackPath: '/callback',
    });

    it('should throw on not credit card channel use period', () => {
      expect(() => {
        payment.prepare({
          // @ts-ignore: Unreachable code error
          channel: Channel.VIRTUAL_ACCOUNT,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.DAY,
            frequency: 1,
            times: 3,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should represent period form data', () => {
      const order5Days = payment.prepare({
        channel: Channel.CREDIT_CARD,
        period: {
          amountPerPeriod: 100,
          type: PaymentPeriodType.DAY,
          times: 3,
        },
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      expect(order5Days.form.PeriodAmount).toBe('100');
      expect(order5Days.form.PeriodType).toBe('D');
      expect(order5Days.form.Frequency).toBe('1');
      expect(order5Days.form.ExecTimes).toBe('3');
      expect(order5Days.form.PeriodReturnURL).toBe('http://localhost:9999/callback');
      expect(order5Days.form.PeriodReturnURL).toBe(order5Days.form.ReturnURL);

      const order5Months = payment.prepare({
        channel: Channel.CREDIT_CARD,
        period: {
          amountPerPeriod: 100,
          type: PaymentPeriodType.MONTH,
          frequency: 5,
          times: 3,
        },
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      expect(order5Months.form.PeriodType).toBe('M');
      expect(order5Months.form.Frequency).toBe('5');

      const orderYear = payment.prepare({
        channel: Channel.CREDIT_CARD,
        period: {
          amountPerPeriod: 100,
          type: PaymentPeriodType.YEAR,
          frequency: 1,
          times: 3,
        },
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      expect(orderYear.form.PeriodType).toBe('Y');
      expect(orderYear.form.Frequency).toBe('1');
    });

    it('should throw on invalid times provided', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.DAY,
            frequency: 4,
            times: 0,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.DAY,
            frequency: 4,
            times: 1000,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.MONTH,
            frequency: 4,
            times: 100,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.YEAR,
            frequency: 1,
            times: 10,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should throw on invalid frequency provided', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.DAY,
            frequency: 0,
            times: 3,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.DAY,
            frequency: 366,
            times: 3,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.MONTH,
            frequency: 0,
            times: 3,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.MONTH,
            frequency: 13,
            times: 3,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.YEAR,
            frequency: 0,
            times: 3,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          period: {
            amountPerPeriod: 100,
            type: PaymentPeriodType.YEAR,
            frequency: 2,
            times: 3,
          },
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });
  });

  describe('Invalid Payment Type', () => {
    let testPayment: ECPayPayment<ECPayChannelCreditCard>;

    beforeAll(() => new Promise<void>((resolve) => {
      testPayment = new ECPayPayment({
        withServer: true,
        onServerListen: resolve,
      });
    }));

    it('should reject invalid channel on callback', (done) => {
      const order = testPayment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      // Get HTML to trigger pre commit
      // eslint-disable-next-line no-unused-vars
      const html = order.formHTML;

      const successfulResponse = addMac({
        BankCode: '806',
        ExpireDate: '2022/04/27',
        MerchantID: '2000132',
        MerchantTradeNo: order.id,
        PaymentType: 'INVALID_PAYMENT_TYPE',
        RtnCode: '1',
        RtnMsg: 'Get VirtualAccount Succeeded',
        TradeAmt: order.totalPrice.toString(),
        TradeDate: '2022/04/20 17:30:52',
        TradeNo: '2204201729498436',
        vAccount: '3453721178769211',
        StoreID: '',
        CustomField1: '',
        CustomField2: '',
        CustomField3: '',
        CustomField4: '',
      });

      request(testPayment._server)
        .post('/payments/ecpay/callback')
        .send(new URLSearchParams(successfulResponse).toString())
        .expect('Content-Type', 'text/plain')
        .expect(400)
        .then((res) => {
          expect(res.text).toEqual('0|OrderNotFound');

          done();
        });
    });

    afterAll(() => new Promise((resolve) => {
      testPayment._server?.close(resolve);
    }));
  });

  describe('Payment Result Default Handler', () => {
    let testPayment: ECPayPayment<ECPayChannelCreditCard>;

    beforeAll(() => new Promise<void>((resolve) => {
      testPayment = new ECPayPayment({
        withServer: true,
        onServerListen: resolve,
      });
    }));

    it('should no effect if duplicate result callback', (done) => {
      const order = testPayment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      // Get HTML to trigger pre commit
      // eslint-disable-next-line no-unused-vars
      const html = order.formHTML;

      const successfulResponse = addMac({
        amount: '70',
        auth_code: '777777',
        card4no: '2222',
        card6no: '431195',
        CustomField1: '',
        CustomField2: '',
        CustomField3: '',
        CustomField4: '',
        eci: '0',
        gwsr: '11943076',
        MerchantID: '2000132',
        MerchantTradeNo: order.id,
        PaymentDate: '2022/04/18 19:15:33',
        PaymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        process_date: '2022/04/18 19:15:33',
        RtnCode: '2',
        RtnMsg: '交易失敗',
        SimulatePaid: '0',
        TradeAmt: order.totalPrice.toString(),
        TradeDate: '2022/04/18 19:14:51',
        TradeNo: '2204181914513433',
      });

      request(testPayment._server)
        .post('/payments/ecpay/callback')
        .send(new URLSearchParams(successfulResponse).toString())
        .expect('Content-Type', 'text/plain')
        .expect(200)
        .then((res) => {
          expect(res.text).toEqual('1|OK');
          expect(order.state).toBe(OrderState.FAILED);
          expect(order.failedMessage?.code).toBe(2);
          expect(order.failedMessage?.message).toBe('交易失敗');

          done();
        });
    });

    it('should reject if invalid payment type call async info', (done) => {
      const order = testPayment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      // Get HTML to trigger pre commit
      // eslint-disable-next-line no-unused-vars
      const html = order.formHTML;

      const successfulResponse = addMac({
        amount: '70',
        auth_code: '777777',
        card4no: '2222',
        card6no: '431195',
        CustomField1: '',
        CustomField2: '',
        CustomField3: '',
        CustomField4: '',
        eci: '0',
        gwsr: '11943076',
        MerchantID: '2000132',
        MerchantTradeNo: order.id,
        PaymentDate: '2022/04/18 19:15:33',
        PaymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        process_date: '2022/04/18 19:15:33',
        RtnCode: '2',
        RtnMsg: '交易失敗',
        SimulatePaid: '0',
        TradeAmt: order.totalPrice.toString(),
        TradeDate: '2022/04/18 19:14:51',
        TradeNo: '2204181914513433',
      });

      request(testPayment._server)
        .post('/payments/ecpay/async-informations')
        .send(new URLSearchParams(successfulResponse).toString())
        .expect('Content-Type', 'text/plain')
        .expect(400)
        .then((res) => {
          expect(res.text).toEqual('0|OrderNotFound');
          expect(order.state).toBe(OrderState.PRE_COMMIT);

          done();
        });
    });

    afterAll(() => new Promise((resolve) => {
      testPayment._server?.close(resolve);
    }));
  });
});
