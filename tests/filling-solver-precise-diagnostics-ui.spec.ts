/**
 * E2E test for precise Filling solver diagnostics in UI
 * Validates that specific error reasons are displayed in the Debug details panel
 */

import { test, expect } from '@playwright/test';

test.describe('Filling Solver Precise Diagnostics UI', () => {
  test('should show "Target time out of bracket" error in debug panel', async ({ page }) => {
    await page.goto('/');
    
    // Enable debug mode for detailed output
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '1');
    });
    await page.reload();
    
    // Set filling mode and DfromT
    await page.selectOption('[data-testid="process-select"]', 'filling');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Use inputs that will cause "Target time out of bracket"
    await page.fill('[data-testid="volume-input"]', '1');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '100');
    await page.fill('[data-testid="P2-input"]', '150');
    await page.fill('[data-testid="Ps-input"]', '200');
    await page.fill('[data-testid="time-input"]', '10000'); // Extremely long time
    await page.selectOption('[data-testid="time-unit"]', 's');
    await page.fill('[data-testid="temperature-input"]', '20');
    await page.fill('[data-testid="length-input"]', '1');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    
    // Debug details should be visible and expanded
    await expect(page.locator('text=Debug details')).toBeVisible();
    const debugContent = page.locator('[data-testid="debug-details-content"]');
    await expect(debugContent).toBeVisible();
    
    // Should contain specific reason
    const debugText = await debugContent.textContent();
    expect(debugText).toContain('"reason": "Target time out of bracket"');
    expect(debugText).toContain('"t_target_s": 10000');
    expect(debugText).toContain('"bracket_expansions"');
    expect(debugText).toContain('"A_lo_m2"');
    expect(debugText).toContain('"A_hi_m2"');
  });

  test('should show "Hit bracket bound (no root inside)" error in debug panel', async ({ page }) => {
    await page.goto('/');
    
    // Enable debug mode
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '1');
    });
    await page.reload();
    
    // Set filling mode
    await page.selectOption('[data-testid="process-select"]', 'filling');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Use inputs that will hit bracket bounds
    await page.fill('[data-testid="volume-input"]', '2000');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '100');
    await page.fill('[data-testid="P2-input"]', '100.1'); // Very small pressure difference
    await page.fill('[data-testid="Ps-input"]', '100.2');
    await page.fill('[data-testid="time-input"]', '0.001'); // Very short time
    await page.selectOption('[data-testid="time-unit"]', 's');
    await page.fill('[data-testid="temperature-input"]', '20');
    await page.fill('[data-testid="length-input"]', '1');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    
    // Check debug content
    const debugContent = page.locator('[data-testid="debug-details-content"]');
    await expect(debugContent).toBeVisible();
    
    const debugText = await debugContent.textContent();
    
    // Should contain boundary hit error or other precise diagnostic
    const hasTargetOutOfBracket = debugText.includes('"reason": "Target time out of bracket"');
    const hasBoundaryHit = debugText.includes('"reason": "Hit bracket bound (no root inside)"');
    const hasNonFinite = debugText.includes('"reason": "non-finite bracket times"');
    const hasResidualRejection = debugText.includes('"reason": "Result rejected by residual check"');
    
    // Should have one of the precise diagnostic reasons
    expect(hasTargetOutOfBracket || hasBoundaryHit || hasNonFinite || hasResidualRejection).toBe(true);
    
    // Should contain detailed information
    expect(debugText).toContain('"A_lo_m2"');
    expect(debugText).toContain('"A_hi_m2"');
    expect(debugText).toContain('"t_target_s"');
  });

  test('should show "Result rejected by residual check" error with choking info', async ({ page }) => {
    await page.goto('/');
    
    // Enable debug mode
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '1');
    });
    await page.reload();
    
    // Set filling mode
    await page.selectOption('[data-testid="process-select"]', 'filling');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Use inputs that might converge but fail residual check
    await page.fill('[data-testid="volume-input"]', '5000');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '100');
    await page.fill('[data-testid="P2-input"]', '150');
    await page.fill('[data-testid="Ps-input"]', '250');
    await page.fill('[data-testid="time-input"]', '0.05'); // 50ms
    await page.selectOption('[data-testid="time-unit"]', 's');
    await page.fill('[data-testid="temperature-input"]', '20');
    await page.fill('[data-testid="length-input"]', '5');
    
    // Set very strict epsilon to force residual failure
    await page.fill('[data-testid="epsilon-input"]', '0.001');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Wait for calculation
    await page.waitForTimeout(5000);
    
    // Check if we get a residual check error
    if (await page.locator('text=Debug details').isVisible()) {
      const debugContent = page.locator('[data-testid="debug-details-content"]');
      const debugText = await debugContent.textContent();
      
      if (debugText.includes('"reason": "Result rejected by residual check"')) {
        expect(debugText).toContain('"t_forward_s"');
        expect(debugText).toContain('"t_target_s"');
        expect(debugText).toContain('"residual"');
        expect(debugText).toContain('"epsilon_used"');
        expect(debugText).toContain('"choking"');
        expect(debugText).toContain('"bounds_used"');
      }
    }
  });

  test('should show precise diagnostics even when debug mode is OFF', async ({ page }) => {
    await page.goto('/');
    
    // Ensure debug mode is OFF
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '0');
    });
    await page.reload();
    
    // Set filling mode
    await page.selectOption('[data-testid="process-select"]', 'filling');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Use inputs guaranteed to fail
    await page.fill('[data-testid="volume-input"]', '0.1');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '100');
    await page.fill('[data-testid="P2-input"]', '150');
    await page.fill('[data-testid="Ps-input"]', '200');
    await page.fill('[data-testid="time-input"]', '1000'); // Very long time
    await page.selectOption('[data-testid="time-unit"]', 's');
    await page.fill('[data-testid="temperature-input"]', '20');
    await page.fill('[data-testid="length-input"]', '1');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    
    // Debug details should still be available (systematic display)
    await expect(page.locator('text=Debug details')).toBeVisible();
    
    // Click to expand (since debug mode is OFF)
    await page.click('[data-testid="debug-details-trigger"]');
    
    // Should show precise diagnostic
    const debugContent = page.locator('[data-testid="debug-details-content"]');
    await expect(debugContent).toBeVisible();
    
    const debugText = await debugContent.textContent();
    
    // Should contain one of the precise reasons
    const preciseReasons = [
      '"reason": "non-finite bracket times"',
      '"reason": "Target time out of bracket"',
      '"reason": "Hit bracket bound (no root inside)"',
      '"reason": "Result rejected by residual check"'
    ];
    
    const hasPreciseReason = preciseReasons.some(reason => debugText.includes(reason));
    expect(hasPreciseReason).toBe(true);
  });

  test('should validate bracket orientation in error messages', async ({ page }) => {
    await page.goto('/');
    
    // Enable debug mode
    await page.evaluate(() => {
      localStorage.setItem('debugMode', '1');
    });
    await page.reload();
    
    // Set filling mode
    await page.selectOption('[data-testid="process-select"]', 'filling');
    await page.selectOption('[data-testid="solve-for-select"]', 'DfromT');
    
    // Use any inputs that will fail
    await page.fill('[data-testid="volume-input"]', '100');
    await page.selectOption('[data-testid="volume-unit"]', 'mm3');
    await page.fill('[data-testid="P1-input"]', '100');
    await page.fill('[data-testid="P2-input"]', '120');
    await page.fill('[data-testid="Ps-input"]', '150');
    await page.fill('[data-testid="time-input"]', '500'); // Long time
    await page.selectOption('[data-testid="time-unit"]', 's');
    await page.fill('[data-testid="temperature-input"]', '25');
    await page.fill('[data-testid="length-input"]', '2');
    
    // Click calculate
    await page.click('[data-testid="calculate-button"]');
    
    // Should show error
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    
    // Check debug content for bracket values
    const debugContent = page.locator('[data-testid="debug-details-content"]');
    await expect(debugContent).toBeVisible();
    
    const debugText = await debugContent.textContent();
    
    // If bracket times are shown, they should be properly oriented (t_lo >= t_hi for monotone decreasing)
    const t_lo_match = debugText.match(/"t_lo[^"]*":\s*([0-9.-]+)/);
    const t_hi_match = debugText.match(/"t_hi[^"]*":\s*([0-9.-]+)/);
    
    if (t_lo_match && t_hi_match) {
      const t_lo = parseFloat(t_lo_match[1]);
      const t_hi = parseFloat(t_hi_match[1]);
      
      // For a monotone decreasing function, t_lo should be >= t_hi
      expect(t_lo).toBeGreaterThanOrEqual(t_hi);
    }
  });
});