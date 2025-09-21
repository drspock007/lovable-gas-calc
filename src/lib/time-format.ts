/**
 * Time formatting utilities to avoid "0.0 s" and use appropriate units
 */

export interface TimeDisplayResult {
  t_display: string;
  time_unit_used: string;
  raw_value: number;
}

/**
 * Format time with appropriate unit to avoid "0.0 s"
 * @param t_SI Time in seconds
 * @param decimals Number of decimal places (default: 3)
 * @returns Formatted time display result
 */
export function formatTimeDisplay(t_SI: number, decimals: number = 3): TimeDisplayResult {
  if (!Number.isFinite(t_SI) || t_SI < 0) {
    return {
      t_display: "Invalid",
      time_unit_used: "s",
      raw_value: t_SI
    };
  }

  // Choose appropriate unit based on magnitude
  if (t_SI < 1e-6) {
    // Less than 1 µs - display in µs
    const t_us = t_SI * 1e6;
    return {
      t_display: t_us.toFixed(decimals),
      time_unit_used: "µs",
      raw_value: t_us
    };
  } else if (t_SI < 1e-3) {
    // Less than 1 ms - display in ms
    const t_ms = t_SI * 1e3;
    return {
      t_display: t_ms.toFixed(decimals),
      time_unit_used: "ms",
      raw_value: t_ms
    };
  } else {
    // 1 ms or more - display in seconds
    return {
      t_display: t_SI.toFixed(decimals),
      time_unit_used: "s",
      raw_value: t_SI
    };
  }
}

/**
 * Get appropriate time unit for a given time value
 * @param t_SI Time in seconds
 * @returns Unit symbol
 */
export function getTimeUnit(t_SI: number): string {
  if (t_SI < 1e-6) return "µs";
  if (t_SI < 1e-3) return "ms";
  return "s";
}

/**
 * Convert time to display value in appropriate unit
 * @param t_SI Time in seconds
 * @returns Display value in the appropriate unit
 */
export function convertTimeToDisplay(t_SI: number): number {
  if (t_SI < 1e-6) return t_SI * 1e6; // µs
  if (t_SI < 1e-3) return t_SI * 1e3; // ms
  return t_SI; // s
}