
namespace ESFE.RestauranteBD.web.UI.Models;

// Configuración visual y operativa del restaurante.
public sealed class AppSettings
{
    // Nombre visible del restaurante.
    public string RestaurantName { get; set; } = "RestauranteBD";
    // Color principal de la interfaz.
    public string PrimaryColor { get; set; } = "#f59e0b";
    // Color principal usado en estados oscuros y énfasis.
    public string PrimaryDarkColor { get; set; } = "#b45309";
    // Versión suave del color principal para fondos y detalles.
    public string PrimarySoftColor { get; set; } = "#fff7ed";
    // Color de fondo general de la aplicación.
    public string BackgroundColor { get; set; } = "#f4f6f8";
    // Color de las superficies y tarjetas.
    public string SurfaceColor { get; set; } = "#ffffff";
    // Color principal del texto.
    public string TextColor { get; set; } = "#0f172a";
    // Color usado para textos secundarios.
    public string MutedColor { get; set; } = "#64748b";
    // Color utilizado en bordes y separadores.
    public string LineColor { get; set; } = "#e2e8f0";
    // Color de fondo de la barra lateral.
    public string SidebarColor { get; set; } = "#101724";
    // Color secundario de la interfaz.
    public string SecondaryColor { get; set; } = "#162033";
    // Color utilizado para estados correctos o completados.
    public string SuccessColor { get; set; } = "#15803d";
    // Color utilizado para errores y acciones destructivas.
    public string DangerColor { get; set; } = "#b91c1c";
    // Color utilizado para avisos y estados de atención.
    public string WarningColor { get; set; } = "#b45309";
    // Ruta del logotipo utilizado por la aplicación.
    public string LogoPath { get; set; } = "/images/logo.jpg";
    // Hora de apertura del restaurante.
    public string OpeningTime { get; set; } = "06:00";
    // Hora de cierre del restaurante.
    public string ClosingTime { get; set; } = "22:00";
    // Porcentaje de impuesto aplicado a las ventas.
    public decimal TaxPercent { get; set; } = 13m;
    // Símbolo monetario mostrado en precios y totales.
    public string CurrencySymbol { get; set; } = "$";
    // Teléfono de contacto del restaurante.
    public string BusinessPhone { get; set; } = "";
    // Correo de contacto del restaurante.
    public string BusinessEmail { get; set; } = "OFGstudio@gmail.com";
    // Dirección del restaurante.
    public string BusinessAddress { get; set; } = "";
    // Número utilizado para contacto por WhatsApp.
    public string WhatsApp { get; set; } = "";
    // Indica si se muestra el estado del servicio.
    public bool ShowServiceStatus { get; set; } = true;
    // Indica si las animaciones de la interfaz están activadas.
    public bool EnableAnimations { get; set; } = true;
    // Indica si la interfaz utiliza el modo compacto.
    public bool CompactMode { get; set; } = false;
    // Indica si se permiten pagos de tarjeta de demostración.
    public bool DemoCardPayments { get; set; } = true;
    // Indica si el chatbot está visible en la aplicación.
    public bool ShowChatbot { get; set; } = true;
    // Indica si se muestran las acciones rápidas.
    public bool ShowQuickActions { get; set; } = true;
    // Indica si se muestran imágenes de los productos.
    public bool ShowProductImages { get; set; } = true;
    // Indica si la interfaz reduce las sombras visuales.
    public bool ReduceShadows { get; set; } = false;
}

public static class AppSettingsStore
{
    private static readonly object FileLock = new();
    private static readonly string LocalFile = Path.Combine(AppContext.BaseDirectory, "settings.local.json");
    private static AppSettings _current = new();

    static AppSettingsStore() => Load();

    public static AppSettings Current => Clone(_current);

    // Actualiza un registro existente con los nuevos datos.
    public static void Update(AppSettings settings)
    {
        _current = Sanitize(settings);
        Save();
    }

    // Restablece los valores del formulario o estado actual.
    public static void Reset()
    {
        _current = new AppSettings();
        Save();
    }

    // Carga los datos almacenados para utilizarlos en la aplicación.
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

    // Guarda los datos actuales en el almacenamiento correspondiente.
    private static void Save()
    {
        try
        {
            lock (FileLock)
            {
                File.WriteAllText(
                    LocalFile,
                    System.Text.Json.JsonSerializer.Serialize(
                        _current,
                        new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
            }
        }
        catch
        {
            // La configuración local es opcional.
        }
    }

    // Limpia los valores de configuración antes de procesarlos.
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

    // Limpia el texto antes de guardarlo.
    private static string CleanText(string? value, string fallback, int max = 120)
    {
        var clean = (value ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(clean) ? fallback : clean[..Math.Min(clean.Length, max)];
    }

    // Valida y limpia el valor de color configurado.
    private static string CleanColor(string? value, string fallback) =>
        System.Text.RegularExpressions.Regex.IsMatch(value ?? string.Empty, "^#[0-9a-fA-F]{6}$") ? value! : fallback;

    // Limpia la ruta antes de utilizarla.
    private static string CleanPath(string? value, string fallback)
    {
        var clean = (value ?? string.Empty).Trim();
        return clean.StartsWith("/", StringComparison.Ordinal) && !clean.Contains("..", StringComparison.Ordinal) ? clean : fallback;
    }

    // Normaliza la hora para mantener un formato válido.
    private static string NormalizeTime(string? value, string fallback) =>
        TimeSpan.TryParse(value, out var time) && time >= TimeSpan.Zero && time < TimeSpan.FromDays(1) ? time.ToString(@"hh\:mm") : fallback;

    // Crea una copia independiente de la configuración.
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
