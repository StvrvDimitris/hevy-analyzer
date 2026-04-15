import {
  applyChartDefaults,
  filterRows,
  fmt,
  getRpeDistribution,
  getWeeklyFrequency,
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
    const weekly = getWeeklyFrequency(filteredRows);
    const rpe = getRpeDistribution(filteredRows);
    const workouts = getWorkouts(filteredRows);

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Workout Frequency</h1>
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
      <div id="frequency-content"></div>
    `;

    bindFilterControls();

    const content = document.getElementById('frequency-content');
    if (!workouts.length) {
      renderNoResultsState(content, 'No workouts match the current filters.');
      return;
    }

    const monthly = new Map();
    for (const workout of workouts) {
      const key = `${workout.start.getFullYear()}-${String(workout.start.getMonth() + 1).padStart(2, '0')}`;
      monthly.set(key, (monthly.get(key) || 0) + 1);
    }
    const monthlyData = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b));

    const avgPerWeek = weekly.length ? (weekly.reduce((sum, week) => sum + week.count, 0) / weekly.length).toFixed(1) : 0;
    const maxWeek = weekly.reduce((max, week) => (week.count > max.count ? week : max), { count: 0, week: '' });
    const totalDays = workouts.length ? Math.round((workouts[0].start - workouts.at(-1).start) / 86400000) : 0;

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Avg / Week</div>
          <div class="value">${avgPerWeek}</div>
        </div>
        <div class="stat-card">
          <div class="label">Best Week</div>
          <div class="value">${maxWeek.count} workouts</div>
          <div class="sub">${maxWeek.week}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Days Tracked</div>
          <div class="value">${fmt(totalDays)}</div>
        </div>
        <div class="stat-card">
          <div class="label">RPE Data Points</div>
          <div class="value">${fmt(rpe.reduce((sum, item) => sum + item.count, 0))}</div>
        </div>
      </div>

      <div class="chart-container">
        <h3>Workouts Per Month</h3>
        <canvas id="monthlyChart"></canvas>
      </div>

      <div class="chart-row">
        <div class="chart-container">
          <h3>Workouts Per Week</h3>
          <canvas id="weeklyChart"></canvas>
        </div>
        <div class="chart-container">
          <h3>RPE Distribution</h3>
          <canvas id="rpeChart"></canvas>
        </div>
      </div>
    `;

    new Chart(document.getElementById('monthlyChart'), {
      type: 'bar',
      data: {
        labels: monthlyData.map(([month]) => month),
        datasets: [{
          label: 'Workouts',
          data: monthlyData.map(([, count]) => count),
          backgroundColor: 'rgba(108, 92, 231, 0.6)',
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 20 } },
          y: { beginAtZero: true },
        },
      },
    });

    new Chart(document.getElementById('weeklyChart'), {
      type: 'bar',
      data: {
        labels: weekly.map(week => week.week),
        datasets: [{
          label: 'Workouts',
          data: weekly.map(week => week.count),
          backgroundColor: 'rgba(0, 206, 201, 0.5)',
          borderRadius: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { beginAtZero: true },
        },
      },
    });

    new Chart(document.getElementById('rpeChart'), {
      type: 'bar',
      data: {
        labels: rpe.map(item => item.rpe),
        datasets: [{
          label: 'Count',
          data: rpe.map(item => item.count),
          backgroundColor: 'rgba(253, 203, 110, 0.6)',
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
      renderDataState(app, 'Workout Frequency', 'Import a Hevy CSV from the sidebar to view training frequency and RPE trends.');
      return;
    }

    renderDataState(app, 'Workout Frequency', error.message || 'The imported CSV could not be loaded.');
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
