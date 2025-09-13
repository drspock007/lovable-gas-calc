import { describe, it, expect } from 'vitest';
import { parseDecimalFlexible, isValidDecimalString, normalizeDecimalString, validateInputForComputation } from '../decimal-utils';

describe('Decimal Utils', () => {
  describe('parseDecimalFlexible', () => {
    it('should parse comma decimal separator', () => {
      expect(parseDecimalFlexible('0,25')).toBe(0.25);
      expect(parseDecimalFlexible('123,456')).toBe(123.456);
    });

    it('should parse dot decimal separator', () => {
      expect(parseDecimalFlexible('0.25')).toBe(0.25);
      expect(parseDecimalFlexible('123.456')).toBe(123.456);
    });

    it('should handle complex international formats', () => {
      expect(parseDecimalFlexible('1.250,5')).toBe(1250.5);
      expect(parseDecimalFlexible('1 250,5')).toBe(1250.5);
      expect(parseDecimalFlexible(' 1250.5 ')).toBe(1250.5);
    });

    it('should handle negative numbers', () => {
      expect(parseDecimalFlexible('-0,25')).toBe(-0.25);
      expect(parseDecimalFlexible('-123.456')).toBe(-123.456);
    });

    it('should handle edge cases', () => {
      expect(parseDecimalFlexible('')).toBeNull();
      expect(parseDecimalFlexible('abc')).toBeNull();
      expect(parseDecimalFlexible('12.34.56')).toBeNull();
    });

    it('should accept very small decimal values', () => {
      expect(parseDecimalFlexible('0.00075')).toBe(0.00075);
      expect(parseDecimalFlexible('0,00075')).toBe(0.00075);
    });
  });

  describe('isValidDecimalString', () => {
    it('should validate correct decimal formats', () => {
      expect(isValidDecimalString('123')).toBe(true);
      expect(isValidDecimalString('123.456')).toBe(true);
      expect(isValidDecimalString('123,456')).toBe(true);
      expect(isValidDecimalString('-123.456')).toBe(true);
      expect(isValidDecimalString('0.00075')).toBe(true);
      expect(isValidDecimalString('')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidDecimalString('abc')).toBe(false);
      expect(isValidDecimalString('12.34.56')).toBe(false);
      expect(isValidDecimalString('12,34,56')).toBe(false);
    });
  });

  describe('normalizeDecimalString', () => {
    it('should normalize decimal separators', () => {
      expect(normalizeDecimalString('123,456')).toBe('123.456');
      expect(normalizeDecimalString('123.456')).toBe('123.456');
      expect(normalizeDecimalString(' 123,456 ')).toBe('123.456');
    });
  });

  describe('validateInputForComputation', () => {
    it('should validate numeric inputs', () => {
      expect(validateInputForComputation(123.45, 'Volume')).toBeNull();
      expect(validateInputForComputation('123,45', 'Volume')).toBeNull();
      expect(validateInputForComputation(0.00075, 'Volume')).toBeNull();
    });

    it('should respect minimum values', () => {
      expect(validateInputForComputation(-1, 'Volume', 0)).toBe('Volume must be at least 0');
      expect(validateInputForComputation(5, 'Volume', 10)).toBe('Volume must be at least 10');
    });

    it('should reject invalid inputs', () => {
      expect(validateInputForComputation('abc', 'Volume')).toBe('Volume must be a valid number');
      expect(validateInputForComputation(NaN, 'Volume')).toBe('Volume must be a finite number');
      expect(validateInputForComputation(Infinity, 'Volume')).toBe('Volume must be a finite number');
    });
  });
});