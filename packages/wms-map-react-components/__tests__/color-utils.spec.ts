import { increaseBrightness, createHoverColor } from '../src/utils/color-utils';

describe('Color Utils', () => {
  describe('increaseBrightness', () => {
    it('should increase brightness of a color', () => {
      const result = increaseBrightness('#800000', 100);

      expect(result).not.toBe('#800000');
    });

    it('should handle 6-digit hex colors', () => {
      const result = increaseBrightness('#ff0000', 15);

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle 3-digit hex colors', () => {
      const result = increaseBrightness('#f00', 15);

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle colors with hash prefix', () => {
      const result = increaseBrightness('#abc', 20);

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should not exceed maximum brightness (255)', () => {
      const result = increaseBrightness('#ffffff', 100);

      expect(result).toBe('#ffffff');
    });

    it('should return original color for invalid format', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = increaseBrightness('invalid', 15);

      expect(result).toBe('invalid');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle 0% increase', () => {
      const result = increaseBrightness('#ff0000', 0);

      expect(result).toBe('#ff0000');
    });

    it('should handle negative percentage', () => {
      const result = increaseBrightness('#ffffff', -50);

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result).not.toBe('#ffffff');
    });

    it('should handle black color', () => {
      const result = increaseBrightness('#000000', 50);

      expect(result).toBe('#000000');
    });

    it('should handle dark colors', () => {
      const result = increaseBrightness('#333333', 50);

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('createHoverColor', () => {
    it('should return a different color from input', () => {
      const original = '#800000';
      const result = createHoverColor(original);

      expect(result).not.toBe(original);
    });

    it('should return valid hex color', () => {
      const result = createHoverColor('#ff0000');

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should create brighter color', () => {
      const result = createHoverColor('#0066cc');

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle short hex colors', () => {
      const result = createHoverColor('#abc');

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle white color gracefully', () => {
      const result = createHoverColor('#ffffff');

      expect(result).toBe('#ffffff');
    });
  });
});
