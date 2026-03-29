let cleanup = null;

window.addEventListener('dx:mount', (e) => {
  if (e.detail.id !== 'dashboard') return;

  const container = e.detail.container;
  container.innerHTML = `
    <h1>Dashboard</h1>
    <p>Current path: ${e.detail.path}</p>
  `;

  // Access plugins via the context bridge
  const dx = window.__DXKIT__;
  const theme = dx.getPlugin('theme');

  if (theme) {
    const btn = document.createElement('button');
    btn.textContent = `Mode: ${theme.getMode()}`;
    btn.addEventListener('click', () => theme.toggleMode());
    container.appendChild(btn);

    // Use dx.events.on() for plugin events (not window.addEventListener)
    const unsub = dx.events.on('dx:plugin:theme:changed', ({ mode }) => {
      btn.textContent = `Mode: ${mode}`;
    });

    cleanup = () => {
      unsub();
      container.innerHTML = '';
    };
  } else {
    cleanup = () => { container.innerHTML = ''; };
  }
});

window.addEventListener('dx:unmount', (e) => {
  if (e.detail.id !== 'dashboard') return;
  cleanup?.();
  cleanup = null;
});
