import { TCatLogisticsService, TCatLogistics } from '../src'

describe('delivery-adapter-tcat', () => {
    const logistics = new TCatLogisticsService(TCatLogistics)

    it('should trace logistics', async () => {
        const trace = await logistics.trace(['903404283301', '800978442950', '135006120322', 'AAAA'])

        trace.map(t => console.log(t))
    });
});
