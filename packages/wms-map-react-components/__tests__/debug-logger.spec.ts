import {
  setDebugMode,
  getDebugMode,
  debugLog,
  debugSuccess,
  debugError,
  debugWarn,
  debugGroup,
} from '../src/utils/debug-logger';

describe('debug-logger', () => {
  const WMS_DEBUG_NAMESPACE = '__WMS_MAP_DEBUG__';
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    originalWindow = global.window;
    global.window = {
      ...originalWindow,
      [WMS_DEBUG_NAMESPACE]: false,
    } as Window & typeof globalThis;
  });

  afterEach(() => {
    global.window = originalWindow;
    jest.restoreAllMocks();
  });

  describe('setDebugMode and getDebugMode', () => {
    it('should set debug mode to true', () => {
      setDebugMode(true);

      expect(getDebugMode()).toBe(true);
    });

    it('should set debug mode to false', () => {
      setDebugMode(true);
      setDebugMode(false);

      expect(getDebugMode()).toBe(false);
    });

    it('should return false by default', () => {
      (global.window as unknown as Record<string, boolean>)[WMS_DEBUG_NAMESPACE] = false;

      expect(getDebugMode()).toBe(false);
    });
  });

  describe('debugLog', () => {
    it('should not log when debug mode is off', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      setDebugMode(false);

      debugLog('test message');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log when debug mode is on', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      setDebugMode(true);

      debugLog('test message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][1]).toBe('test message');
    });

    it('should include timestamp prefix', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      setDebugMode(true);

      debugLog('test');

      expect(consoleSpy.mock.calls[0][0]).toMatch(/🔧.*\[WMS\]/);
    });

    it('should pass additional arguments', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      setDebugMode(true);

      debugLog('message', 'arg1', 42, { key: 'value' });

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), 'message', 'arg1', 42, { key: 'value' });
    });
  });

  describe('debugSuccess', () => {
    it('should not log when debug mode is off', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      setDebugMode(false);

      debugSuccess('success message');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log with success prefix when debug mode is on', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      setDebugMode(true);

      debugSuccess('success message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toMatch(/✅.*\[WMS\]/);
      expect(consoleSpy.mock.calls[0][1]).toBe('success message');
    });

    it('should pass additional arguments', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      setDebugMode(true);

      debugSuccess('done', 'extra', 123);

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), 'done', 'extra', 123);
    });
  });

  describe('debugError', () => {
    it('should not log when debug mode is off', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      setDebugMode(false);

      debugError('error message');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log with error prefix when debug mode is on', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      setDebugMode(true);

      debugError('error message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toMatch(/❌.*\[WMS\]/);
      expect(consoleSpy.mock.calls[0][1]).toBe('error message');
    });

    it('should include error object when provided', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      setDebugMode(true);
      const error = new Error('Test error');

      debugError('error occurred', error);

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), 'error occurred', error);
    });
  });

  describe('debugWarn', () => {
    it('should not log when debug mode is off', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      setDebugMode(false);

      debugWarn('warning message');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log with warning prefix when debug mode is on', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      setDebugMode(true);

      debugWarn('warning message');

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toMatch(/⚠️.*\[WMS\]/);
      expect(consoleSpy.mock.calls[0][1]).toBe('warning message');
    });

    it('should pass additional arguments', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      setDebugMode(true);

      debugWarn('caution', { data: 'value' });

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), 'caution', { data: 'value' });
    });
  });

  describe('debugGroup', () => {
    it('should execute callback without grouping when debug mode is off', () => {
      const groupSpy = jest.spyOn(console, 'group').mockImplementation();
      const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();

      setDebugMode(false);

      let executed = false;

      debugGroup('test group', () => {
        executed = true;
      });

      expect(executed).toBe(true);
      expect(groupSpy).not.toHaveBeenCalled();
      expect(groupEndSpy).not.toHaveBeenCalled();
    });

    it('should wrap callback in console.group when debug mode is on', () => {
      const groupSpy = jest.spyOn(console, 'group').mockImplementation();
      const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();

      setDebugMode(true);

      let executed = false;

      debugGroup('test group', () => {
        executed = true;
      });

      expect(executed).toBe(true);
      expect(groupSpy).toHaveBeenCalled();
      expect(groupSpy.mock.calls[0][0]).toMatch(/🔧.*\[WMS\].*test group/);
      expect(groupEndSpy).toHaveBeenCalled();
    });

    it('should call groupEnd even if callback throws', () => {
      const groupSpy = jest.spyOn(console, 'group').mockImplementation();
      const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();

      setDebugMode(true);

      expect(() => {
        debugGroup('error group', () => {
          throw new Error('test error');
        });
      }).toThrow('test error');

      expect(groupSpy).toHaveBeenCalled();
      expect(groupEndSpy).toHaveBeenCalled();
    });
  });
});
