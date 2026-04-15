// Shared CSV loader and data utilities
const STORAGE_KEY = 'hevyAnalyzer.csvText';
const STORAGE_NAME_KEY = 'hevyAnalyzer.csvName';
const FILTER_STORAGE_PREFIX = 'hevyAnalyzer.filters.';

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

export function loadPageFilters(pageKey, defaults) {
  const raw = readStoredValue(`${FILTER_STORAGE_PREFIX}${pageKey}`);
  if (!raw) return { ...defaults };

  try {
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function savePageFilters(pageKey, filters) {
  writeStoredValue(`${FILTER_STORAGE_PREFIX}${pageKey}`, JSON.stringify(filters));
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

export function getExerciseRecords(data, exerciseName = '') {
  const records = new Map();
  const sessionMap = new Map();

  for (const row of data) {
    if (row.setType !== 'normal' || !row.exercise) continue;
    if (exerciseName && row.exercise !== exerciseName) continue;

    if (!records.has(row.exercise)) {
      records.set(row.exercise, {
        exercise: row.exercise,
        heaviestSet: { weight: 0, reps: 0, date: null, title: '' },
        bestEstimatedOneRepMax: { estimated: 0, weight: 0, reps: 0, date: null, title: '' },
        bestRepSet: { weight: 0, reps: 0, date: null, title: '' },
        bestSessionVolume: { totalVolume: 0, totalSets: 0, date: null, title: '' },
        totalSessions: 0,
        totalSets: 0,
      });
    }

    const item = records.get(row.exercise);
    item.totalSets++;

    if (
      row.weight > item.heaviestSet.weight
      || (row.weight === item.heaviestSet.weight && row.reps > item.heaviestSet.reps)
    ) {
      item.heaviestSet = {
        weight: row.weight,
        reps: row.reps,
        date: row.start,
        title: getDisplayTitle(row.title),
      };
    }

    const estimated = estimateOneRepMax(row.weight, row.reps);
    if (estimated > item.bestEstimatedOneRepMax.estimated) {
      item.bestEstimatedOneRepMax = {
        estimated,
        weight: row.weight,
        reps: row.reps,
        date: row.start,
        title: getDisplayTitle(row.title),
      };
    }

    if (
      row.reps > item.bestRepSet.reps
      || (row.reps === item.bestRepSet.reps && row.weight > item.bestRepSet.weight)
    ) {
      item.bestRepSet = {
        weight: row.weight,
        reps: row.reps,
        date: row.start,
        title: getDisplayTitle(row.title),
      };
    }

    const sessionKey = `${row.exercise}::${row.start?.getTime() ?? 'na'}`;
    if (!sessionMap.has(sessionKey)) {
      sessionMap.set(sessionKey, {
        exercise: row.exercise,
        title: getDisplayTitle(row.title),
        date: row.start,
        totalVolume: 0,
        totalSets: 0,
      });
    }

    const session = sessionMap.get(sessionKey);
    session.totalVolume += row.weight * row.reps;
    session.totalSets++;
  }

  for (const session of sessionMap.values()) {
    const item = records.get(session.exercise);
    if (!item) continue;

    item.totalSessions++;
    if (session.totalVolume > item.bestSessionVolume.totalVolume) {
      item.bestSessionVolume = {
        totalVolume: session.totalVolume,
        totalSets: session.totalSets,
        date: session.date,
        title: session.title,
      };
    }
  }

  return [...records.values()].sort((a, b) => {
    const estimatedDelta = b.bestEstimatedOneRepMax.estimated - a.bestEstimatedOneRepMax.estimated;
    if (estimatedDelta !== 0) return estimatedDelta;
    return b.heaviestSet.weight - a.heaviestSet.weight;
  });
}

export function getExerciseRecordProgress(data, exerciseName) {
  const map = new Map();

  for (const row of data) {
    if (row.exercise !== exerciseName || row.setType !== 'normal' || !row.start) continue;

    const key = row.start.toDateString();
    if (!map.has(key)) {
      map.set(key, {
        date: row.start,
        topWeight: 0,
        estimatedOneRepMax: 0,
        totalVolume: 0,
      });
    }

    const item = map.get(key);
    item.topWeight = Math.max(item.topWeight, row.weight || 0);
    item.estimatedOneRepMax = Math.max(item.estimatedOneRepMax, estimateOneRepMax(row.weight, row.reps));
    item.totalVolume += row.weight * row.reps;
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

export function estimateOneRepMax(weight, reps) {
  if (!(weight > 0) || !(reps > 0)) return 0;
  return weight * (1 + reps / 30);
}

export function getTopEstimatedOneRepMax(data, limit = 10) {
  const map = new Map();

  for (const row of data) {
    if (row.setType !== 'normal' || !row.exercise) continue;
    const estimated = estimateOneRepMax(row.weight, row.reps);
    if (!estimated) continue;

    const existing = map.get(row.exercise);
    if (!existing || estimated > existing.estimatedOneRepMax) {
      map.set(row.exercise, {
        exercise: row.exercise,
        estimatedOneRepMax: estimated,
        weight: row.weight,
        reps: row.reps,
        date: row.start,
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => b.estimatedOneRepMax - a.estimatedOneRepMax)
    .slice(0, limit);
}

export function getExerciseOneRepMaxProgress(data, exerciseName) {
  const map = new Map();

  for (const row of data) {
    if (row.exercise !== exerciseName || row.setType !== 'normal' || !row.start) continue;
    const estimated = estimateOneRepMax(row.weight, row.reps);
    if (!estimated) continue;

    const key = row.start.toDateString();
    const existing = map.get(key);
    if (!existing || estimated > existing.estimatedOneRepMax) {
      map.set(key, {
        date: row.start,
        estimatedOneRepMax: estimated,
        weight: row.weight,
        reps: row.reps,
      });
    }
  }

  return [...map.values()].sort((a, b) => a.date - b.date);
}

export function getExerciseRepRangeProfile(data, exerciseName = '') {
  const buckets = [
    { label: '1-5', min: 1, max: 5, count: 0 },
    { label: '6-8', min: 6, max: 8, count: 0 },
    { label: '9-12', min: 9, max: 12, count: 0 },
    { label: '13+', min: 13, max: Infinity, count: 0 },
  ];

  for (const row of data) {
    if (row.setType !== 'normal' || !(row.reps > 0)) continue;
    if (exerciseName && row.exercise !== exerciseName) continue;

    const bucket = buckets.find(item => row.reps >= item.min && row.reps <= item.max);
    if (bucket) bucket.count++;
  }

  return buckets;
}

export function getExerciseRpeProfile(data, exerciseName = '') {
  const map = new Map();

  for (const row of data) {
    if (row.setType !== 'normal' || row.rpe == null) continue;
    if (exerciseName && row.exercise !== exerciseName) continue;

    const key = row.rpe.toString();
    if (!map.has(key)) {
      map.set(key, {
        rpe: row.rpe,
        count: 0,
        totalWeight: 0,
        totalEstimatedOneRepMax: 0,
      });
    }

    const item = map.get(key);
    item.count++;
    item.totalWeight += row.weight || 0;
    item.totalEstimatedOneRepMax += estimateOneRepMax(row.weight, row.reps);
  }

  return [...map.values()]
    .sort((a, b) => a.rpe - b.rpe)
    .map(item => ({
      ...item,
      averageWeight: item.count ? item.totalWeight / item.count : 0,
      averageEstimatedOneRepMax: item.count ? item.totalEstimatedOneRepMax / item.count : 0,
    }));
}

export function getSessionStats(data) {
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
        totalSets: 0,
        totalVolume: 0,
        totalRpe: 0,
        rpeCount: 0,
        cardioDistance: 0,
        cardioDurationSeconds: 0,
        peakEstimatedOneRepMax: 0,
      });
    }

    const session = map.get(key);
    session.exercises.add(row.exercise);

    if (row.setType === 'normal') {
      session.totalSets++;
      session.totalVolume += row.weight * row.reps;
      session.peakEstimatedOneRepMax = Math.max(session.peakEstimatedOneRepMax, estimateOneRepMax(row.weight, row.reps));
    }

    if (row.rpe != null) {
      session.totalRpe += row.rpe;
      session.rpeCount++;
    }

    session.cardioDistance += row.distance || 0;
    session.cardioDurationSeconds += row.duration || 0;
  }

  return [...map.values()]
    .map(session => {
      const durationMin = session.start && session.end ? Math.max(1, (session.end - session.start) / 60000) : 1;
      return {
        ...session,
        durationMin,
        exerciseCount: session.exercises.size,
        avgRpe: session.rpeCount ? session.totalRpe / session.rpeCount : null,
        setsPerMinute: session.totalSets / durationMin,
        volumePerMinute: session.totalVolume / durationMin,
        cardioDurationMin: session.cardioDurationSeconds / 60,
      };
    })
    .sort((a, b) => b.start - a.start);
}

export function getSessionTrend(data) {
  return getSessionStats(data)
    .slice()
    .reverse()
    .map(session => ({
      label: session.start.toLocaleDateString(),
      durationMin: session.durationMin,
      setsPerMinute: session.setsPerMinute,
      volumePerMinute: session.volumePerMinute,
      totalSets: session.totalSets,
      totalVolume: session.totalVolume,
    }));
}

export function getMonthlySplitCounts(data) {
  const workouts = getWorkouts(data);
  const months = new Map();

  for (const workout of workouts) {
    const month = `${workout.start.getFullYear()}-${String(workout.start.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(month)) months.set(month, {});
    const monthItem = months.get(month);
    monthItem[workout.title] = (monthItem[workout.title] || 0) + 1;
  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, counts }));
}

export function getWorkoutStreaks(data) {
  const days = [...new Set(getWorkouts(data).map(workout => workout.start.toISOString().slice(0, 10)))].sort();
  if (!days.length) {
    return { currentStreak: 0, longestStreak: 0, activeDays: 0 };
  }

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate = null;

  for (const day of days) {
    const currentDate = new Date(`${day}T00:00:00`);
    if (previousDate && (currentDate - previousDate) / 86400000 === 1) {
      runningStreak++;
    } else {
      runningStreak = 1;
    }

    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = currentDate;
  }

  let currentStreak = 0;
  previousDate = null;
  for (let index = days.length - 1; index >= 0; index--) {
    const currentDate = new Date(`${days[index]}T00:00:00`);
    if (!previousDate) {
      currentStreak = 1;
    } else if ((previousDate - currentDate) / 86400000 === 1) {
      currentStreak++;
    } else {
      break;
    }
    previousDate = currentDate;
  }

  return {
    currentStreak,
    longestStreak,
    activeDays: days.length,
  };
}

export function getWorkoutDayCounts(data) {
  const counts = {};
  for (const workout of getWorkouts(data)) {
    const key = workout.start.toISOString().slice(0, 10);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function getWeekdayDistribution(data) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = labels.map(label => ({ label, count: 0 }));

  for (const workout of getWorkouts(data)) {
    counts[workout.start.getDay()].count++;
  }

  return counts;
}

export function getHourDistribution(data) {
  const counts = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));

  for (const workout of getWorkouts(data)) {
    counts[workout.start.getHours()].count++;
  }

  return counts;
}

export function getWeeklyCardio(data) {
  const map = new Map();

  for (const row of data) {
    if (!(row.distance > 0) && !(row.duration > 0)) continue;
    if (!row.start) continue;

    const date = new Date(row.start);
    date.setDate(date.getDate() - date.getDay());
    const key = date.toISOString().slice(0, 10);

    if (!map.has(key)) {
      map.set(key, { week: key, distance: 0, durationMin: 0 });
    }

    const item = map.get(key);
    item.distance += row.distance || 0;
    item.durationMin += (row.duration || 0) / 60;
  }

  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week));
}

export function getCardioExerciseStats(data) {
  const map = new Map();

  for (const row of data) {
    if (!(row.distance > 0) && !(row.duration > 0)) continue;

    if (!map.has(row.exercise)) {
      map.set(row.exercise, {
        exercise: row.exercise,
        totalDistance: 0,
        totalDurationMin: 0,
        entries: 0,
      });
    }

    const item = map.get(row.exercise);
    item.totalDistance += row.distance || 0;
    item.totalDurationMin += (row.duration || 0) / 60;
    item.entries++;
  }

  return [...map.values()].sort((a, b) => b.totalDistance - a.totalDistance || b.totalDurationMin - a.totalDurationMin);
}

export function getCardioSummary(data) {
  const cardioRows = data.filter(row => row.distance > 0 || row.duration > 0);
  return {
    totalDistance: cardioRows.reduce((sum, row) => sum + (row.distance || 0), 0),
    totalDurationMin: cardioRows.reduce((sum, row) => sum + (row.duration || 0) / 60, 0),
    totalEntries: cardioRows.length,
    uniqueExercises: new Set(cardioRows.map(row => row.exercise).filter(Boolean)).size,
  };
}

export function getSupersetSummary(data) {
  const groups = new Map();

  for (const row of data) {
    if (!row.supersetId || !row.start) continue;
    const key = `${row.start.getTime()}::${row.supersetId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        exercises: new Set(),
        setCount: 0,
      });
    }

    const group = groups.get(key);
    if (row.exercise) group.exercises.add(row.exercise);
    if (row.setType === 'normal') group.setCount++;
  }

  const pairCounts = {};
  let totalSupersetSets = 0;

  for (const group of groups.values()) {
    totalSupersetSets += group.setCount;
    const label = [...group.exercises].sort().join(' + ') || 'Unlabeled Superset';
    pairCounts[label] = (pairCounts[label] || 0) + 1;
  }

  return {
    totalGroups: groups.size,
    totalSupersetSets,
    mostCommonPairs: Object.entries(pairCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([pair, count]) => ({ pair, count })),
  };
}

export function getPeriodComparison(data, days = 30) {
  const workouts = getWorkouts(data).filter(workout => workout.start);
  if (!workouts.length) {
    return {
      days,
      latestDate: null,
      current: getPeriodMetrics([]),
      previous: getPeriodMetrics([]),
    };
  }

  const latestDate = workouts[0].start;
  const currentStart = shiftDays(startOfDate(latestDate), -(days - 1));
  const previousStart = shiftDays(currentStart, -days);

  const currentRows = data.filter(row => row.start && row.start >= currentStart);
  const previousRows = data.filter(row => row.start && row.start >= previousStart && row.start < currentStart);

  return {
    days,
    latestDate,
    currentStart,
    previousStart,
    current: getPeriodMetrics(currentRows),
    previous: getPeriodMetrics(previousRows),
  };
}

export function getWeeklyLoad(data) {
  const map = new Map();

  for (const session of getSessionStats(data)) {
    if (!session.start) continue;

    const weekStart = getWeekStart(session.start);
    const key = weekStart.toISOString().slice(0, 10);
    if (!map.has(key)) {
      map.set(key, {
        week: key,
        totalVolume: 0,
        workouts: 0,
        totalSets: 0,
        totalRpe: 0,
        rpeCount: 0,
      });
    }

    const item = map.get(key);
    item.totalVolume += session.totalVolume;
    item.workouts++;
    item.totalSets += session.totalSets;
    if (session.avgRpe != null) {
      item.totalRpe += session.avgRpe;
      item.rpeCount++;
    }
  }

  return [...map.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(item => ({
      week: item.week,
      totalVolume: item.totalVolume,
      workouts: item.workouts,
      totalSets: item.totalSets,
      avgRpe: item.rpeCount ? item.totalRpe / item.rpeCount : null,
    }));
}

export function getExerciseMomentum(data, days = 30, minSessions = 2) {
  const workouts = getWorkouts(data).filter(workout => workout.start);
  if (!workouts.length) return [];

  const latestDate = workouts[0].start;
  const currentStart = shiftDays(startOfDate(latestDate), -(days - 1));
  const previousStart = shiftDays(currentStart, -days);
  const records = getExerciseRecords(data);

  return records
    .map(record => {
      const progress = getExerciseOneRepMaxProgress(data, record.exercise);
      const recent = progress.filter(item => item.date >= currentStart);
      const previous = progress.filter(item => item.date >= previousStart && item.date < currentStart);
      const recentBest = recent.reduce((best, item) => Math.max(best, item.estimatedOneRepMax), 0);
      const previousBest = previous.reduce((best, item) => Math.max(best, item.estimatedOneRepMax), 0);
      const delta = previousBest > 0 ? (recentBest - previousBest) / previousBest : null;
      const lastImprovementDate = getLastImprovementDate(progress);

      return {
        exercise: record.exercise,
        recentSessions: recent.length,
        previousSessions: previous.length,
        recentBest,
        previousBest,
        delta,
        lastImprovementDate,
        daysSinceImprovement: lastImprovementDate && latestDate
          ? Math.round((startOfDate(latestDate) - startOfDate(lastImprovementDate)) / 86400000)
          : null,
      };
    })
    .filter(item => item.recentSessions >= minSessions || item.previousSessions >= minSessions)
    .sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity));
}

export function getExercisePlateaus(data, options = {}) {
  const days = options.days || 30;
  const threshold = options.threshold ?? 0.01;
  const minSessions = options.minSessions || 3;

  return getExerciseMomentum(data, days, minSessions)
    .filter(item => item.previousSessions >= minSessions && item.recentSessions >= minSessions)
    .filter(item => item.delta != null && item.delta <= threshold)
    .sort((a, b) => {
      const stallDelta = (a.delta ?? 0) - (b.delta ?? 0);
      if (stallDelta !== 0) return stallDelta;
      return (b.daysSinceImprovement ?? 0) - (a.daysSinceImprovement ?? 0);
    });
}

export function getRecoveryWarnings(data, options = {}) {
  const days = options.days || 30;
  const sessions = getSessionStats(data)
    .filter(session => session.start)
    .slice()
    .sort((a, b) => a.start - b.start);

  if (!sessions.length) return [];

  const latestDate = sessions[sessions.length - 1].start;
  const recentStart = shiftDays(startOfDate(latestDate), -(days - 1));
  const recentSessions = sessions.filter(session => session.start >= recentStart);
  const warnings = [];

  const highRpeStreaks = [];
  let currentStreak = [];
  for (const session of recentSessions) {
    if ((session.avgRpe ?? 0) >= 8.5) {
      currentStreak.push(session);
    } else if (currentStreak.length) {
      highRpeStreaks.push(currentStreak);
      currentStreak = [];
    }
  }
  if (currentStreak.length) highRpeStreaks.push(currentStreak);

  const longestHighRpeStreak = highRpeStreaks.sort((a, b) => b.length - a.length)[0];
  if (longestHighRpeStreak?.length >= 2) {
    warnings.push({
      severity: longestHighRpeStreak.length >= 3 ? 'high' : 'medium',
      title: 'Back-to-back high RPE sessions',
      detail: `${longestHighRpeStreak.length} sessions averaged 8.5+ RPE between ${longestHighRpeStreak[0].start.toLocaleDateString()} and ${longestHighRpeStreak[longestHighRpeStreak.length - 1].start.toLocaleDateString()}.`,
      score: longestHighRpeStreak.length >= 3 ? 30 : 20,
    });
  }

  let biggestSpike = null;
  for (let index = 4; index < recentSessions.length; index++) {
    const previous = recentSessions.slice(index - 4, index);
    const baseline = previous.reduce((sum, item) => sum + item.totalVolume, 0) / previous.length;
    const current = recentSessions[index];
    if (baseline > 0 && current.totalVolume > baseline * 1.25) {
      const spike = {
        session: current,
        ratio: current.totalVolume / baseline,
        baseline,
      };
      if (!biggestSpike || spike.ratio > biggestSpike.ratio) {
        biggestSpike = spike;
      }
    }
  }

  if (biggestSpike) {
    warnings.push({
      severity: biggestSpike.ratio >= 1.5 ? 'high' : 'medium',
      title: 'Acute volume spike',
      detail: `${biggestSpike.session.start.toLocaleDateString()} jumped to ${fmt(biggestSpike.session.totalVolume)} kg, ${Math.round((biggestSpike.ratio - 1) * 100)}% above the prior 4-session average.`,
      score: biggestSpike.ratio >= 1.5 ? 28 : 18,
    });
  }

  const longThreshold = Math.max(90, percentile(recentSessions.map(session => session.durationMin), 0.85));
  const longSessions = recentSessions.filter(session => session.durationMin >= longThreshold);
  if (longSessions.length >= 2) {
    warnings.push({
      severity: 'medium',
      title: 'Multiple unusually long sessions',
      detail: `${longSessions.length} sessions in the last ${days} days ran ${Math.round(longThreshold)}+ minutes.`,
      score: 16,
    });
  }

  const denseHardBlock = recentSessions.filter(session => {
    const sessionDay = startOfDate(session.start);
    const blockStart = shiftDays(sessionDay, -4);
    const blockSessions = recentSessions.filter(item => item.start >= blockStart && item.start <= sessionDay);
    const hardSessions = blockSessions.filter(item => (item.avgRpe ?? 0) >= 8 || item.durationMin >= longThreshold);
    return hardSessions.length >= 3;
  })[0];

  if (denseHardBlock) {
    warnings.push({
      severity: 'high',
      title: 'Hard sessions are clustering',
      detail: `At least 3 hard or long sessions landed within 5 days by ${denseHardBlock.start.toLocaleDateString()}.`,
      score: 26,
    });
  }

  return warnings.sort((a, b) => b.score - a.score);
}

export function applyChartDefaults() {
  Chart.defaults.color = '#8b8fa3';
  Chart.defaults.borderColor = '#2a2e3d';
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
}

export function fmt(n) {
  return Math.round(n).toLocaleString();
}

function getPeriodMetrics(rows) {
  const sessions = getSessionStats(rows);
  const totalAvgRpe = sessions.reduce((sum, session) => sum + (session.avgRpe || 0), 0);
  const rpeCount = sessions.filter(session => session.avgRpe != null).length;

  return {
    workouts: sessions.length,
    activeDays: new Set(sessions.map(session => session.start?.toISOString().slice(0, 10)).filter(Boolean)).size,
    totalSets: sessions.reduce((sum, session) => sum + session.totalSets, 0),
    totalVolume: sessions.reduce((sum, session) => sum + session.totalVolume, 0),
    avgDuration: sessions.length ? sessions.reduce((sum, session) => sum + session.durationMin, 0) / sessions.length : 0,
    avgSetsPerWorkout: sessions.length ? sessions.reduce((sum, session) => sum + session.totalSets, 0) / sessions.length : 0,
    avgRpe: rpeCount ? totalAvgRpe / rpeCount : null,
    cardioDistance: sessions.reduce((sum, session) => sum + session.cardioDistance, 0),
    cardioDurationMin: sessions.reduce((sum, session) => sum + session.cardioDurationMin, 0),
    peakEstimatedOneRepMax: sessions.reduce((best, session) => Math.max(best, session.peakEstimatedOneRepMax), 0),
  };
}

function getLastImprovementDate(progress) {
  let best = 0;
  let lastImprovementDate = null;

  for (const item of progress) {
    if (item.estimatedOneRepMax > best) {
      best = item.estimatedOneRepMax;
      lastImprovementDate = item.date;
    }
  }

  return lastImprovementDate;
}

function startOfDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekStart(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - value.getDay());
  return value;
}

function percentile(values, ratio) {
  const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * ratio)));
  return sorted[index];
}
