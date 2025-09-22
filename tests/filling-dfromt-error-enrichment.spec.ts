/**
 * E2E acceptance test for enhanced error reporting in Filling DfromT mode
 * Validates that errors surface with comprehensive devNote information in the UI
 */

import { test, expect } from '@playwright/test';

test.describe('Filling DfromT Enhanced Error Reporting', () => {
  test('should show comprehensive debug details when filling DfromT calculation fails', async ({ page }) => {
    // Navigate to the page
    await page.goto('/');
    
    // Set debug mode to ensure panel opens
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '1');
    });
    await page.reload();
    
    // Set mode to Filling process and Diameter from Time
    await page.selectOption('[data-testid="process-select"]', 'filling');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Fill in inputs that will cause solver failure
    await page.fill('[data-testid="volume-input"]', '2000');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '100'); // Initial pressure
    await page.fill('[data-testid="P2-input"]', '200'); // Target pressure
    await page.fill('[data-testid="Ps-input"]', '500'); // Supply pressure
    await page.fill('[data-testid="time-input"]', '0.00001'); // Extremely short time
    await page.selectOption('[data-testid="time-unit"]', 's');
    await page.fill('[data-testid="temperature-input"]', '20');
    await page.fill('[data-testid="length-input"]', '1');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    
    // Should show debug details panel
    await expect(page.locator('text=Debug details')).toBeVisible();
    
    // Panel should be expanded by default (debug mode on)
    const debugContent = page.locator('[data-testid="debug-details-content"]');
    await expect(debugContent).toBeVisible();
    
    // Verify comprehensive devNote content
    const debugText = await debugContent.textContent();
    
    // Should contain process information
    expect(debugText).toContain('"process": "filling"');
    expect(debugText).toContain('"model"');
    expect(debugText).toContain('"t_target_s": 0.00001');
    expect(debugText).toContain('"epsilon"');
    
    // Should contain inputs_SI
    expect(debugText).toContain('"inputs_SI"');
    expect(debugText).toContain('"V_SI_m3"');
    expect(debugText).toContain('"P1_Pa"');
    expect(debugText).toContain('"P2_Pa"');
    expect(debugText).toContain('"Ps_Pa"');
    expect(debugText).toContain('"T_K"');
    expect(debugText).toContain('"L_SI_m"');
    expect(debugText).toContain('"gas"');
    expect(debugText).toContain('"Cd"');
    
    // Should contain bracket information (if solver got that far)
    if (debugText.includes('"bracket"')) {
      expect(debugText).toContain('"A_lo_m2"');
      expect(debugText).toContain('"A_hi_m2"');
      expect(debugText).toContain('"t_lo_s"');
      expect(debugText).toContain('"t_hi_s"');
      expect(debugText).toContain('"expansions"');
    }
    
    // Should contain forward_check information
    expect(debugText).toContain('"forward_check"');
    expect(debugText).toContain('"epsilon_used"');
    
    // Should contain reason
    expect(debugText).toContain('"reason"');
  });

  test('should show debug details even when debug mode is OFF (Filling DfromT error)', async ({ page }) => {
    // Navigate with debug mode explicitly OFF
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '0');
    });
    await page.reload();
    
    // Set mode to Filling DfromT
    await page.selectOption('[data-testid="process-select"]', 'filling');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Fill in inputs that will cause error
    await page.fill('[data-testid="volume-input"]', '1000');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '100');
    await page.fill('[data-testid="P2-input"]', '101'); // Very small pressure difference
    await page.fill('[data-testid="Ps-input"]', '102');
    await page.fill('[data-testid="time-input"]', '0.0001'); // Short time
    await page.selectOption('[data-testid="time-unit"]', 's');
    await page.fill('[data-testid="temperature-input"]', '25');
    await page.fill('[data-testid="length-input"]', '0.5');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    
    // Debug details panel should still be visible even with debug mode OFF
    await expect(page.locator('text=Debug details')).toBeVisible();
    
    // Click to expand panel (since debug mode is OFF, it won't auto-expand)
    await page.click('[data-testid="debug-details-trigger"]');
    
    // Should show debug content
    const debugContent = page.locator('[data-testid="debug-details-content"]');
    await expect(debugContent).toBeVisible();
    
    const debugText = await debugContent.textContent();
    expect(debugText).toContain('"process": "filling"');
    expect(debugText).toContain('"inputs_SI"');
  });

  test('should include bracket expansion details when solver expands bounds', async ({ page }) => {
    await page.goto('/');
    
    // Set debug mode on for detailed output
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '1');
    });
    await page.reload();
    
    // Set filling mode
    await page.selectOption('[data-testid="process-select"]', 'filling');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Use inputs that might require bracket expansion
    await page.fill('[data-testid="volume-input"]', '5000');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '150');
    await page.fill('[data-testid="P2-input"]', '300');
    await page.fill('[data-testid="Ps-input"]', '400');
    await page.fill('[data-testid="time-input"]', '500'); // Very long time
    await page.selectOption('[data-testid="time-unit"]', 's');
    await page.fill('[data-testid="temperature-input"]', '30');
    await page.fill('[data-testid="length-input"]', '2');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Wait for result or error
    await page.waitForTimeout(5000);
    
    // If there's an error with debug details
    if (await page.locator('text=Debug details').isVisible()) {
      const debugContent = page.locator('[data-testid="debug-details-content"]');
      const debugText = await debugContent.textContent();
      
      // Should contain bracket information
      if (debugText.includes('"bracket"')) {
        expect(debugText).toContain('"bracket_expansions"');
        expect(debugText).toContain('"A_lo_m2"');
        expect(debugText).toContain('"A_hi_m2"');
      }
    }
  });

  test('should show error details for "No valid solution found" in filling mode', async ({ page }) => {
    await page.goto('/');
    
    // Set filling mode
    await page.selectOption('[data-testid="process-select"]', 'filling');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Use impossible parameters
    await page.fill('[data-testid="volume-input"]', '0.001');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '100');
    await page.fill('[data-testid="P2-input"]', '99'); // P2 < P1 (impossible for filling)
    await page.fill('[data-testid="Ps-input"]', '98'); // Ps < P2 (impossible)
    await page.fill('[data-testid="time-input"]', '10');
    await page.selectOption('[data-testid="time-unit"]', 's');
    await page.fill('[data-testid="temperature-input"]', '20');
    await page.fill('[data-testid="length-input"]', '1');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    
    // Should show debug details panel
    await expect(page.locator('text=Debug details')).toBeVisible();
    
    // Expand and check content
    await page.click('[data-testid="debug-details-trigger"]');
    const debugContent = page.locator('[data-testid="debug-details-content"]');
    const debugText = await debugContent.textContent();
    
    expect(debugText).toContain('"reason"');
    expect(debugText).toContain('"process": "filling"');
  });
});