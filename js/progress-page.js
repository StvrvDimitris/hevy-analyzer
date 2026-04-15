import {
  applyChartDefaults,
  filterRows,
  getExerciseProgress,
  getExerciseStats,
  getWorkoutTitleOptions,
  loadData,
  loadPageFilters,
  MissingDataError,
  renderDataState,
  renderNoResultsState,
  savePageFilters,
} from './data.js';
import { renderNav } from './nav.js';

renderNav();
applyChartDefaults();

const app = document.getElementById('app');
const defaultFilters = {
  from: '',
  to: '',
  title: '',
  exercise: '',
};
const filters = loadPageFilters('progress', defaultFilters);

async function renderPage() {
  try {
    const data = await loadData();
    const titleOptions = getWorkoutTitleOptions(data);
    if (filters.title && !titleOptions.includes(filters.title)) {
      filters.title = '';
    }

    const filteredRows = filterRows(data, filters);
    const exercises = getExerciseStats(filteredRows);

    if (!exercises.some(exercise => exercise.name === filters.exercise)) {
      filters.exercise = exercises[0]?.name || '';
    }
    persistFilters();

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Strength Progress</h1>
      </div>
      <div class="filter-bar card">
        <div class="filter-grid">
          <label class="filter-field">
            <span>From</span>
            <input type="date" id="filter-from" value="${filters.from}">
          </label>
          <label class="filter-field">
            <span>To</span>
            <input type="date" id="filter-to" value="${filters.to}">
          </label>
          <label class="filter-field">
            <span>Workout Split</span>
            <select id="filter-title">
              <option value="">All splits</option>
              ${titleOptions.map(title => `<option value="${title}" ${filters.title === title ? 'selected' : ''}>${title}</option>`).join('')}
            </select>
          </label>
          <label class="filter-field">
            <span>Exercise</span>
            <select id="filter-exercise">
              ${exercises.map(exercise => `<option value="${exercise.name}" ${filters.exercise === exercise.name ? 'selected' : ''}>${exercise.name} (${exercise.sessionCount} sessions)</option>`).join('')}
            </select>
          </label>
          <div class="filter-actions">
            <button type="button" class="button button-secondary" id="reset-filters">Reset filters</button>
          </div>
        </div>
      </div>
      <div id="progress-content"></div>
    `;

    bindFilterControls();

    const content = document.getElementById('progress-content');
    if (!exercises.length || !filters.exercise) {
      renderNoResultsState(content, 'No exercise progress matches the current filters.');
      return;
    }

    const progress = getExerciseProgress(filteredRows, filters.exercise);
    const stat = exercises.find(exercise => exercise.name === filters.exercise);

    if (!progress.length || !stat) {
      renderNoResultsState(content, 'No exercise progress matches the current filters.');
      return;
    }

    const first = progress[0];
    const last = progress[progress.length - 1];
    const gain = last && first ? last.weight - first.weight : 0;

    content.innerHTML = `
      <div class="chart-container">
        <h3 id="chart-title">${filters.exercise}</h3>
        <canvas id="progressChart"></canvas>
      </div>
      <div class="stats-grid">
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
          <div class="sub">First to last session</div>
        </div>
      </div>
    `;

    new Chart(document.getElementById('progressChart'), {
      type: 'line',
      data: {
        labels: progress.map(point => point.date.toLocaleDateString()),
        datasets: [
          {
            label: 'Max Weight (kg)',
            data: progress.map(point => point.weight),
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
            data: progress.map(point => point.reps),
            borderColor: '#00cec9',
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { position: 'left', title: { display: true, text: 'Weight (kg)' } },
          y1: { position: 'right', title: { display: true, text: 'Reps' }, grid: { drawOnChartArea: false } },
        },
      },
    });
  } catch (error) {
    if (error instanceof MissingDataError) {
      renderDataState(app, 'Strength Progress', 'Import a Hevy CSV from the sidebar before opening progress charts.');
      return;
    }

    renderDataState(app, 'Strength Progress', error.message || 'The imported CSV could not be loaded.');
  }
}

function bindFilterControls() {
  document.getElementById('filter-from').addEventListener('change', event => {
    filters.from = event.target.value;
    persistFilters();
    renderPage();
  });

  document.getElementById('filter-to').addEventListener('change', event => {
    filters.to = event.target.value;
    persistFilters();
    renderPage();
  });

  document.getElementById('filter-title').addEventListener('change', event => {
    filters.title = event.target.value;
    persistFilters();
    renderPage();
  });

  document.getElementById('filter-exercise').addEventListener('change', event => {
    filters.exercise = event.target.value;
    persistFilters();
    renderPage();
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    Object.assign(filters, defaultFilters);
    persistFilters();
    renderPage();
  });
}

function persistFilters() {
  savePageFilters('progress', filters);
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
