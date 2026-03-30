/** Deep-merge b into a. Arrays in b replace a (no concatenation). Null/undefined values are skipped. */
export function deepMerge<T extends Record<string, any>>(a: T, b: Partial<T>): T {
  const result = { ...a };
  for (const key of Object.keys(b) as (keyof T)[]) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const val = b[key];
    if (
      val !== undefined &&
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as any, val as any);
    } else if (val !== undefined) {
      result[key] = val as any;
    }
  }
  return result;
}
