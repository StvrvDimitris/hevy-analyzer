import { loadData, getWeeklyFrequency, getRpeDistribution, getWorkouts, applyChartDefaults, fmt, MissingDataError, renderDataState } from './data.js';
import { renderNav } from './nav.js';

renderNav();
applyChartDefaults();

const app = document.getElementById('app');

async function renderPage() {
  try {
    const data = await loadData();
  const weekly = getWeeklyFrequency(data);
  const rpe = getRpeDistribution(data);
  const workouts = getWorkouts(data);

  if (!workouts.length) {
    renderDataState(app, 'Workout Frequency', 'The imported CSV did not contain any workouts.');
    return;
  }

  // Monthly aggregation
  const monthly = new Map();
  for (const w of workouts) {
    const key = `${w.start.getFullYear()}-${String(w.start.getMonth() + 1).padStart(2, '0')}`;
    monthly.set(key, (monthly.get(key) || 0) + 1);
  }
  const monthlyData = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b));

  const avgPerWeek = weekly.length ? (weekly.reduce((s, w) => s + w.count, 0) / weekly.length).toFixed(1) : 0;
  const maxWeek = weekly.reduce((m, w) => w.count > m.count ? w : m, { count: 0 });
  const totalDays = workouts.length ? Math.round((workouts[0].start - workouts.at(-1).start) / 86400000) : 0;

  app.innerHTML = `
    <h1 class="page-title">Workout Frequency</h1>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Avg / Week</div>
        <div class="value">${avgPerWeek}</div>
      </div>
      <div class="stat-card">
        <div class="label">Best Week</div>
        <div class="value">${maxWeek.count} workouts</div>
        <div class="sub">${maxWeek.week || ''}</div>
      </div>
      <div class="stat-card">
        <div class="label">Total Days Tracked</div>
        <div class="value">${fmt(totalDays)}</div>
      </div>
      <div class="stat-card">
        <div class="label">RPE Data Points</div>
        <div class="value">${fmt(rpe.reduce((s, r) => s + r.count, 0))}</div>
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

  // Monthly bar chart
  new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: {
      labels: monthlyData.map(([m]) => m),
      datasets: [{
        label: 'Workouts',
        data: monthlyData.map(([, c]) => c),
        backgroundColor: 'rgba(108, 92, 231, 0.6)',
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 20 } },
        y: { beginAtZero: true }
      }
    }
  });

  // Weekly frequency
  new Chart(document.getElementById('weeklyChart'), {
    type: 'bar',
    data: {
      labels: weekly.map(w => w.week),
      datasets: [{
        label: 'Workouts',
        data: weekly.map(w => w.count),
        backgroundColor: 'rgba(0, 206, 201, 0.5)',
        borderRadius: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { beginAtZero: true }
      }
    }
  });

  // RPE distribution
  new Chart(document.getElementById('rpeChart'), {
    type: 'bar',
    data: {
      labels: rpe.map(r => r.rpe),
      datasets: [{
        label: 'Count',
        data: rpe.map(r => r.count),
        backgroundColor: 'rgba(253, 203, 110, 0.6)',
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'RPE' } },
        y: { beginAtZero: true }
      }
    }
  });
  } catch (error) {
  if (error instanceof MissingDataError) {
    renderDataState(app, 'Workout Frequency', 'Import a Hevy CSV from the sidebar to view training frequency and RPE trends.');
    return;
  }

    renderDataState(app, 'Workout Frequency', error.message || 'The imported CSV could not be loaded.');
  }
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
