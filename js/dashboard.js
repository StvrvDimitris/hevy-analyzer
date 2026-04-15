import { loadData, getWorkouts, getWeeklyVolume, getSplitDistribution, getExerciseStats, applyChartDefaults, fmt, MissingDataError, renderDataState } from './data.js';
import { renderNav } from './nav.js';

renderNav();
applyChartDefaults();

const app = document.getElementById('app');

async function renderPage() {
  try {
    const data = await loadData();
  const workouts = getWorkouts(data);
  const weeklyVol = getWeeklyVolume(data);
  const splits = getSplitDistribution(data);
  const exercises = getExerciseStats(data);

  if (!workouts.length) {
    renderDataState(app, 'Dashboard', 'The imported CSV did not contain any workouts.');
    return;
  }

  const totalSets = workouts.reduce((s, w) => s + w.sets, 0);
  const totalVolume = workouts.reduce((s, w) => s + w.totalVolume, 0);
  const avgDuration = workouts.reduce((s, w) => s + (w.end - w.start) / 60000, 0) / workouts.length;
  const dateRange = `${workouts.at(-1)?.start.toLocaleDateString()} — ${workouts[0]?.start.toLocaleDateString()}`;

  app.innerHTML = `
    <h1 class="page-title">Dashboard</h1>
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
        <div class="value" style="font-size:1rem">${exercises[0]?.name || '—'}</div>
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
        ${workouts.slice(0, 10).map(w => `
          <li>
            <div>
              <div class="workout-name">${w.title}</div>
              <div class="workout-meta">${w.exercises.size} exercises &middot; ${w.sets} sets</div>
            </div>
            <div class="workout-meta">${w.start.toLocaleDateString()}</div>
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  // Volume chart
  new Chart(document.getElementById('volumeChart'), {
    type: 'line',
    data: {
      labels: weeklyVol.map(d => d.week),
      datasets: [{
        label: 'Volume (kg)',
        data: weeklyVol.map(d => d.volume),
        borderColor: '#6c5ce7',
        backgroundColor: 'rgba(108, 92, 231, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 12 } },
        y: { beginAtZero: true }
      }
    }
  });

  // Split doughnut
  const colors = ['#6c5ce7', '#00cec9', '#fdcb6e', '#ff6b6b', '#a29bfe', '#55efc4', '#fab1a0', '#74b9ff', '#dfe6e9', '#fd79a8'];
  new Chart(document.getElementById('splitChart'), {
    type: 'doughnut',
    data: {
      labels: splits.map(s => s.title),
      datasets: [{
        data: splits.map(s => s.count),
        backgroundColor: colors.slice(0, splits.length),
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, padding: 8 } }
      }
    }
  });
  } catch (error) {
  if (error instanceof MissingDataError) {
    renderDataState(app, 'Dashboard', 'Use the Import CSV button in the sidebar to load a Hevy export.');
    return;
  }

    renderDataState(app, 'Dashboard', error.message || 'The imported CSV could not be loaded.');
  }
}

renderPage();
window.addEventListener('hevy-data-imported', renderPage);
