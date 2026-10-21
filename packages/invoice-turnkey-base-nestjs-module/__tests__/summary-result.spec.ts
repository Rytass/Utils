import path from 'path';
import { readSummaryDay } from '../src/reconciliation/summary-result';

const dataPath = path.join(__dirname, 'fixtures/summary-data');

describe('readSummaryDay', () => {
  it('parses good and failed messages and the expected count', async () => {
    const day = await readSummaryDay(dataPath, '20261020');

    expect(day?.expectedCount).toBe(2);
    expect(day?.messages).toEqual([
      {
        turnkeyUuid: '11111111-1111-4111-8111-111111111111',
        messageType: 'F0401',
        companyTaxId: '12345675',
        good: ['ZZ00000001'],
        failed: [],
      },
      {
        turnkeyUuid: '22222222-2222-4222-8222-222222222222',
        messageType: 'F0401',
        companyTaxId: '12345675',
        good: [],
        failed: ['ZZ00000002'],
      },
    ]);
  });

  it('returns null when the day has not arrived', async () => {
    expect(await readSummaryDay(dataPath, '20261021')).toBeNull();
  });
});
