import { loadData, getExerciseStats, getExerciseProgress, applyChartDefaults, MissingDataError, renderDataState } from './data.js';
import { renderNav } from './nav.js';

renderNav();
applyChartDefaults();

const app = document.getElementById('app');

async function renderPage() {
  try {
    const data = await loadData();
  const exercises = getExerciseStats(data);

  if (!exercises.length) {
    renderDataState(app, 'Strength Progress', 'The imported CSV did not contain any exercise rows.');
    return;
  }

  let chart = null;

  app.innerHTML = `
    <h1 class="page-title">Strength Progress</h1>
    <select id="exercise-select">
      ${exercises.map(e => `<option value="${e.name}">${e.name} (${e.sessionCount} sessions)</option>`).join('')}
    </select>
    <div class="chart-container" style="margin-top:1.5rem">
      <h3 id="chart-title"></h3>
      <canvas id="progressChart"></canvas>
    </div>
    <div class="stats-grid" id="exercise-stats" style="margin-top:1.5rem"></div>
  `;

  function render(name) {
    const progress = getExerciseProgress(data, name);
    const stat = exercises.find(e => e.name === name);
    document.getElementById('chart-title').textContent = name;

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('progressChart'), {
      type: 'line',
      data: {
        labels: progress.map(p => p.date.toLocaleDateString()),
        datasets: [
          {
            label: 'Max Weight (kg)',
            data: progress.map(p => p.weight),
            borderColor: '#6c5ce7',
            backgroundColor: 'rgba(108, 92, 231, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            yAxisID: 'y',
          },
          {
            label: 'Reps at max weight',
            data: progress.map(p => p.reps),
            borderColor: '#00cec9',
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { position: 'left', title: { display: true, text: 'Weight (kg)' } },
          y1: { position: 'right', title: { display: true, text: 'Reps' }, grid: { drawOnChartArea: false } },
        }
      }
    });

    if (stat) {
      const first = progress[0];
      const last = progress[progress.length - 1];
      const gain = last && first ? last.weight - first.weight : 0;
      document.getElementById('exercise-stats').innerHTML = `
        <div class="stat-card">
          <div class="label">Max Weight</div>
          <div class="value">${stat.maxWeight} kg</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Sessions</div>
          <div class="value">${stat.sessionCount}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Sets</div>
          <div class="value">${stat.totalSets}</div>
        </div>
        <div class="stat-card">
          <div class="label">Weight Change</div>
          <div class="value" style="color:${gain >= 0 ? 'var(--green)' : 'var(--red)'}">${gain >= 0 ? '+' : ''}${gain} kg</div>
          <div class="sub">First → Last session</div>
        </div>
      `;
    }
  }

  document.getElementById('exercise-select').addEventListener('change', e => render(e.target.value));
  render(exercises[0]?.name);
  } catch (error) {
  if (error instanceof MissingDataError) {
    renderDataState(app, 'Strength Progress', 'Import a Hevy CSV from the sidebar before opening progress charts.');
    return;
  }

    renderDataState(app, 'Strength Progress', error.message || 'The imported CSV could not be loaded.');
  }
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
