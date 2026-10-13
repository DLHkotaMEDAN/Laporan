import { describe, it, expect } from 'vitest';

describe('Utility Functions', () => {
  describe('String Operations', () => {
    it('should concatenate strings', () => {
      const result = 'Hello' + ' ' + 'World';
      expect(result).toBe('Hello World');
    });

    it('should trim whitespace', () => {
      const result = '  test  '.trim();
      expect(result).toBe('test');
    });

    it('should convert to uppercase', () => {
      const result = 'hello'.toUpperCase();
      expect(result).toBe('HELLO');
    });
  });

  describe('Array Operations', () => {
    it('should filter array', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = arr.filter((x) => x > 2);
      expect(result).toEqual([3, 4, 5]);
    });

    it('should map array', () => {
      const arr = [1, 2, 3];
      const result = arr.map((x) => x * 2);
      expect(result).toEqual([2, 4, 6]);
    });

    it('should reduce array', () => {
      const arr = [1, 2, 3, 4];
      const result = arr.reduce((acc, x) => acc + x, 0);
      expect(result).toBe(10);
    });
  });

  describe('Object Operations', () => {
    it('should create object', () => {
      const obj = { name: 'Test', value: 42 };
      expect(obj).toHaveProperty('name', 'Test');
      expect(obj).toHaveProperty('value', 42);
    });

    it('should merge objects', () => {
      const obj1 = { a: 1 };
      const obj2 = { b: 2 };
      const result = { ...obj1, ...obj2 };
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });
});
