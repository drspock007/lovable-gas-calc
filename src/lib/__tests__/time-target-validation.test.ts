import { describe, it, expect } from 'vitest';
import { computeDfromT, GASES } from '../physics';

describe('Time Target Validation in computeDfromT', () => {
  const baseInputs = {
    process: 'blowdown' as const,
    solveFor: 'DfromT' as const,
    V: 2e-7,
    P1: 1.2e6,
    P2: 1e3,
    T: 288.15,
    L: 0.002,
    gas: GASES.air,
    Cd: 0.62,
    epsilon: 0.01,
    regime: 'isothermal' as const
  };

  describe('Invalid time rejection', () => {
    it('should reject NaN time with clear devNote', () => {
      const inputs = { ...baseInputs, t: NaN };
      
      expect(() => computeDfromT(inputs)).toThrow('Invalid target time');
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        expect(error.devNote).toBeDefined();
        expect(error.devNote.tRaw).toBe(NaN);
        expect(error.devNote.parsed).toBe(NaN);
        expect(error.devNote.error).toContain('NaN');
      }
    });

    it('should reject zero time with clear devNote', () => {
      const inputs = { ...baseInputs, t: 0 };
      
      expect(() => computeDfromT(inputs)).toThrow('Invalid target time');
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        expect(error.devNote).toBeDefined();
        expect(error.devNote.tRaw).toBe(0);
        expect(error.devNote.parsed).toBe(0);
        expect(error.devNote.error).toContain('≤0');
      }
    });

    it('should reject negative time with clear devNote', () => {
      const inputs = { ...baseInputs, t: -10 };
      
      expect(() => computeDfromT(inputs)).toThrow('Invalid target time');
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        expect(error.devNote).toBeDefined();
        expect(error.devNote.tRaw).toBe(-10);
        expect(error.devNote.parsed).toBe(-10);
        expect(error.devNote.error).toContain('≤0');
      }
    });

    it('should reject undefined time with clear devNote', () => {
      const inputs = { ...baseInputs, t: undefined };
      
      expect(() => computeDfromT(inputs)).toThrow('Invalid target time');
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        expect(error.devNote).toBeDefined();
        expect(error.devNote.tRaw).toBeUndefined();
        expect(error.devNote.parsed).toBe(NaN);
        expect(error.devNote.error).toContain('NaN');
      }
    });
  });

  describe('Valid time acceptance', () => {
    it('should accept valid positive time', () => {
      const inputs = { ...baseInputs, t: 175 };
      
      // Should not throw
      const result = computeDfromT(inputs);
      expect(result.D).toBeGreaterThan(0);
      expect(result.D).toBeLessThan(1); // Reasonable bounds
    });

    it('should accept very small positive time', () => {
      const inputs = { ...baseInputs, t: 1e-6 };
      
      // Should not throw (though may fail for other physical reasons)
      expect(() => computeDfromT(inputs)).not.toThrow('Invalid target time');
    });

    it('should accept very large time', () => {
      const inputs = { ...baseInputs, t: 1e6 };
      
      // Should not throw (though may fail for other physical reasons)  
      expect(() => computeDfromT(inputs)).not.toThrow('Invalid target time');
    });
  });

  describe('String parsing tolerance', () => {
    it('should handle string input with comma replacement', () => {
      const inputs = { ...baseInputs, t: "175,5" as any };
      
      // Should parse as 175.5 and not throw invalid time error
      expect(() => computeDfromT(inputs)).not.toThrow('Invalid target time');
    });

    it('should handle string input with whitespace', () => {
      const inputs = { ...baseInputs, t: "  175.0  " as any };
      
      // Should parse as 175.0 and not throw invalid time error
      expect(() => computeDfromT(inputs)).not.toThrow('Invalid target time');
    });

    it('should reject empty string', () => {
      const inputs = { ...baseInputs, t: "" as any };
      
      expect(() => computeDfromT(inputs)).toThrow('Invalid target time');
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        expect(error.devNote.tRaw).toBe("");
        expect(error.devNote.parsed).toBe(NaN);
      }
    });

    it('should reject invalid string', () => {
      const inputs = { ...baseInputs, t: "abc" as any };
      
      expect(() => computeDfromT(inputs)).toThrow('Invalid target time');
      
      try {
        computeDfromT(inputs);
      } catch (error: any) {
        expect(error.devNote.tRaw).toBe("abc");
        expect(error.devNote.parsed).toBe(NaN);
      }
    });
  });
});