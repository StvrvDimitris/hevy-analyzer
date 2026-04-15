using HevyAnalyzer.Models;
using HevyAnalyzer.Services;
using Microsoft.AspNetCore.Components;

namespace HevyAnalyzer.Pages;

public abstract class HevyPageBase<TFilter> : ComponentBase, IDisposable
    where TFilter : class, new()
{
    [Inject] protected HevyDataService DataService { get; set; } = default!;
    [Inject] protected BrowserStorageService Storage { get; set; } = default!;

    protected IReadOnlyList<HevyRow> AllRows { get; private set; } = [];
    protected TFilter Filters { get; set; } = new();
    protected bool IsLoading { get; private set; } = true;
    protected string? ErrorMessage { get; private set; }
    protected bool HasData => string.IsNullOrWhiteSpace(ErrorMessage) && AllRows.Count > 0;

    protected abstract string StorageKey { get; }
    protected virtual TFilter DefaultFilters => new();

    protected override async Task OnInitializedAsync()
    {
        Filters = await Storage.GetItemAsync(StorageKey, DefaultFilters);
        DataService.Changed += HandleDataChanged;
        await ReloadPageAsync();
    }

    protected async Task PersistAndReloadAsync()
    {
        await Storage.SetItemAsync(StorageKey, Filters);
        await ReloadPageAsync();
    }

    protected async Task ResetFiltersAsync()
    {
        Filters = DefaultFilters;
        await PersistAndReloadAsync();
    }

    protected virtual Task OnRowsLoadedAsync()
        => Task.CompletedTask;

    private async Task ReloadPageAsync()
    {
        IsLoading = true;
        try
        {
            AllRows = await DataService.GetRowsAsync();
            ErrorMessage = null;
            await OnRowsLoadedAsync();
        }
        catch (Exception ex)
        {
            AllRows = [];
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsLoading = false;
        }

        await InvokeAsync(StateHasChanged);
    }

    private async void HandleDataChanged()
        => await ReloadPageAsync();

    public void Dispose()
    {
        DataService.Changed -= HandleDataChanged;
    }
}
