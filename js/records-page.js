import {
  applyChartDefaults,
  estimateOneRepMax,
  filterRows,
  fmt,
  getExerciseRecordProgress,
  getExerciseRecords,
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
const filters = loadPageFilters('records', defaultFilters);

async function renderPage() {
  try {
    const data = await loadData();
    const titleOptions = getWorkoutTitleOptions(data);
    if (filters.title && !titleOptions.includes(filters.title)) {
      filters.title = '';
    }

    const filteredRows = filterRows(data, filters);
    const records = getExerciseRecords(filteredRows);
    if (!records.some(record => record.exercise === filters.exercise)) {
      filters.exercise = records[0]?.exercise || '';
    }
    persistFilters();

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Records</h1>
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
              ${records.map(record => `<option value="${record.exercise}" ${filters.exercise === record.exercise ? 'selected' : ''}>${record.exercise}</option>`).join('')}
            </select>
          </label>
          <div class="filter-actions">
            <button type="button" class="button button-secondary" id="reset-filters">Reset filters</button>
          </div>
        </div>
      </div>
      <div id="records-content"></div>
    `;

    bindFilterControls();

    const content = document.getElementById('records-content');
    if (!records.length || !filters.exercise) {
      renderNoResultsState(content, 'No exercise records match the current filters.');
      return;
    }

    const selectedRecord = records.find(record => record.exercise === filters.exercise);
    const progress = getExerciseRecordProgress(filteredRows, filters.exercise);
    const selectedRows = filteredRows.filter(row => row.exercise === filters.exercise && row.setType === 'normal');
    const topSet = selectedRows.reduce((best, row) => {
      const estimated = estimateOneRepMax(row.weight, row.reps);
      return estimated > best.estimated ? { estimated, weight: row.weight, reps: row.reps } : best;
    }, { estimated: 0, weight: 0, reps: 0 });

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Selected Exercise</div>
          <div class="value stat-value-small">${selectedRecord.exercise}</div>
          <div class="sub">${selectedRecord.totalSessions} tracked sessions</div>
        </div>
        <div class="stat-card">
          <div class="label">Heaviest Set</div>
          <div class="value">${fmt(selectedRecord.heaviestSet.weight)} kg</div>
          <div class="sub">${selectedRecord.heaviestSet.reps} reps</div>
        </div>
        <div class="stat-card">
          <div class="label">Best Estimated 1RM</div>
          <div class="value">${fmt(topSet.estimated)} kg</div>
          <div class="sub">${topSet.weight}kg x ${topSet.reps}</div>
        </div>
        <div class="stat-card">
          <div class="label">Most Reps At Load</div>
          <div class="value">${selectedRecord.bestRepSet.reps}</div>
          <div class="sub">${fmt(selectedRecord.bestRepSet.weight)} kg</div>
        </div>
        <div class="stat-card">
          <div class="label">Best Session Volume</div>
          <div class="value">${fmt(selectedRecord.bestSessionVolume.totalVolume)} kg</div>
          <div class="sub">${selectedRecord.bestSessionVolume.date ? selectedRecord.bestSessionVolume.date.toLocaleDateString() : 'No sessions'}</div>
        </div>
      </div>

      <div class="chart-row">
        <div class="chart-container">
          <h3>Record Trend</h3>
          <canvas id="recordTrendChart"></canvas>
        </div>
        <div class="chart-container">
          <h3>Session Volume Trend</h3>
          <canvas id="recordVolumeChart"></canvas>
        </div>
      </div>

      <div class="chart-container">
        <h3>Exercise Record Leaderboard</h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Heaviest Set</th>
                <th>Best Est. 1RM</th>
                <th>Most Reps</th>
                <th>Best Session Volume</th>
                <th>Sessions</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(record => `
                <tr class="${record.exercise === filters.exercise ? 'selected-row' : ''}" data-exercise="${record.exercise}">
                  <td>${record.exercise}</td>
                  <td>${fmt(record.heaviestSet.weight)}kg x ${record.heaviestSet.reps}</td>
                  <td>${fmt(record.bestEstimatedOneRepMax.estimated)} kg</td>
                  <td>${record.bestRepSet.reps} @ ${fmt(record.bestRepSet.weight)}kg</td>
                  <td>${fmt(record.bestSessionVolume.totalVolume)} kg</td>
                  <td>${record.totalSessions}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    bindRecordRows();

    new Chart(document.getElementById('recordTrendChart'), {
      type: 'line',
      data: {
        labels: progress.map(item => item.date.toLocaleDateString()),
        datasets: [
          {
            label: 'Top Weight',
            data: progress.map(item => item.topWeight),
            borderColor: '#00cec9',
            backgroundColor: 'rgba(0, 206, 201, 0.12)',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            yAxisID: 'y',
          },
          {
            label: 'Estimated 1RM',
            data: progress.map(item => Math.round(item.estimatedOneRepMax)),
            borderColor: '#6c5ce7',
            backgroundColor: 'rgba(108, 92, 231, 0.12)',
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
          y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Top Weight (kg)' } },
          y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Estimated 1RM (kg)' }, grid: { drawOnChartArea: false } },
        },
      },
    });

    new Chart(document.getElementById('recordVolumeChart'), {
      type: 'bar',
      data: {
        labels: progress.map(item => item.date.toLocaleDateString()),
        datasets: [{
          label: 'Session Volume',
          data: progress.map(item => Math.round(item.totalVolume)),
          backgroundColor: 'rgba(253, 203, 110, 0.7)',
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Volume (kg)' } },
        },
      },
    });
  } catch (error) {
    if (error instanceof MissingDataError) {
      renderDataState(app, 'Records', 'Import a Hevy CSV from the sidebar before opening records.');
      return;
    }

    renderDataState(app, 'Records', error.message || 'The imported CSV could not be loaded.');
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

function bindRecordRows() {
  document.querySelectorAll('[data-exercise]').forEach(row => {
    row.addEventListener('click', () => {
      filters.exercise = row.dataset.exercise || '';
      persistFilters();
      renderPage();
    });
  });
}

function persistFilters() {
  savePageFilters('records', filters);
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
