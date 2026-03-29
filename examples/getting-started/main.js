const shell = DxKit.createShell({
  plugins: {
    theme: DxTheme.createCSSTheme({ themes: ['default', 'midnight'] }),
    settings: DxSettings.createSettings(),
  },
  dapps: [
    { manifest: 'dashboard/manifest.json' },
    { manifest: 'settings/manifest.json' },
  ],
  mode: 'hash',
});

// Build nav from manifests after init
shell.init().then(() => {
  const nav = document.getElementById('app-nav');
  const manifests = shell.getEnabledManifests();

  manifests
    .filter(m => !m.nav.hidden)
    .sort((a, b) => (a.nav.order ?? 0) - (b.nav.order ?? 0))
    .forEach(m => {
      const link = document.createElement('a');
      link.href = m.route;
      link.textContent = m.nav.label;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        shell.navigate(m.route);
      });
      nav.appendChild(link);
    });
});
