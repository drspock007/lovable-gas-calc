/**
 * Tests for ResidualDetails panel UI rendering
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResidualDetails } from '@/components/ResidualDetails';

// Mock the debug hook to control debug state
const mockUseDebug = vi.fn();
vi.mock('@/lib/debug-context', () => ({
  useDebug: () => mockUseDebug()
}));

// Mock devNote data
const mockDevNote = {
  process: "filling",
  residual: 0.12,
  model: "capillary", 
  epsilon_used: 0.05,
  t_target: 100.5,
  t_forward: 112.6,
  D_candidate_SI_m: 8e-6,
  A_candidate_SI_m2: 5.02e-11,
  choking: {
    r_crit: 0.528,
    choked: false,
    r: 0.75
  },
  inputs_SI: {
    V_SI_m3: 2e-7,
    P1_Pa: 101325,
    P2_Pa: 1301325,
    Ps_Pa: 2000000,
    T_K: 288.15,
    L_SI_m: 0.002,
    gas: { name: 'Air', R: 287.06, gamma: 1.4, mu: 1.825e-5 },
    Cd: 0.62,
    regime: 'isothermal'
  },
  bounds_used: {
    D_lo: 5e-6,
    D_hi: 15e-6,
    iters: 3,
    bracketed: true
  }
};

describe('ResidualDetails Panel', () => {
  it('should render with debug mode ON and panel open by default', () => {
    mockUseDebug.mockReturnValue({ debug: true });
    
    render(<ResidualDetails devNote={mockDevNote} />);

    // Panel should be present
    const accordion = screen.getByRole('button', { name: /residual details/i });
    expect(accordion).toBeInTheDocument();

    // Panel should be expanded by default in debug mode
    const content = screen.getByText(/"process": "filling"/);
    expect(content).toBeInTheDocument();

    // Check for specific values
    const residualText = screen.getByText(/"residual": 0.12/);
    expect(residualText).toBeInTheDocument();
  });

  it('should render with debug mode OFF and panel closed by default', () => {
    mockUseDebug.mockReturnValue({ debug: false });
    
    render(<ResidualDetails devNote={mockDevNote} />);

    // Panel header should be present
    const accordion = screen.getByRole('button', { name: /residual details/i });
    expect(accordion).toBeInTheDocument();

    // Content should not be visible initially (panel closed)
    const content = screen.queryByText(/"process": "filling"/);
    expect(content).not.toBeInTheDocument();
  });

  it('should display all key devNote fields in JSON format', () => {
    mockUseDebug.mockReturnValue({ debug: true });
    
    render(<ResidualDetails devNote={mockDevNote} />);

    // Check for main fields
    expect(screen.getByText(/"process": "filling"/)).toBeInTheDocument();
    expect(screen.getByText(/"residual": 0.12/)).toBeInTheDocument();
    expect(screen.getByText(/"model": "capillary"/)).toBeInTheDocument();
    expect(screen.getByText(/"t_target": 100.5/)).toBeInTheDocument();
    expect(screen.getByText(/"t_forward": 112.6/)).toBeInTheDocument();

    // Check for nested objects
    expect(screen.getByText(/"V_SI_m3": 2e-7/)).toBeInTheDocument();
    expect(screen.getByText(/"P1_Pa": 101325/)).toBeInTheDocument();
    expect(screen.getByText(/"Ps_Pa": 2000000/)).toBeInTheDocument();

    // Check choking information
    expect(screen.getByText(/"r_crit": 0.528/)).toBeInTheDocument();
    expect(screen.getByText(/"choked": false/)).toBeInTheDocument();

    // Check bounds information
    expect(screen.getByText(/"D_lo": 5e-6/)).toBeInTheDocument();
    expect(screen.getByText(/"bracketed": true/)).toBeInTheDocument();
  });

  it('should not render when devNote is null or undefined', () => {
    mockUseDebug.mockReturnValue({ debug: true });
    
    const { container } = render(<ResidualDetails devNote={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('should handle devNote with retry information', () => {
    mockUseDebug.mockReturnValue({ debug: true });
    
    const devNoteWithRetry = {
      ...mockDevNote,
      retry: {
        previous_bounds: { D_lo: 3e-6, D_hi: 10e-6 },
        new_bounds: { D_lo: 1.5e-6, D_hi: 20e-6 },
        previous_residual: 0.08,
        new_residual: 0.12,
        expand_factor: 2,
        attempt: 1
      }
    };

    render(<ResidualDetails devNote={devNoteWithRetry} />);

    // Check for retry information
    expect(screen.getByText(/"retry":/)).toBeInTheDocument();
    expect(screen.getByText(/"previous_bounds":/)).toBeInTheDocument();
    expect(screen.getByText(/"new_bounds":/)).toBeInTheDocument();
    expect(screen.getByText(/"previous_residual": 0.08/)).toBeInTheDocument();
    expect(screen.getByText(/"expand_factor": 2/)).toBeInTheDocument();
    expect(screen.getByText(/"attempt": 1/)).toBeInTheDocument();
  });

  it('should apply correct styling classes', () => {
    mockUseDebug.mockReturnValue({ debug: true });
    
    render(<ResidualDetails devNote={mockDevNote} className="custom-class" />);

    const container = screen.getByText(/"process": "filling"/).closest('div');
    expect(container).toHaveClass('bg-orange-50/50');
  });
});