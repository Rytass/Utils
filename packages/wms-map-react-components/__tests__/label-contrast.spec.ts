import {
  averageColorOver,
  CANVAS_BACKGROUND,
  containedFrame,
  contrastRatio,
  labelSampleArea,
  parseHexColor,
  pickLabelTone,
} from '../src/utils/label-contrast';

describe('label-contrast', () => {
  it('parses short and long hex colours', () => {
    expect(parseHexColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor('3b82f6')).toEqual({ r: 59, g: 130, b: 246 });
    expect(parseHexColor('red')).toBeNull();
  });

  it('measures WCAG contrast symmetrically', () => {
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };

    expect(contrastRatio(white, black)).toBeCloseTo(21, 0);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
  });

  it('puts dark labels on a pale floor plan whatever the range colour', () => {
    ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f59e0b'].forEach(color => {
      expect(pickLabelTone({ r: 240, g: 240, b: 240 }, parseHexColor(color))).toBe('dark');
    });
  });

  it('puts light labels on a dark background', () => {
    expect(pickLabelTone({ r: 30, g: 30, b: 30 }, parseHexColor('#3b82f6'))).toBe('light');
    expect(pickLabelTone({ r: 20, g: 40, b: 90 }, null)).toBe('light');
  });

  it('lets an opaque enough fill decide on its own', () => {
    expect(pickLabelTone({ r: 255, g: 255, b: 255 }, parseHexColor('#1e3a8a'), 0.9)).toBe('light');
  });

  it('samples the middle third of a range', () => {
    expect(labelSampleArea({ x: 0, y: 0, width: 90, height: 30 })).toEqual({ x: 30, y: 10, width: 30, height: 10 });
  });

  it('finds where a contained image is actually drawn', () => {
    expect(containedFrame({ x: 0, y: 0, width: 200, height: 100 }, 1)).toEqual({
      x: 50,
      y: 0,
      width: 100,
      height: 100,
    });

    expect(containedFrame({ x: 0, y: 0, width: 100, height: 200 }, 2)).toEqual({ x: 0, y: 75, width: 100, height: 50 });
  });

  it('averages the image pixels under an area, treating transparency as canvas', () => {
    // 2×1 image: left black opaque, right fully transparent; drawn over 0..100 × 0..50
    const sample = { pixels: [0, 0, 0, 255, 0, 0, 0, 0], width: 2, height: 1 };
    const frame = { x: 0, y: 0, width: 100, height: 50 };

    expect(averageColorOver(sample, frame, { x: 0, y: 0, width: 40, height: 50 })).toEqual({ r: 0, g: 0, b: 0 });
    expect(averageColorOver(sample, frame, { x: 60, y: 0, width: 40, height: 50 })).toEqual(CANVAS_BACKGROUND);
    expect(averageColorOver(sample, frame, { x: 200, y: 0, width: 10, height: 10 })).toBeNull();
  });
});
