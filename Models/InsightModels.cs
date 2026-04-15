namespace HevyAnalyzer.Models;

public sealed class CardioExerciseSummary
{
    public string Exercise { get; init; } = string.Empty;
    public double TotalDistance { get; init; }
    public double TotalDurationMin { get; init; }
    public int Entries { get; init; }
}

public sealed class CardioSummary
{
    public double TotalDistance { get; init; }
    public double TotalDurationMin { get; init; }
    public int TotalEntries { get; init; }
    public int UniqueExercises { get; init; }
}

public sealed class SupersetPairCount
{
    public string Pair { get; init; } = string.Empty;
    public int Count { get; init; }
}

public sealed class SupersetSummary
{
    public int TotalGroups { get; init; }
    public int TotalSupersetSets { get; init; }
    public List<SupersetPairCount> MostCommonPairs { get; init; } = [];
}

public sealed class ExerciseRecordSummary
{
    public string Exercise { get; init; } = string.Empty;
    public SetSnapshot HeaviestSet { get; init; } = new();
    public SetSnapshot BestEstimatedOneRepMax { get; init; } = new();
    public SetSnapshot BestRepSet { get; init; } = new();
    public SessionRecord BestSessionVolume { get; init; } = new();
    public int TotalSessions { get; init; }
    public int TotalSets { get; init; }
}

public sealed class SessionRecord
{
    public double TotalVolume { get; init; }
    public int TotalSets { get; init; }
    public DateTime? Date { get; init; }
    public string Title { get; init; } = string.Empty;
}

public sealed class PeriodMetrics
{
    public int Workouts { get; init; }
    public int ActiveDays { get; init; }
    public int TotalSets { get; init; }
    public double TotalVolume { get; init; }
    public double AvgDuration { get; init; }
    public double AvgSetsPerWorkout { get; init; }
    public double? AvgRpe { get; init; }
    public double CardioDistance { get; init; }
    public double CardioDurationMin { get; init; }
    public double PeakEstimatedOneRepMax { get; init; }
}

public sealed class PeriodComparison
{
    public int Days { get; init; }
    public DateTime? LatestDate { get; init; }
    public DateTime? CurrentStart { get; init; }
    public DateTime? PreviousStart { get; init; }
    public PeriodMetrics Current { get; init; } = new();
    public PeriodMetrics Previous { get; init; } = new();
}

public sealed class ExerciseMomentum
{
    public string Exercise { get; init; } = string.Empty;
    public int RecentSessions { get; init; }
    public int PreviousSessions { get; init; }
    public double RecentBest { get; init; }
    public double PreviousBest { get; init; }
    public double? Delta { get; init; }
    public DateTime? LastImprovementDate { get; init; }
    public int? DaysSinceImprovement { get; init; }
}

public sealed class RecoveryWarning
{
    public string Severity { get; init; } = "info";
    public string Title { get; init; } = string.Empty;
    public string Detail { get; init; } = string.Empty;
    public int Score { get; init; }
}
