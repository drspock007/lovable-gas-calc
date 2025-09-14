/**
 * Debug System Acceptance Tests
 * Tests the debug mode functionality with localStorage persistence
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import React from 'react';
import { DebugProvider, useDebug } from '@/lib/debug-context';
import DevDump from '@/components/DevDump';
import DevPanel from '@/components/DevPanel';
import { computeDisabledReason } from '@/lib/compute-enabled';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test component that uses debug context
function TestDebugComponent() {
  const { debug } = useDebug();
  return (
    <div>
      <div data-testid="debug-state">{debug ? 'enabled' : 'disabled'}</div>
      <DevDump note={{ test: 'data' }} title="Test Debug" />
    </div>
  );
}

describe('Debug System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('DebugProvider', () => {
    it('should initialize debug state from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('1');
      
      render(
        <DebugProvider>
          <TestDebugComponent />
        </DebugProvider>
      );

      expect(localStorageMock.getItem).toHaveBeenCalledWith('debugMode');
      expect(screen.getByTestId('debug-state')).toHaveTextContent('enabled');
    });

    it('should default to false when localStorage is empty', () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(
        <DebugProvider>
          <TestDebugComponent />
        </DebugProvider>
      );

      expect(screen.getByTestId('debug-state')).toHaveTextContent('disabled');
    });

    it('should persist debug state changes to localStorage', async () => {
      render(
        <DebugProvider>
          <DevPanel />
          <TestDebugComponent />
        </DebugProvider>
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('debugMode', '1');
      });
    });
  });

  describe('DevDump Component', () => {
    it('should not render when debug is disabled', () => {
      localStorageMock.getItem.mockReturnValue('0');

      render(
        <DebugProvider>
          <TestDebugComponent />
        </DebugProvider>
      );

      expect(screen.queryByText('Test Debug')).not.toBeInTheDocument();
    });

    it('should render debug info when debug is enabled', () => {
      localStorageMock.getItem.mockReturnValue('1');

      render(
        <DebugProvider>
          <TestDebugComponent />
        </DebugProvider>
      );

      expect(screen.getByText('Test Debug')).toBeInTheDocument();
      expect(screen.getByText(JSON.stringify({ test: 'data' }, null, 2))).toBeInTheDocument();
    });

    it('should not render when note is null', () => {
      localStorageMock.getItem.mockReturnValue('1');

      render(
        <DebugProvider>
          <DevDump note={null} title="Empty Debug" />
        </DebugProvider>
      );

      expect(screen.queryByText('Empty Debug')).not.toBeInTheDocument();
    });
  });

  describe('DevPanel Component', () => {
    it('should render debug toggle checkbox', () => {
      render(
        <DebugProvider>
          <DevPanel />
        </DebugProvider>
      );

      expect(screen.getByText('Debug Mode')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should toggle debug state when checkbox is clicked', async () => {
      render(
        <DebugProvider>
          <DevPanel />
          <TestDebugComponent />
        </DebugProvider>
      );

      const checkbox = screen.getByRole('checkbox');
      const debugState = screen.getByTestId('debug-state');

      expect(debugState).toHaveTextContent('disabled');
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(debugState).toHaveTextContent('enabled');
        expect(checkbox).toBeChecked();
      });
    });
  });

  describe('Conditional Logging', () => {
    it('should pass debug flag to computeDisabledReason correctly', () => {
      const values = {
        pressureInputMode: 'gauge',
        P1: { value: '1200', unit: 'kPa' },
        P2: { value: '0', unit: 'kPa' },
        process: 'blowdown',
        patmMode: 'standard'
      };

      // Mock console.info to verify conditional logging
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      // Test with debug = false (should not log)
      computeDisabledReason(values, false);
      expect(consoleSpy).not.toHaveBeenCalled();

      // Test with debug = true (should log for P2="0")
      computeDisabledReason(values, true);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🔥 P2=0 DEBUG:',
        expect.objectContaining({
          pressureInputMode: 'gauge',
          P1_val: '1200',
          P2_val: '0'
        })
      );

      consoleSpy.mockRestore();
    });
  });
});