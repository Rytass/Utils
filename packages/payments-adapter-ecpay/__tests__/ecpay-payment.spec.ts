/**
 * @jest-environment jsdom
 */

import request from 'supertest';
import { createHash } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { ECPayOrder, ECPayPayment, ECPayCallbackPaymentType, ECPayChannelCreditCard, ECPayChannelVirtualAccount, ECPayCommitMessage } from '../src';
import { Channel, OrderState, PaymentPeriodType } from '@rytass/payments';

function addMac(payload: Record<string, string>) {
  const mac = createHash('sha256')
    .update(
      encodeURIComponent(
        [
          ['HashKey', '5294y06JbISpM5x9'],
          ...Object.entries(payload).sort(([aKey], [bKey]) => (aKey.toLowerCase() < bKey.toLowerCase() ? -1 : 1)),
          ['HashIV', 'v77hoKGq4kWxNNIS'],
        ]
          .map(([key, value]) => `${key}=${value}`)
          .join('&'),
      )
        .toLowerCase()
        .replace(/'/g, '%27')
        .replace(/~/g, '%7e')
        .replace(/%20/g, '+'),
    )
    .digest('hex')
    .toUpperCase();

  return {
    ...payload,
    CheckMacValue: mac,
  } as Record<string, string>;
}

describe('ECPayPayment', () => {
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
            .post('/payments/ecpay/checkout')
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
            .post('/payments/ecpay/checkout')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200)
            .then((res) => {
              expect(res.text).toEqual('1|OK');

              request(payment._server)
                .post('/payments/ecpay/checkout')
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
            .post('/payments/ecpay/checkout')
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
            .post('/payments/ecpay/checkout')
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
            .post('/payments/ecpay/checkout')
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
            .post('/payments/ecpay/checkout')
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
        RtnCode: '2',
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

  describe('Virtual account', () => {
    const payment = new ECPayPayment<ECPayChannelVirtualAccount | ECPayChannelCreditCard>({
      serverHost: 'http://localhost:9999',
      callbackPath: '/callback',
    });

    it('should throw error on invalid channel', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          // @ts-ignore: Unreachable code error
          virtualAccountExpireDays: 9,
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should `virtualAccountExpireDays` between 1 and 60', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 0,
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 99,
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should default virtual expire day is 3', () => {
      const order = payment.prepare({
        channel: Channel.VIRTUAL_ACCOUNT,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      expect(order.form.ExpireDate).toBe('3');
    });

    it('should represent virtual account config on form data', () => {
      const order = payment.prepare({
        channel: Channel.VIRTUAL_ACCOUNT,
        virtualAccountExpireDays: 7,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      expect(order.form.ExpireDate).toBe('7');
      expect(order.form.PaymentInfoURL).toBe('http://localhost:9999/callback');
      expect(order.form.ClientRedirectURL).toBe('');

      const clientOrder = payment.prepare({
        channel: Channel.VIRTUAL_ACCOUNT,
        virtualAccountExpireDays: 7,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }],
        clientBackUrl: 'https://rytass.com',
      });

      expect(clientOrder.form.ClientRedirectURL).toBe('https://rytass.com');
    });

    describe('Vistual Account Banks', () => {
      let testPayment: ECPayPayment<ECPayChannelCreditCard | ECPayChannelVirtualAccount>;

      beforeAll(() => new Promise<void>((resolve) => {
        testPayment = new ECPayPayment({
          withServer: true,
          onServerListen: resolve,
        });
      }));

      it('should reject invalid channel type', (done) => {
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
          PaymentType: ECPayCallbackPaymentType.ATM_TAISHIN,
          RtnCode: '2',
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

      it('should default callback handler commit TAISHIN virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
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
          PaymentType: ECPayCallbackPaymentType.ATM_TAISHIN,
          RtnCode: '2',
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
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.COMMITTED);
            expect(order.additionalInfo?.bankCode).toBe('806');
            expect(order.additionalInfo?.account).toBe('3453721178769211');
            expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_TAISHIN);

            done();
          });
      });

      it('should default callback handler commit ESUN virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
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
          PaymentType: ECPayCallbackPaymentType.ATM_ESUN,
          RtnCode: '2',
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
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.COMMITTED);
            expect(order.additionalInfo?.bankCode).toBe('806');
            expect(order.additionalInfo?.account).toBe('3453721178769211');
            expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_ESUN);

            done();
          });
      });

      it('should default callback handler commit BOT virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
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
          PaymentType: ECPayCallbackPaymentType.ATM_BOT,
          RtnCode: '2',
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
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.COMMITTED);
            expect(order.additionalInfo?.bankCode).toBe('806');
            expect(order.additionalInfo?.account).toBe('3453721178769211');
            expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_BOT);

            done();
          });
      });

      it('should default callback handler commit FUBON virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
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
          PaymentType: ECPayCallbackPaymentType.ATM_FUBON,
          RtnCode: '2',
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
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.COMMITTED);
            expect(order.additionalInfo?.bankCode).toBe('806');
            expect(order.additionalInfo?.account).toBe('3453721178769211');
            expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_FUBON);

            done();
          });
      });

      it('should default callback handler commit CHINATRUST virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
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
          PaymentType: ECPayCallbackPaymentType.ATM_CHINATRUST,
          RtnCode: '2',
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
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.COMMITTED);
            expect(order.additionalInfo?.bankCode).toBe('806');
            expect(order.additionalInfo?.account).toBe('3453721178769211');
            expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_CHINATRUST);

            done();
          });
      });

      it('should default callback handler commit FIRST virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
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
          PaymentType: ECPayCallbackPaymentType.ATM_FIRST,
          RtnCode: '2',
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
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.COMMITTED);
            expect(order.additionalInfo?.bankCode).toBe('806');
            expect(order.additionalInfo?.account).toBe('3453721178769211');
            expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_FIRST);

            done();
          });
      });

      it('should default callback handler commit LAND virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
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
          PaymentType: ECPayCallbackPaymentType.ATM_LAND,
          RtnCode: '2',
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
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.COMMITTED);
            expect(order.additionalInfo?.bankCode).toBe('806');
            expect(order.additionalInfo?.account).toBe('3453721178769211');
            expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_LAND);

            done();
          });
      });

      it('should default callback handler commit CATHAY virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
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
          PaymentType: ECPayCallbackPaymentType.ATM_CATHAY,
          RtnCode: '2',
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
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.COMMITTED);
            expect(order.additionalInfo?.bankCode).toBe('806');
            expect(order.additionalInfo?.account).toBe('3453721178769211');
            expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_CATHAY);

            done();
          });
      });

      it('should default callback handler commit TACHONG virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
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
          PaymentType: ECPayCallbackPaymentType.ATM_TACHONG,
          RtnCode: '2',
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
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.COMMITTED);
            expect(order.additionalInfo?.bankCode).toBe('806');
            expect(order.additionalInfo?.account).toBe('3453721178769211');
            expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_TACHONG);

            done();
          });
      });

      it('should default callback handler commit PANHSIN virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
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
          PaymentType: ECPayCallbackPaymentType.ATM_PANHSIN,
          RtnCode: '2',
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
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.COMMITTED);
            expect(order.additionalInfo?.bankCode).toBe('806');
            expect(order.additionalInfo?.account).toBe('3453721178769211');
            expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_PANHSIN);

            done();
          });
      });

      afterAll(() => new Promise((resolve) => {
        testPayment._server?.close(resolve);
      }));
    });
  });
});
