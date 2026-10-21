/**
 * @jest-environment node
 */

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { parseInboundMessage, scanInbound, TurnkeyMigMessageType } from '../src';

// 驗證區 RecvTarget 實際收到的檔案
const fixture = (type: string): Promise<string> => readFile(path.join(__dirname, 'fixtures', `${type}.xml`), 'utf8');

describe('parseInboundMessage', () => {
  it('reads buyer replies received in the verification environment', async () => {
    expect(parseInboundMessage(await fixture('A0102'))).toMatchObject({
      messageType: TurnkeyMigMessageType.A0102,
      documentNumber: 'ZY00000907',
      documentDate: '20261019',
      buyerTaxId: '87654322',
      sellerTaxId: '12345675',
      occurredAt: new Date('2026-10-19T10:33:08Z'),
      reason: null,
    });

    expect(parseInboundMessage(await fixture('A0301'))).toMatchObject({
      messageType: TurnkeyMigMessageType.A0301,
      documentNumber: 'ZY00000908',
      occurredAt: new Date('2026-10-19T10:34:41Z'),
      reason: '驗證測試退回',
    });

    expect(parseInboundMessage(await fixture('A0202'))).toMatchObject({
      messageType: TurnkeyMigMessageType.A0202,
      occurredAt: new Date('2026-10-19T11:08:57Z'),
    });

    expect(parseInboundMessage(await fixture('B0102'))).toMatchObject({
      messageType: TurnkeyMigMessageType.B0102,
      documentDate: '20261019',
      occurredAt: new Date('2026-10-19T11:09:09Z'),
    });

    expect(parseInboundMessage(await fixture('B0202'))).toMatchObject({
      messageType: TurnkeyMigMessageType.B0202,
      documentNumber: expect.stringMatching(/^AL/),
    });
  });

  it('returns null for unknown documents', () => {
    expect(parseInboundMessage('<?xml version="1.0"?><Foo xmlns="urn:other"/>')).toBeNull();
  });
});

describe('scanInbound', () => {
  it('archives processed, unmatched and unrecognized files and keeps failures in place', async () => {
    const dataPath = await mkdtemp(path.join(tmpdir(), 'turnkey-inbound-'));
    const archive = path.join(dataPath, 'sidecar/inbound');

    await mkdir(path.join(dataPath, 'RecvTarget/A0102'), { recursive: true });
    await mkdir(path.join(dataPath, 'RecvTarget/A0301'), { recursive: true });
    await writeFile(path.join(dataPath, 'RecvTarget/A0102/a.xml'), await fixture('A0102'));
    await writeFile(path.join(dataPath, 'RecvTarget/A0102/b.xml'), '<x/>');
    // 命名空間對但缺 Main：解析會丟錯，不能擋住後面的檔案
    await writeFile(
      path.join(dataPath, 'RecvTarget/A0102/b2.xml'),
      '<Invoice xmlns="urn:GEINV:eInvoiceMessage:A0101:4.1"><Details/></Invoice>',
    );
    await writeFile(path.join(dataPath, 'RecvTarget/A0301/c.xml'), await fixture('A0301'));

    const failing = await scanInbound(
      dataPath,
      archive,
      async message => {
        if (message.messageType === TurnkeyMigMessageType.A0301) throw new Error('db down');

        return 'APPLIED';
      },
      new Date('2026-10-21T03:00:00Z'),
    );

    expect(failing.map(result => [result.fileName, result.outcome])).toEqual([
      ['a.xml', 'APPLIED'],
      ['b.xml', 'UNRECOGNIZED'],
      ['b2.xml', 'UNRECOGNIZED'],
      ['c.xml', 'ERROR'],
    ]);

    expect(await readdir(path.join(archive, '20261021/A0102'))).toEqual(['a.xml']);
    expect(await readdir(path.join(archive, '20261021/unrecognized'))).toEqual(['b.xml', 'b2.xml']);
    expect(await readdir(path.join(dataPath, 'RecvTarget/A0301'))).toEqual(['c.xml']);

    const retried = await scanInbound(dataPath, archive, async () => 'UNMATCHED', new Date('2026-10-21T03:00:00Z'));

    expect(retried.map(result => result.outcome)).toEqual(['UNMATCHED']);
    expect(await readdir(path.join(archive, '20261021/unmatched'))).toEqual(['c.xml']);

    await rm(dataPath, { recursive: true, force: true });
  });
});
