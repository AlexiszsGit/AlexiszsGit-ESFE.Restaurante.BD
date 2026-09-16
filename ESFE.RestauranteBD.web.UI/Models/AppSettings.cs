namespace ESFE.RestauranteBD.web.UI.Models;

public sealed class AppSettings
{
    public string RestaurantName { get; set; } = "RestauranteBD";
    public string PrimaryColor { get; set; } = "#f59e0b";
    public string PrimaryDarkColor { get; set; } = "#b45309";
    public string PrimarySoftColor { get; set; } = "#fff7ed";
    public string BackgroundColor { get; set; } = "#f4f6f8";
    public string SurfaceColor { get; set; } = "#ffffff";
    public string TextColor { get; set; } = "#0f172a";
    public string MutedColor { get; set; } = "#64748b";
    public string LineColor { get; set; } = "#e2e8f0";
    public string SidebarColor { get; set; } = "#101724";
    public string SecondaryColor { get; set; } = "#162033";
    public string SuccessColor { get; set; } = "#15803d";
    public string DangerColor { get; set; } = "#b91c1c";
    public string WarningColor { get; set; } = "#b45309";
    public string LogoPath { get; set; } = "/images/logo.jpg";
    public string OpeningTime { get; set; } = "06:00";
    public string ClosingTime { get; set; } = "22:00";
    public decimal TaxPercent { get; set; } = 13m;
    public string CurrencySymbol { get; set; } = "$";
    public string BusinessPhone { get; set; } = "";
    public string BusinessEmail { get; set; } = "OFGstudio@gmail.com";
    public string BusinessAddress { get; set; } = "";
    public string WhatsApp { get; set; } = "";
    public bool ShowServiceStatus { get; set; } = true;
    public bool EnableAnimations { get; set; } = true;
    public bool CompactMode { get; set; } = false;
    public bool DemoCardPayments { get; set; } = true;
    public bool ShowChatbot { get; set; } = true;
    public bool ShowQuickActions { get; set; } = true;
    public bool ShowProductImages { get; set; } = true;
    public bool ReduceShadows { get; set; } = false;
}

public static class AppSettingsStore
{
    private static readonly object FileLock = new();
    private static readonly string LocalFile = Path.Combine(AppContext.BaseDirectory, "settings.local.json");
    private static AppSettings _current = new();

    static AppSettingsStore() => Load();

    public static AppSettings Current => Clone(_current);

    public static void Update(AppSettings settings)
    {
        _current = Sanitize(settings);
        Save();
    }

    public static void Reset()
    {
        _current = new AppSettings();
        Save();
    }

    private static void Load()
    {
        try
        {
            if (!File.Exists(LocalFile)) return;
            var json = File.ReadAllText(LocalFile);
            var loaded = System.Text.Json.JsonSerializer.Deserialize<AppSettings>(json);
            if (loaded is not null) _current = Sanitize(loaded);
        }
        catch
        {
            _current = new AppSettings();
        }
    }

    private static void Save()
    {
        try
        {
            lock (FileLock)
            {
                File.WriteAllText(LocalFile, System.Text.Json.JsonSerializer.Serialize(_current, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
            }
        }
        catch { }
    }

    private static AppSettings Sanitize(AppSettings s) => new()
    {
        RestaurantName = CleanText(s.RestaurantName, "RestauranteBD", 60),
        PrimaryColor = CleanColor(s.PrimaryColor, "#f59e0b"),
        PrimaryDarkColor = CleanColor(s.PrimaryDarkColor, "#b45309"),
        PrimarySoftColor = CleanColor(s.PrimarySoftColor, "#fff7ed"),
        BackgroundColor = CleanColor(s.BackgroundColor, "#f4f6f8"),
        SurfaceColor = CleanColor(s.SurfaceColor, "#ffffff"),
        TextColor = CleanColor(s.TextColor, "#0f172a"),
        MutedColor = CleanColor(s.MutedColor, "#64748b"),
        LineColor = CleanColor(s.LineColor, "#e2e8f0"),
        SidebarColor = CleanColor(s.SidebarColor, "#101724"),
        SecondaryColor = CleanColor(s.SecondaryColor, "#162033"),
        SuccessColor = CleanColor(s.SuccessColor, "#15803d"),
        DangerColor = CleanColor(s.DangerColor, "#b91c1c"),
        WarningColor = CleanColor(s.WarningColor, "#b45309"),
        LogoPath = CleanPath(s.LogoPath, "/images/logo.jpg"),
        OpeningTime = NormalizeTime(s.OpeningTime, "06:00"),
        ClosingTime = NormalizeTime(s.ClosingTime, "22:00"),
        TaxPercent = Math.Clamp(s.TaxPercent, 0m, 25m),
        CurrencySymbol = CleanText(s.CurrencySymbol, "$", 4),
        BusinessPhone = CleanText(s.BusinessPhone, "", 40),
        BusinessEmail = CleanText(s.BusinessEmail, "OFGstudio@gmail.com", 160),
        BusinessAddress = CleanText(s.BusinessAddress, "", 250),
        WhatsApp = CleanText(s.WhatsApp, "", 40),
        ShowServiceStatus = s.ShowServiceStatus,
        EnableAnimations = s.EnableAnimations,
        CompactMode = s.CompactMode,
        DemoCardPayments = s.DemoCardPayments,
        ShowChatbot = s.ShowChatbot,
        ShowQuickActions = s.ShowQuickActions,
        ShowProductImages = s.ShowProductImages,
        ReduceShadows = s.ReduceShadows
    };

    private static string CleanText(string? value, string fallback, int max = 120)
    {
        var clean = (value ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(clean) ? fallback : clean[..Math.Min(clean.Length, max)];
    }

    private static string CleanColor(string? value, string fallback) =>
        System.Text.RegularExpressions.Regex.IsMatch(value ?? string.Empty, "^#[0-9a-fA-F]{6}$") ? value! : fallback;

    private static string CleanPath(string? value, string fallback)
    {
        var clean = (value ?? string.Empty).Trim();
        return clean.StartsWith("/", StringComparison.Ordinal) && !clean.Contains("..", StringComparison.Ordinal) ? clean : fallback;
    }

    private static string NormalizeTime(string? value, string fallback) =>
        TimeSpan.TryParse(value, out var time) && time >= TimeSpan.Zero && time < TimeSpan.FromDays(1) ? time.ToString(@"hh\:mm") : fallback;

    private static AppSettings Clone(AppSettings s) => new()
    {
        RestaurantName=s.RestaurantName, PrimaryColor=s.PrimaryColor, PrimaryDarkColor=s.PrimaryDarkColor, PrimarySoftColor=s.PrimarySoftColor,
        BackgroundColor=s.BackgroundColor, SurfaceColor=s.SurfaceColor, TextColor=s.TextColor, MutedColor=s.MutedColor, LineColor=s.LineColor,
        LogoPath=s.LogoPath, OpeningTime=s.OpeningTime, ClosingTime=s.ClosingTime, TaxPercent=s.TaxPercent, CurrencySymbol=s.CurrencySymbol,
        BusinessPhone=s.BusinessPhone, BusinessEmail=s.BusinessEmail, BusinessAddress=s.BusinessAddress, WhatsApp=s.WhatsApp,
        ShowServiceStatus=s.ShowServiceStatus, EnableAnimations=s.EnableAnimations, CompactMode=s.CompactMode, DemoCardPayments=s.DemoCardPayments,
        ShowChatbot=s.ShowChatbot, ShowQuickActions=s.ShowQuickActions, ShowProductImages=s.ShowProductImages, ReduceShadows=s.ReduceShadows
    };
}
