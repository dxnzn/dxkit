let cleanup = null;

window.addEventListener('dx:mount', (e) => {
  if (e.detail.id !== 'app-settings') return;

  const container = e.detail.container;
  const dx = window.__DXKIT__;

  if (!dx.settings) {
    container.innerHTML = '<p>Settings plugin not registered.</p>';
    cleanup = () => { container.innerHTML = ''; };
    return;
  }

  // Build a settings form from declared sections
  const sections = dx.settings.getSections();
  container.innerHTML = '';

  for (const section of sections) {
    const heading = document.createElement('h2');
    heading.textContent = section.label;
    container.appendChild(heading);

    for (const def of section.definitions) {
      const row = document.createElement('div');
      row.className = 'setting-row';

      const label = document.createElement('label');
      label.textContent = def.label;

      const current = dx.settings.get(section.id, def.key) ?? def.default;

      let input;
      if (def.type === 'boolean') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!current;
        input.addEventListener('change', () => {
          dx.settings.set(section.id, def.key, input.checked);
        });
      } else if (def.type === 'select' && def.options) {
        input = document.createElement('select');
        for (const opt of def.options) {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          option.selected = opt.value === current;
          input.appendChild(option);
        }
        input.addEventListener('change', () => {
          dx.settings.set(section.id, def.key, input.value);
        });
      } else {
        input = document.createElement('input');
        input.type = def.type === 'number' ? 'number' : 'text';
        input.value = current ?? '';
        input.addEventListener('input', () => {
          const val = def.type === 'number' ? Number(input.value) : input.value;
          dx.settings.set(section.id, def.key, val);
        });
      }

      row.appendChild(label);
      row.appendChild(input);
      container.appendChild(row);
    }
  }

  cleanup = () => { container.innerHTML = ''; };
});

window.addEventListener('dx:unmount', (e) => {
  if (e.detail.id !== 'app-settings') return;
  cleanup?.();
  cleanup = null;
});
