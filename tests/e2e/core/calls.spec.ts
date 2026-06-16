import { test, expect } from '@playwright/test';

test.describe('Calls Launcher E2E', () => {
  test('should render calls page and validate input', async ({ page }) => {
    // Login to access dashboard
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard**');

    // Go to calls page
    await page.goto('/dashboard/calls');
    await expect(page.getByText('Llamadas Proactivas')).toBeVisible();

    // The call button should be disabled initially
    const callButton = page.getByRole('button', { name: /LLAMAR AHORA/i });
    await expect(callButton).toBeDisabled();

    // Click dialpad to input a short number
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    
    // Call button still disabled because it needs at least 8 digits
    await expect(callButton).toBeDisabled();

    // Check if the empty state for the live monitor is visible
    await expect(page.getByText('Inicia una llamada para ver la')).toBeVisible();
  });
});
