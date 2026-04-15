using System.Globalization;
using System.Text;
using HevyAnalyzer.Models;

namespace HevyAnalyzer.Services;

public static class HevyCsvParser
{
    public static IReadOnlyList<HevyRow> Parse(string text)
    {
        var records = ParseRecords(text);
        if (records.Count <= 1)
        {
            return [];
        }

        var headers = records[0]
            .Select((name, index) => new { name = name.Trim(), index })
            .ToDictionary(item => item.name, item => item.index, StringComparer.OrdinalIgnoreCase);

        var rows = new List<HevyRow>(records.Count - 1);
        foreach (var record in records.Skip(1))
        {
            if (record.All(string.IsNullOrWhiteSpace))
            {
                continue;
            }

            rows.Add(new HevyRow
            {
                Title = GetValue(record, headers, "title"),
                Start = ParseDate(GetValue(record, headers, "start_time")),
                End = ParseDate(GetValue(record, headers, "end_time")),
                Exercise = GetValue(record, headers, "exercise_title"),
                SetIndex = ParseInt(GetValue(record, headers, "set_index")),
                SetType = string.IsNullOrWhiteSpace(GetValue(record, headers, "set_type")) ? "normal" : GetValue(record, headers, "set_type"),
                Weight = ParseDouble(GetValue(record, headers, "weight_kg")),
                Reps = ParseInt(GetValue(record, headers, "reps")),
                Distance = ParseDouble(GetValue(record, headers, "distance_km")),
                Duration = ParseDouble(GetValue(record, headers, "duration_seconds")),
                Rpe = ParseNullableDouble(GetValue(record, headers, "rpe")),
                SupersetId = GetValue(record, headers, "superset_id"),
            });
        }

        return rows;
    }

    private static List<string[]> ParseRecords(string text)
    {
        var records = new List<string[]>();
        var fields = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var index = 0; index < text.Length; index++)
        {
            var ch = text[index];

            if (ch == '"')
            {
                if (inQuotes && index + 1 < text.Length && text[index + 1] == '"')
                {
                    current.Append('"');
                    index++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }

                continue;
            }

            if (ch == ',' && !inQuotes)
            {
                fields.Add(current.ToString());
                current.Clear();
                continue;
            }

            if ((ch == '\n' || ch == '\r') && !inQuotes)
            {
                if (ch == '\r' && index + 1 < text.Length && text[index + 1] == '\n')
                {
                    index++;
                }

                fields.Add(current.ToString());
                current.Clear();
                records.Add([.. fields]);
                fields.Clear();
                continue;
            }

            current.Append(ch);
        }

        if (current.Length > 0 || fields.Count > 0)
        {
            fields.Add(current.ToString());
            records.Add([.. fields]);
        }

        return records;
    }

    private static string GetValue(string[] record, IReadOnlyDictionary<string, int> headers, string name)
        => headers.TryGetValue(name, out var index) && index < record.Length ? record[index].Trim() : string.Empty;

    private static int ParseInt(string value)
        => int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;

    private static double ParseDouble(string value)
        => double.TryParse(value, NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;

    private static double? ParseNullableDouble(string value)
        => double.TryParse(value, NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;

    private static DateTime? ParseDate(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateTime.TryParseExact(value, "d MMM yyyy, HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed
            : null;
    }
}
