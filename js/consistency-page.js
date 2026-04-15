import {
  applyChartDefaults,
  filterRows,
  fmt,
  getHourDistribution,
  getWorkoutDayCounts,
  getWorkoutStreaks,
  getWorkoutTitleOptions,
  getWorkouts,
  getWeekdayDistribution,
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
};
const filters = loadPageFilters('consistency', defaultFilters);

async function renderPage() {
  try {
    const data = await loadData();
    const titleOptions = getWorkoutTitleOptions(data);
    if (filters.title && !titleOptions.includes(filters.title)) {
      filters.title = '';
    }
    persistFilters();

    const filteredRows = filterRows(data, filters);
    const workouts = getWorkouts(filteredRows);
    const streaks = getWorkoutStreaks(filteredRows);
    const weekday = getWeekdayDistribution(filteredRows);
    const hours = getHourDistribution(filteredRows);
    const activity = getWorkoutDayCounts(filteredRows);

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Consistency Insights</h1>
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
      <div id="consistency-content"></div>
    `;

    bindFilterControls();

    const content = document.getElementById('consistency-content');
    if (!workouts.length) {
      renderNoResultsState(content, 'No workouts match the current filters.');
      return;
    }

    const averagePerWeek = getAveragePerWeek(workouts);

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Current Streak</div>
          <div class="value">${streaks.currentStreak}</div>
          <div class="sub">Consecutive training days</div>
        </div>
        <div class="stat-card">
          <div class="label">Longest Streak</div>
          <div class="value">${streaks.longestStreak}</div>
          <div class="sub">Best run in filtered data</div>
        </div>
        <div class="stat-card">
          <div class="label">Active Days</div>
          <div class="value">${streaks.activeDays}</div>
        </div>
        <div class="stat-card">
          <div class="label">Average / Week</div>
          <div class="value">${averagePerWeek.toFixed(1)}</div>
        </div>
      </div>

      <div class="chart-row">
        <div class="chart-container">
          <h3>Weekday Distribution</h3>
          <canvas id="weekdayChart"></canvas>
        </div>
        <div class="chart-container">
          <h3>Start Time Distribution</h3>
          <canvas id="hourChart"></canvas>
        </div>
      </div>

      <div class="chart-container">
        <h3>Recent Activity Heatmap</h3>
        <div class="heatmap" id="heatmap">${renderHeatmap(activity)}</div>
      </div>
    `;

    new Chart(document.getElementById('weekdayChart'), {
      type: 'bar',
      data: {
        labels: weekday.map(item => item.label),
        datasets: [{
          label: 'Workouts',
          data: weekday.map(item => item.count),
          backgroundColor: 'rgba(108, 92, 231, 0.6)',
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });

    new Chart(document.getElementById('hourChart'), {
      type: 'bar',
      data: {
        labels: hours.map(item => `${String(item.hour).padStart(2, '0')}:00`),
        datasets: [{
          label: 'Workouts',
          data: hours.map(item => item.count),
          backgroundColor: 'rgba(0, 206, 201, 0.55)',
          borderRadius: 2,
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
  } catch (error) {
    if (error instanceof MissingDataError) {
      renderDataState(app, 'Consistency Insights', 'Import a Hevy CSV from the sidebar before opening consistency insights.');
      return;
    }

    renderDataState(app, 'Consistency Insights', error.message || 'The imported CSV could not be loaded.');
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

  document.getElementById('reset-filters').addEventListener('click', () => {
    Object.assign(filters, defaultFilters);
    persistFilters();
    renderPage();
  });
}

function getAveragePerWeek(workouts) {
  if (!workouts.length) return 0;
  const first = workouts[workouts.length - 1].start;
  const last = workouts[0].start;
  const weeks = Math.max(1, (last - first) / 604800000);
  return workouts.length / weeks;
}

function renderHeatmap(activity) {
  const days = [];
  const today = new Date();
  const current = new Date(today);
  current.setDate(current.getDate() - 125);

  for (let index = 0; index < 126; index++) {
    const day = new Date(current);
    day.setDate(current.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    const count = activity[key] || 0;
    days.push(`<div class="heatmap-cell level-${Math.min(count, 4)}" title="${key}: ${count} workout${count === 1 ? '' : 's'}"></div>`);
  }

  return days.join('');
}

function persistFilters() {
  savePageFilters('consistency', filters);
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
