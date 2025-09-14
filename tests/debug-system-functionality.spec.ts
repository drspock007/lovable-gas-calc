import { test, expect } from '@playwright/test';

test.describe('Debug System Functionality', () => {
  test('Debug toggle should persist after page reload', async ({ page }) => {
    await page.goto('/');

    // Enable debug mode
    await page.getByRole('button', { name: /debug/i }).click();
    
    // Check that debug is ON
    await expect(page.getByText('Debug Mode')).toBeVisible();
    
    // Reload page
    await page.reload();
    
    // Debug should still be ON after reload
    await expect(page.getByText('Debug Mode')).toBeVisible();
    
    // Disable debug
    await page.getByRole('button', { name: /debug/i }).click();
    
    // Reload page
    await page.reload();
    
    // Debug should be OFF
    await expect(page.getByText('Debug Mode')).not.toBeVisible();
  });

  test('Time from Diameter should show DevDump with required fields when debug ON', async ({ page }) => {
    await page.goto('/');

    // Enable debug mode
    await page.getByRole('button', { name: /debug/i }).click();

    // Switch to Time from Diameter mode
    await page.getByRole('button', { name: /time from diameter/i }).click();

    // Set inputs for a valid calculation
    await page.getByLabel('Diameter').fill('9');
    await page.selectOption('[data-testid="diameter-unit"]', 'µm');
    
    // Set required pressure inputs
    await page.getByLabel('Initial Pressure (P1)').fill('1200');
    await page.getByLabel('Final Pressure (P2)').fill('1');
    
    // Set volume
    await page.getByLabel('Volume').fill('200');
    await page.selectOption('[data-testid="volume-unit"]', 'mm³');

    // Calculate
    await page.getByRole('button', { name: 'Compute' }).click();

    // Should show DevDump with Time-from-D Debug
    await expect(page.getByText('Time-from-D Debug')).toBeVisible();
    
    // Check that required fields are present in the debug dump
    const debugContent = page.locator('[data-testid="debug-dump"]');
    await expect(debugContent).toContainText('diameterRaw');
    await expect(debugContent).toContainText('diameterUnit');
    await expect(debugContent).toContainText('D_SI_m');
    await expect(debugContent).toContainText('A_SI_m2');
    await expect(debugContent).toContainText('model');
    await expect(debugContent).toContainText('t_SI_s');
  });

  test('Button status should show disabled=false and reason=ok when valid', async ({ page }) => {
    await page.goto('/');

    // Enable debug mode
    await page.getByRole('button', { name: /debug/i }).click();

    // Set valid inputs
    await page.getByLabel('Initial Pressure (P1)').fill('1200');
    await page.getByLabel('Final Pressure (P2)').fill('100');

    // Should show debug status under button
    await expect(page.getByText(/disabled=false/)).toBeVisible();
    await expect(page.getByText(/reason=ok/)).toBeVisible();
  });

  test('Console should log debug info when debug ON', async ({ page }) => {
    // Listen for console logs
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'info' && msg.text().includes('Time from Diameter')) {
        logs.push(msg.text());
      }
    });

    await page.goto('/');

    // Enable debug mode
    await page.getByRole('button', { name: /debug/i }).click();

    // Switch to Time from Diameter mode and calculate
    await page.getByRole('button', { name: /time from diameter/i }).click();
    await page.getByLabel('Diameter').fill('5');
    await page.selectOption('[data-testid="diameter-unit"]', 'µm');
    await page.getByLabel('Initial Pressure (P1)').fill('1200');
    await page.getByLabel('Final Pressure (P2)').fill('1');
    await page.getByLabel('Volume').fill('200');
    await page.selectOption('[data-testid="volume-unit"]', 'mm³');

    await page.getByRole('button', { name: 'Compute' }).click();

    // Wait a bit for logs to be captured
    await page.waitForTimeout(1000);

    // Should have logged debug information
    expect(logs.some(log => log.includes('Pipeline'))).toBeTruthy();
  });
});