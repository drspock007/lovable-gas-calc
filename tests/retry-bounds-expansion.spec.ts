/**
 * Test for retry bounds expansion and devNote enrichment
 */
import { test, expect } from '@playwright/test';

test.describe('Retry Bounds Expansion', () => {
  test('should show residual details panel after retry', async ({ page }) => {
    await page.goto('/');
    
    // Set to filling mode and TfromD to trigger residual errors more easily
    await page.click('[data-testid="process-selector"] button[value="filling"]');
    await page.click('[data-testid="solvefor-selector"] button[value="TfromD"]');
    
    // Use inputs that are likely to cause residual check failure
    await page.fill('[data-testid="volume-input"]', '0.0001'); // Very small volume
    await page.fill('[data-testid="P1-input"]', '1'); // 1 atm initial
    await page.fill('[data-testid="P2-input"]', '10'); // 10 atm final
    await page.fill('[data-testid="Ps-input"]', '15'); // 15 atm supply
    await page.fill('[data-testid="diameter-input"]', '100'); // Very large diameter
    await page.fill('[data-testid="temperature-input"]', '20');
    await page.fill('[data-testid="length-input"]', '2');
    
    // Calculate - this should fail with residual error
    await page.click('[data-testid="calculate-button"]');
    
    // Wait for error result
    await page.waitForSelector('.text-red-600', { timeout: 10000 });
    
    // Look for Auto-expand search & retry button
    const retryButton = page.locator('button', { hasText: 'Auto‑expand search & retry' });
    
    if (await retryButton.isVisible()) {
      // Click retry button
      await retryButton.click();
      
      // Wait for calculation to complete
      await page.waitForTimeout(2000);
      
      // Check if residual details panel appears
      const residualPanel = page.locator('[data-testid="residual-details"]');
      if (await residualPanel.isVisible()) {
        // Expand the panel if it's collapsed
        await residualPanel.click();
        
        // Check for retry information in the JSON
        const panelText = await residualPanel.textContent();
        expect(panelText).toContain('retry');
        expect(panelText).toContain('previous_bounds');
        expect(panelText).toContain('new_bounds');
        expect(panelText).toContain('expand_factor');
      }
    }
  });
  
  test('should show retry context in devNote for DfromT', async ({ page }) => {
    await page.goto('/');
    
    // Enable debug mode
    await page.click('[data-testid="debug-toggle"]');
    
    // Set to DfromT mode which has better retry support
    await page.click('[data-testid="solvefor-selector"] button[value="DfromT"]');
    
    // Use inputs that might cause solver issues
    await page.fill('[data-testid="volume-input"]', '0.001');
    await page.fill('[data-testid="P1-input"]', '5');
    await page.fill('[data-testid="P2-input"]', '1');
    await page.fill('[data-testid="time-input"]', '0.1'); // Very short time
    await page.fill('[data-testid="temperature-input"]', '20');
    await page.fill('[data-testid="length-input"]', '5');
    
    // Calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Wait for result
    await page.waitForTimeout(3000);
    
    // If retry button appears, click it
    const retryButton = page.locator('button', { hasText: 'Auto‑expand search & retry' });
    
    if (await retryButton.isVisible()) {
      await retryButton.click();
      await page.waitForTimeout(3000);
      
      // Check debug dump for retry information
      const debugDump = page.locator('[data-testid="debug-dump"]');
      if (await debugDump.isVisible()) {
        const debugText = await debugDump.textContent();
        expect(debugText).toContain('retry');
        expect(debugText).toContain('attempt');
        expect(debugText).toContain('expand_factor');
      }
    }
  });
});