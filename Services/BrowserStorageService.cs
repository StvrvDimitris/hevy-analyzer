using System.Text.Json;
using Microsoft.JSInterop;

namespace HevyAnalyzer.Services;

public sealed class BrowserStorageService(IJSRuntime jsRuntime)
{
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<string?> GetStringAsync(string key)
        => await jsRuntime.InvokeAsync<string?>("hevyAnalyzer.storage.get", key);

    public async Task SetStringAsync(string key, string value)
        => await jsRuntime.InvokeVoidAsync("hevyAnalyzer.storage.set", key, value);

    public async Task RemoveAsync(string key)
        => await jsRuntime.InvokeVoidAsync("hevyAnalyzer.storage.remove", key);

    public async Task<T> GetItemAsync<T>(string key, T fallback)
    {
        var json = await GetStringAsync(key);
        if (string.IsNullOrWhiteSpace(json))
        {
            return fallback;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(json, _jsonOptions) ?? fallback;
        }
        catch
        {
            return fallback;
        }
    }

    public async Task SetItemAsync<T>(string key, T value)
        => await SetStringAsync(key, JsonSerializer.Serialize(value, _jsonOptions));
}
