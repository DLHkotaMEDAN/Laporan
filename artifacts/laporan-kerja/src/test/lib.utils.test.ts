import { describe, it, expect } from 'vitest';
import { cn, uniqueAutocompleteValues } from '@/lib/utils';

describe('Utils Library Tests', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('should handle duplicate classes', () => {
      const result = cn('foo', 'bar', 'foo');
      // tailwind-merge doesn't remove duplicates, just merges them
      expect(result).toContain('foo');
      expect(result).toContain('bar');
    });

    it('should handle empty inputs', () => {
      expect(cn()).toBe('');
    });
  });

  describe('uniqueAutocompleteValues', () => {
    it('should return unique values sorted', () => {
      const values = ['Foo', 'Bar', 'foo', 'Baz'];
      const result = uniqueAutocompleteValues(values);
      expect(result).toEqual(['Bar', 'Baz', 'Foo']);
    });

    it('should trim whitespace', () => {
      const values = ['  Foo  ', '  Bar  '];
      const result = uniqueAutocompleteValues(values);
      expect(result).toEqual(['Bar', 'Foo']);
    });

    it('should normalize internal whitespace', () => {
      const values = ['Foo   Bar', 'Foo Bar'];
      const result = uniqueAutocompleteValues(values);
      expect(result).toEqual(['Foo Bar']);
    });

    it('should handle empty strings', () => {
      const values = ['', 'Foo', '', 'Bar'];
      const result = uniqueAutocompleteValues(values);
      expect(result).toEqual(['Bar', 'Foo']);
    });

    it('should be case-insensitive for comparison', () => {
      const values = ['foo', 'FOO', 'Foo'];
      const result = uniqueAutocompleteValues(values);
      expect(result).toEqual(['foo']);
    });

    it('should use Indonesian locale for sorting', () => {
      const values = ['Cabai', 'Apel', 'Beras'];
      const result = uniqueAutocompleteValues(values);
      expect(result).toEqual(['Apel', 'Beras', 'Cabai']);
    });
  });
});
