import type { Plugin } from './types/index.js';

export interface PluginRegistry {
  register(name: string, plugin: Plugin): void;
  get<T extends Plugin>(name: string): T | undefined;
  has(name: string): boolean;
  getAll(): Record<string, Plugin>;
}

export function createPluginRegistry(): PluginRegistry {
  const plugins = new Map<string, Plugin>();

  function register(name: string, plugin: Plugin): void {
    plugins.set(name, plugin);
  }

  function get<T extends Plugin>(name: string): T | undefined {
    return plugins.get(name) as T | undefined;
  }

  function has(name: string): boolean {
    return plugins.has(name);
  }

  function getAll(): Record<string, Plugin> {
    const result: Record<string, Plugin> = {};
    for (const [name, plugin] of plugins) {
      result[name] = plugin;
    }
    return result;
  }

  return { register, get, has, getAll };
}
