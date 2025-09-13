/**
 * Flexible decimal parsing utility for international number formats
 * Handles both comma and dot as decimal separators
 */

export function parseDecimalFlexible(s: string | null | undefined): number | null {
  if (s == null || s.trim() === '') return null;
  const t = s.replace(/\s/g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validates if a string can be parsed as a valid decimal number
 * @param s String to validate
 * @returns true if valid decimal format
 */
export function isValidDecimalString(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  
  // Allow empty string as valid (will be handled as null)
  if (s.trim() === '') return true;
  
  // Pattern allows: optional minus, digits, optional decimal (comma or dot), optional digits
  const decimalPattern = /^-?\d*[.,]?\d*$/;
  return decimalPattern.test(s.trim());
}

/**
 * Normalizes a decimal string by replacing comma with dot
 * @param s Input string
 * @returns Normalized string
 */
export function normalizeDecimalString(s: string): string {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/\s/g, '').replace(',', '.');
}

/**
 * Formats a number for display with locale-appropriate decimal separator
 * @param value Number to format
 * @param locale Locale string (defaults to browser locale)
 * @returns Formatted string
 */
export function formatNumberForDisplay(value: number, locale?: string): string {
  if (!Number.isFinite(value)) return '';
  
  // Use browser locale if not specified
  const targetLocale = locale || navigator.language || 'en-US';
  
  try {
    return value.toLocaleString(targetLocale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
      useGrouping: false, // No thousands separators to avoid confusion
    });
  } catch {
    // Fallback to standard dot notation
    return value.toString();
  }
}

/**
 * Validates input values before computation
 * Returns validation errors or null if valid
 */
export function validateInputForComputation(value: any, fieldName: string, min?: number): string | null {
  // Handle string inputs by attempting to parse
  let numericValue: number;
  
  if (typeof value === 'string') {
    const parsed = parseDecimalFlexible(value);
    if (parsed === null) {
      return `${fieldName} must be a valid number`;
    }
    numericValue = parsed;
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return `${fieldName} must be a finite number`;
    }
    numericValue = value;
  } else {
    return `${fieldName} is required`;
  }
  
  // Check minimum value constraint
  if (min !== undefined && numericValue < min) {
    return `${fieldName} must be at least ${min}`;
  }
  
  return null;
}

/**
 * Validates all required input values for computation
 * @param inputs Input values object
 * @param solveFor What we're solving for
 * @returns Array of validation errors
 */
export function validateAllInputs(inputs: any, solveFor: string): string[] {
  const errors: string[] = [];
  
  // Required fields
  const volumeError = validateInputForComputation(inputs.V, 'Volume', 0);
  if (volumeError) errors.push(volumeError);
  
  const p1Error = validateInputForComputation(inputs.P1, 'Initial Pressure', 0);
  if (p1Error) errors.push(p1Error);
  
  const p2Error = validateInputForComputation(inputs.P2, 'Final Pressure', 0);
  if (p2Error) errors.push(p2Error);
  
  const tempError = validateInputForComputation(inputs.T, 'Temperature', 0);
  if (tempError) errors.push(tempError);
  
  const lengthError = validateInputForComputation(inputs.L, 'Length', 0);
  if (lengthError) errors.push(lengthError);
  
  // Conditional fields based on solveFor
  if (solveFor === 'DfromT') {
    const timeError = validateInputForComputation(inputs.t, 'Time', 0);
    if (timeError) errors.push(timeError);
  } else if (solveFor === 'TfromD') {
    const diameterError = validateInputForComputation(inputs.D, 'Diameter', 0);
    if (diameterError) errors.push(diameterError);
  }
  
  return errors;
}