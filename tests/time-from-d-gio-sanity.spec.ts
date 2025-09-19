import { test, expect } from '@playwright/test';

test.describe('Time from D - Gio Preset Sanity Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Set mode to Time from Diameter
    await page.selectOption('[data-testid="mode-selector"]', 'TfromD');
    
    // Enable debug mode
    await page.getByText('Debug Mode').click();
    
    // Apply Gio preset
    await page.click('[data-testid="preset-gio"]');
    await page.waitForTimeout(300); // Wait for preset to load
  });

  test('D=9µm should give 150s < t < 200s with DevDump visible', async ({ page }) => {
    // Set diameter to 9 µm
    await page.fill('[data-testid="diameter-input"]', '9');
    await page.selectOption('[data-testid="diameter-unit-select"]', 'µm');
    
    // Calculate
    await page.click('[data-testid="calculate-button"]');
    await page.waitForTimeout(1000);
    
    // Check result is in expected range
    const timeResult = await page.textContent('[data-testid="time-result"]') || await page.textContent(':has-text("s"):first');
    const timeMatch = timeResult?.match(/(\d+\.?\d*)\s*s/);
    
    if (timeMatch) {
      const timeValue = parseFloat(timeMatch[1]);
      expect(timeValue).toBeGreaterThan(150);
      expect(timeValue).toBeLessThan(200);
    } else {
      // Alternative: check if we have a time display anywhere
      const timeText = await page.textContent('.text-2xl:has-text("s")');
      expect(timeText).toBeTruthy();
      
      if (timeText) {
        const time = parseFloat(timeText.replace(/[^\d.]/g, ''));
        expect(time).toBeGreaterThan(150);
        expect(time).toBeLessThan(200);
      }
    }
    
    // DevDump should be visible when debug is ON
    await expect(page.getByTestId('debug-dump')).toBeVisible();
    
    // DevDump should contain key debug information
    const devDump = page.getByTestId('debug-dump');
    await expect(devDump).toContainText('parsed');
    await expect(devDump).toContainText('D_SI_m');
    await expect(devDump).toContainText('model');
    await expect(devDump).toContainText('orifice');
  });

  test('D=5µm should give 400s < t < 700s with DevDump visible', async ({ page }) => {
    // Set diameter to 5 µm
    await page.fill('[data-testid="diameter-input"]', '5');
    await page.selectOption('[data-testid="diameter-unit-select"]', 'µm');
    
    // Calculate
    await page.click('[data-testid="calculate-button"]');
    await page.waitForTimeout(1000);
    
    // Check result is in expected range
    const timeResult = await page.textContent('[data-testid="time-result"]') || await page.textContent(':has-text("s"):first');
    const timeMatch = timeResult?.match(/(\d+\.?\d*)\s*s/);
    
    if (timeMatch) {
      const timeValue = parseFloat(timeMatch[1]);
      expect(timeValue).toBeGreaterThan(400);
      expect(timeValue).toBeLessThan(700);
    } else {
      // Alternative: check if we have a time display anywhere
      const timeText = await page.textContent('.text-2xl:has-text("s")');
      expect(timeText).toBeTruthy();
      
      if (timeText) {
        const time = parseFloat(timeText.replace(/[^\d.]/g, ''));
        expect(time).toBeGreaterThan(400);
        expect(time).toBeLessThan(700);
      }
    }
    
    // DevDump should be visible when debug is ON
    await expect(page.getByTestId('debug-dump')).toBeVisible();
    
    // DevDump should contain key debug information
    const devDump = page.getByTestId('debug-dump');
    await expect(devDump).toContainText('parsed');
    await expect(devDump).toContainText('D_SI_m');
    await expect(devDump).toContainText('model');
  });

  test('DevDump disappears when debug mode is turned OFF', async ({ page }) => {
    // Set diameter to 9 µm
    await page.fill('[data-testid="diameter-input"]', '9');
    await page.selectOption('[data-testid="diameter-unit-select"]', 'µm');
    
    // Calculate with debug ON
    await page.click('[data-testid="calculate-button"]');
    await page.waitForTimeout(500);
    
    // DevDump should be visible
    await expect(page.getByTestId('debug-dump')).toBeVisible();
    
    // Turn off debug mode
    await page.getByText('Debug Mode').click();
    
    // DevDump should disappear
    await expect(page.getByTestId('debug-dump')).not.toBeVisible();
    
    // But result should still be visible
    const timeText = await page.textContent('.text-2xl');
    expect(timeText).toContain('s');
  });

  test('Error case with invalid diameter shows DevDump with error info', async ({ page }) => {
    // Set invalid diameter (negative)
    await page.fill('[data-testid="diameter-input"]', '-5');
    await page.selectOption('[data-testid="diameter-unit-select"]', 'µm');
    
    // Calculate
    await page.click('[data-testid="calculate-button"]');
    await page.waitForTimeout(500);
    
    // Should show error
    await expect(page.getByText('Calculation failed')).toBeVisible();
    
    // DevDump should still be visible with error information
    await expect(page.getByTestId('debug-dump')).toBeVisible();
    
    // DevDump should contain error debug info
    const devDump = page.getByTestId('debug-dump');
    await expect(devDump).toContainText('diameterRaw');
    await expect(devDump).toContainText('-5');
  });
});