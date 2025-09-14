import { test, expect } from '@playwright/test';

test.describe('Gauge Zero Button State', () => {
  test('Button should be active when P2 gauge = 0 in blowdown mode', async ({ page }) => {
    await page.goto('/');

    // Set to blowdown mode
    await page.getByRole('button', { name: 'Blowdown' }).click();

    // Set pressure input mode to gauge
    await page.getByRole('button', { name: 'Gauge' }).click();

    // Set P1 to a positive value
    await page.getByLabel('Initial Pressure (P1)').fill('1200');
    
    // Set P2 to 0 (atmosphere)
    await page.getByLabel('Final Pressure (P2)').fill('0');

    // Button should be active
    const computeButton = page.getByRole('button', { name: 'Compute' });
    await expect(computeButton).not.toBeDisabled();
  });

  test('"To atmosphere" button should activate compute button', async ({ page }) => {
    await page.goto('/');

    // Enable debug mode to see the reason
    await page.getByRole('button', { name: 'Debug' }).click();

    // Set to blowdown mode
    await page.getByRole('button', { name: 'Blowdown' }).click();

    // Set pressure input mode to gauge
    await page.getByRole('button', { name: 'Gauge' }).click();

    // Set P1 to a positive value
    await page.getByLabel('Initial Pressure (P1)').fill('1200');
    
    // Set P2 to some value first
    await page.getByLabel('Final Pressure (P2)').fill('500');

    // Click "To atmosphere" button for P2
    await page.getByRole('button', { name: 'To Atmosphere' }).click();

    // Button should be active and debug should show reason=ok
    const computeButton = page.getByRole('button', { name: 'Compute' });
    await expect(computeButton).not.toBeDisabled();
    
    // Check debug info shows reason=ok
    await expect(page.getByText('reason=ok')).toBeVisible();
  });
});