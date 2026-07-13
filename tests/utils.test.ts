import { describe, expect, it } from 'vitest';
import { deepMerge } from '../src/utils.js';

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3 });
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it('merges nested objects recursively', () => {
    const result = deepMerge({ nav: { label: 'Test', order: 0 } }, { nav: { order: 5 } });
    expect(result).toEqual({ nav: { label: 'Test', order: 5 } });
  });

  it('merges deeply nested objects', () => {
    const result = deepMerge({ a: { b: { c: 1, d: 2 }, e: 3 } }, { a: { b: { c: 99 } } });
    expect(result).toEqual({ a: { b: { c: 99, d: 2 }, e: 3 } });
  });

  it('replaces arrays instead of merging', () => {
    const result = deepMerge({ tags: ['a', 'b', 'c'] }, { tags: ['x'] });
    expect(result).toEqual({ tags: ['x'] });
  });

  it('replaces nested arrays wholesale, not just top-level ones', () => {
    const result = deepMerge({ nav: { label: 'Test', tags: ['a', 'b'] } }, { nav: { tags: ['x'] } });
    expect(result).toEqual({ nav: { label: 'Test', tags: ['x'] } });
  });

  it('replaces primitives', () => {
    const result = deepMerge({ name: 'old', count: 1 }, { name: 'new', count: 2 });
    expect(result).toEqual({ name: 'new', count: 2 });
  });

  it('ignores undefined values in override', () => {
    const result = deepMerge({ a: 1, b: 2 }, { a: undefined });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('replaces with null', () => {
    const result = deepMerge({ a: { nested: true } }, { a: null as any });
    expect(result).toEqual({ a: null });
  });

  it('replaces object with primitive', () => {
    const result = deepMerge({ a: { nested: true } }, { a: 'replaced' as any });
    expect(result).toEqual({ a: 'replaced' });
  });

  it('replaces primitive with object', () => {
    const result = deepMerge({ a: 'string' as any }, { a: { nested: true } as any });
    expect(result).toEqual({ a: { nested: true } });
  });

  it('adds new keys from override', () => {
    const result = deepMerge({ a: 1 } as any, { b: 2 } as any);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('rejects __proto__ keys to prevent prototype pollution', () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}}');
    const result = deepMerge({ a: 1 }, malicious);
    expect(result.a).toBe(1);
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.hasOwn(result, '__proto__')).toBe(false);
  });

  it('rejects constructor keys to prevent prototype pollution', () => {
    const result = deepMerge({ a: 1 }, { constructor: { polluted: true } } as any);
    expect(result.a).toBe(1);
    expect(Object.hasOwn(result, 'constructor')).toBe(false);
  });

  it('rejects prototype keys to prevent prototype pollution', () => {
    const result = deepMerge({ a: 1 }, { prototype: { polluted: true } } as any);
    expect(result.a).toBe(1);
    expect(Object.hasOwn(result, 'prototype')).toBe(false);
  });

  it('rejects dangerous keys in nested merges', () => {
    const malicious = JSON.parse('{"nested": {"__proto__": {"polluted": true}}}');
    const result = deepMerge({ nested: { safe: 1 } }, malicious);
    expect(result.nested.safe).toBe(1);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('rejects constructor/prototype keys one level deep in nested merges', () => {
    const maliciousConstructor = JSON.parse('{"nested": {"constructor": {"polluted": true}}}');
    const resultConstructor = deepMerge({ nested: { safe: 1 } }, maliciousConstructor);
    expect(resultConstructor.nested.safe).toBe(1);
    expect(Object.hasOwn(resultConstructor.nested, 'constructor')).toBe(false);

    const maliciousPrototype = JSON.parse('{"nested": {"prototype": {"polluted": true}}}');
    const resultPrototype = deepMerge({ nested: { safe: 1 } }, maliciousPrototype);
    expect(resultPrototype.nested.safe).toBe(1);
    expect(Object.hasOwn(resultPrototype.nested, 'prototype')).toBe(false);
  });

  it('does not mutate either input', () => {
    const a = { nav: { label: 'Test', order: 0 } };
    const b = { nav: { order: 5 } };
    deepMerge(a, b);
    expect(a).toEqual({ nav: { label: 'Test', order: 0 } });
    expect(b).toEqual({ nav: { order: 5 } });
  });
});
