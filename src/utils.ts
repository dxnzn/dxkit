/** Recursive Partial<T> — nested objects stay optional at every depth, matching deepMerge's actual runtime contract. */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/** Deep-merge b into a. Arrays in b replace a (no concatenation). Undefined values in b are skipped; null replaces a's value. */
export function deepMerge<T extends Record<string, any>>(a: T, b: DeepPartial<T>): T {
  const result: Record<string, any> = { ...a };
  // DeepPartial<T>'s conditional type can't be indexed by keyof T when T is a generic type
  // parameter (TS2536) — the implementation is correct at runtime, so widen locally to index.
  const overrides = b as Record<string, any>;
  for (const key of Object.keys(overrides)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const val = overrides[key];
    if (
      val !== undefined &&
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], val);
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result as T;
}
