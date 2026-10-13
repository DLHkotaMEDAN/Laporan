import { describe, it, expect } from 'vitest';
import { getEdgeFunctionErrorMessage, toggleWorkPlanCategory, executeWithConcurrency } from '@/components/UserManagement/utils';

describe('UserManagement Utils', () => {
  describe('getEdgeFunctionErrorMessage', () => {
    it('should return error message from response payload', async () => {
      const error = new Error('Test error') as Error & { context?: unknown };
      error.context = new Response(JSON.stringify({ error: 'Specific error' }));

      const message = await getEdgeFunctionErrorMessage(error);
      expect(message).toBe('Specific error');
    });

    it('should return message from response payload', async () => {
      const error = new Error('Test error') as Error & { context?: unknown };
      error.context = new Response(JSON.stringify({ message: 'Specific message' }));

      const message = await getEdgeFunctionErrorMessage(error);
      expect(message).toBe('Specific message');
    });

    it('should return error message if no payload', async () => {
      const error = new Error('Test error');

      const message = await getEdgeFunctionErrorMessage(error);
      expect(message).toBe('Test error');
    });

    it('should return default message if unknown error', async () => {
      const error = 'unknown error';

      const message = await getEdgeFunctionErrorMessage(error);
      expect(message).toBe('Terjadi kesalahan saat menghubungi layanan akun.');
    });
  });

  describe('toggleWorkPlanCategory', () => {
    it('should add category if not present', () => {
      const result = toggleWorkPlanCategory(['cat1'], 'cat2');
      expect(result).toEqual(['cat1', 'cat2']);
    });

    it('should remove category if present', () => {
      const result = toggleWorkPlanCategory(['cat1', 'cat2'], 'cat1');
      expect(result).toEqual(['cat2']);
    });

    it('should handle empty array', () => {
      const result = toggleWorkPlanCategory([], 'cat1');
      expect(result).toEqual(['cat1']);
    });
  });

  describe('executeWithConcurrency', () => {
    it('should execute tasks with concurrency limit', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3),
      ];

      const results = await executeWithConcurrency(tasks, 2);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should handle empty tasks array', async () => {
      const results = await executeWithConcurrency([], 5);
      expect(results).toEqual([]);
    });

    it('should handle single task', async () => {
      const tasks = [() => Promise.resolve('test')];
      const results = await executeWithConcurrency(tasks, 5);
      expect(results).toEqual(['test']);
    });
  });
});
