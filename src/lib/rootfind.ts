// Numerical root finding algorithms for gas transfer calculations

export interface RootFindOptions {
  tolerance?: number;
  maxIterations?: number;
  initialGuess?: number;
  bounds?: [number, number];
}

// Bisection method for finding roots
export function bisection(
  func: (x: number) => number,
  bounds: [number, number],
  options: RootFindOptions = {}
): number | null {
  const { tolerance = 1e-6, maxIterations = 100 } = options;
  let [a, b] = bounds;
  
  // Check if function changes sign over the interval
  if (func(a) * func(b) > 0) {
    return null; // No root in interval
  }
  
  for (let i = 0; i < maxIterations; i++) {
    const c = (a + b) / 2;
    const fc = func(c);
    
    if (Math.abs(fc) < tolerance || Math.abs(b - a) < tolerance) {
      return c;
    }
    
    if (func(a) * fc < 0) {
      b = c;
    } else {
      a = c;
    }
  }
  
  return (a + b) / 2; // Return best approximation
}

// Newton-Raphson method for finding roots
export function newtonRaphson(
  func: (x: number) => number,
  derivative: (x: number) => number,
  options: RootFindOptions = {}
): number | null {
  const { tolerance = 1e-6, maxIterations = 100, initialGuess = 1.0 } = options;
  let x = initialGuess;
  
  for (let i = 0; i < maxIterations; i++) {
    const fx = func(x);
    const dfx = derivative(x);
    
    if (Math.abs(dfx) < 1e-12) {
      return null; // Derivative too small
    }
    
    const newX = x - fx / dfx;
    
    if (Math.abs(newX - x) < tolerance) {
      return newX;
    }
    
    x = newX;
  }
  
  return null; // Did not converge
}

// Secant method for finding roots
export function secant(
  func: (x: number) => number,
  x0: number,
  x1: number,
  options: RootFindOptions = {}
): number | null {
  const { tolerance = 1e-6, maxIterations = 100 } = options;
  
  for (let i = 0; i < maxIterations; i++) {
    const fx0 = func(x0);
    const fx1 = func(x1);
    
    if (Math.abs(fx1 - fx0) < 1e-12) {
      return null; // Denominator too small
    }
    
    const x2 = x1 - fx1 * (x1 - x0) / (fx1 - fx0);
    
    if (Math.abs(x2 - x1) < tolerance) {
      return x2;
    }
    
    x0 = x1;
    x1 = x2;
  }
  
  return null; // Did not converge
}

// Brent's method - robust hybrid approach
export function brent(
  func: (x: number) => number,
  bounds: [number, number],
  options: RootFindOptions = {}
): number | null {
  const { tolerance = 1e-6, maxIterations = 100 } = options;
  let [a, b] = bounds;
  
  let fa = func(a);
  let fb = func(b);
  
  if (fa * fb > 0) {
    return null; // No root in interval
  }
  
  if (Math.abs(fa) < Math.abs(fb)) {
    [a, b] = [b, a];
    [fa, fb] = [fb, fa];
  }
  
  let c = a;
  let fc = fa;
  let mflag = true;
  
  for (let i = 0; i < maxIterations; i++) {
    if (Math.abs(b - a) < tolerance) {
      return b;
    }
    
    let s: number;
    
    if (fa !== fc && fb !== fc) {
      // Inverse quadratic interpolation
      s = a * fb * fc / ((fa - fb) * (fa - fc)) +
          b * fa * fc / ((fb - fa) * (fb - fc)) +
          c * fa * fb / ((fc - fa) * (fc - fb));
    } else {
      // Secant method
      s = b - fb * (b - a) / (fb - fa);
    }
    
    // Check conditions for bisection
    const delta = Math.abs(2 * 1e-12 * Math.abs(b));
    const condition1 = s < (3 * a + b) / 4 || s > b;
    const condition2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const condition3 = !mflag && Math.abs(s - b) >= Math.abs(c - a) / 2;
    const condition4 = mflag && Math.abs(b - c) < delta;
    const condition5 = !mflag && Math.abs(c - a) < delta;
    
    if (condition1 || condition2 || condition3 || condition4 || condition5) {
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }
    
    const fs = func(s);
    
    [a, c] = [b, b];
    [fa, fc] = [fb, fb];
    
    if (fa * fs < 0) {
      b = s;
      fb = fs;
    } else {
      a = s;
      fa = fs;
    }
    
    if (Math.abs(fa) < Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }
  }
  
  return b;
}