/**
 * Acceptance tests for ErrorDebugPanel component
 * Tests the systematic display of debug details for errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorDebugPanel } from '@/components/ErrorDebugPanel';
import { DebugProvider } from '@/lib/debug-context';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock URL search params
const mockURLSearchParams = vi.fn();
Object.defineProperty(window, 'URLSearchParams', {
  value: mockURLSearchParams,
});

describe('ErrorDebugPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockURLSearchParams.mockImplementation(() => ({
      get: vi.fn().mockReturnValue(null)
    }));
  });

  it('should always show debug panel when error has devNote (debug mode OFF)', () => {
    mockLocalStorage.getItem.mockReturnValue('0'); // Debug mode OFF
    
    const errorWithDevNote = {
      message: "No valid solution found",
      devNote: { residual: 0.5, iterations: 10 }
    };

    render(
      <DebugProvider>
        <ErrorDebugPanel error={errorWithDevNote} />
      </DebugProvider>
    );

    // Panel should be present
    expect(screen.getByText('Debug details')).toBeInTheDocument();
    
    // Content should show the devNote JSON
    expect(screen.getByText(/"residual": 0\.5/)).toBeInTheDocument();
    expect(screen.getByText(/"iterations": 10/)).toBeInTheDocument();
  });

  it('should open panel by default when ?debug=1 in URL', () => {
    mockURLSearchParams.mockImplementation(() => ({
      get: vi.fn((param) => param === 'debug' ? '1' : null)
    }));

    const errorWithDevNote = {
      devNote: { test: "data" }
    };

    render(
      <DebugProvider>
        <ErrorDebugPanel error={errorWithDevNote} />
      </DebugProvider>
    );

    // Should find expanded content since panel opens by default
    expect(screen.getByText(/"test": "data"/)).toBeInTheDocument();
  });

  it('should open panel by default when localStorage.debugMode==="1"', () => {
    mockLocalStorage.getItem.mockReturnValue('1'); // Debug mode ON
    
    const errorWithDevNote = {
      devNote: { test: "localStorage debug" }
    };

    render(
      <DebugProvider>
        <ErrorDebugPanel error={errorWithDevNote} />
      </DebugProvider>
    );

    // Should find expanded content since panel opens by default
    expect(screen.getByText(/"test": "localStorage debug"/)).toBeInTheDocument();
  });

  it('should not render when no devNote available', () => {
    const errorWithoutDevNote = {
      message: "Some error without debug info"
    };

    render(
      <DebugProvider>
        <ErrorDebugPanel error={errorWithoutDevNote} />
      </DebugProvider>
    );

    // Panel should not be present
    expect(screen.queryByText('Debug details')).not.toBeInTheDocument();
  });

  it('should prioritize direct devNote prop over error.devNote', () => {
    const errorWithDevNote = {
      devNote: { source: "error" }
    };
    const directDevNote = { source: "direct" };

    render(
      <DebugProvider>
        <ErrorDebugPanel error={errorWithDevNote} devNote={directDevNote} />
      </DebugProvider>
    );

    // Should show direct devNote, not error devNote
    expect(screen.getByText(/"source": "direct"/)).toBeInTheDocument();
    expect(screen.queryByText(/"source": "error"/)).not.toBeInTheDocument();
  });

  it('should handle "No valid solution found" error specifically', () => {
    const noSolutionError = {
      message: "No valid solution found",
      devNote: { 
        bounds_used: { A_lo: 1e-9, A_hi: 1e-3 },
        residual: 0.2,
        boundary_hit: "A_hi"
      }
    };

    render(
      <DebugProvider>
        <ErrorDebugPanel error={noSolutionError} />
      </DebugProvider>
    );

    // Panel should always be visible for this error type
    expect(screen.getByText('Debug details')).toBeInTheDocument();
    expect(screen.getByText(/"boundary_hit": "A_hi"/)).toBeInTheDocument();
    expect(screen.getByText(/"residual": 0\.2/)).toBeInTheDocument();
  });
});