import { TCatLogisticsService, TCatLogistics } from '../src'

describe('delivery-adapter-tcat', () => {
    const logistics = new TCatLogisticsService(TCatLogistics)

    it('should trace logistics', async () => {
        const trace = await logistics.trace('800978442950')
    });
});
