import {
  applyChartDefaults,
  filterRows,
  fmt,
  getExerciseMomentum,
  getExercisePlateaus,
  getExerciseStats,
  getPeriodComparison,
  getRecoveryWarnings,
  getWeeklyLoad,
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
  title: '',
  exercise: '',
  windowDays: '30',
};
const filters = loadPageFilters('analysis', defaultFilters);

async function renderPage() {
  try {
    const data = await loadData();
    const titleOptions = getWorkoutTitleOptions(data);
    if (filters.title && !titleOptions.includes(filters.title)) {
      filters.title = '';
    }

    const splitRows = filterRows(data, { title: filters.title });
    const exerciseOptions = getExerciseStats(splitRows).map(item => item.name);
    if (filters.exercise && !exerciseOptions.includes(filters.exercise)) {
      filters.exercise = '';
    }

    const scopedRows = filters.exercise
      ? splitRows.filter(row => row.exercise === filters.exercise)
      : splitRows;
    persistFilters();

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Analysis</h1>
      </div>
      <div class="filter-bar card">
        <div class="filter-grid">
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
              <option value="">All exercises</option>
              ${exerciseOptions.map(exercise => `<option value="${exercise}" ${filters.exercise === exercise ? 'selected' : ''}>${exercise}</option>`).join('')}
            </select>
          </label>
          <label class="filter-field">
            <span>Compare Window</span>
            <select id="filter-window">
              ${['30', '60', '90'].map(days => `<option value="${days}" ${filters.windowDays === days ? 'selected' : ''}>Last ${days} days</option>`).join('')}
            </select>
          </label>
          <div class="filter-actions">
            <button type="button" class="button button-secondary" id="reset-filters">Reset filters</button>
          </div>
        </div>
      </div>
      <div id="analysis-content"></div>
    `;

    bindFilterControls();

    const content = document.getElementById('analysis-content');
    if (!scopedRows.length) {
      renderNoResultsState(content, 'No analysis data matches the current filters.');
      return;
    }

    const windowDays = Number(filters.windowDays) || 30;
    const comparison = getPeriodComparison(scopedRows, windowDays);
    const weeklyLoad = getWeeklyLoad(scopedRows);
    const momentum = getExerciseMomentum(scopedRows, windowDays, 2).filter(item => item.previousBest > 0 && item.recentBest > 0);
    const plateaus = getExercisePlateaus(scopedRows, { days: windowDays, threshold: 0.01, minSessions: 3 });
    const warnings = getRecoveryWarnings(scopedRows, { days: windowDays });
    const momentumChartData = momentum
      .slice()
      .sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity))
      .slice(0, 8);

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Workouts</div>
          <div class="value">${comparison.current.workouts}</div>
          <div class="sub">${formatDelta(comparison.current.workouts, comparison.previous.workouts)} vs previous ${windowDays} days</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Volume</div>
          <div class="value">${fmt(comparison.current.totalVolume)} kg</div>
          <div class="sub">${formatDelta(comparison.current.totalVolume, comparison.previous.totalVolume)} vs previous window</div>
        </div>
        <div class="stat-card">
          <div class="label">Avg Duration</div>
          <div class="value">${Math.round(comparison.current.avgDuration)} min</div>
          <div class="sub">${formatDelta(comparison.current.avgDuration, comparison.previous.avgDuration)} vs previous window</div>
        </div>
        <div class="stat-card">
          <div class="label">Peak Estimated 1RM</div>
          <div class="value">${fmt(comparison.current.peakEstimatedOneRepMax)} kg</div>
          <div class="sub">${formatDelta(comparison.current.peakEstimatedOneRepMax, comparison.previous.peakEstimatedOneRepMax)} vs previous window</div>
        </div>
      </div>

      <div class="chart-row">
        <div class="chart-container">
          <h3>Weekly Load Trend</h3>
          <canvas id="weeklyLoadChart"></canvas>
        </div>
        <div class="chart-container">
          <h3>Exercise Momentum</h3>
          ${momentumChartData.length ? '<canvas id="momentumChart"></canvas>' : '<div class="empty-note">Not enough repeated exercise history to compare periods yet.</div>'}
        </div>
      </div>

      <div class="chart-container">
        <h3>Recovery Warnings</h3>
        <div class="warning-list">
          ${warnings.length ? warnings.map(warning => `
            <div class="warning-card warning-${warning.severity}">
              <div class="warning-title">${warning.title}</div>
              <p>${warning.detail}</p>
            </div>
          `).join('') : '<div class="warning-card warning-clear"><div class="warning-title">No major recovery flags</div><p>No strong high-RPE streaks, acute volume spikes, or clustered long sessions were detected in the current window.</p></div>'}
        </div>
      </div>

      <div class="chart-container">
        <h3>Plateau Watch</h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Recent Best</th>
                <th>Previous Best</th>
                <th>Change</th>
                <th>Recent Sessions</th>
                <th>Days Since Improvement</th>
              </tr>
            </thead>
            <tbody>
              ${plateaus.length ? plateaus.slice(0, 12).map(item => `
                <tr>
                  <td>${item.exercise}</td>
                  <td>${fmt(item.recentBest)} kg</td>
                  <td>${fmt(item.previousBest)} kg</td>
                  <td>${formatPercent(item.delta)}</td>
                  <td>${item.recentSessions}</td>
                  <td>${item.daysSinceImprovement ?? '-'}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6">No plateau candidates met the minimum repeat-session threshold in this window.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    new Chart(document.getElementById('weeklyLoadChart'), {
      type: 'line',
      data: {
        labels: weeklyLoad.map(item => item.week),
        datasets: [
          {
            label: 'Volume',
            data: weeklyLoad.map(item => Math.round(item.totalVolume)),
            borderColor: '#6c5ce7',
            backgroundColor: 'rgba(108, 92, 231, 0.12)',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            yAxisID: 'y',
          },
          {
            label: 'Workouts',
            data: weeklyLoad.map(item => item.workouts),
            borderColor: '#00cec9',
            backgroundColor: 'rgba(0, 206, 201, 0.12)',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Volume (kg)' } },
          y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Workouts' }, grid: { drawOnChartArea: false } },
        },
      },
    });

    if (momentumChartData.length) {
      new Chart(document.getElementById('momentumChart'), {
        type: 'bar',
        data: {
          labels: momentumChartData.map(item => item.exercise),
          datasets: [{
            label: 'Change vs previous window',
            data: momentumChartData.map(item => Number(((item.delta || 0) * 100).toFixed(1))),
            backgroundColor: momentumChartData.map(item => (item.delta || 0) >= 0 ? 'rgba(0, 206, 201, 0.7)' : 'rgba(255, 107, 107, 0.7)'),
            borderRadius: 4,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks: {
                callback: value => `${value}%`,
              },
            },
          },
        },
      });
    }
  } catch (error) {
    if (error instanceof MissingDataError) {
      renderDataState(app, 'Analysis', 'Import a Hevy CSV from the sidebar before opening analysis.');
      return;
    }

    renderDataState(app, 'Analysis', error.message || 'The imported CSV could not be loaded.');
  }
}

function bindFilterControls() {
  document.getElementById('filter-title').addEventListener('change', event => {
    filters.title = event.target.value;
    filters.exercise = '';
    persistFilters();
    renderPage();
  });

  document.getElementById('filter-exercise').addEventListener('change', event => {
    filters.exercise = event.target.value;
    persistFilters();
    renderPage();
  });

  document.getElementById('filter-window').addEventListener('change', event => {
    filters.windowDays = event.target.value;
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
  savePageFilters('analysis', filters);
}

function formatDelta(current, previous) {
  if (!previous) {
    return current ? 'New activity window' : 'No prior period';
  }

  const delta = ((current - previous) / previous) * 100;
  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${delta.toFixed(1)}%`;
}

function formatPercent(value) {
  if (value == null) return '-';
  const percent = value * 100;
  const prefix = percent > 0 ? '+' : '';
  return `${prefix}${percent.toFixed(1)}%`;
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
