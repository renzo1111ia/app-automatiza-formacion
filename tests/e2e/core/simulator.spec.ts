import { test, expect } from '@playwright/test';

test.describe('Simulator E2E', () => {
  test('should render simulator page and allow basic interaction', async ({ page }) => {
    // Login to access dashboard
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@example.com'); // Adaptar si hay credenciales de test específicas
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard**');

    // Go to simulator
    await page.goto('/dashboard/simulator');
    await expect(page.getByText('Simulador de Variables')).toBeVisible();

    // Check if empty state is visible
    await expect(page.getByText('Inicia una conversación')).toBeVisible();

    // Wait for agents to load in sidebar
    await page.waitForSelector('button:has-text("Seleccionar Agente")');
    
    // Test passes if we can load the page and see the empty state
  });
});
