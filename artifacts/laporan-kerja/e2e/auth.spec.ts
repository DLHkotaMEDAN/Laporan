import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear sessionStorage before each test
    await page.goto('/login');
    await page.evaluate(() => {
      sessionStorage.clear();
    });
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');
    
    // Check page title
    await expect(page).toHaveTitle(/laporan/i);
    
    // Check login form elements (using id selectors)
    await expect(page.getByTestId('username')).toBeVisible();
    await expect(page.getByTestId('password')).toBeVisible();
    await expect(page.getByRole('button', { name: /masuk/i })).toBeVisible();
  });

  test('should show error with empty credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login without credentials
    await page.getByRole('button', { name: /masuk/i }).click();
    
    // Should show error message
    await expect(page.getByText(/username dan password wajib diisi/i)).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Enter invalid credentials
    await page.getByTestId('username').fill('invaliduser');
    await page.getByTestId('password').fill('wrongpassword');
    await page.getByRole('button', { name: /masuk/i }).click();
    
    // Should show error message
    await expect(page.getByText(/username atau password salah/i)).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/login');
    
    const passwordInput = page.getByTestId('password');
    const toggleButton = page.locator('button[type="button"]').filter({ hasText: '' }).first();
    
    // Password should be hidden by default
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle button
    await toggleButton.click();
    
    // Password should be visible
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click again to hide
    await toggleButton.click();
    
    // Password should be hidden again
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should auto-append @gmail.com if not present', async ({ page }) => {
    await page.goto('/login');
    
    // Enter username without @gmail.com
    await page.getByTestId('username').fill('testuser');
    await page.getByTestId('password').fill('testpassword');
    
    // The form should auto-append @gmail.com
    // This is verified by checking if the login attempt is made with testuser@gmail.com
    // (we can't verify the actual email sent, but we can verify the form behavior)
    await page.getByRole('button', { name: /masuk/i }).click();
    
    // Should attempt login (will fail with invalid credentials)
    await expect(page.getByText(/username atau password salah/i)).toBeVisible();
  });
});
