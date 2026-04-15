import {
  applyChartDefaults,
  filterRows,
  fmt,
  getExerciseProgress,
  getExerciseStats,
  getWorkoutTitleOptions,
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
  search: '',
  selectedExercise: '',
};

async function renderPage() {
  try {
    const data = await loadData();
    const titleOptions = getWorkoutTitleOptions(data);
    const filteredRows = filterRows(data, filters);
    const exercises = getExerciseStats(filteredRows);
    const visibleExercises = exercises.filter(exercise => exercise.name.toLowerCase().includes(filters.search.toLowerCase()));

    if (!visibleExercises.some(exercise => exercise.name === filters.selectedExercise)) {
      filters.selectedExercise = '';
    }

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Exercises</h1>
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
            <span>Exercise Search</span>
            <input type="text" id="filter-search" placeholder="Search exercises..." value="${filters.search}">
          </label>
          <div class="filter-actions">
            <button type="button" class="button button-secondary" id="reset-filters">Reset filters</button>
          </div>
        </div>
      </div>
      <div id="exercises-content"></div>
    `;

    bindFilterControls();

    const content = document.getElementById('exercises-content');
    if (!visibleExercises.length) {
      renderNoResultsState(content, 'No exercises match the current filters.');
      return;
    }

    content.innerHTML = `
      <div class="card table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Exercise</th>
              <th>Sessions</th>
              <th>Total Sets</th>
              <th>Total Volume</th>
              <th>Max Weight</th>
              <th>Best Set</th>
            </tr>
          </thead>
          <tbody id="tbody">
            ${visibleExercises.map(exercise => `
              <tr data-name="${exercise.name}" class="${filters.selectedExercise === exercise.name ? 'selected-row' : ''}">
                <td>${exercise.name}</td>
                <td>${exercise.sessionCount}</td>
                <td>${exercise.totalSets}</td>
                <td>${fmt(exercise.totalVolume)} kg</td>
                <td>${exercise.maxWeight} kg</td>
                <td>${exercise.bestSet ? `${exercise.bestSet.weight}kg x ${exercise.bestSet.reps}` : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="chart-container ${filters.selectedExercise ? '' : 'hidden'}" id="detail-section">
        <h3 id="detail-title"></h3>
        <canvas id="detailChart"></canvas>
      </div>
    `;

    document.getElementById('tbody').addEventListener('click', event => {
      const row = event.target.closest('tr');
      if (!row) return;
      filters.selectedExercise = row.dataset.name;
      renderPage();
    });

    if (!filters.selectedExercise) return;

    const progress = getExerciseProgress(filteredRows, filters.selectedExercise);
    if (!progress.length) return;

    document.getElementById('detail-title').textContent = `${filters.selectedExercise} - Max Weight Over Time`;

    new Chart(document.getElementById('detailChart'), {
      type: 'line',
      data: {
        labels: progress.map(point => point.date.toLocaleDateString()),
        datasets: [{
          label: 'Max Weight (kg)',
          data: progress.map(point => point.weight),
          borderColor: '#6c5ce7',
          backgroundColor: 'rgba(108, 92, 231, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: false } },
      },
    });
  } catch (error) {
    if (error instanceof MissingDataError) {
      renderDataState(app, 'Exercises', 'Import a Hevy CSV from the sidebar before browsing exercise stats.');
      return;
    }

    renderDataState(app, 'Exercises', error.message || 'The imported CSV could not be loaded.');
  }
}

function bindFilterControls() {
  document.getElementById('filter-from').addEventListener('change', event => {
    filters.from = event.target.value;
    filters.selectedExercise = '';
    renderPage();
  });

  document.getElementById('filter-to').addEventListener('change', event => {
    filters.to = event.target.value;
    filters.selectedExercise = '';
    renderPage();
  });

  document.getElementById('filter-title').addEventListener('change', event => {
    filters.title = event.target.value;
    filters.selectedExercise = '';
    renderPage();
  });

  document.getElementById('filter-search').addEventListener('input', event => {
    filters.search = event.target.value;
    filters.selectedExercise = '';
    renderPage();
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    filters.from = '';
    filters.to = '';
    filters.title = '';
    filters.search = '';
    filters.selectedExercise = '';
    renderPage();
  });
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
