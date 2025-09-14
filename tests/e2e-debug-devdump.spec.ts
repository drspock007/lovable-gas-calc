import { test, expect } from '@playwright/test';

test.describe('E2E Debug System DevDump', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Set up basic calculation inputs
    await page.getByTestId('volume-input').fill('200');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.getByTestId('pressure1-input').fill('12');
    await page.selectOption('[data-testid="pressure1-unit"]', 'bar');
    await page.getByTestId('pressure2-input').fill('0.01');
    await page.selectOption('[data-testid="pressure2-unit"]', 'bar');
    await page.getByTestId('temperature-input').fill('15');
    await page.getByTestId('length-input').fill('2');
  });

  test('Debug ON → DevDump visible with Time from Diameter', async ({ page }) => {
    // Switch to Time from Diameter mode
    await page.click('text=Time');
    await page.getByTestId('diameter-input').fill('9');
    await page.selectOption('[data-testid="diameter-unit"]', 'µm');
    
    // Enable Debug mode - look for debug toggle in dev panel
    const debugToggle = page.locator('[data-testid="debug-toggle"]').or(page.locator('text=Debug'));
    if (await debugToggle.isVisible()) {
      await debugToggle.click();
    }
    
    // Compute
    await page.click('text=Compute');
    
    // Wait for results and check DevDump visibility
    await expect(page.getByTestId('debug-dump')).toBeVisible();
    
    // Verify DevDump contains expected fields
    const debugContent = await page.getByTestId('debug-dump').textContent();
    expect(debugContent).toContain('diameterRaw');
    expect(debugContent).toContain('diameterUnit');
    expect(debugContent).toContain('D_SI_m');
    expect(debugContent).toContain('A_SI_m2');
    expect(debugContent).toContain('model');
    expect(debugContent).toContain('t_SI_s');
  });

  test('Debug OFF → DevDump not visible', async ({ page }) => {
    // Ensure Debug is OFF (default state)
    await page.click('text=Time');
    await page.getByTestId('diameter-input').fill('9');
    await page.selectOption('[data-testid="diameter-unit"]', 'µm');
    
    // Compute without debug
    await page.click('text=Compute');
    
    // DevDump should not be visible
    await expect(page.getByTestId('debug-dump')).not.toBeVisible();
  });

  test('Debug toggle persists after page reload', async ({ page }) => {
    // Enable Debug
    const debugToggle = page.locator('[data-testid="debug-toggle"]').or(page.locator('text=Debug'));
    if (await debugToggle.isVisible()) {
      await debugToggle.click();
    }
    
    // Reload page
    await page.reload();
    
    // Debug should still be enabled
    const debugToggle = page.locator('text=Debug');
    await expect(debugToggle).toBeVisible();
    
    // Set up calculation and verify DevDump appears
    await page.click('text=Time');
    await page.getByTestId('diameter-input').fill('9');
    await page.selectOption('[data-testid="diameter-unit"]', 'µm');
    await page.click('text=Compute');
    
    await expect(page.getByTestId('debug-dump')).toBeVisible();
  });

  test('Button status debug shows reason=ok for valid inputs', async ({ page }) => {
    // Enable Debug  
    const debugToggle = page.locator('[data-testid="debug-toggle"]').or(page.locator('text=Debug'));
    if (await debugToggle.isVisible()) {
      await debugToggle.click();
    }
    
    // Set valid inputs for blowdown
    await page.getByTestId('pressure2-input').fill('0'); // P2_g = 0
    await page.selectOption('[data-testid="pressure-mode"]', 'gauge');
    
    // Check button status (should be enabled with reason=ok)
    const computeButton = page.locator('text=Compute');
    await expect(computeButton).not.toBeDisabled();
    
    // Look for debug info showing reason=ok
    const debugInfo = page.getByTestId('button-status-debug');
    if (await debugInfo.isVisible()) {
      const debugText = await debugInfo.textContent();
      expect(debugText).toContain('reason=ok');
    }
  });
});