// Shared CSV loader and data utilities
const STORAGE_KEY = 'hevyAnalyzer.csvText';
const STORAGE_NAME_KEY = 'hevyAnalyzer.csvName';

let _data = null;
let _fileName = '';

export class MissingDataError extends Error {
  constructor() {
    super('No Hevy export has been imported yet.');
    this.name = 'MissingDataError';
  }
}

export async function loadData() {
  if (_data) return _data;

  const text = readStoredValue(STORAGE_KEY);
  if (!text) throw new MissingDataError();

  _data = parseCsvText(text);
  _fileName = readStoredValue(STORAGE_NAME_KEY) || _fileName;
  return _data;
}

export async function importCsvFile(file) {
  if (!file) throw new Error('No file selected.');

  const text = await file.text();
  const parsedData = parseCsvText(text);

  _data = parsedData;
  _fileName = file.name;

  writeStoredValue(STORAGE_KEY, text);
  writeStoredValue(STORAGE_NAME_KEY, file.name);
  window.dispatchEvent(new CustomEvent('hevy-data-imported', { detail: { fileName: file.name } }));

  return parsedData;
}

export function getImportedFileName() {
  return _fileName || readStoredValue(STORAGE_NAME_KEY) || '';
}

export function hasImportedData() {
  return !!_data || !!readStoredValue(STORAGE_KEY);
}

export function getWorkoutTitleOptions(data) {
  return [...new Set(data.map(row => getDisplayTitle(row.title)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function filterRows(data, filters = {}) {
  const fromTime = filters.from ? startOfDayTimestamp(filters.from) : null;
  const toTime = filters.to ? endOfDayTimestamp(filters.to) : null;
  const title = filters.title || '';

  return data.filter(row => {
    const rowTime = row.start?.getTime() ?? null;

    if (fromTime != null && (rowTime == null || rowTime < fromTime)) return false;
    if (toTime != null && (rowTime == null || rowTime > toTime)) return false;
    if (title && getDisplayTitle(row.title) !== title) return false;

    return true;
  });
}

export function getDisplayTitle(title) {
  return title || 'Untitled';
}

export function renderDataState(container, title, message) {
  container.innerHTML = `
    <h1 class="page-title">${title}</h1>
    <div class="empty-state card">
      <h2>Import a Hevy CSV export</h2>
      <p>${message}</p>
    </div>
  `;
}

export function renderNoResultsState(container, message) {
  container.innerHTML = `
    <div class="card empty-state empty-state-inline">
      <h2>No results</h2>
      <p>${message}</p>
    </div>
  `;
}

function parseCsvText(text) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (parsed.errors?.length) {
    throw new Error(parsed.errors[0].message || 'The CSV could not be parsed.');
  }

  return parsed.data.map(row => ({
    title: row.title || '',
    start: parseDate(row.start_time),
    end: parseDate(row.end_time),
    exercise: row.exercise_title || '',
    setIndex: row.set_index,
    setType: row.set_type || 'normal',
    weight: row.weight_kg || 0,
    reps: row.reps || 0,
    distance: row.distance_km || 0,
    duration: row.duration_seconds || 0,
    rpe: row.rpe || null,
    supersetId: row.superset_id,
  }));
}

function readStoredValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function parseDate(str) {
  if (!str) return null;
  const parts = str.match(/(\d+)\s+(\w+)\s+(\d{4}),\s*(\d+):(\d+)/);
  if (!parts) return null;
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  return new Date(+parts[3], months[parts[2]], +parts[1], +parts[4], +parts[5]);
}

function startOfDayTimestamp(value) {
  return new Date(`${value}T00:00:00`).getTime();
}

function endOfDayTimestamp(value) {
  return new Date(`${value}T23:59:59.999`).getTime();
}

export function getWorkouts(data) {
  const map = new Map();
  for (const row of data) {
    const key = row.start?.getTime();
    if (key == null) continue;
    if (!map.has(key)) {
      map.set(key, {
        title: getDisplayTitle(row.title),
        start: row.start,
        end: row.end,
        exercises: new Set(),
        sets: 0,
        totalVolume: 0,
      });
    }
    const workout = map.get(key);
    workout.exercises.add(row.exercise);
    if (row.setType === 'normal') {
      workout.sets++;
      workout.totalVolume += row.weight * row.reps;
    }
  }
  return [...map.values()].sort((a, b) => b.start - a.start);
}

export function getExerciseStats(data) {
  const map = new Map();
  for (const row of data) {
    if (row.setType !== 'normal') continue;
    if (!map.has(row.exercise)) {
      map.set(row.exercise, {
        name: row.exercise,
        totalSets: 0,
        totalVolume: 0,
        maxWeight: 0,
        bestSet: null,
        sessions: new Set(),
      });
    }
    const exercise = map.get(row.exercise);
    exercise.totalSets++;
    exercise.totalVolume += row.weight * row.reps;
    if (row.weight > exercise.maxWeight) {
      exercise.maxWeight = row.weight;
      exercise.bestSet = { weight: row.weight, reps: row.reps };
    }
    if (row.start) exercise.sessions.add(row.start.toDateString());
  }
  return [...map.values()]
    .map(exercise => ({ ...exercise, sessionCount: exercise.sessions.size }))
    .sort((a, b) => b.sessionCount - a.sessionCount);
}

export function getWeeklyVolume(data) {
  const map = new Map();
  for (const row of data) {
    if (!row.start || row.setType !== 'normal') continue;
    const date = new Date(row.start);
    date.setDate(date.getDate() - date.getDay());
    const key = date.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + row.weight * row.reps);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, volume]) => ({ week, volume: Math.round(volume) }));
}

export function getWeeklyFrequency(data) {
  const workouts = getWorkouts(data);
  const map = new Map();
  for (const workout of workouts) {
    const date = new Date(workout.start);
    date.setDate(date.getDate() - date.getDay());
    const key = date.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));
}

export function getExerciseProgress(data, exerciseName) {
  const map = new Map();
  for (const row of data) {
    if (row.exercise !== exerciseName || row.setType !== 'normal' || !row.start) continue;
    const key = row.start.toDateString();
    const existing = map.get(key);
    if (!existing || row.weight > existing.weight) {
      map.set(key, { date: row.start, weight: row.weight, reps: row.reps });
    }
  }
  return [...map.values()].sort((a, b) => a.date - b.date);
}

export function getRpeDistribution(data) {
  const counts = {};
  for (const row of data) {
    if (row.rpe != null) {
      const key = row.rpe.toString();
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort(([a], [b]) => +a - +b)
    .map(([rpe, count]) => ({ rpe: +rpe, count }));
}

export function getSplitDistribution(data) {
  const workouts = getWorkouts(data);
  const counts = {};
  for (const workout of workouts) {
    counts[workout.title] = (counts[workout.title] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([title, count]) => ({ title, count }));
}

export function applyChartDefaults() {
  Chart.defaults.color = '#8b8fa3';
  Chart.defaults.borderColor = '#2a2e3d';
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
}

export function fmt(n) {
  return Math.round(n).toLocaleString();
}
