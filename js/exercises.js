import { loadData, getExerciseStats, getExerciseProgress, applyChartDefaults, fmt, MissingDataError, renderDataState } from './data.js';
import { renderNav } from './nav.js';

renderNav();
applyChartDefaults();

const app = document.getElementById('app');

async function renderPage() {
  try {
    const data = await loadData();
  const exercises = getExerciseStats(data);

  if (!exercises.length) {
    renderDataState(app, 'Exercises', 'The imported CSV did not contain any exercise rows.');
    return;
  }

  let detailChart = null;

  app.innerHTML = `
    <h1 class="page-title">Exercises</h1>
    <input type="text" class="search-box" id="search" placeholder="Search exercises...">
    <div class="card table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Exercise</th>
            <th>Sessions</th>
            <th>Total Sets</th>
            <th>Total Volume</th>
            <th>Max Weight</th>
            <th>Best Set</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
    <div class="chart-container" id="detail-section" style="margin-top:1.5rem;display:none">
      <h3 id="detail-title"></h3>
      <canvas id="detailChart"></canvas>
    </div>
  `;

  function renderTable(filter = '') {
    const f = filter.toLowerCase();
    const filtered = exercises.filter(e => e.name.toLowerCase().includes(f));
    document.getElementById('tbody').innerHTML = filtered.map(e => `
      <tr data-name="${e.name}" style="cursor:pointer">
        <td>${e.name}</td>
        <td>${e.sessionCount}</td>
        <td>${e.totalSets}</td>
        <td>${fmt(e.totalVolume)} kg</td>
        <td>${e.maxWeight} kg</td>
        <td>${e.bestSet ? `${e.bestSet.weight}kg x ${e.bestSet.reps}` : '—'}</td>
      </tr>
    `).join('');
  }

  renderTable();

  document.getElementById('search').addEventListener('input', e => {
    renderTable(e.target.value);
  });

  document.getElementById('tbody').addEventListener('click', e => {
    const row = e.target.closest('tr');
    if (!row) return;
    const name = row.dataset.name;
    showDetail(name);
  });

  function showDetail(name) {
    const section = document.getElementById('detail-section');
    section.style.display = 'block';
    document.getElementById('detail-title').textContent = name + ' — Max Weight Over Time';

    const progress = getExerciseProgress(data, name);
    if (detailChart) detailChart.destroy();

    detailChart = new Chart(document.getElementById('detailChart'), {
      type: 'line',
      data: {
        labels: progress.map(p => p.date.toLocaleDateString()),
        datasets: [{
          label: 'Max Weight (kg)',
          data: progress.map(p => p.weight),
          borderColor: '#6c5ce7',
          backgroundColor: 'rgba(108, 92, 231, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: false } }
      }
    });

    section.scrollIntoView({ behavior: 'smooth' });
  }
  } catch (error) {
  if (error instanceof MissingDataError) {
    renderDataState(app, 'Exercises', 'Import a Hevy CSV from the sidebar before browsing exercise stats.');
    return;
  }

    renderDataState(app, 'Exercises', error.message || 'The imported CSV could not be loaded.');
  }
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
