/**
 * Acceptance tests for systematic error debug panel display
 * Validates that debug details are always shown for calculation failures
 */

import { test, expect } from '@playwright/test';

test.describe('Error Debug Panel - Systematic Display', () => {
  test('should always show debug details when calculation fails (debug mode OFF)', async ({ page }) => {
    // Navigate to the page with debug mode OFF
    await page.goto('/');
    
    // Ensure debug mode is OFF
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '0');
    });
    await page.reload();
    
    // Set mode to Time from Diameter 
    await page.selectOption('[data-testid="process-select"]', 'blowdown');
    await page.selectOption('[data-testid="solve-for-select"]', 'TfromD');
    
    // Fill in inputs that will cause an error (invalid diameter)
    await page.fill('[data-testid="volume-input"]', '2000');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '200');
    await page.fill('[data-testid="P2-input"]', '100');
    await page.fill('[data-testid="diameter-input"]', '-5'); // Invalid negative diameter
    await page.selectOption('[data-testid="diameter-unit"]', 'um');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error message
    await expect(page.locator('text=Calculation failed')).toBeVisible();
    
    // Should always show debug details panel even with debug mode OFF
    await expect(page.locator('text=Debug details')).toBeVisible();
    
    // Panel should contain JSON debug information
    const debugContent = page.locator('[data-testid="debug-details"] pre');
    await expect(debugContent).toBeVisible();
    await expect(debugContent).toContainText('diameter');
  });

  test('should open debug panel by default when ?debug=1 in URL', async ({ page }) => {
    // Navigate with debug parameter in URL
    await page.goto('/?debug=1');
    
    // Set mode to Time from Diameter 
    await page.selectOption('[data-testid="process-select"]', 'blowdown');
    await page.selectOption('[data-testid="solve-for-select"]', 'TfromD');
    
    // Fill in inputs that will cause "No valid solution found" error
    await page.fill('[data-testid="volume-input"]', '2000');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '200');
    await page.fill('[data-testid="P2-input"]', '100');
    await page.fill('[data-testid="diameter-input"]', '0.001'); // Very small diameter
    await page.selectOption('[data-testid="diameter-unit"]', 'um');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error
    await expect(page.locator('text=Calculation failed')).toBeVisible();
    
    // Debug panel should be expanded by default (content visible without clicking)
    const debugContent = page.locator('[data-testid="debug-details"] pre');
    await expect(debugContent).toBeVisible();
  });

  test('should open debug panel by default when localStorage.debugMode==="1"', async ({ page }) => {
    // Navigate and set debug mode in localStorage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '1');
    });
    await page.reload();
    
    // Set mode to Time from Diameter
    await page.selectOption('[data-testid="process-select"]', 'blowdown');
    await page.selectOption('[data-testid="solve-for-select"]', 'TfromD');
    
    // Fill in inputs that cause error
    await page.fill('[data-testid="volume-input"]', '2000');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '200');
    await page.fill('[data-testid="P2-input"]', '100');
    await page.fill('[data-testid="diameter-input"]', '0'); // Zero diameter
    await page.selectOption('[data-testid="diameter-unit"]', 'um');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error
    await expect(page.locator('text=Calculation failed')).toBeVisible();
    
    // Debug panel should be expanded by default
    const debugContent = page.locator('[data-testid="debug-details"] pre');
    await expect(debugContent).toBeVisible();
  });

  test('should show debug details for "No valid solution found" specifically', async ({ page }) => {
    // Navigate with debug OFF to prove it shows regardless
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '0');
    });
    await page.reload();
    
    // Set mode to Diameter from Time to trigger bracket/solver errors
    await page.selectOption('[data-testid="process-select"]', 'blowdown');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Fill in inputs that should cause "No valid solution found"
    await page.fill('[data-testid="volume-input"]', '2000');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '200');
    await page.fill('[data-testid="P2-input"]', '100');
    await page.fill('[data-testid="time-input"]', '0.001'); // Very short time
    await page.selectOption('[data-testid="time-unit"]', 's');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Wait for calculation to complete and show error
    await page.waitForSelector('text=Calculation failed', { timeout: 10000 });
    
    // Should show debug details panel
    await expect(page.locator('text=Debug details')).toBeVisible();
    
    // Click to expand the panel and verify content
    await page.click('[data-testid="debug-details-trigger"]');
    const debugContent = page.locator('[data-testid="debug-details-content"] pre');
    await expect(debugContent).toBeVisible();
    
    // Should contain solver/bracket information
    const debugText = await debugContent.textContent();
    expect(debugText).toContain('bounds');
  });

  test('should handle DfromT errors with debug details', async ({ page }) => {
    await page.goto('/');
    
    // Set mode to Diameter from Time
    await page.selectOption('[data-testid="process-select"]', 'blowdown');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Fill inputs that will cause solver to fail
    await page.fill('[data-testid="volume-input"]', '1');
    await page.selectOption('[data-testid="volume-unit"]', 'L');
    await page.fill('[data-testid="P1-input"]', '150');
    await page.fill('[data-testid="P2-input"]', '100');
    await page.fill('[data-testid="time-input"]', '0.00001'); // Extremely short time
    await page.selectOption('[data-testid="time-unit"]', 's');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    
    // Debug details should be available
    await expect(page.locator('text=Debug details')).toBeVisible();
  });
});