import type { Context, SettingDefinition, Theme, ThemeMode } from 'dxkit';
import '@dxkit/settings';

declare module 'dxkit' {
  interface EventMap {
    'dx:plugin:theme:changed': { theme: string; mode: ThemeMode; resolved: 'light' | 'dark' };
  }
}

export interface CSSThemeOptions {
  /** Available theme names. First is the default. */
  themes?: string[];
  /** Initial mode. Default: 'system'. */
  defaultMode?: ThemeMode;
  /** localStorage key prefix. Default: 'dxkit:theme'. */
  storageKey?: string;
}

/**
 * Creates a CSS theme plugin.
 *
 * Sets `data-theme` and `data-mode` attributes on `<html>`.
 * Persists selection to localStorage. Respects `prefers-color-scheme`
 * when mode is 'system'.
 *
 * Declares settings so the settings plugin can render theme/mode controls.
 */
export function createCSSTheme(options: CSSThemeOptions = {}): Theme {
  const { themes = ['default'], defaultMode = 'system', storageKey = 'dxkit:theme' } = options;

  let currentTheme = themes[0];
  let currentMode: ThemeMode = defaultMode;
  let dx: Context | null = null;
  let settingsListener: { off(): void } | null = null;
  // Prevents re-entrant loop: theme change → settings write → settings event → theme change
  let syncing = false;

  const modeHandlers = new Set<(mode: ThemeMode, resolved: 'light' | 'dark') => void>();
  const themeHandlers = new Set<(theme: string) => void>();

  // Media query for system preference
  const mql = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function resolveMode(): 'light' | 'dark' {
    if (currentMode !== 'system') return currentMode;
    return mql?.matches ? 'dark' : 'light';
  }

  function applyToDOM(): void {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    el.setAttribute('data-theme', currentTheme);
    el.setAttribute('data-mode', resolveMode());
  }

  function canUseStorage(): boolean {
    try {
      return typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function';
    } catch {
      return false;
    }
  }

  function persist(): void {
    if (!canUseStorage()) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          theme: currentTheme,
          mode: currentMode,
        }),
      );
    } catch {
      /* storage full or blocked */
    }
  }

  function restore(): void {
    if (!canUseStorage()) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.theme && themes.includes(saved.theme)) currentTheme = saved.theme;
      if (saved.mode && ['light', 'dark', 'system'].includes(saved.mode)) currentMode = saved.mode;
    } catch {
      /* corrupted — use defaults */
    }
  }

  /** Push current theme/mode into the settings store (if available). */
  function syncToSettings(): void {
    if (!dx?.settings || syncing) return;
    syncing = true;
    dx.settings.set('theme', 'theme', currentTheme);
    dx.settings.set('theme', 'mode', currentMode);
    syncing = false;
  }

  function notifyModeChange(): void {
    const resolved = resolveMode();
    for (const handler of modeHandlers) handler(currentMode, resolved);
    dx?.events.emit('dx:plugin:theme:changed', { theme: currentTheme, mode: currentMode, resolved });
    syncToSettings();
  }

  function notifyThemeChange(): void {
    for (const handler of themeHandlers) handler(currentTheme);
    dx?.events.emit('dx:plugin:theme:changed', { theme: currentTheme, mode: currentMode, resolved: resolveMode() });
    syncToSettings();
  }

  // System preference change listener
  function onSystemChange(): void {
    if (currentMode !== 'system') return;
    applyToDOM();
    notifyModeChange();
  }

  /** React to settings changes (from settings dapp UI). */
  function onSettingsChanged(event: { dappId: string; key: string; value: unknown }): void {
    if (event.dappId !== 'theme' || syncing) return;
    if (event.key === 'theme' && typeof event.value === 'string') {
      plugin.setTheme(event.value);
    } else if (event.key === 'mode' && typeof event.value === 'string') {
      plugin.setMode(event.value as ThemeMode);
    }
  }

  // Build settings definitions from the options
  function buildSettings(): SettingDefinition[] {
    const defs: SettingDefinition[] = [];

    if (themes.length > 1) {
      defs.push({
        key: 'theme',
        label: 'Theme',
        type: 'select',
        default: themes[0],
        description: 'Color palette.',
        options: themes.map((t) => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t })),
      });
    }

    defs.push({
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: defaultMode,
      description: 'Light, dark, or match your system.',
      options: [
        { label: 'System', value: 'system' },
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
      ],
    });

    return defs;
  }

  const plugin: Theme = {
    name: 'theme',
    settings: buildSettings(),

    async init(context: Context): Promise<void> {
      dx = context;

      context.eventRegistry.registerEvent('theme', [{ name: 'dx:plugin:theme:changed' }]);

      restore();
      applyToDOM();
      mql?.addEventListener('change', onSystemChange);

      // Seed current values into settings store
      syncToSettings();

      // Listen for settings changes (from settings dapp)
      settingsListener = dx.events.on('dx:plugin:settings:changed', onSettingsChanged);
    },

    async destroy(): Promise<void> {
      mql?.removeEventListener('change', onSystemChange);
      if (settingsListener) {
        settingsListener.off();
        settingsListener = null;
      }
      modeHandlers.clear();
      themeHandlers.clear();
      dx = null;
    },

    getMode(): ThemeMode {
      return currentMode;
    },

    setMode(mode: ThemeMode): void {
      if (currentMode === mode) return;
      currentMode = mode;
      applyToDOM();
      persist();
      notifyModeChange();
    },

    toggleMode(): void {
      // Cycle order: system → light → dark → system
      const cycle: ThemeMode[] = ['system', 'light', 'dark'];
      const idx = cycle.indexOf(currentMode);
      plugin.setMode(cycle[(idx + 1) % cycle.length]);
    },

    getResolvedMode(): 'light' | 'dark' {
      return resolveMode();
    },

    onModeChange(handler: (mode: ThemeMode, resolved: 'light' | 'dark') => void): () => void {
      modeHandlers.add(handler);
      return () => modeHandlers.delete(handler);
    },

    getTheme(): string {
      return currentTheme;
    },

    setTheme(theme: string): void {
      if (currentTheme === theme) return;
      if (!themes.includes(theme)) return;
      currentTheme = theme;
      applyToDOM();
      persist();
      notifyThemeChange();
    },

    getAvailableThemes(): string[] {
      return [...themes];
    },

    onThemeChange(handler: (theme: string) => void): () => void {
      themeHandlers.add(handler);
      return () => themeHandlers.delete(handler);
    },
  };

  return plugin;
}
