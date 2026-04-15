import {
  applyChartDefaults,
  filterRows,
  fmt,
  getCardioExerciseStats,
  getCardioSummary,
  getSupersetSummary,
  getWeeklyCardio,
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
const filters = loadPageFilters('conditioning', defaultFilters);

async function renderPage() {
  try {
    const data = await loadData();
    const titleOptions = getWorkoutTitleOptions(data);
    if (filters.title && !titleOptions.includes(filters.title)) {
      filters.title = '';
    }
    persistFilters();

    const filteredRows = filterRows(data, filters);
    const cardioSummary = getCardioSummary(filteredRows);
    const weeklyCardio = getWeeklyCardio(filteredRows);
    const cardioExercises = getCardioExerciseStats(filteredRows).slice(0, 8);
    const supersetSummary = getSupersetSummary(filteredRows);

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Conditioning & Supersets</h1>
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
      <div id="conditioning-content"></div>
    `;

    bindFilterControls();

    const content = document.getElementById('conditioning-content');
    if (!weeklyCardio.length && !supersetSummary.totalGroups) {
      renderNoResultsState(content, 'No cardio or superset data matches the current filters.');
      return;
    }

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Total Cardio Distance</div>
          <div class="value">${cardioSummary.totalDistance.toFixed(1)} km</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Cardio Time</div>
          <div class="value">${Math.round(cardioSummary.totalDurationMin)} min</div>
        </div>
        <div class="stat-card">
          <div class="label">Superset Groups</div>
          <div class="value">${supersetSummary.totalGroups}</div>
        </div>
        <div class="stat-card">
          <div class="label">Superset Sets</div>
          <div class="value">${supersetSummary.totalSupersetSets}</div>
        </div>
      </div>

      <div class="chart-row">
        <div class="chart-container">
          <h3>Weekly Cardio Trend</h3>
          <canvas id="cardioChart"></canvas>
        </div>
        <div class="chart-container">
          <h3>Top Cardio Movements</h3>
          <canvas id="cardioExerciseChart"></canvas>
        </div>
      </div>

      <div class="chart-container">
        <h3>Most Common Supersets</h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pairing</th>
                <th>Occurrences</th>
              </tr>
            </thead>
            <tbody>
              ${supersetSummary.mostCommonPairs.map(item => `
                <tr>
                  <td>${item.pair}</td>
                  <td>${item.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    new Chart(document.getElementById('cardioChart'), {
      type: 'line',
      data: {
        labels: weeklyCardio.map(item => item.week),
        datasets: [
          {
            label: 'Distance (km)',
            data: weeklyCardio.map(item => Number(item.distance.toFixed(1))),
            borderColor: '#00cec9',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            yAxisID: 'y',
          },
          {
            label: 'Duration (min)',
            data: weeklyCardio.map(item => Math.round(item.durationMin)),
            borderColor: '#fdcb6e',
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
          y: { position: 'left', beginAtZero: true, title: { display: true, text: 'Distance (km)' } },
          y1: { position: 'right', beginAtZero: true, title: { display: true, text: 'Duration (min)' }, grid: { drawOnChartArea: false } },
        },
      },
    });

    new Chart(document.getElementById('cardioExerciseChart'), {
      type: 'bar',
      data: {
        labels: cardioExercises.map(item => item.exercise || 'Untitled'),
        datasets: [{
          label: 'Distance (km)',
          data: cardioExercises.map(item => Number(item.totalDistance.toFixed(1))),
          backgroundColor: 'rgba(108, 92, 231, 0.6)',
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 8 } },
          y: { beginAtZero: true },
        },
      },
    });
  } catch (error) {
    if (error instanceof MissingDataError) {
      renderDataState(app, 'Conditioning & Supersets', 'Import a Hevy CSV from the sidebar before opening conditioning insights.');
      return;
    }

    renderDataState(app, 'Conditioning & Supersets', error.message || 'The imported CSV could not be loaded.');
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
  savePageFilters('conditioning', filters);
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
