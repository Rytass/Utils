/**
 * @jest-environment node
 */

import { SMSRequestResult } from '@rytass/sms';
import axios from 'axios';
import { Every8DError, SMSServiceEvery8D } from '../src';

describe('SMSServiceEvery8D', () => {
  const post = jest.spyOn(axios, 'post');

  const smsService = new SMSServiceEvery8D({
    username: 'uuuuu',
    password: 'pwpwpw',
  });

  it('should every8d send sms', done => {
    post.mockImplementationOnce(async (url: string, data: unknown) => {
      expect(url).toEqual('https://api.e8d.tw/API21/HTTP/SendSMS.ashx');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        UID: string;
        PWD: string;
        MSG: string;
        DEST: string;
      };

      expect(params.UID).toEqual('uuuuu');
      expect(params.PWD).toEqual('pwpwpw');
      expect(params.MSG).toEqual('Testing');
      expect(params.DEST).toEqual('0969999999');

      return { data: '80.00,1,1,0,b6fbd168-90b7-4119-9e24-87aaeebf6298' };
    });

    smsService
      .send({
        mobile: '0969999999',
        text: 'Testing',
      })
      .then(response => {
        expect(response.errorCode).toBeUndefined();
        expect(response.errorMessage).toBeUndefined();
        expect(response.status).toBe(SMSRequestResult.SUCCESS);
        expect(response.mobile).toBe('0969999999');
        expect(response.messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6298');

        done();
      });
  });

  it('should send batch request', done => {
    post.mockImplementation(async (url: string, data: unknown) => {
      expect(url).toEqual('https://api.e8d.tw/API21/HTTP/SendSMS.ashx');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        UID: string;
        PWD: string;
        MSG: string;
        DEST: string;
      };

      expect(params.UID).toEqual('uuuuu');
      expect(params.PWD).toEqual('pwpwpw');
      expect(params.MSG).toEqual('Testing');
      expect(params.DEST).toEqual('0969999999,0969999998');

      return { data: '80.00,2,2,0,b6fbd168-90b7-4119-9e24-87aaeebf6299' };
    });

    Promise.all([
      smsService.send([
        {
          mobile: '0969999999',
          text: 'Testing',
        },
        {
          mobile: '0969999998',
          text: 'Testing',
        },
      ]),
      smsService.send({
        mobileList: ['0969999999', '0969999998'],
        text: 'Testing',
      }),
    ]).then(([responsesA, responsesB]) => {
      expect(responsesA.length).toBe(2);

      expect(responsesA[0].errorCode).toBeUndefined();
      expect(responsesA[0].errorMessage).toBeUndefined();
      expect(responsesA[0].status).toBe(SMSRequestResult.SUCCESS);
      expect(responsesA[0].mobile).toBe('0969999999');
      expect(responsesA[0].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6299');

      expect(responsesA[1].errorCode).toBeUndefined();
      expect(responsesA[1].errorMessage).toBeUndefined();
      expect(responsesA[1].status).toBe(SMSRequestResult.SUCCESS);
      expect(responsesA[1].mobile).toBe('0969999998');
      expect(responsesA[1].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6299');

      expect(responsesB.length).toBe(2);

      expect(responsesB[0].errorCode).toBeUndefined();
      expect(responsesB[0].errorMessage).toBeUndefined();
      expect(responsesB[0].status).toBe(SMSRequestResult.SUCCESS);
      expect(responsesB[0].mobile).toBe('0969999999');
      expect(responsesB[0].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6299');

      expect(responsesB[1].errorCode).toBeUndefined();
      expect(responsesB[1].errorMessage).toBeUndefined();
      expect(responsesB[1].status).toBe(SMSRequestResult.SUCCESS);
      expect(responsesB[1].mobile).toBe('0969999998');
      expect(responsesB[1].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6299');

      done();
    });
  });

  it('should send batch request with difference message', done => {
    post.mockImplementation(async (url: string, data: unknown) => {
      expect(url).toEqual('https://api.e8d.tw/API21/HTTP/SendSMS.ashx');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        UID: string;
        PWD: string;
        MSG: string;
        DEST: string;
      };

      expect(params.UID).toEqual('uuuuu');
      expect(params.PWD).toEqual('pwpwpw');

      if (params.MSG === 'Testing1') {
        expect(params.MSG).toEqual('Testing1');
        expect(params.DEST).toEqual('0969999999');
      } else {
        expect(params.MSG).toEqual('Testing2');
        expect(params.DEST).toEqual('0969999998');
      }

      return { data: '80.00,1,1,0,b6fbd168-90b7-4119-9e24-87aaeebf6299' };
    });

    smsService
      .send([
        {
          mobile: '0969999999',
          text: 'Testing1',
        },
        {
          mobile: '0969999998',
          text: 'Testing2',
        },
      ])
      .then(responses => {
        expect(responses.length).toBe(2);

        expect(responses[0].errorCode).toBeUndefined();
        expect(responses[0].errorMessage).toBeUndefined();
        expect(responses[0].status).toBe(SMSRequestResult.SUCCESS);
        expect(responses[0].mobile).toBe('0969999999');
        expect(responses[0].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6299');

        expect(responses[1].errorCode).toBeUndefined();
        expect(responses[1].errorMessage).toBeUndefined();
        expect(responses[1].status).toBe(SMSRequestResult.SUCCESS);
        expect(responses[1].mobile).toBe('0969999998');
        expect(responses[1].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6299');

        done();
      });
  });

  it('should receive format error', done => {
    post.mockImplementationOnce(async (url: string, data: unknown) => {
      expect(url).toEqual('https://api.e8d.tw/API21/HTTP/SendSMS.ashx');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        UID: string;
        PWD: string;
        MSG: string;
        DEST: string;
      };

      expect(params.UID).toEqual('uuuuu');
      expect(params.PWD).toEqual('pwpwpw');
      expect(params.MSG).toEqual('Testing1');
      expect(params.DEST).toEqual('+1-202-895-1800');

      return { data: `-306,手機格式不符:${params.DEST}` };
    });

    smsService
      .send({
        mobile: '+1-202-895-1800',
        text: 'Testing1',
      })
      .then(response => {
        expect(response.errorCode).toBe(Every8DError.FORMAT_ERROR);
        expect(response.errorMessage).toBe('手機格式不符:+1-202-895-1800');
        expect(response.status).toBe(SMSRequestResult.FAILED);
        expect(response.mobile).toBe('+1-202-895-1800');
        expect(response.messageId).toBeUndefined();

        done();
      });
  });

  it('should receive partial error', done => {
    post.mockImplementation(async (url: string, data: unknown) => {
      expect(url).toEqual('https://api.e8d.tw/API21/HTTP/SendSMS.ashx');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        UID: string;
        PWD: string;
        MSG: string;
        DEST: string;
      };

      expect(params.UID).toEqual('uuuuu');
      expect(params.PWD).toEqual('pwpwpw');
      expect(params.MSG).toEqual('Testing1');
      expect(params.DEST).toEqual('+1-202-895-1800,0972222223,0972222222');

      return { data: '80.00,3,1,2,b6fbd168-90b7-4119-9e24-87aaeebf6230' };
    });

    smsService
      .send({
        mobileList: ['+1-202-895-1800', '0972-222-223', '0972222222'],
        text: 'Testing1',
      })
      .then(responses => {
        expect(responses[0].errorCode).toBeUndefined();
        expect(responses[0].errorMessage).toBeUndefined();
        expect(responses[0].status).toBe(SMSRequestResult.SUCCESS);
        expect(responses[0].mobile).toBe('+1-202-895-1800');
        expect(responses[0].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6230');

        expect(responses[1].errorCode).toBeUndefined();
        expect(responses[1].errorMessage).toBeUndefined();
        expect(responses[1].status).toBe(SMSRequestResult.FAILED);
        expect(responses[1].mobile).toBe('0972222223');
        expect(responses[1].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6230');

        expect(responses[2].errorCode).toBeUndefined();
        expect(responses[2].errorMessage).toBeUndefined();
        expect(responses[2].status).toBe(SMSRequestResult.FAILED);
        expect(responses[2].mobile).toBe('0972222222');
        expect(responses[2].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6230');

        done();
      });
  });

  it('should send to oversea number', done => {
    post.mockImplementation(async (url: string, data: unknown) => {
      expect(url).toEqual('https://api.e8d.tw/API21/HTTP/SendSMS.ashx');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        UID: string;
        PWD: string;
        MSG: string;
        DEST: string;
      };

      expect(params.UID).toEqual('uuuuu');
      expect(params.PWD).toEqual('pwpwpw');
      expect(params.MSG).toEqual('Testing1');
      expect(params.DEST).toEqual('+1-202-895-1800');

      return { data: '80.00,1,1,0,b6fbd168-90b7-4119-9e24-87aaeebf6230' };
    });

    Promise.all([
      smsService.send([
        {
          mobile: '+1-202-895-1800',
          text: 'Testing1',
        },
      ]),
      smsService.send({
        mobileList: ['+1-202-895-1800'],
        text: 'Testing1',
      }),
    ]).then(([responseA, responseB]) => {
      expect(responseA[0].errorCode).toBeUndefined();
      expect(responseA[0].errorMessage).toBeUndefined();
      expect(responseA[0].status).toBe(SMSRequestResult.SUCCESS);
      expect(responseA[0].mobile).toBe('+1-202-895-1800');
      expect(responseA[0].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6230');

      expect(responseB[0].errorCode).toBeUndefined();
      expect(responseB[0].errorMessage).toBeUndefined();
      expect(responseB[0].status).toBe(SMSRequestResult.SUCCESS);
      expect(responseB[0].mobile).toBe('+1-202-895-1800');
      expect(responseB[0].messageId).toBe('b6fbd168-90b7-4119-9e24-87aaeebf6230');

      done();
    });
  });

  it('should block oversea phone number if `onlyTaiwanMobileNumber` set', () => {
    const smsTaiwanService = new SMSServiceEvery8D({
      username: 'uuuuu',
      password: 'pwpwpw',
      onlyTaiwanMobileNumber: true,
    });

    expect(
      smsTaiwanService.send({
        mobile: '+1-202-895-1800',
        text: 'Testing1',
      }),
    ).rejects.toThrow();

    expect(
      smsTaiwanService.send([
        {
          mobile: '+1-202-895-1800',
          text: 'Testing1',
        },
      ]),
    ).rejects.toThrow();

    expect(
      smsTaiwanService.send([
        {
          mobile: '+886-958-999-999',
          text: 'Testing1',
        },
        {
          mobile: '+1-202-895-1800',
          text: 'Testing1',
        },
      ]),
    ).rejects.toThrow();

    expect(
      smsTaiwanService.send({
        mobileList: ['+1-202-895-1800'],
        text: 'Testing1',
      }),
    ).rejects.toThrow();
  });

  it('should reject no target request', () => {
    expect(
      smsService.send({
        mobileList: [],
        text: 'Testing',
      }),
    ).rejects.toThrow();

    expect(smsService.send([])).rejects.toThrow();
  });
});
