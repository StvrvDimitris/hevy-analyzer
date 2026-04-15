namespace HevyAnalyzer.Models;

public sealed class WorkoutSummary
{
    public string Title { get; init; } = string.Empty;
    public DateTime Start { get; init; }
    public DateTime? End { get; init; }
    public HashSet<string> Exercises { get; init; } = [];
    public int Sets { get; init; }
    public double TotalVolume { get; init; }
}

public sealed class ExerciseSummary
{
    public string Name { get; init; } = string.Empty;
    public int TotalSets { get; init; }
    public double TotalVolume { get; init; }
    public double MaxWeight { get; init; }
    public int SessionCount { get; init; }
    public SetSnapshot? BestSet { get; init; }
}

public sealed class SetSnapshot
{
    public double Weight { get; init; }
    public int Reps { get; init; }
    public double EstimatedOneRepMax { get; init; }
    public DateTime? Date { get; init; }
    public string Title { get; init; } = string.Empty;
}

public sealed class VolumePoint
{
    public string Label { get; init; } = string.Empty;
    public double Value { get; init; }
}

public sealed class ProgressPoint
{
    public DateTime Date { get; init; }
    public double Weight { get; init; }
    public int Reps { get; init; }
}

public sealed class OneRepMaxProgressPoint
{
    public DateTime Date { get; init; }
    public double EstimatedOneRepMax { get; init; }
    public double Weight { get; init; }
    public int Reps { get; init; }
}

public sealed class RecordProgressPoint
{
    public DateTime Date { get; init; }
    public double TopWeight { get; init; }
    public double EstimatedOneRepMax { get; init; }
    public double TotalVolume { get; init; }
}

public sealed class SplitCount
{
    public string Title { get; init; } = string.Empty;
    public int Count { get; init; }
}

public sealed class RpeBucket
{
    public double Rpe { get; init; }
    public int Count { get; init; }
    public double AverageWeight { get; init; }
    public double AverageEstimatedOneRepMax { get; init; }
}

public sealed class SessionSummary
{
    public string Title { get; init; } = string.Empty;
    public DateTime Start { get; init; }
    public DateTime? End { get; init; }
    public int TotalSets { get; init; }
    public double TotalVolume { get; init; }
    public int ExerciseCount { get; init; }
    public double DurationMin { get; init; }
    public double SetsPerMinute { get; init; }
    public double VolumePerMinute { get; init; }
    public double CardioDistance { get; init; }
    public double CardioDurationMin { get; init; }
    public double? AvgRpe { get; init; }
    public double PeakEstimatedOneRepMax { get; init; }
}

public sealed class SessionTrendPoint
{
    public string Label { get; init; } = string.Empty;
    public double DurationMin { get; init; }
    public double SetsPerMinute { get; init; }
    public double VolumePerMinute { get; init; }
    public int TotalSets { get; init; }
    public double TotalVolume { get; init; }
}

public sealed class MonthlySplitCounts
{
    public string Month { get; init; } = string.Empty;
    public Dictionary<string, int> Counts { get; init; } = [];
}

public sealed class StreakSummary
{
    public int CurrentStreak { get; init; }
    public int LongestStreak { get; init; }
    public int ActiveDays { get; init; }
}

public sealed class LabeledCount
{
    public string Label { get; init; } = string.Empty;
    public int Count { get; init; }
}

public sealed class HourCount
{
    public int Hour { get; init; }
    public int Count { get; init; }
}
