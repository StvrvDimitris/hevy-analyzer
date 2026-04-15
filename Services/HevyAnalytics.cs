using HevyAnalyzer.Models;

namespace HevyAnalyzer.Services;

public static class HevyAnalytics
{
    public static string GetDisplayTitle(string? title)
        => string.IsNullOrWhiteSpace(title) ? "Untitled" : title;

    public static IReadOnlyList<string> GetWorkoutTitleOptions(IEnumerable<HevyRow> rows)
        => rows.Select(row => GetDisplayTitle(row.Title))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(title => title)
            .ToList();

    public static IReadOnlyList<HevyRow> FilterRows(IEnumerable<HevyRow> rows, DateTitleFilters filters)
    {
        var from = filters.From?.Date;
        var to = filters.To?.Date.AddDays(1).AddTicks(-1);
        var title = filters.Title ?? string.Empty;

        return rows.Where(row =>
        {
            var start = row.Start;
            if (from.HasValue && (!start.HasValue || start.Value < from.Value))
            {
                return false;
            }

            if (to.HasValue && (!start.HasValue || start.Value > to.Value))
            {
                return false;
            }

            if (!string.IsNullOrWhiteSpace(title) && !string.Equals(GetDisplayTitle(row.Title), title, StringComparison.Ordinal))
            {
                return false;
            }

            return true;
        }).ToList();
    }

    public static IReadOnlyList<WorkoutSummary> GetWorkouts(IEnumerable<HevyRow> rows)
    {
        var workouts = new Dictionary<long, WorkoutSummary>();

        foreach (var row in rows.Where(row => row.Start.HasValue))
        {
            var key = row.Start!.Value.Ticks;
            if (!workouts.TryGetValue(key, out var workout))
            {
                workout = new WorkoutSummary
                {
                    Title = GetDisplayTitle(row.Title),
                    Start = row.Start.Value,
                    End = row.End,
                };
            }

            workout.Exercises.Add(row.Exercise);
            if (row.SetType == "normal")
            {
                workout = new WorkoutSummary
                {
                    Title = workout.Title,
                    Start = workout.Start,
                    End = workout.End,
                    Exercises = workout.Exercises,
                    Sets = workout.Sets + 1,
                    TotalVolume = workout.TotalVolume + (row.Weight * row.Reps),
                };
            }

            workouts[key] = workout;
        }

        return workouts.Values.OrderByDescending(item => item.Start).ToList();
    }

    public static IReadOnlyList<ExerciseSummary> GetExerciseStats(IEnumerable<HevyRow> rows)
    {
        var summaries = new Dictionary<string, (int totalSets, double totalVolume, double maxWeight, SetSnapshot? bestSet, HashSet<DateOnly> sessions)>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows.Where(row => row.SetType == "normal" && !string.IsNullOrWhiteSpace(row.Exercise)))
        {
            summaries.TryGetValue(row.Exercise, out var current);
            current.totalSets++;
            current.totalVolume += row.Weight * row.Reps;
            if (row.Weight > current.maxWeight)
            {
                current.maxWeight = row.Weight;
                current.bestSet = new SetSnapshot
                {
                    Weight = row.Weight,
                    Reps = row.Reps,
                    EstimatedOneRepMax = EstimateOneRepMax(row.Weight, row.Reps),
                    Date = row.Start,
                };
            }

            current.sessions ??= [];
            if (row.Start.HasValue)
            {
                current.sessions.Add(DateOnly.FromDateTime(row.Start.Value));
            }

            summaries[row.Exercise] = current;
        }

