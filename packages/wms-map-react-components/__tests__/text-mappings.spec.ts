import { TEXT_MAPPINGS } from '../src/constants/text-mappings';

describe('TEXT_MAPPINGS', () => {
  describe('DEBUG', () => {
    it('should have all debug keys defined', () => {
      expect(TEXT_MAPPINGS.DEBUG.DATA_LOADING).toBe('data-loading');
      expect(TEXT_MAPPINGS.DEBUG.HISTORY).toBe('history');
      expect(TEXT_MAPPINGS.DEBUG.REACT_FLOW).toBe('reactFlow');
      expect(TEXT_MAPPINGS.DEBUG.NODES).toBe('nodes');
      expect(TEXT_MAPPINGS.DEBUG.EVENTS).toBe('events');
      expect(TEXT_MAPPINGS.DEBUG.UI).toBe('ui');
      expect(TEXT_MAPPINGS.DEBUG.TESTING).toBe('testing');
    });
  });

  describe('OPERATIONS', () => {
    it('should have all operation keys defined', () => {
      expect(TEXT_MAPPINGS.OPERATIONS.LOAD_NEW_DATA).toBe('load-new-data');
      expect(TEXT_MAPPINGS.OPERATIONS.CHANGE_COLOR).toBe('change-color');
      expect(TEXT_MAPPINGS.OPERATIONS.MOVE_SHAPE).toBe('move-shape');
      expect(TEXT_MAPPINGS.OPERATIONS.DRAW_RECTANGLE).toBe('draw-rectangle');
      expect(TEXT_MAPPINGS.OPERATIONS.DRAW_PATH).toBe('draw-path');
      expect(TEXT_MAPPINGS.OPERATIONS.TEXT_EDIT).toBe('text-edit');
      expect(TEXT_MAPPINGS.OPERATIONS.PATH_EDIT).toBe('path-edit');
      expect(TEXT_MAPPINGS.OPERATIONS.DATA_CHANGE).toBe('data-change');
      expect(TEXT_MAPPINGS.OPERATIONS.DELETE_IMAGES).toBe('delete-images');
      expect(TEXT_MAPPINGS.OPERATIONS.DELETE_LAYERS).toBe('delete-layers');
      expect(TEXT_MAPPINGS.OPERATIONS.UPLOAD_IMAGE).toBe('upload-image');
    });
  });

  describe('MESSAGES', () => {
    it('should have Chinese node type messages', () => {
      expect(TEXT_MAPPINGS.MESSAGES.IMAGE_NODE).toBeDefined();
      expect(TEXT_MAPPINGS.MESSAGES.RECTANGLE_NODE).toBeDefined();
      expect(TEXT_MAPPINGS.MESSAGES.PATH_NODE).toBeDefined();
    });

    it('should have Chinese status messages', () => {
      expect(TEXT_MAPPINGS.MESSAGES.SELECTABLE).toBeDefined();
      expect(TEXT_MAPPINGS.MESSAGES.DRAGGABLE).toBeDefined();
      expect(TEXT_MAPPINGS.MESSAGES.DELETABLE).toBeDefined();
    });
  });

  describe('ALERTS', () => {
    it('should have LOAD_SUCCESS_WITH_NODES function', () => {
      const result = TEXT_MAPPINGS.ALERTS.LOAD_SUCCESS_WITH_NODES('測試類型', 5);

      expect(result).toContain('測試類型');
      expect(result).toContain('5');
    });

    it('should have SAVE_SUCCESS_WITH_DATA function', () => {
      const result = TEXT_MAPPINGS.ALERTS.SAVE_SUCCESS_WITH_DATA(3, 8);

      expect(result).toContain('3');
      expect(result).toContain('8');
    });

    it('should have LOAD_FAILED function', () => {
      const result = TEXT_MAPPINGS.ALERTS.LOAD_FAILED('Test Error');

      expect(result).toContain('Test Error');
    });

    it('should have INVALID_IMAGE_FORMAT function', () => {
      const result = TEXT_MAPPINGS.ALERTS.INVALID_IMAGE_FORMAT('test.txt');

      expect(result).toContain('test.txt');
    });
  });

  describe('FORMATTERS', () => {
    it('should have NODES_UNIT', () => {
      expect(TEXT_MAPPINGS.FORMATTERS.NODES_UNIT).toBeDefined();
    });

    it('should have BACKGROUND_COUNT function', () => {
      const result = TEXT_MAPPINGS.FORMATTERS.BACKGROUND_COUNT(5);

      expect(result).toContain('5');
    });

    it('should have RANGE_COUNT function', () => {
      const result = TEXT_MAPPINGS.FORMATTERS.RANGE_COUNT(10);

      expect(result).toContain('10');
    });

    it('should have WAREHOUSE_ID_FORMAT function', () => {
      const result = TEXT_MAPPINGS.FORMATTERS.WAREHOUSE_ID_FORMAT('WH001');

      expect(result).toContain('WH001');
    });

    it('should have INDEX_FORMAT function', () => {
      const result = TEXT_MAPPINGS.FORMATTERS.INDEX_FORMAT(3);

      expect(result).toContain('3');
    });

    it('should have CURRENT_INDICATOR', () => {
      expect(TEXT_MAPPINGS.FORMATTERS.CURRENT_INDICATOR).toBeDefined();
    });
  });

  describe('TEST_MESSAGES', () => {
    it('should have test data type messages', () => {
      expect(TEXT_MAPPINGS.TEST_MESSAGES.SIMPLE_TEST_DATA).toBeDefined();
      expect(TEXT_MAPPINGS.TEST_MESSAGES.COMPLEX_WAREHOUSE_DATA).toBeDefined();
      expect(TEXT_MAPPINGS.TEST_MESSAGES.LARGE_TEST_DATA).toBeDefined();
      expect(TEXT_MAPPINGS.TEST_MESSAGES.DEFAULT_TEST_DATA).toBeDefined();
    });

    it('should have status messages', () => {
      expect(TEXT_MAPPINGS.TEST_MESSAGES.LOAD_SUCCESS).toBeDefined();
      expect(TEXT_MAPPINGS.TEST_MESSAGES.LOAD_FAILED).toBeDefined();
      expect(TEXT_MAPPINGS.TEST_MESSAGES.SAVE_SUCCESS).toBeDefined();
    });
  });
});
