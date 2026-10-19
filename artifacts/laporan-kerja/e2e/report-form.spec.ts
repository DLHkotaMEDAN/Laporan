import { test, expect } from '@playwright/test';

test.describe('Report Form E2E Tests', () => {
  test('should load daily recap page', async ({ page }) => {
    await page.goto('/daily-recap');
    
    // Check that page loads successfully
    await expect(page).toHaveTitle(/laporan/i);
  });
});
