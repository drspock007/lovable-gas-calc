import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsTimeFromD } from '@/components/ResultsTimeFromD';
import { DebugProvider } from '@/lib/debug-context';

// Mock DevDump component to capture props
vi.mock('@/components/DevDump', () => ({
  default: ({ note, title }: { note: any; title: string }) => (
    <div data-testid="debug-dump">
      <div data-testid="debug-title">{title}</div>
      <pre data-testid="debug-content">{JSON.stringify(note, null, 2)}</pre>
    </div>
  )
}));

describe('ResultsTimeFromD - Error handling with devNote', () => {
  const DebugWrapper = ({ children, debug = true }: { children: React.ReactNode; debug?: boolean }) => {
    // Mock debug context
    const mockDebugContext = {
      debug,
      setDebug: vi.fn()
    };
    
    return (
      <div>
        {React.cloneElement(children as React.ReactElement, {
          ...((children as React.ReactElement).props),
          debug: mockDebugContext
        })}
      </div>
    );
  };

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  it('should show error message and devNote JSON when calculation fails', () => {
    const errorObj = {
      message: "Boom",
      devNote: { probe: 1, test: "error data" }
    };

    const mockResult = null; // No valid result
    const mockDevNote = { probe: 1, test: "error data" };

    render(
      <DebugProvider>
        <ResultsTimeFromD
          result={mockResult}
          error={errorObj}
          devNote={mockDevNote}
          unitTime="s"
        />
      </DebugProvider>
    );

    // Should show error message
    expect(screen.getByText('Calculation failed')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();

    // Should show DevDump with error devNote
    expect(screen.getByTestId('debug-dump')).toBeInTheDocument();
    expect(screen.getByTestId('debug-title')).toHaveTextContent('Time-from-D Debug');
    
    // Should contain the probe value in JSON
    const debugContent = screen.getByTestId('debug-content');
    expect(debugContent).toHaveTextContent('"probe": 1');
    expect(debugContent).toHaveTextContent('"test": "error data"');
  });

  it('should prioritize result debugNote over error devNote', () => {
    const errorObj = {
      message: "Boom",
      devNote: { probe: 1 }
    };

    const mockResult = {
      t_SI_s: 175.5,
      model: "orifice",
      debugNote: { success: true, calculated: 175.5 }
    };

    const mockDevNote = { probe: 1 };

    render(
      <DebugProvider>
        <ResultsTimeFromD
          result={mockResult}
          error={errorObj}
          devNote={mockDevNote}
          unitTime="s"
        />
      </DebugProvider>
    );

    // Should show successful result
    expect(screen.getByText('175.500 s')).toBeInTheDocument();
    expect(screen.getByText('Model: orifice')).toBeInTheDocument();

    // Should show DevDump with success debugNote (not error)
    expect(screen.getByTestId('debug-dump')).toBeInTheDocument();
    const debugContent = screen.getByTestId('debug-content');
    expect(debugContent).toHaveTextContent('"success": true');
    expect(debugContent).toHaveTextContent('"calculated": 175.5');
    expect(debugContent).not.toHaveTextContent('"probe": 1');
  });

  it('should not show DevDump when debug context is disabled', () => {
    const errorObj = {
      message: "Boom",
      devNote: { probe: 1 }
    };

    // Create wrapper with debug disabled
    const DebugDisabledWrapper = ({ children }: { children: React.ReactNode }) => (
      <DebugProvider>
        <div data-debug="false">
          {children}
        </div>
      </DebugProvider>
    );

    render(
      <DebugDisabledWrapper>
        <ResultsTimeFromD
          result={null}
          error={errorObj}
          devNote={{ probe: 1 }}
          unitTime="s"
        />
      </DebugDisabledWrapper>
    );

    // Should show error message
    expect(screen.getByText('Calculation failed')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();

    // Should NOT show DevDump when debug is off
    expect(screen.queryByTestId('debug-dump')).not.toBeInTheDocument();
  });
});