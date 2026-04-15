import {
  applyChartDefaults,
  estimateOneRepMax,
  filterRows,
  fmt,
  getExerciseOneRepMaxProgress,
  getExerciseRepRangeProfile,
  getExerciseRpeProfile,
  getExerciseStats,
  getWorkoutTitleOptions,
  getTopEstimatedOneRepMax,
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
const filters = loadPageFilters('strength', defaultFilters);

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
        <h1 class="page-title">Strength Insights</h1>
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
              ${exercises.map(exercise => `<option value="${exercise.name}" ${filters.exercise === exercise.name ? 'selected' : ''}>${exercise.name}</option>`).join('')}
            </select>
          </label>
          <div class="filter-actions">
            <button type="button" class="button button-secondary" id="reset-filters">Reset filters</button>
          </div>
        </div>
      </div>
      <div id="strength-content"></div>
    `;

    bindFilterControls();

    const content = document.getElementById('strength-content');
    if (!exercises.length || !filters.exercise) {
      renderNoResultsState(content, 'No strength data matches the current filters.');
      return;
    }

    const progression = getExerciseOneRepMaxProgress(filteredRows, filters.exercise);
    const repRanges = getExerciseRepRangeProfile(filteredRows, filters.exercise);
    const rpeProfile = getExerciseRpeProfile(filteredRows, filters.exercise);
    const leaderboard = getTopEstimatedOneRepMax(filteredRows, 10);
    const selectedExercise = exercises.find(exercise => exercise.name === filters.exercise);
    const bestPoint = progression[progression.length - 1];
    const allSets = filteredRows.filter(row => row.exercise === filters.exercise && row.setType === 'normal');
    const bestSet = allSets.reduce((best, row) => {
      const estimated = estimateOneRepMax(row.weight, row.reps);
      return estimated > best.estimated ? { estimated, weight: row.weight, reps: row.reps } : best;
    }, { estimated: 0, weight: 0, reps: 0 });

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Selected Exercise</div>
          <div class="value stat-value-small">${filters.exercise}</div>
        </div>
        <div class="stat-card">
          <div class="label">Best Estimated 1RM</div>
          <div class="value">${fmt(bestSet.estimated)} kg</div>
          <div class="sub">${bestSet.weight}kg x ${bestSet.reps}</div>
        </div>
        <div class="stat-card">
          <div class="label">Tracked Sessions</div>
          <div class="value">${selectedExercise?.sessionCount || 0}</div>
        </div>
        <div class="stat-card">
          <div class="label">Current Session Peak</div>
          <div class="value">${fmt(bestPoint?.estimatedOneRepMax || 0)} kg</div>
          <div class="sub">${bestPoint ? bestPoint.date.toLocaleDateString() : 'No sessions'}</div>
        </div>
      </div>

      <div class="chart-container">
        <h3>Estimated 1RM Progression</h3>
        <canvas id="oneRmChart"></canvas>
      </div>

      <div class="chart-row">
        <div class="chart-container">
          <h3>Rep Range Profile</h3>
          <canvas id="repRangeChart"></canvas>
        </div>
        <div class="chart-container">
          <h3>RPE Calibration</h3>
          <canvas id="rpeChart"></canvas>
        </div>
      </div>

      <div class="chart-container">
        <h3>Top Estimated 1RM Leaderboard</h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Estimated 1RM</th>
                <th>Best Set</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${leaderboard.map(item => `
                <tr>
                  <td>${item.exercise}</td>
                  <td>${fmt(item.estimatedOneRepMax)} kg</td>
                  <td>${item.weight}kg x ${item.reps}</td>
                  <td>${item.date ? item.date.toLocaleDateString() : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    new Chart(document.getElementById('oneRmChart'), {
      type: 'line',
      data: {
        labels: progression.map(point => point.date.toLocaleDateString()),
        datasets: [{
          label: 'Estimated 1RM',
          data: progression.map(point => Math.round(point.estimatedOneRepMax)),
          borderColor: '#6c5ce7',
          backgroundColor: 'rgba(108, 92, 231, 0.12)',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
      },
    });

    new Chart(document.getElementById('repRangeChart'), {
      type: 'doughnut',
      data: {
        labels: repRanges.map(item => item.label),
        datasets: [{
          data: repRanges.map(item => item.count),
          backgroundColor: ['#6c5ce7', '#00cec9', '#fdcb6e', '#ff6b6b'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
      },
    });

    new Chart(document.getElementById('rpeChart'), {
      type: 'bar',
      data: {
        labels: rpeProfile.map(item => item.rpe),
        datasets: [{
          label: 'Avg Est. 1RM',
          data: rpeProfile.map(item => Math.round(item.averageEstimatedOneRepMax)),
          backgroundColor: 'rgba(0, 206, 201, 0.55)',
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'RPE' } },
          y: { beginAtZero: true },
        },
      },
    });
  } catch (error) {
    if (error instanceof MissingDataError) {
      renderDataState(app, 'Strength Insights', 'Import a Hevy CSV from the sidebar before opening strength insights.');
      return;
    }

    renderDataState(app, 'Strength Insights', error.message || 'The imported CSV could not be loaded.');
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
  savePageFilters('strength', filters);
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
