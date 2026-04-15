namespace HevyAnalyzer.Models;

public class DateTitleFilters
{
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public string Title { get; set; } = string.Empty;
}

public sealed class DashboardFilters : DateTitleFilters;

public sealed class ExerciseFilters : DateTitleFilters
{
    public string Search { get; set; } = string.Empty;
    public string SelectedExercise { get; set; } = string.Empty;
}

public sealed class ExerciseSelectionFilters : DateTitleFilters
{
    public string Exercise { get; set; } = string.Empty;
}

public sealed class AnalysisFilters
{
    public string Title { get; set; } = string.Empty;
    public string Exercise { get; set; } = string.Empty;
    public int WindowDays { get; set; } = 30;
}
