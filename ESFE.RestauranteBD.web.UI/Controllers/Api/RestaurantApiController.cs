using System.Text.Json;
using ESFE.RestauranteBD.web.UI.Data;
using ESFE.RestauranteBD.web.UI.Models;
using ESFE.RestauranteBD.web.UI.Services;
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers.Api;

[Route("api")]
public sealed class RestaurantApiController : ControllerBase
{
    private static readonly HashSet<string> UserStateKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "esfe_carrito","esfe_pedidos","esfe_ventas","esfe_reservas","restaurantebd_calificaciones",
        "restaurantebd_notificaciones","esfe_reportes_guardados","esfe_report_periodo_inicio","esfe_reportes_semanales","restaurantebd_mail_draft"
    };
    private static readonly HashSet<string> GlobalStateKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "restaurantebd_product_overrides","restaurantebd_product_deleted","restaurantebd_custom_categories"
    };
    private readonly GeminiAssistantService _assistant;

    public RestaurantApiController(GeminiAssistantService assistant) => _assistant = assistant;

    [HttpGet("system/status")]
    public IActionResult Status() => Ok(new { configured = RestaurantDb.IsConfigured });

    [HttpGet("database/health")]
    public IActionResult DatabaseHealth()
    {
        try
        {
            var health = RestaurantDb.GetHealth();
            return Ok(health);
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { connected = false, error = ex.Message });
        }
    }

    [HttpGet("chat/status")]
    public IActionResult ChatStatus()
    {
        var configuration = HttpContext.RequestServices.GetRequiredService<IConfiguration>();

        var key =
            Environment.GetEnvironmentVariable("GEMINI_API_KEY")
            ?? configuration["Gemini:ApiKey"];
        var enabled = HttpContext.RequestServices.GetRequiredService<IConfiguration>().GetValue<bool>("Gemini:Enabled");
        var model = HttpContext.RequestServices.GetRequiredService<IConfiguration>()["Gemini:Model"] ?? "gemini-3.1-flash-lite";
        var keyConfigured = !string.IsNullOrWhiteSpace(key) && !key.StartsWith("PON_AQUI", StringComparison.OrdinalIgnoreCase);
        return Ok(new { enabled, keyConfigured, model, databaseConfigured = RestaurantDb.IsConfigured });
    }

    [HttpGet("state/bootstrap")]
    public IActionResult Bootstrap()
    {
        if (!RestaurantDb.IsConfigured) return Ok(new { configured = false, states = new Dictionary<string,string>(), global = new Dictionary<string,string>() });
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null || !user.Activo)
            return Ok(new { configured = true, states = new Dictionary<string,string>(), global = new Dictionary<string,string>() });
        try
        {
            var states = RestaurantDb.GetUserStates(user.AccountId, UserStateKeys);
            var global = RestaurantDb.GetGlobalStates(GlobalStateKeys);
            return Ok(new { configured = true, states, global });
        }
        catch (Exception ex) { return StatusCode(503, new { configured = true, error = ex.Message }); }
    }

    [HttpPost("state/sync")]
    [ValidateAntiForgeryToken]
    public IActionResult Sync([FromBody] StateSyncRequest request)
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null || !user.Activo)
            return Unauthorized();
        if (!UserStateKeys.Contains(request.Key) && !GlobalStateKeys.Contains(request.Key)) return BadRequest(new { error = "Estado no permitido." });
        try
        {
            var raw = request.Value.ValueKind == JsonValueKind.String ? JsonSerializer.Serialize(request.Value.GetString() ?? string.Empty) : request.Value.GetRawText();
            if (GlobalStateKeys.Contains(request.Key))
            {
                if (!RoleStore.IsAdministrator(user.Rol)) return Forbid();
                RestaurantDb.SaveGlobalState(request.Key, raw);
            }
            else
            {
                RestaurantDb.SaveUserState(user.AccountId, request.Key, raw);
            }
            return Ok(new { ok = true });
        }
        catch (Exception ex) { return StatusCode(503, new { ok = false, error = ex.Message }); }
    }

    [HttpPost("chat/ask")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request, CancellationToken cancellationToken)
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (!string.IsNullOrWhiteSpace(email) && UserStore.TryGet(email, out var user) && user is not null && user.Activo)
            return Ok(new { answer = await _assistant.AskAsync(user, request.Message ?? string.Empty, cancellationToken), role = user.Rol });
        return Ok(new { answer = await _assistant.AskPublicAsync(request.Message ?? string.Empty, cancellationToken), role = "Publico" });
    }
}

public sealed class StateSyncRequest
{
    public string Key { get; set; } = string.Empty;
    public JsonElement Value { get; set; }
}

public sealed class ChatRequest
{
    public string? Message { get; set; }
}
