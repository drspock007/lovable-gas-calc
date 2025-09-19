import { test, expect } from '@playwright/test';

test.describe('Time from D - DevNote always available', () => {
  test('shows DevDump on calculation success when debug is ON', async ({ page }) => {
    await page.goto('/');
    
    // Set mode to Time from Diameter
    await page.selectOption('[data-testid="mode-selector"]', 'TfromD');
    
    // Enable debug mode
    await page.getByText('Debug Mode').click();
    
    // Fill valid inputs
    await page.fill('[data-testid="volume-input"]', '0.2');
    await page.fill('[data-testid="pressure-p1-input"]', '1200');
    await page.fill('[data-testid="pressure-p2-input"]', '1');
    await page.fill('[data-testid="temperature-input"]', '15');
    await page.fill('[data-testid="length-input"]', '2');
    await page.fill('[data-testid="diameter-input"]', '9');
    
    // Set diameter unit to µm
    await page.selectOption('[data-testid="diameter-unit-select"]', 'µm');
    
    // Calculate
    await page.click('[data-testid="calculate-button"]');
    await page.waitForTimeout(500);
    
    // Should show time result and DevDump
    await expect(page.getByText(/\d+\.\d+ s/)).toBeVisible();
    await expect(page.getByTestId('debug-dump')).toBeVisible();
    
    // DevDump should contain debug information
    const devDump = page.getByTestId('debug-dump');
    await expect(devDump).toContainText('parsed');
    await expect(devDump).toContainText('D_SI_m');
    await expect(devDump).toContainText('model');
  });

  test('shows DevDump on calculation failure when debug is ON', async ({ page }) => {
    await page.goto('/');
    
    // Set mode to Time from Diameter
    await page.selectOption('[data-testid="mode-selector"]', 'TfromD');
    
    // Enable debug mode
    await page.getByText('Debug Mode').click();
    
    // Fill invalid diameter (negative)
    await page.fill('[data-testid="volume-input"]', '0.2');
    await page.fill('[data-testid="pressure-p1-input"]', '1200');
    await page.fill('[data-testid="pressure-p2-input"]', '1');
    await page.fill('[data-testid="temperature-input"]', '15');
    await page.fill('[data-testid="length-input"]', '2');
    await page.fill('[data-testid="diameter-input"]', '-5');
    
    // Calculate
    await page.click('[data-testid="calculate-button"]');
    await page.waitForTimeout(500);
    
    // Should show error message
    await expect(page.getByText('Calculation failed')).toBeVisible();
    
    // Should still show DevDump with error information
    await expect(page.getByTestId('debug-dump')).toBeVisible();
    
    // DevDump should contain error debug information
    const devDump = page.getByTestId('debug-dump');
    await expect(devDump).toContainText('diameterRaw');
    await expect(devDump).toContainText('errorMessage');
  });

  test('does not show DevDump when debug is OFF', async ({ page }) => {
    await page.goto('/');
    
    // Set mode to Time from Diameter
    await page.selectOption('[data-testid="mode-selector"]', 'TfromD');
    
    // Make sure debug mode is OFF (default)
    
    // Fill valid inputs
    await page.fill('[data-testid="volume-input"]', '0.2');
    await page.fill('[data-testid="pressure-p1-input"]', '1200');
    await page.fill('[data-testid="pressure-p2-input"]', '1');
    await page.fill('[data-testid="temperature-input"]', '15');
    await page.fill('[data-testid="length-input"]', '2');
    await page.fill('[data-testid="diameter-input"]', '9');
    
    // Set diameter unit to µm
    await page.selectOption('[data-testid="diameter-unit-select"]', 'µm');
    
    // Calculate
    await page.click('[data-testid="calculate-button"]');
    await page.waitForTimeout(500);
    
    // Should show time result but no DevDump
    await expect(page.getByText(/\d+\.\d+ s/)).toBeVisible();
    await expect(page.getByTestId('debug-dump')).not.toBeVisible();
  });
});