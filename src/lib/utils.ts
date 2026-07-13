import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Clamp a value into [min, max]. NaN / null / undefined / non-finite → min.
 * Used defensively wherever spoofed or missing telemetry values could reach
 * the render layer (e.g. `-50%` or `9999999` inflow).
 */
export function clamp(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

