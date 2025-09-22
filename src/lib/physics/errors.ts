/**
 * Specialized error classes for physics calculations
 */

/**
 * Specific error types for better user feedback
 */
export class BracketError extends Error {
  type = 'bracketing' as const;
  details: Record<string, any>;
  suggestions: string[];
  
  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'BracketError';
    this.details = details;
    this.suggestions = [
      'Try increasing target time',
      'Widen A bounds in solver settings', 
      'Set ε=1% (default) for more stable convergence'
    ];
  }
}

export class IntegralError extends Error {
  type = 'integral' as const;
  details: Record<string, any>;
  suggestions: string[];
  
  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'IntegralError';
    this.details = details;
    this.suggestions = [
      'Increase ε (e.g., 1–2%) for more stable integration',
      'Choose adiabatic=false (isothermal) for simpler model',
      'Check pressure conditions are physically reasonable'
    ];
  }
}

export class ResidualError extends Error {
  type = 'residual' as const;
  t_check: number;
  t_target: number;
  details: Record<string, any>;
  suggestions: string[];
  
  constructor(message: string, t_check: number, t_target: number, details: Record<string, any> = {}) {
    super(message);
    this.name = 'ResidualError';
    this.t_check = t_check;
    this.t_target = t_target;
    this.details = details;
    this.suggestions = [
      'Switch to alternative model',
      'Retry with different epsilon value',
      'Check input parameter accuracy'
    ];
  }
}