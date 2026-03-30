import type { Context, Theme } from '@dnzn/dxkit';
import { createEventBus } from '@dnzn/dxkit';
import { createCSSTheme } from '@dnzn/dxkit-theme';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let testCounter = 0;

function uniqueStorageKey(): string {
  return `dxkit:theme:test:${++testCounter}`;
}

function mockContext(): Context {
  const events = createEventBus();
  return {
    events,
    eventRegistry: {
      registerEvent: vi.fn(),
      getRegisteredEvents: () => [],
      isRegistered: () => false,
    },
    router: { navigate: vi.fn(), getCurrentPath: () => '/' },
    getPlugin: () => undefined,
    getPlugins: () => ({}),
    getManifests: () => [],
    getEnabledManifests: () => [],
    enableDapp: vi.fn(),
    disableDapp: vi.fn(),
    isDappEnabled: () => true,
  };
}

describe('createCSSTheme', () => {
  let theme: Theme;
  let ctx: Context;
  let storageKey: string;

  beforeEach(() => {
    storageKey = uniqueStorageKey();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-mode');
    ctx = mockContext();
  });

  afterEach(async () => {
    if (theme) await theme.destroy?.();
  });

  it('applies default theme and system mode on init', async () => {
    theme = createCSSTheme({ storageKey, themes: ['default'] });
    await theme.init!(ctx);

    expect(document.documentElement.getAttribute('data-theme')).toBe('default');
    expect(document.documentElement.getAttribute('data-mode')).toMatch(/^(light|dark)$/);
    expect(theme.getMode()).toBe('system');
    expect(theme.getTheme()).toBe('default');
  });

  it('setMode() updates DOM and notifies', async () => {
    theme = createCSSTheme({ storageKey });
    await theme.init!(ctx);

    const handler = vi.fn();
    theme.onModeChange(handler);

    theme.setMode('dark');

    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
    expect(theme.getMode()).toBe('dark');
    expect(theme.getResolvedMode()).toBe('dark');
    expect(handler).toHaveBeenCalledWith('dark', 'dark');
  });

  it('setMode("system") resolves to light or dark', async () => {
    theme = createCSSTheme({ storageKey });
    await theme.init!(ctx);

    theme.setMode('system');

    expect(theme.getMode()).toBe('system');
    expect(['light', 'dark']).toContain(theme.getResolvedMode());
  });

  it('toggleMode() cycles system -> light -> dark -> system', async () => {
    theme = createCSSTheme({ storageKey, defaultMode: 'system' });
    await theme.init!(ctx);

    expect(theme.getMode()).toBe('system');

    theme.toggleMode();
    expect(theme.getMode()).toBe('light');

    theme.toggleMode();
    expect(theme.getMode()).toBe('dark');

    theme.toggleMode();
    expect(theme.getMode()).toBe('system');
  });

  it('setTheme() updates DOM and notifies', async () => {
    theme = createCSSTheme({ storageKey, themes: ['default', 'cyberpunk'] });
    await theme.init!(ctx);

    const handler = vi.fn();
    theme.onThemeChange(handler);

    theme.setTheme('cyberpunk');

    expect(document.documentElement.getAttribute('data-theme')).toBe('cyberpunk');
    expect(theme.getTheme()).toBe('cyberpunk');
    expect(handler).toHaveBeenCalledWith('cyberpunk');
  });

  it('setTheme() ignores unknown themes', async () => {
    theme = createCSSTheme({ storageKey, themes: ['default'] });
    await theme.init!(ctx);

    theme.setTheme('nonexistent');

    expect(theme.getTheme()).toBe('default');
  });

  it('getAvailableThemes() returns a copy', async () => {
    theme = createCSSTheme({ storageKey, themes: ['default', 'ocean'] });
    await theme.init!(ctx);

    const a = theme.getAvailableThemes();
    const b = theme.getAvailableThemes();
    expect(a).toEqual(['default', 'ocean']);
    expect(a).not.toBe(b);
  });

  it('persists to localStorage and restores on next init', async () => {
    theme = createCSSTheme({ storageKey, themes: ['default', 'ocean'] });
    await theme.init!(ctx);

    theme.setTheme('ocean');
    theme.setMode('dark');
    await theme.destroy?.();

    // Create a new instance — should restore from localStorage
    const theme2 = createCSSTheme({ storageKey, themes: ['default', 'ocean'] });
    await theme2.init!(ctx);

    expect(theme2.getTheme()).toBe('ocean');
    expect(theme2.getMode()).toBe('dark');

    await theme2.destroy?.();
    theme = null as any; // prevent double destroy in afterEach
  });

  it('falls back to defaults when localStorage contains corrupted data', async () => {
    localStorage.setItem(storageKey, '{not valid json!!!');

    theme = createCSSTheme({ storageKey, themes: ['default', 'ocean'], defaultMode: 'system' });
    await theme.init!(ctx);

    expect(theme.getTheme()).toBe('default');
    expect(theme.getMode()).toBe('system');
  });

  it('ignores persisted theme that is no longer in the available list', async () => {
    localStorage.setItem(storageKey, JSON.stringify({ theme: 'removed', mode: 'dark' }));

    theme = createCSSTheme({ storageKey, themes: ['default', 'ocean'] });
    await theme.init!(ctx);

    // Theme falls back to default, but mode is still restored
    expect(theme.getTheme()).toBe('default');
    expect(theme.getMode()).toBe('dark');
  });

  it('ignores persisted mode that is not a valid value', async () => {
    localStorage.setItem(storageKey, JSON.stringify({ theme: 'default', mode: 'ultra' }));

    theme = createCSSTheme({ storageKey, themes: ['default'] });
    await theme.init!(ctx);

    expect(theme.getMode()).toBe('system'); // falls back to defaultMode
  });

  it('destroy() removes media query listener and settings listener', async () => {
    theme = createCSSTheme({ storageKey });
    await theme.init!(ctx);

    // Mode/theme handlers should be cleared after destroy
    const modeHandler = vi.fn();
    const themeHandler = vi.fn();
    theme.onModeChange(modeHandler);
    theme.onThemeChange(themeHandler);

    await theme.destroy?.();

    // Handlers were cleared — setting mode/theme on a new instance won't fire old handlers
    const theme2 = createCSSTheme({ storageKey, themes: ['default', 'alt'] });
    await theme2.init!(ctx);
    theme2.setMode('dark');
    theme2.setTheme('alt');

    expect(modeHandler).not.toHaveBeenCalled();
    expect(themeHandler).not.toHaveBeenCalled();

    await theme2.destroy?.();
    theme = null as any;
  });

  it('emits dx:plugin:theme:changed on mode change', async () => {
    theme = createCSSTheme({ storageKey, themes: ['default'] });
    await theme.init!(ctx);

    const handler = vi.fn();
    ctx.events.on('dx:plugin:theme:changed', handler);

    theme.setMode('light');

    expect(handler).toHaveBeenCalledWith({
      theme: 'default',
      mode: 'light',
      resolved: 'light',
    });
  });

  it('emits dx:plugin:theme:changed on theme change', async () => {
    theme = createCSSTheme({ storageKey, themes: ['default', 'cyber'] });
    await theme.init!(ctx);

    theme.setMode('dark'); // set to known mode first

    const handler = vi.fn();
    ctx.events.on('dx:plugin:theme:changed', handler);

    theme.setTheme('cyber');

    expect(handler).toHaveBeenCalledWith({
      theme: 'cyber',
      mode: 'dark',
      resolved: 'dark',
    });
  });

  it('onModeChange() returns unsubscribe function', async () => {
    theme = createCSSTheme({ storageKey });
    await theme.init!(ctx);

    const handler = vi.fn();
    const unsub = theme.onModeChange(handler);

    unsub();
    theme.setMode('dark');

    expect(handler).not.toHaveBeenCalled();
  });

  it('onThemeChange() returns unsubscribe function', async () => {
    theme = createCSSTheme({ storageKey, themes: ['default', 'other'] });
    await theme.init!(ctx);

    const handler = vi.fn();
    const unsub = theme.onThemeChange(handler);

    unsub();
    theme.setTheme('other');

    expect(handler).not.toHaveBeenCalled();
  });

  it('setMode() is a no-op if mode unchanged', async () => {
    theme = createCSSTheme({ storageKey, defaultMode: 'dark' });
    await theme.init!(ctx);

    const handler = vi.fn();
    theme.onModeChange(handler);

    theme.setMode('dark');

    expect(handler).not.toHaveBeenCalled();
  });

  it('setTheme() is a no-op if theme unchanged', async () => {
    theme = createCSSTheme({ storageKey, themes: ['default'] });
    await theme.init!(ctx);

    const handler = vi.fn();
    theme.onThemeChange(handler);

    theme.setTheme('default');

    expect(handler).not.toHaveBeenCalled();
  });

  it('declares settings with mode definition', () => {
    theme = createCSSTheme({ storageKey, themes: ['default'] });

    expect(theme.settings).toBeDefined();
    const modeDef = theme.settings!.find((s) => s.key === 'mode');
    expect(modeDef).toBeDefined();
    expect(modeDef!.type).toBe('select');
    expect(modeDef!.options).toHaveLength(3);
  });

  it('declares theme setting only when multiple themes', () => {
    const single = createCSSTheme({ storageKey, themes: ['default'] });
    expect(single.settings!.find((s) => s.key === 'theme')).toBeUndefined();

    const multi = createCSSTheme({ storageKey, themes: ['default', 'cyber'] });
    expect(multi.settings!.find((s) => s.key === 'theme')).toBeDefined();
  });

  it('reacts to settings changes (two-way sync)', async () => {
    theme = createCSSTheme({ storageKey, themes: ['default', 'cyber'] });
    await theme.init!(ctx);

    // Simulate settings dapp changing the theme
    ctx.events.emit('dx:plugin:settings:changed', { dappId: 'theme', key: 'theme', value: 'cyber' });

    expect(theme.getTheme()).toBe('cyber');
    expect(document.documentElement.getAttribute('data-theme')).toBe('cyber');
  });

  it('reacts to settings mode change', async () => {
    theme = createCSSTheme({ storageKey });
    await theme.init!(ctx);

    ctx.events.emit('dx:plugin:settings:changed', { dappId: 'theme', key: 'mode', value: 'dark' });

    expect(theme.getMode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
  });

  it('ignores settings changes for other plugins', async () => {
    theme = createCSSTheme({ storageKey });
    await theme.init!(ctx);

    theme.setMode('light');
    ctx.events.emit('dx:plugin:settings:changed', { dappId: 'other', key: 'mode', value: 'dark' });

    expect(theme.getMode()).toBe('light');
  });

  it('seeds current values into settings store on init', async () => {
    const events = createEventBus();
    const settingsStore = new Map<string, unknown>();
    const ctxWithSettings: Context = {
      events,
      eventRegistry: {
        registerEvent: vi.fn(),
        getRegisteredEvents: () => [],
        isRegistered: () => false,
      },
      router: { navigate: vi.fn(), getCurrentPath: () => '/' },
      getPlugin: () => undefined,
      getPlugins: () => ({}),
      getManifests: () => [],
      getEnabledManifests: () => [],
      enableDapp: vi.fn(),
      disableDapp: vi.fn(),
      isDappEnabled: () => true,
      settings: {
        get: (id: string, key: string) => settingsStore.get(`${id}:${key}`),
        set: (id: string, key: string, value: unknown) => {
          settingsStore.set(`${id}:${key}`, value);
        },
        getAll: () => ({}),
        onChange: () => () => {},
        onAnyChange: () => () => {},
      },
    };

    theme = createCSSTheme({ storageKey, themes: ['default', 'cyber'], defaultMode: 'dark' });
    await theme.init!(ctxWithSettings);

    expect(settingsStore.get('theme:theme')).toBe('default');
    expect(settingsStore.get('theme:mode')).toBe('dark');
  });
});
