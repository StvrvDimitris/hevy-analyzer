import {
  applyChartDefaults,
  filterRows,
  fmt,
  getMonthlySplitCounts,
  getSessionStats,
  getSessionTrend,
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
};
const filters = loadPageFilters('sessions', defaultFilters);

async function renderPage() {
  try {
    const data = await loadData();
    const titleOptions = getWorkoutTitleOptions(data);
    if (filters.title && !titleOptions.includes(filters.title)) {
      filters.title = '';
    }
    persistFilters();

    const filteredRows = filterRows(data, filters);
    const sessions = getSessionStats(filteredRows);
    const trend = getSessionTrend(filteredRows);
    const splitCounts = getMonthlySplitCounts(filteredRows);

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Session Insights</h1>
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
      <div id="sessions-content"></div>
    `;

    bindFilterControls();

    const content = document.getElementById('sessions-content');
    if (!sessions.length) {
      renderNoResultsState(content, 'No sessions match the current filters.');
      return;
    }

    const avgDuration = sessions.reduce((sum, session) => sum + session.durationMin, 0) / sessions.length;
    const avgSetsPerMinute = sessions.reduce((sum, session) => sum + session.setsPerMinute, 0) / sessions.length;
    const avgVolumePerMinute = sessions.reduce((sum, session) => sum + session.volumePerMinute, 0) / sessions.length;
    const mostEfficient = sessions.reduce((best, session) => session.volumePerMinute > best.volumePerMinute ? session : best, sessions[0]);

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Average Duration</div>
          <div class="value">${Math.round(avgDuration)} min</div>
        </div>
        <div class="stat-card">
          <div class="label">Average Sets / Min</div>
          <div class="value">${avgSetsPerMinute.toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Average Volume / Min</div>
          <div class="value">${fmt(avgVolumePerMinute)} kg</div>
        </div>
        <div class="stat-card">
          <div class="label">Highest Density Session</div>
          <div class="value stat-value-small">${mostEfficient.title}</div>
          <div class="sub">${fmt(mostEfficient.volumePerMinute)} kg/min</div>
        </div>
      </div>

      <div class="chart-row">
        <div class="chart-container">
          <h3>Session Density Trend</h3>
          <canvas id="densityChart"></canvas>
        </div>
        <div class="chart-container">
          <h3>Split Balance Over Time</h3>
          <canvas id="splitBalanceChart"></canvas>
        </div>
      </div>

      <div class="chart-container">
        <h3>Recent Sessions</h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Split</th>
                <th>Duration</th>
                <th>Sets</th>
                <th>Sets / Min</th>
                <th>Volume / Min</th>
              </tr>
            </thead>
            <tbody>
              ${sessions.slice(0, 12).map(session => `
                <tr>
                  <td>${session.start.toLocaleDateString()}</td>
                  <td>${session.title}</td>
                  <td>${Math.round(session.durationMin)} min</td>
                  <td>${session.totalSets}</td>
                  <td>${session.setsPerMinute.toFixed(2)}</td>
                  <td>${fmt(session.volumePerMinute)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    new Chart(document.getElementById('densityChart'), {
      type: 'line',
      data: {
        labels: trend.map(item => item.label),
        datasets: [
          {
            label: 'Sets / Min',
            data: trend.map(item => Number(item.setsPerMinute.toFixed(2))),
            borderColor: '#00cec9',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            yAxisID: 'y',
          },
          {
            label: 'Volume / Min',
            data: trend.map(item => Math.round(item.volumePerMinute)),
            borderColor: '#6c5ce7',
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
          y: { position: 'left', beginAtZero: true, title: { display: true, text: 'Sets / Min' } },
          y1: { position: 'right', beginAtZero: true, title: { display: true, text: 'Volume / Min' }, grid: { drawOnChartArea: false } },
        },
      },
    });

    const topSplits = [...new Set(splitCounts.flatMap(item => Object.keys(item.counts)))]
      .map(title => ({
        title,
        total: splitCounts.reduce((sum, item) => sum + (item.counts[title] || 0), 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(item => item.title);

    new Chart(document.getElementById('splitBalanceChart'), {
      type: 'bar',
      data: {
        labels: splitCounts.map(item => item.month),
        datasets: topSplits.map((title, index) => ({
          label: title,
          data: splitCounts.map(item => item.counts[title] || 0),
          backgroundColor: ['#6c5ce7', '#00cec9', '#fdcb6e', '#ff6b6b', '#74b9ff'][index % 5],
          stack: 'splits',
        })),
      },
      options: {
        responsive: true,
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true },
        },
      },
    });
  } catch (error) {
    if (error instanceof MissingDataError) {
      renderDataState(app, 'Session Insights', 'Import a Hevy CSV from the sidebar before opening session insights.');
      return;
    }

    renderDataState(app, 'Session Insights', error.message || 'The imported CSV could not be loaded.');
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

function persistFilters() {
  savePageFilters('sessions', filters);
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
