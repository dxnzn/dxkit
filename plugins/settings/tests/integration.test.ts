import type { DappManifest, Shell, ShellConfig } from '@dnzn/dxkit';
import { createShell } from '@dnzn/dxkit';
import { createSettings } from '@dnzn/dxkit-settings';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let testCounter = 0;

function uniqueStorageKey(): string {
  return `dxkit:settings:test:integration:${++testCounter}`;
}

/** No-op loaders — avoids happy-dom DOMException on module script injection. */
const testLoaders: Pick<ShellConfig, 'lifecycle'> = {
  lifecycle: {
    scriptLoader: async () => {},
    styleLoader: async () => {},
  },
};

function optionalManifest(overrides: Partial<DappManifest> & { id: string; route: string }): DappManifest {
  return {
    name: overrides.id,
    version: '0.0.1',
    entry: `${overrides.id}/app.js`,
    nav: { label: overrides.id },
    optional: true,
    ...overrides,
  };
}

// This is the real-shell contrast to plugins/settings/tests/settings.test.ts's mocked-context
// handler-cleanup suite (D-10) — no mockContext here; every call drives the actual
// createShell -> disableDapp -> dx:dapp:disabled -> settings cleanup(dappId) wiring.
describe('settings plugin — full-shell disable-cleanup integration (TEST-03/D-10)', () => {
  let shell: Shell;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'dx-mount';
    document.body.appendChild(container);
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    if (shell) shell.destroy();
    container.remove();
    delete window.__DXKIT__;
  });

  it("prunes a disabled dapp's onChange handler through the real shell.disableDapp() call, without over-pruning an unrelated dapp's handler", async () => {
    const settingsPlugin = createSettings({ storageKey: uniqueStorageKey() });
    shell = createShell({
      ...testLoaders,
      plugins: { settings: settingsPlugin },
      manifests: [
        optionalManifest({ id: 'hello', route: '/hello' }),
        optionalManifest({ id: 'world', route: '/world' }),
      ],
    });
    await shell.init();

    const api = settingsPlugin.getSettingsAPI();
    const helloHandler = vi.fn();
    const worldHandler = vi.fn();
    api.onChange('hello', 'someKey', helloHandler);
    api.onChange('world', 'someKey', worldHandler);

    // Real shell method — drives the actual dx:dapp:disabled emit into the settings
    // plugin's cleanup('hello') subscription (plugins/settings/src/index.ts:242).
    shell.disableDapp('hello');

    // The internal store write still succeeds — cleanup prunes only handlers, not values.
    api.set('hello', 'someKey', 'newValue');
    expect(helloHandler).not.toHaveBeenCalled();

    // No over-cleanup: a different, still-enabled dapp's handler must be unaffected.
    api.set('world', 'someKey', 'stillFires');
    expect(worldHandler).toHaveBeenCalledWith('stillFires');
  });
});
