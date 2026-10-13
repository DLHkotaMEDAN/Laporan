/**
 * Helper functions for UserManagement component
 */

/**
 * Supabase wraps every non-2xx Edge Function response in a generic
 * FunctionsHttpError. The function still sends a useful `{ error: string }`
 * body, so read it before showing the toast to the administrator.
 */
export const getEdgeFunctionErrorMessage = async (error: unknown): Promise<string> => {
  const functionError = error as Error & { context?: unknown };
  const response = functionError?.context;

  if (response instanceof Response) {
    const payload = await response.clone().json().catch(() => null) as { error?: unknown; message?: unknown } | null;
    if (typeof payload?.error === 'string') return payload.error;
    if (typeof payload?.message === 'string') return payload.message;
  }

  return error instanceof Error ? error.message : 'Terjadi kesalahan saat menghubungi layanan akun.';
};

/**
 * Toggle work plan category in selected categories
 */
export const toggleWorkPlanCategory = (selected: string[], category: string): string[] => (
  selected.includes(category)
    ? selected.filter((item) => item !== category)
    : [...selected, category]
);

/**
 * Execute tasks with concurrency limit to prevent rate limiting
 */
export const executeWithConcurrency = async <T,>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 5
): Promise<T[]> => {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }

    executing.splice(executing.indexOf(promise), 1);
  }

  await Promise.all(executing);
  return results;
};
