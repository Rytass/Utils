/**
 * @jest-environment node
 */

import { mkdtemp, readdir, readFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  resolveSubmissionResult,
  TurnkeyDbLogReader,
  TurnkeyMessageCategory,
  TurnkeyMigMessageType,
  TurnkeySubmissionStatus,
  upCastSourceDirectory,
  writeSubmissionFile,
} from '../src';

// 驗證區 turnkey_message_log / sysevent 實際出現過的列
describe('resolveSubmissionResult', () => {
  it('treats C as accepted and other non-E statuses as in progress', () => {
    expect(resolveSubmissionResult({ uuid: 'u', status: 'C', failedTask: null, events: [] })).toEqual({
      status: TurnkeySubmissionStatus.ACCEPTED,
      code: '00000',
      message: null,
    });

    expect(resolveSubmissionResult({ uuid: 'u', status: 'G', failedTask: null, events: [] })).toBeNull();
    expect(resolveSubmissionResult(null)).toBeNull();
  });

  it('reads platform codes from the concatenated messages (E1002 after Unpack)', () => {
    expect(
      resolveSubmissionResult({
        uuid: 'a689c3af',
        status: 'E',
        failedTask: 'Unpack',
        events: [{ errorCode: '-022', message: '[E1002] No. 1 發票 Validate Fail. 發票開立日期不得過早' }],
      }),
    ).toMatchObject({ status: TurnkeySubmissionStatus.REJECTED, code: 'E1002' });
  });

  it('marks local validation (7001 at UpCast) and empty files (-002) as failed', () => {
    expect(
      resolveSubmissionResult({
        uuid: '8122e555',
        status: 'E',
        failedTask: 'UpCast',
        events: [
          {
            errorCode: '-008',
            message: 'Validate message by program v41F0401-ZY00000924.xml fail: [7001] CustomsClearanceMark invalid!',
          },
        ],
      }),
    ).toMatchObject({ status: TurnkeySubmissionStatus.FAILED, code: '7001' });

    expect(
      resolveSubmissionResult({
        uuid: 'b9a2e3c9',
        status: 'E',
        failedTask: 'UpCast',
        events: [{ errorCode: '-002', message: 'This file /data/UpCast/B2SSTORAGE/F0401/SRC/x.xml is empty.' }],
      }),
    ).toMatchObject({ status: TurnkeySubmissionStatus.FAILED, code: '-002' });
  });

  it('treats E0201 (duplicate) as accepted', () => {
    expect(
      resolveSubmissionResult({
        uuid: 'u',
        status: 'E',
        failedTask: 'Unpack',
        events: [{ errorCode: '-022', message: '[E0201] duplicate' }],
      }),
    ).toMatchObject({ status: TurnkeySubmissionStatus.ACCEPTED, code: 'E0201' });
  });
});

describe('TurnkeyDbLogReader', () => {
  it('lists columns explicitly, matches by basename and joins on seqno + subseqno', async () => {
    const calls: { sql: string; parameters: readonly unknown[] }[] = [];

    const responses: Record<string, string | null>[][] = [
      [{ uuid: 'u1', seqno: 'QAK0001T', subseqno: '1' }],
      [{ uuid: 'u1', status: 'E' }],
      [{ task: 'Unpack' }],
      [
        {
          errorcode: '-022',
          message1: '[E1002] No. 1 發票 Validate',
          message2: ' Fail.',
          message3: null,
          message4: null,
          message5: null,
          message6: null,
        },
      ],
    ];

    const reader = new TurnkeyDbLogReader(async (sql, parameters) => {
      calls.push({ sql, parameters });

      return responses[calls.length - 1];
    });

    const record = await reader.findByUpCastFileName('3f0e_x.xml');

    expect(calls.every(call => !/select\s+\*/i.test(call.sql))).toBe(true);
    expect(calls[0].parameters).toEqual(['%/3f0e\\_x.xml']);
    expect(calls[1].parameters).toEqual(['QAK0001T', '1']);
    expect(record).toEqual({
      uuid: 'u1',
      status: 'E',
      failedTask: 'Unpack',
      events: [{ errorCode: '-022', message: '[E1002] No. 1 發票 Validate Fail.' }],
    });
  });
});

describe('writeSubmissionFile', () => {
  it('writes through a temp file outside SRC and renames into SRC', async () => {
    const dataPath = await mkdtemp(path.join(tmpdir(), 'turnkey-'));
    const src = upCastSourceDirectory(dataPath, TurnkeyMessageCategory.B2SSTORAGE, TurnkeyMigMessageType.F0401);

    await mkdir(src, { recursive: true });

    const target = await writeSubmissionFile(dataPath, {
      category: TurnkeyMessageCategory.B2SSTORAGE,
      messageType: TurnkeyMigMessageType.F0401,
      fileName: 'abc.xml',
      xml: '<Invoice/>',
    });

    expect(target).toBe(path.join(src, 'abc.xml'));
    expect(await readFile(target, 'utf8')).toBe('<Invoice/>');
    expect(await readdir(path.join(dataPath, 'sidecar/tmp'))).toEqual([]);

    await rm(dataPath, { recursive: true, force: true });
  });
});
