import { fitLabelFontSize, labelFontSizeCss, LABEL_MIN_SCREEN_PX } from '../src/utils/label-font-size';

describe('label-font-size', () => {
  it('grows with the range', () => {
    expect(fitLabelFontSize(400, 300, 'XS-A')).toBeGreaterThan(fitLabelFontSize(100, 75, 'XS-A'));
  });

  it('keeps a long label inside the range width', () => {
    const size = fitLabelFontSize(200, 1000, 'XS-B1-1F-DOCK');

    expect(size * 0.62 * 'XS-B1-1F-DOCK'.length).toBeLessThanOrEqual(200 * 0.9 + 1e-9);
  });

  it('is limited by height for a flat range', () => {
    expect(fitLabelFontSize(1000, 20, 'A')).toBeCloseTo(8);
  });

  it('clamps to screen pixels through the canvas zoom', () => {
    expect(labelFontSizeCss(100, 50, 'XS')).toBe(
      `clamp(calc(${LABEL_MIN_SCREEN_PX}px / var(--wms-map-zoom, 1)), 20.00px, calc(32px / var(--wms-map-zoom, 1)))`,
    );
  });
});
