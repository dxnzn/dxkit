import type { Plugin } from '@dnzn/dxkit';
import { createPluginRegistry } from '@dnzn/dxkit';
import { describe, expect, it } from 'vitest';

function stubPlugin(name: string): Plugin {
  return { name };
}

describe('PluginRegistry', () => {
  it('registers and retrieves a plugin', () => {
    const registry = createPluginRegistry();
    const plugin = stubPlugin('wallet');

    registry.register('wallet', plugin);

    expect(registry.get('wallet')).toBe(plugin);
  });

  it('returns undefined for unregistered plugins', () => {
    const registry = createPluginRegistry();

    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('has() returns correct boolean', () => {
    const registry = createPluginRegistry();
    const plugin = stubPlugin('theme');

    expect(registry.has('theme')).toBe(false);

    registry.register('theme', plugin);

    expect(registry.has('theme')).toBe(true);
  });

  it('getAll() returns all registered plugins', () => {
    const registry = createPluginRegistry();
    const wallet = stubPlugin('wallet');
    const theme = stubPlugin('theme');

    registry.register('wallet', wallet);
    registry.register('theme', theme);

    const all = registry.getAll();

    expect(all).toEqual({ wallet, theme });
  });

  it('getAll() returns a new object each time', () => {
    const registry = createPluginRegistry();
    registry.register('wallet', stubPlugin('wallet'));

    const a = registry.getAll();
    const b = registry.getAll();

    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('supports typed retrieval via generics', () => {
    const registry = createPluginRegistry();

    interface CustomPlugin extends Plugin {
      customMethod(): string;
    }

    const plugin: CustomPlugin = {
      name: 'custom',
      customMethod: () => 'hello',
    };

    registry.register('custom', plugin);

    const retrieved = registry.get<CustomPlugin>('custom');
    expect(retrieved?.customMethod()).toBe('hello');
  });
});
