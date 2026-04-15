import {
  applyChartDefaults,
  filterRows,
  fmt,
  getExerciseStats,
  getSplitDistribution,
  getWeeklyVolume,
  getWorkoutTitleOptions,
  getWorkouts,
  loadData,
  MissingDataError,
  renderDataState,
  renderNoResultsState,
} from './data.js';
import { renderNav } from './nav.js';

renderNav();
applyChartDefaults();

const app = document.getElementById('app');
const filters = {
  from: '',
  to: '',
  title: '',
};

async function renderPage() {
  try {
    const data = await loadData();
    const titleOptions = getWorkoutTitleOptions(data);
    const filteredRows = filterRows(data, filters);
    const workouts = getWorkouts(filteredRows);
    const weeklyVol = getWeeklyVolume(filteredRows);
    const splits = getSplitDistribution(filteredRows);
    const exercises = getExerciseStats(filteredRows);

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
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
          <div class="filter-actions">
            <button type="button" class="button button-secondary" id="reset-filters">Reset filters</button>
          </div>
        </div>
      </div>
      <div id="dashboard-content"></div>
    `;

    bindFilterControls();

    const content = document.getElementById('dashboard-content');
    if (!workouts.length) {
      renderNoResultsState(content, 'No workouts match the current filters.');
      return;
    }

    const totalSets = workouts.reduce((sum, workout) => sum + workout.sets, 0);
    const totalVolume = workouts.reduce((sum, workout) => sum + workout.totalVolume, 0);
    const avgDuration = workouts.reduce((sum, workout) => sum + (workout.end - workout.start) / 60000, 0) / workouts.length;
    const dateRange = `${workouts.at(-1)?.start.toLocaleDateString()} - ${workouts[0]?.start.toLocaleDateString()}`;

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Total Workouts</div>
          <div class="value">${fmt(workouts.length)}</div>
          <div class="sub">${dateRange}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Sets</div>
          <div class="value">${fmt(totalSets)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Volume</div>
          <div class="value">${fmt(totalVolume)} kg</div>
        </div>
        <div class="stat-card">
          <div class="label">Avg Duration</div>
          <div class="value">${Math.round(avgDuration)} min</div>
        </div>
        <div class="stat-card">
          <div class="label">Unique Exercises</div>
          <div class="value">${exercises.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Most Frequent</div>
          <div class="value stat-value-small">${exercises[0]?.name || '-'}</div>
          <div class="sub">${exercises[0]?.sessionCount || 0} sessions</div>
        </div>
      </div>

      <div class="chart-row">
        <div class="chart-container">
          <h3>Weekly Volume (kg)</h3>
          <canvas id="volumeChart"></canvas>
        </div>
        <div class="chart-container">
          <h3>Workout Split</h3>
          <canvas id="splitChart"></canvas>
        </div>
      </div>

      <div class="chart-container">
        <h3>Recent Workouts</h3>
        <ul class="workout-list">
          ${workouts.slice(0, 10).map(workout => `
            <li>
              <div>
                <div class="workout-name">${workout.title}</div>
                <div class="workout-meta">${workout.exercises.size} exercises &middot; ${workout.sets} sets</div>
              </div>
              <div class="workout-meta">${workout.start.toLocaleDateString()}</div>
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    new Chart(document.getElementById('volumeChart'), {
      type: 'line',
      data: {
        labels: weeklyVol.map(point => point.week),
        datasets: [{
          label: 'Volume (kg)',
          data: weeklyVol.map(point => point.volume),
          borderColor: '#6c5ce7',
          backgroundColor: 'rgba(108, 92, 231, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 12 } },
          y: { beginAtZero: true },
        },
      },
    });

    const colors = ['#6c5ce7', '#00cec9', '#fdcb6e', '#ff6b6b', '#a29bfe', '#55efc4', '#fab1a0', '#74b9ff', '#dfe6e9', '#fd79a8'];
    new Chart(document.getElementById('splitChart'), {
      type: 'doughnut',
      data: {
        labels: splits.map(split => split.title),
        datasets: [{
          data: splits.map(split => split.count),
          backgroundColor: colors.slice(0, splits.length),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 8 } },
        },
      },
    });
  } catch (error) {
    if (error instanceof MissingDataError) {
      renderDataState(app, 'Dashboard', 'Use the Import CSV button in the sidebar to load a Hevy export.');
      return;
    }

    renderDataState(app, 'Dashboard', error.message || 'The imported CSV could not be loaded.');
  }
}

function bindFilterControls() {
  document.getElementById('filter-from').addEventListener('change', event => {
    filters.from = event.target.value;
    renderPage();
  });

  document.getElementById('filter-to').addEventListener('change', event => {
    filters.to = event.target.value;
    renderPage();
  });

  document.getElementById('filter-title').addEventListener('change', event => {
    filters.title = event.target.value;
    renderPage();
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    filters.from = '';
    filters.to = '';
    filters.title = '';
    renderPage();
  });
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
