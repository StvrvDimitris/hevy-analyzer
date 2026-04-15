namespace HevyAnalyzer.Models;

public sealed class HevyRow
{
    public string Title { get; init; } = string.Empty;
    public DateTime? Start { get; init; }
    public DateTime? End { get; init; }
    public string Exercise { get; init; } = string.Empty;
    public int SetIndex { get; init; }
    public string SetType { get; init; } = "normal";
    public double Weight { get; init; }
    public int Reps { get; init; }
    public double Distance { get; init; }
    public double Duration { get; init; }
    public double? Rpe { get; init; }
    public string SupersetId { get; init; } = string.Empty;
}
