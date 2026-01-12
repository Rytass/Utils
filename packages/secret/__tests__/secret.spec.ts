import { SecretManager } from '../src/typings';

class MockSecretManager extends SecretManager {
  private readonly store: Map<string, unknown> = new Map();

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

describe('SecretManager', () => {
  describe('constructor', () => {
    it('should set project name', () => {
      const manager = new MockSecretManager('test-project');

      expect(manager.project).toBe('test-project');
    });

    it('should store project as readonly', () => {
      const manager = new MockSecretManager('my-project');

      expect(manager.project).toBe('my-project');
    });
  });

  describe('project getter', () => {
    it('should return the project name', () => {
      const manager = new MockSecretManager('production');

      expect(manager.project).toBe('production');
    });
  });

  describe('abstract methods implementation', () => {
    let manager: MockSecretManager;

    beforeEach(() => {
      manager = new MockSecretManager('test');
    });

    it('should get a value', () => {
      manager.set('key1', 'value1');

      const result = manager.get<string>('key1');

      expect(result).toBe('value1');
    });

    it('should set a value', () => {
      manager.set('myKey', { nested: 'data' });

      const result = manager.get<{ nested: string }>('myKey');

      expect(result).toEqual({ nested: 'data' });
    });

    it('should delete a value', () => {
      manager.set('toDelete', 'someValue');
      manager.delete('toDelete');

      const result = manager.get<string>('toDelete');

      expect(result).toBeUndefined();
    });

    it('should handle different value types', () => {
      manager.set('string', 'text');
      manager.set('number', 42);
      manager.set('boolean', true);
      manager.set('object', { a: 1 });
      manager.set('array', [1, 2, 3]);

      expect(manager.get<string>('string')).toBe('text');
      expect(manager.get<number>('number')).toBe(42);
      expect(manager.get<boolean>('boolean')).toBe(true);
      expect(manager.get<{ a: number }>('object')).toEqual({ a: 1 });
      expect(manager.get<number[]>('array')).toEqual([1, 2, 3]);
    });
  });
});
