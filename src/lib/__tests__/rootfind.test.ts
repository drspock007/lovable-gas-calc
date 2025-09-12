import { describe, it, expect } from 'vitest';
import { bisection, newtonRaphson, secant, brent } from '../rootfind';

describe('Root Finding Algorithms', () => {
  // Test function: f(x) = x² - 4, root at x = 2
  const testFunction = (x: number) => x * x - 4;
  const testDerivative = (x: number) => 2 * x;

  describe('Bisection Method', () => {
    it('should find root correctly', () => {
      const root = bisection(testFunction, [0, 5]);
      expect(root).toBeCloseTo(2, 3);
    });

    it('should return null for invalid interval', () => {
      const root = bisection(testFunction, [3, 5]);
      expect(root).toBeNull();
    });
  });

  describe('Newton-Raphson Method', () => {
    it('should find root correctly', () => {
      const root = newtonRaphson(testFunction, testDerivative, { initialGuess: 3 });
      expect(root).toBeCloseTo(2, 5);
    });

    it('should handle zero derivative', () => {
      const constantDerivative = () => 0;
      const root = newtonRaphson(testFunction, constantDerivative);
      expect(root).toBeNull();
    });
  });

  describe('Secant Method', () => {
    it('should find root correctly', () => {
      const root = secant(testFunction, 1, 3);
      expect(root).toBeCloseTo(2, 3);
    });
  });

  describe('Brent Method', () => {
    it('should find root correctly', () => {
      const root = brent(testFunction, [0, 5]);
      expect(root).toBeCloseTo(2, 5);
    });

    it('should return null for invalid interval', () => {
      const root = brent(testFunction, [3, 5]);
      expect(root).toBeNull();
    });
  });

  describe('Performance comparison', () => {
    it('should find roots with different methods', () => {
      const polynomial = (x: number) => x * x * x - 2 * x - 5; // Root ≈ 2.094
      const derivative = (x: number) => 3 * x * x - 2;

      const bisectionRoot = bisection(polynomial, [2, 3]);
      const newtonRoot = newtonRaphson(polynomial, derivative, { initialGuess: 2.5 });
      const secantRoot = secant(polynomial, 2, 3);
      const brentRoot = brent(polynomial, [2, 3]);

      // All methods should find approximately the same root
      const expectedRoot = 2.094;
      expect(bisectionRoot).toBeCloseTo(expectedRoot, 2);
      expect(newtonRoot).toBeCloseTo(expectedRoot, 2);
      expect(secantRoot).toBeCloseTo(expectedRoot, 2);
      expect(brentRoot).toBeCloseTo(expectedRoot, 2);
    });
  });
});