        return summaries.Select(item => new ExerciseSummary
            {
                Name = item.Key,
                TotalSets = item.Value.totalSets,
                TotalVolume = item.Value.totalVolume,
                MaxWeight = item.Value.maxWeight,
                BestSet = item.Value.bestSet,
                SessionCount = item.Value.sessions?.Count ?? 0,
            })
            .OrderByDescending(item => item.SessionCount)
            .ThenBy(item => item.Name)
            .ToList();
    }

    public static IReadOnlyList<VolumePoint> GetWeeklyVolume(IEnumerable<HevyRow> rows)
        => rows.Where(row => row.Start.HasValue && row.SetType == "normal")
            .GroupBy(row => StartOfWeek(row.Start!.Value))
            .OrderBy(group => group.Key)
            .Select(group => new VolumePoint
            {
                Label = group.Key.ToString("yyyy-MM-dd"),
                Value = Math.Round(group.Sum(row => row.Weight * row.Reps)),
            })
            .ToList();

    public static IReadOnlyList<VolumePoint> GetWeeklyFrequency(IEnumerable<HevyRow> rows)
        => GetWorkouts(rows)
            .GroupBy(workout => StartOfWeek(workout.Start))
            .OrderBy(group => group.Key)
            .Select(group => new VolumePoint
            {
                Label = group.Key.ToString("yyyy-MM-dd"),
                Value = group.Count(),
            })
            .ToList();

    public static IReadOnlyList<ProgressPoint> GetExerciseProgress(IEnumerable<HevyRow> rows, string exerciseName)
        => rows.Where(row => row.Start.HasValue && row.SetType == "normal" && string.Equals(row.Exercise, exerciseName, StringComparison.OrdinalIgnoreCase))
            .GroupBy(row => row.Start!.Value.Date)
            .Select(group =>
            {
                var best = group.OrderByDescending(row => row.Weight).ThenByDescending(row => row.Reps).First();
                return new ProgressPoint { Date = best.Start!.Value, Weight = best.Weight, Reps = best.Reps };
            })
            .OrderBy(item => item.Date)
            .ToList();

    public static IReadOnlyList<RpeBucket> GetRpeDistribution(IEnumerable<HevyRow> rows)
        => rows.Where(row => row.Rpe.HasValue)
            .GroupBy(row => row.Rpe!.Value)
            .OrderBy(group => group.Key)
            .Select(group => new RpeBucket
            {
                Rpe = group.Key,
                Count = group.Count(),
                AverageWeight = group.Average(row => row.Weight),
                AverageEstimatedOneRepMax = group.Average(row => EstimateOneRepMax(row.Weight, row.Reps)),
            })
            .ToList();

    public static IReadOnlyList<SplitCount> GetSplitDistribution(IEnumerable<HevyRow> rows)
        => GetWorkouts(rows)
            .GroupBy(workout => workout.Title)
            .OrderByDescending(group => group.Count())
            .Select(group => new SplitCount { Title = group.Key, Count = group.Count() })
            .ToList();

    public static double EstimateOneRepMax(double weight, int reps)
        => weight > 0 && reps > 0 ? weight * (1 + reps / 30d) : 0;

    public static IReadOnlyList<SetSnapshot> GetTopEstimatedOneRepMax(IEnumerable<HevyRow> rows, int limit = 10)
    {
        var best = new Dictionary<string, SetSnapshot>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows.Where(row => row.SetType == "normal" && !string.IsNullOrWhiteSpace(row.Exercise)))
        {
            var estimated = EstimateOneRepMax(row.Weight, row.Reps);
            if (!best.TryGetValue(row.Exercise, out var current) || estimated > current.EstimatedOneRepMax)
            {
                best[row.Exercise] = new SetSnapshot
                {
                    Weight = row.Weight,
                    Reps = row.Reps,
                    EstimatedOneRepMax = estimated,
                    Date = row.Start,
                    Title = row.Exercise,
                };
            }
        }

        return best.Values.OrderByDescending(item => item.EstimatedOneRepMax).Take(limit).ToList();
    }

    public static IReadOnlyList<OneRepMaxProgressPoint> GetExerciseOneRepMaxProgress(IEnumerable<HevyRow> rows, string exerciseName)
        => rows.Where(row => row.Start.HasValue && row.SetType == "normal" && string.Equals(row.Exercise, exerciseName, StringComparison.OrdinalIgnoreCase))
            .Select(row => new OneRepMaxProgressPoint
            {
                Date = row.Start!.Value,
                EstimatedOneRepMax = EstimateOneRepMax(row.Weight, row.Reps),
                Weight = row.Weight,
                Reps = row.Reps,
            })
            .GroupBy(item => item.Date.Date)
            .Select(group => group.OrderByDescending(item => item.EstimatedOneRepMax).First())
            .OrderBy(item => item.Date)
            .ToList();

    public static IReadOnlyList<LabeledCount> GetExerciseRepRangeProfile(IEnumerable<HevyRow> rows, string? exerciseName = null)
    {
        var buckets = new[]
        {
            new { Label = "1-5", Min = 1, Max = 5 },
            new { Label = "6-8", Min = 6, Max = 8 },
            new { Label = "9-12", Min = 9, Max = 12 },
            new { Label = "13+", Min = 13, Max = int.MaxValue },
        };

        return buckets.Select(bucket => new LabeledCount
        {
            Label = bucket.Label,
            Count = rows.Count(row =>
                row.SetType == "normal"
                && row.Reps >= bucket.Min
                && row.Reps <= bucket.Max
                && (string.IsNullOrWhiteSpace(exerciseName) || string.Equals(row.Exercise, exerciseName, StringComparison.OrdinalIgnoreCase))),
        }).ToList();
    }

    public static IReadOnlyList<RpeBucket> GetExerciseRpeProfile(IEnumerable<HevyRow> rows, string? exerciseName = null)
        => rows.Where(row =>
                row.SetType == "normal"
                && row.Rpe.HasValue
                && (string.IsNullOrWhiteSpace(exerciseName) || string.Equals(row.Exercise, exerciseName, StringComparison.OrdinalIgnoreCase)))
            .GroupBy(row => row.Rpe!.Value)
            .OrderBy(group => group.Key)
            .Select(group => new RpeBucket
            {
                Rpe = group.Key,
                Count = group.Count(),
                AverageWeight = group.Average(row => row.Weight),
                AverageEstimatedOneRepMax = group.Average(row => EstimateOneRepMax(row.Weight, row.Reps)),
            })
            .ToList();

    public static IReadOnlyList<SessionSummary> GetSessionStats(IEnumerable<HevyRow> rows)
        => rows.Where(row => row.Start.HasValue)
            .GroupBy(row => row.Start!.Value)
            .Select(group =>
            {
                var durationMin = group.First().End.HasValue ? Math.Max(1, (group.First().End!.Value - group.Key).TotalMinutes) : 1;
                var totalSets = group.Count(row => row.SetType == "normal");
                var totalVolume = group.Where(row => row.SetType == "normal").Sum(row => row.Weight * row.Reps);
                var rpeRows = group.Where(row => row.Rpe.HasValue).ToList();

                return new SessionSummary
                {
                    Title = GetDisplayTitle(group.First().Title),
                    Start = group.Key,
                    End = group.First().End,
                    TotalSets = totalSets,
                    TotalVolume = totalVolume,
                    ExerciseCount = group.Select(row => row.Exercise).Where(name => !string.IsNullOrWhiteSpace(name)).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                    DurationMin = durationMin,
                    SetsPerMinute = totalSets / durationMin,
                    VolumePerMinute = totalVolume / durationMin,
                    CardioDistance = group.Sum(row => row.Distance),
                    CardioDurationMin = group.Sum(row => row.Duration) / 60d,
                    AvgRpe = rpeRows.Count > 0 ? rpeRows.Average(row => row.Rpe!.Value) : null,
                    PeakEstimatedOneRepMax = group.Where(row => row.SetType == "normal").Select(row => EstimateOneRepMax(row.Weight, row.Reps)).DefaultIfEmpty(0).Max(),
                };
            })
            .OrderByDescending(item => item.Start)
            .ToList();

    public static IReadOnlyList<SessionTrendPoint> GetSessionTrend(IEnumerable<HevyRow> rows)
        => GetSessionStats(rows)
            .OrderBy(item => item.Start)
            .Select(item => new SessionTrendPoint
            {
                Label = item.Start.ToString("d MMM"),
                DurationMin = item.DurationMin,
                SetsPerMinute = item.SetsPerMinute,
                VolumePerMinute = item.VolumePerMinute,
                TotalSets = item.TotalSets,
                TotalVolume = item.TotalVolume,
            })
            .ToList();

    public static IReadOnlyList<MonthlySplitCounts> GetMonthlySplitCounts(IEnumerable<HevyRow> rows)
        => GetWorkouts(rows)
            .GroupBy(workout => $"{workout.Start:yyyy-MM}")
            .OrderBy(group => group.Key)
            .Select(group => new MonthlySplitCounts
            {
                Month = group.Key,
                Counts = group.GroupBy(item => item.Title).ToDictionary(item => item.Key, item => item.Count()),
            })
            .ToList();

    public static StreakSummary GetWorkoutStreaks(IEnumerable<HevyRow> rows)
    {
        var days = GetWorkouts(rows)
            .Select(item => DateOnly.FromDateTime(item.Start))
            .Distinct()
            .OrderBy(item => item)
            .ToList();

        if (days.Count == 0)
        {
            return new StreakSummary();
        }

        var longest = 0;
        var running = 0;
        DateOnly? previous = null;
        foreach (var day in days)
        {
            running = previous.HasValue && day.DayNumber - previous.Value.DayNumber == 1 ? running + 1 : 1;
            longest = Math.Max(longest, running);
            previous = day;
        }

        var current = 0;
        previous = null;
        for (var index = days.Count - 1; index >= 0; index--)
        {
            var day = days[index];
            if (!previous.HasValue)
            {
                current = 1;
            }
            else if (previous.Value.DayNumber - day.DayNumber == 1)
            {
                current++;
            }
            else
            {
                break;
            }

            previous = day;
        }

        return new StreakSummary { CurrentStreak = current, LongestStreak = longest, ActiveDays = days.Count };
    }

    public static IReadOnlyDictionary<DateOnly, int> GetWorkoutDayCounts(IEnumerable<HevyRow> rows)
        => GetWorkouts(rows).GroupBy(workout => DateOnly.FromDateTime(workout.Start)).ToDictionary(group => group.Key, group => group.Count());

    public static IReadOnlyList<LabeledCount> GetWeekdayDistribution(IEnumerable<HevyRow> rows)
    {
        var workouts = GetWorkouts(rows);
        var labels = new[] { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
        return labels.Select((label, index) => new LabeledCount { Label = label, Count = workouts.Count(workout => (int)workout.Start.DayOfWeek == index) }).ToList();
    }

    public static IReadOnlyList<HourCount> GetHourDistribution(IEnumerable<HevyRow> rows)
    {
        var workouts = GetWorkouts(rows);
        return Enumerable.Range(0, 24).Select(hour => new HourCount { Hour = hour, Count = workouts.Count(workout => workout.Start.Hour == hour) }).ToList();
    }

    public static IReadOnlyList<(string Week, double Distance, double DurationMin)> GetWeeklyCardio(IEnumerable<HevyRow> rows)
        => rows.Where(row => row.Start.HasValue && (row.Distance > 0 || row.Duration > 0))
            .GroupBy(row => StartOfWeek(row.Start!.Value))
            .OrderBy(group => group.Key)
            .Select(group => (group.Key.ToString("yyyy-MM-dd"), group.Sum(row => row.Distance), group.Sum(row => row.Duration) / 60d))
            .ToList();

    public static IReadOnlyList<CardioExerciseSummary> GetCardioExerciseStats(IEnumerable<HevyRow> rows)
        => rows.Where(row => row.Distance > 0 || row.Duration > 0)
            .GroupBy(row => row.Exercise)
            .Select(group => new CardioExerciseSummary
            {
                Exercise = group.Key,
                TotalDistance = group.Sum(row => row.Distance),
                TotalDurationMin = group.Sum(row => row.Duration) / 60d,
                Entries = group.Count(),
            })
            .OrderByDescending(item => item.TotalDistance)
            .ThenByDescending(item => item.TotalDurationMin)
            .ToList();

    public static CardioSummary GetCardioSummary(IEnumerable<HevyRow> rows)
    {
        var cardioRows = rows.Where(row => row.Distance > 0 || row.Duration > 0).ToList();
        return new CardioSummary
        {
            TotalDistance = cardioRows.Sum(row => row.Distance),
            TotalDurationMin = cardioRows.Sum(row => row.Duration) / 60d,
            TotalEntries = cardioRows.Count,
            UniqueExercises = cardioRows.Select(row => row.Exercise).Where(name => !string.IsNullOrWhiteSpace(name)).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
        };
    }

    public static SupersetSummary GetSupersetSummary(IEnumerable<HevyRow> rows)
    {
        var groups = rows.Where(row => row.Start.HasValue && !string.IsNullOrWhiteSpace(row.SupersetId))
            .GroupBy(row => $"{row.Start!.Value.Ticks}::{row.SupersetId}")
            .Select(group => new
            {
                Pair = string.Join(" + ", group.Select(row => row.Exercise).Where(name => !string.IsNullOrWhiteSpace(name)).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(name => name)),
                SetCount = group.Count(row => row.SetType == "normal"),
            })
            .ToList();

        return new SupersetSummary
        {
            TotalGroups = groups.Count,
            TotalSupersetSets = groups.Sum(group => group.SetCount),
            MostCommonPairs = groups.GroupBy(group => string.IsNullOrWhiteSpace(group.Pair) ? "Unlabeled Superset" : group.Pair)
                .OrderByDescending(group => group.Count())
                .Take(10)
                .Select(group => new SupersetPairCount { Pair = group.Key, Count = group.Count() })
                .ToList(),
        };
    }

    public static IReadOnlyList<ExerciseRecordSummary> GetExerciseRecords(IEnumerable<HevyRow> rows, string? exerciseName = null)
    {
        var relevantRows = rows.Where(row =>
            row.SetType == "normal"
            && !string.IsNullOrWhiteSpace(row.Exercise)
            && (string.IsNullOrWhiteSpace(exerciseName) || string.Equals(row.Exercise, exerciseName, StringComparison.OrdinalIgnoreCase)))
            .ToList();

        var bestSessions = relevantRows
            .GroupBy(row => $"{row.Exercise}::{row.Start?.Ticks}")
            .Select(group => new
            {
                Exercise = group.First().Exercise,
                TotalVolume = group.Sum(row => row.Weight * row.Reps),
                TotalSets = group.Count(),
                Date = group.First().Start,
                Title = GetDisplayTitle(group.First().Title),
            })
            .GroupBy(item => item.Exercise)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(item => item.TotalVolume).First(), StringComparer.OrdinalIgnoreCase);

        return relevantRows
            .GroupBy(row => row.Exercise)
            .Select(group =>
            {
                var heaviest = group.OrderByDescending(row => row.Weight).ThenByDescending(row => row.Reps).First();
                var bestEstimated = group.OrderByDescending(row => EstimateOneRepMax(row.Weight, row.Reps)).First();
                var bestRepSet = group.OrderByDescending(row => row.Reps).ThenByDescending(row => row.Weight).First();
                var session = bestSessions[group.Key];

                return new ExerciseRecordSummary
                {
                    Exercise = group.Key,
                    HeaviestSet = new SetSnapshot
                    {
                        Weight = heaviest.Weight,
                        Reps = heaviest.Reps,
                        EstimatedOneRepMax = EstimateOneRepMax(heaviest.Weight, heaviest.Reps),
                        Date = heaviest.Start,
                        Title = GetDisplayTitle(heaviest.Title),
                    },
                    BestEstimatedOneRepMax = new SetSnapshot
                    {
                        Weight = bestEstimated.Weight,
                        Reps = bestEstimated.Reps,
                        EstimatedOneRepMax = EstimateOneRepMax(bestEstimated.Weight, bestEstimated.Reps),
                        Date = bestEstimated.Start,
                        Title = GetDisplayTitle(bestEstimated.Title),
                    },
                    BestRepSet = new SetSnapshot
                    {
                        Weight = bestRepSet.Weight,
                        Reps = bestRepSet.Reps,
                        EstimatedOneRepMax = EstimateOneRepMax(bestRepSet.Weight, bestRepSet.Reps),
                        Date = bestRepSet.Start,
                        Title = GetDisplayTitle(bestRepSet.Title),
                    },
                    BestSessionVolume = new SessionRecord
                    {
                        TotalVolume = session.TotalVolume,
                        TotalSets = session.TotalSets,
                        Date = session.Date,
                        Title = session.Title,
                    },
                    TotalSessions = group.Where(row => row.Start.HasValue).Select(row => row.Start!.Value.Date).Distinct().Count(),
                    TotalSets = group.Count(),
                };
            })
            .OrderByDescending(item => item.BestEstimatedOneRepMax.EstimatedOneRepMax)
            .ThenByDescending(item => item.HeaviestSet.Weight)
            .ToList();
    }

    public static IReadOnlyList<RecordProgressPoint> GetExerciseRecordProgress(IEnumerable<HevyRow> rows, string exerciseName)
        => rows.Where(row => row.Start.HasValue && row.SetType == "normal" && string.Equals(row.Exercise, exerciseName, StringComparison.OrdinalIgnoreCase))
            .GroupBy(row => row.Start!.Value.Date)
            .Select(group => new RecordProgressPoint
            {
                Date = group.First().Start!.Value,
                TopWeight = group.Max(row => row.Weight),
                EstimatedOneRepMax = group.Max(row => EstimateOneRepMax(row.Weight, row.Reps)),
                TotalVolume = group.Sum(row => row.Weight * row.Reps),
            })
            .OrderBy(item => item.Date)
            .ToList();

    public static PeriodComparison GetPeriodComparison(IEnumerable<HevyRow> rows, int days = 30)
    {
        var workouts = GetWorkouts(rows);
        if (workouts.Count == 0)
        {
            return new PeriodComparison { Days = days };
        }

        var latestDate = workouts[0].Start.Date;
        var currentStart = latestDate.AddDays(-(days - 1));
        var previousStart = currentStart.AddDays(-days);
        var list = rows.ToList();

        return new PeriodComparison
        {
            Days = days,
            LatestDate = latestDate,
            CurrentStart = currentStart,
            PreviousStart = previousStart,
            Current = GetPeriodMetrics(list.Where(row => row.Start.HasValue && row.Start.Value >= currentStart)),
            Previous = GetPeriodMetrics(list.Where(row => row.Start.HasValue && row.Start.Value >= previousStart && row.Start.Value < currentStart)),
        };
    }

    public static IReadOnlyList<(string Week, double TotalVolume, int Workouts, int TotalSets, double? AvgRpe)> GetWeeklyLoad(IEnumerable<HevyRow> rows)
        => GetSessionStats(rows)
            .GroupBy(session => StartOfWeek(session.Start))
            .OrderBy(group => group.Key)
            .Select(group => (
                group.Key.ToString("yyyy-MM-dd"),
                group.Sum(item => item.TotalVolume),
                group.Count(),
                group.Sum(item => item.TotalSets),
                group.Any(item => item.AvgRpe.HasValue) ? group.Where(item => item.AvgRpe.HasValue).Average(item => item.AvgRpe) : null))
            .ToList();

    public static IReadOnlyList<ExerciseMomentum> GetExerciseMomentum(IEnumerable<HevyRow> rows, int days = 30, int minSessions = 2)
    {
        var workouts = GetWorkouts(rows);
        if (workouts.Count == 0)
        {
            return [];
        }

        var latestDate = workouts[0].Start.Date;
        var currentStart = latestDate.AddDays(-(days - 1));
        var previousStart = currentStart.AddDays(-days);

        return GetExerciseRecords(rows)
            .Select(record =>
            {
                var progress = GetExerciseOneRepMaxProgress(rows, record.Exercise);
                var recent = progress.Where(item => item.Date >= currentStart).ToList();
                var previous = progress.Where(item => item.Date >= previousStart && item.Date < currentStart).ToList();
                var recentBest = recent.Select(item => item.EstimatedOneRepMax).DefaultIfEmpty(0).Max();
                var previousBest = previous.Select(item => item.EstimatedOneRepMax).DefaultIfEmpty(0).Max();
                var lastImprovementDate = GetLastImprovementDate(progress);

                return new ExerciseMomentum
                {
                    Exercise = record.Exercise,
                    RecentSessions = recent.Count,
                    PreviousSessions = previous.Count,
                    RecentBest = recentBest,
                    PreviousBest = previousBest,
                    Delta = previousBest > 0 ? (recentBest - previousBest) / previousBest : null,
                    LastImprovementDate = lastImprovementDate,
                    DaysSinceImprovement = lastImprovementDate.HasValue ? (int)(latestDate - lastImprovementDate.Value.Date).TotalDays : null,
                };
            })
            .Where(item => item.RecentSessions >= minSessions || item.PreviousSessions >= minSessions)
            .OrderByDescending(item => item.Delta ?? double.MinValue)
            .ToList();
    }

    public static IReadOnlyList<ExerciseMomentum> GetExercisePlateaus(IEnumerable<HevyRow> rows, int days = 30, double threshold = 0.01, int minSessions = 3)
        => GetExerciseMomentum(rows, days, minSessions)
            .Where(item => item.PreviousSessions >= minSessions && item.RecentSessions >= minSessions)
            .Where(item => item.Delta.HasValue && item.Delta.Value <= threshold)
            .OrderBy(item => item.Delta ?? 0)
            .ThenByDescending(item => item.DaysSinceImprovement ?? 0)
            .ToList();

    public static IReadOnlyList<RecoveryWarning> GetRecoveryWarnings(IEnumerable<HevyRow> rows, int days = 30)
    {
        var sessions = GetSessionStats(rows).OrderBy(item => item.Start).ToList();
        if (sessions.Count == 0)
        {
            return [];
        }

        var latestDate = sessions[^1].Start.Date;
        var recentSessions = sessions.Where(item => item.Start.Date >= latestDate.AddDays(-(days - 1))).ToList();
        var warnings = new List<RecoveryWarning>();

        var longestHighRpeStreak = 0;
        var runningStreak = 0;
        DateTime? streakStart = null;
        DateTime? streakEnd = null;

        foreach (var session in recentSessions)
        {
            if ((session.AvgRpe ?? 0) >= 8.5)
            {
                runningStreak++;
                streakStart ??= session.Start;
                streakEnd = session.Start;
                longestHighRpeStreak = Math.Max(longestHighRpeStreak, runningStreak);
            }
            else
            {
                runningStreak = 0;
                streakStart = null;
                streakEnd = null;
            }
        }

        if (longestHighRpeStreak >= 2 && streakStart.HasValue && streakEnd.HasValue)
        {
            warnings.Add(new RecoveryWarning
            {
                Severity = longestHighRpeStreak >= 3 ? "high" : "medium",
                Title = "Back-to-back high RPE sessions",
                Detail = $"{longestHighRpeStreak} sessions averaged 8.5+ RPE between {streakStart.Value:d} and {streakEnd.Value:d}.",
                Score = longestHighRpeStreak >= 3 ? 30 : 20,
            });
        }

        var biggestSpike = recentSessions
            .Select((session, index) => new { session, index })
            .Where(item => item.index >= 4)
            .Select(item =>
            {
                var baselineSessions = recentSessions.Skip(item.index - 4).Take(4).ToList();
                var baseline = baselineSessions.Average(session => session.TotalVolume);
                var ratio = baseline > 0 ? item.session.TotalVolume / baseline : 0;
                return new { item.session, baseline, ratio };
            })
            .Where(item => item.baseline > 0 && item.ratio > 1.25)
            .OrderByDescending(item => item.ratio)
            .FirstOrDefault();

        if (biggestSpike is not null)
        {
            warnings.Add(new RecoveryWarning
            {
                Severity = biggestSpike.ratio >= 1.5 ? "high" : "medium",
                Title = "Acute volume spike",
                Detail = $"{biggestSpike.session.Start:d} jumped to {FormatNumber(biggestSpike.session.TotalVolume)} kg, {Math.Round((biggestSpike.ratio - 1) * 100)}% above the prior 4-session average.",
                Score = biggestSpike.ratio >= 1.5 ? 28 : 18,
            });
        }

        var longThreshold = Math.Max(90, Percentile(recentSessions.Select(item => item.DurationMin), 0.85));
        var longSessions = recentSessions.Where(item => item.DurationMin >= longThreshold).ToList();
        if (longSessions.Count >= 2)
        {
            warnings.Add(new RecoveryWarning
            {
                Severity = "medium",
                Title = "Multiple unusually long sessions",
                Detail = $"{longSessions.Count} sessions in the last {days} days ran {Math.Round(longThreshold)}+ minutes.",
                Score = 16,
            });
        }

        var clustering = recentSessions.FirstOrDefault(session =>
        {
            var blockStart = session.Start.Date.AddDays(-4);
            return recentSessions.Count(item =>
                item.Start.Date >= blockStart
                && item.Start.Date <= session.Start.Date
                && ((item.AvgRpe ?? 0) >= 8 || item.DurationMin >= longThreshold)) >= 3;
        });

        if (clustering is not null)
        {
            warnings.Add(new RecoveryWarning
            {
                Severity = "high",
                Title = "Hard sessions are clustering",
                Detail = $"At least 3 hard or long sessions landed within 5 days by {clustering.Start:d}.",
                Score = 26,
            });
        }

        return warnings.OrderByDescending(item => item.Score).ToList();
    }

    public static string FormatNumber(double value)
        => Math.Round(value).ToString("N0");

    public static string FormatDelta(double current, double previous)
    {
        if (previous == 0)
        {
            return current == 0 ? "No prior period" : "New activity window";
        }

        var delta = ((current - previous) / previous) * 100;
        return $"{(delta > 0 ? "+" : string.Empty)}{delta:F1}%";
    }

    public static string FormatPercent(double? value)
    {
        if (!value.HasValue)
        {
            return "-";
        }

        var percent = value.Value * 100;
        return $"{(percent > 0 ? "+" : string.Empty)}{percent:F1}%";
    }

    private static PeriodMetrics GetPeriodMetrics(IEnumerable<HevyRow> rows)
    {
        var sessions = GetSessionStats(rows).ToList();
        return new PeriodMetrics
        {
            Workouts = sessions.Count,
            ActiveDays = sessions.Select(item => item.Start.Date).Distinct().Count(),
            TotalSets = sessions.Sum(item => item.TotalSets),
            TotalVolume = sessions.Sum(item => item.TotalVolume),
            AvgDuration = sessions.Count > 0 ? sessions.Average(item => item.DurationMin) : 0,
            AvgSetsPerWorkout = sessions.Count > 0 ? sessions.Average(item => item.TotalSets) : 0,
            AvgRpe = sessions.Any(item => item.AvgRpe.HasValue) ? sessions.Where(item => item.AvgRpe.HasValue).Average(item => item.AvgRpe) : null,
            CardioDistance = sessions.Sum(item => item.CardioDistance),
            CardioDurationMin = sessions.Sum(item => item.CardioDurationMin),
            PeakEstimatedOneRepMax = sessions.Select(item => item.PeakEstimatedOneRepMax).DefaultIfEmpty(0).Max(),
        };
    }

    private static DateTime? GetLastImprovementDate(IEnumerable<OneRepMaxProgressPoint> progress)
    {
        var best = 0d;
        DateTime? last = null;
        foreach (var point in progress.OrderBy(item => item.Date))
        {
            if (point.EstimatedOneRepMax > best)
            {
                best = point.EstimatedOneRepMax;
                last = point.Date;
            }
        }

        return last;
    }

    private static DateTime StartOfWeek(DateTime value)
        => value.Date.AddDays(-(int)value.DayOfWeek);

    private static double Percentile(IEnumerable<double> values, double ratio)
    {
        var sorted = values.Where(value => !double.IsNaN(value) && !double.IsInfinity(value)).OrderBy(value => value).ToList();
        if (sorted.Count == 0)
        {
            return 0;
        }

        var index = Math.Clamp((int)Math.Floor(sorted.Count * ratio), 0, sorted.Count - 1);
        return sorted[index];
    }
}
