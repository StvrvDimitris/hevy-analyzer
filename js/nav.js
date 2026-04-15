import { getImportedFileName, hasImportedData, importCsvFile } from './data.js';

const pages = [
  { href: 'index.html', label: 'Dashboard', icon: '<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/>' },
  { href: 'exercises.html', label: 'Exercises', icon: '<path d="M4 6h16M4 12h16M4 18h7"/>' },
  { href: 'progress.html', label: 'Progress', icon: '<path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>' },
  { href: 'frequency.html', label: 'Frequency', icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
  { href: 'strength.html', label: 'Strength', icon: '<path d="M6 6l12 12M18 6L6 18"/><path d="M4 8l4-4M16 20l4-4M20 8l-4-4M8 20l-4-4"/>' },
  { href: 'sessions.html', label: 'Sessions', icon: '<path d="M8 7V3m8 4V3M5 11h14"/><rect x="3" y="5" width="18" height="16" rx="2"/>' },
  { href: 'consistency.html', label: 'Consistency', icon: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-6"/>' },
  { href: 'conditioning.html', label: 'Conditioning', icon: '<path d="M20 12a8 8 0 10-8 8"/><path d="M12 12l5-3"/>' },
  { href: 'records.html', label: 'Records', icon: '<path d="M12 15l-3.5 2 1-4-3-2.5 4.2-.3L12 6l1.8 4.2 4.2.3-3 2.5 1 4z"/>' },
  { href: 'analysis.html', label: 'Analysis', icon: '<path d="M4 19h16"/><path d="M7 16V8"/><path d="M12 16V5"/><path d="M17 16v-3"/>' },
];

export function renderNav() {
  const current = location.pathname.split('/').pop() || 'index.html';
  const importedFile = getImportedFileName();

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = `
    <div class="nav-brand">Hevy Analyzer</div>
    ${pages.map(p => `
      <a href="${p.href}" class="${current === p.href ? 'active' : ''}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p.icon}</svg>
        ${p.label}
      </a>
    `).join('')}
    <div class="nav-import">
      <label class="nav-import-button" for="csv-import">Import CSV</label>
      <input id="csv-import" type="file" accept=".csv,text/csv" hidden>
      <div class="nav-import-status ${hasImportedData() ? 'loaded' : ''}">
        ${hasImportedData() ? importedFile : 'No CSV imported'}
      </div>
    </div>
  `;

  const toggle = document.createElement('button');
  toggle.className = 'nav-toggle';
  toggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  toggle.onclick = () => nav.classList.toggle('open');

  const fileInput = nav.querySelector('#csv-import');
  const label = nav.querySelector('.nav-import-button');
  const status = nav.querySelector('.nav-import-status');

  fileInput.addEventListener('change', async event => {
    const [file] = event.target.files || [];
    if (!file) return;

    label.textContent = 'Importing...';

    try {
      await importCsvFile(file);
      status.textContent = file.name;
      status.classList.add('loaded');
    } catch (error) {
      status.textContent = error.message;
      status.classList.remove('loaded');
    } finally {
      label.textContent = 'Import CSV';
      fileInput.value = '';
    }
  });

  document.body.prepend(nav);
  document.body.prepend(toggle);
}
