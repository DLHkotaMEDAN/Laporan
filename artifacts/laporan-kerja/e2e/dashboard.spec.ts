import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E Tests', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check that page loads successfully
    await expect(page).toHaveTitle(/laporan/i);
  });
});
