using System.Text;
using HevyAnalyzer.Models;
using Microsoft.AspNetCore.Components.Forms;

namespace HevyAnalyzer.Services;

public sealed class HevyDataService(BrowserStorageService storage)
{
    public const string CsvStorageKey = "hevyAnalyzer.csvText";
    public const string CsvNameStorageKey = "hevyAnalyzer.csvName";

    private IReadOnlyList<HevyRow>? _rows;
    private bool _initialized;

    public string FileName { get; private set; } = string.Empty;
    public event Action? Changed;

    public async Task InitializeAsync()
    {
        if (_initialized)
        {
            return;
        }

        var csvText = await storage.GetStringAsync(CsvStorageKey);
        if (!string.IsNullOrWhiteSpace(csvText))
        {
            _rows = HevyCsvParser.Parse(csvText);
            FileName = await storage.GetStringAsync(CsvNameStorageKey) ?? string.Empty;
        }

        _initialized = true;
    }

    public async Task<IReadOnlyList<HevyRow>> GetRowsAsync()
    {
        await InitializeAsync();
        if (_rows is null || _rows.Count == 0)
        {
            throw new InvalidOperationException("Import a Hevy CSV from the sidebar to load your data.");
        }

        return _rows;
    }

    public async Task ImportAsync(IBrowserFile file)
    {
        await using var stream = file.OpenReadStream(maxAllowedSize: 10 * 1024 * 1024);
        using var reader = new StreamReader(stream, Encoding.UTF8);
        var text = await reader.ReadToEndAsync();

        _rows = HevyCsvParser.Parse(text);
        _initialized = true;
        FileName = file.Name;

        await storage.SetStringAsync(CsvStorageKey, text);
        await storage.SetStringAsync(CsvNameStorageKey, file.Name);
        Changed?.Invoke();
    }
}
