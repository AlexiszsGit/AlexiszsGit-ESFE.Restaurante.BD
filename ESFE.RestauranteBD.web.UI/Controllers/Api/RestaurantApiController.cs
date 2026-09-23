
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
    private const string OperationalOrdersKey = "esfe_pedidos_operational";
    private static readonly HashSet<string> OperationalRoles = new(StringComparer.OrdinalIgnoreCase)
    { "Dueno", "Administrador", "Cocina", "Barra", "Delivery" };
    private readonly GeminiAssistantService _assistant;

    public RestaurantApiController(GeminiAssistantService assistant) => _assistant = assistant;

    [HttpGet("system/status")]
    // Consulta el estado actual del servicio o registro.
    public IActionResult Status() => Ok(new { configured = RestaurantDb.IsConfigured });

    [HttpGet("database/health")]
    // Comprueba que la conexión y los componentes principales de la base estén disponibles.
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
    // Comprueba el estado de disponibilidad del chatbot.
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
    // Prepara el módulo y sus dependencias al cargar la página.
    public IActionResult Bootstrap()
    {
        if (!RestaurantDb.IsConfigured)
        {
            return Ok(new
            {
                configured = false,
                states = new Dictionary<string, string>(),
                global = new Dictionary<string, string>()
            });
        }
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null || !user.Activo)
            return Ok(new
            {
                configured = true,
                states = new Dictionary<string, string>(),
                global = new Dictionary<string, string>()
            });
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
    // Sincroniza los datos entre la interfaz y la base de datos.
    public IActionResult Sync([FromBody] StateSyncRequest request)
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null || !user.Activo)
            return Unauthorized();
        if (!UserStateKeys.Contains(request.Key) && !GlobalStateKeys.Contains(request.Key))
            return BadRequest(new { error = "Estado no permitido." });
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

    [HttpGet("state/operational-orders")]
    // Obtiene los pedidos operativos que necesita la pantalla.
    public IActionResult OperationalOrders()
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null || !user.Activo)
            return Unauthorized();
        if (!OperationalRoles.Contains(user.Rol) && !string.Equals(user.Rol, "Cliente", StringComparison.OrdinalIgnoreCase)) return Forbid();
        try
        {
            var raw = RestaurantDb.GetOperationalOrdersJson(OperationalOrdersKey);
            if (string.Equals(user.Rol, "Cliente", StringComparison.OrdinalIgnoreCase))
                raw = FilterOrdersForCustomer(raw, email);
            return Content(string.IsNullOrWhiteSpace(raw) ? "[]" : raw, "application/json");
        }
        catch (Exception ex) { return StatusCode(503, new { error = ex.Message }); }
    }

    [HttpPost("state/operational-orders")]
    [ValidateAntiForgeryToken]
    // Obtiene los pedidos operativos que necesita la pantalla.
    public IActionResult SaveOperationalOrders([FromBody] OperationalOrdersRequest request)
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null || !user.Activo)
            return Unauthorized();
        if (!OperationalRoles.Contains(user.Rol) && !string.Equals(user.Rol, "Cliente", StringComparison.OrdinalIgnoreCase)) return Forbid();
        try
        {
            var raw = request.Orders.ValueKind == JsonValueKind.Array ? request.Orders.GetRawText() : "[]";
            if (string.Equals(user.Rol, "Cliente", StringComparison.OrdinalIgnoreCase))
            {
                var existingRaw = RestaurantDb.GetOperationalOrdersJson(OperationalOrdersKey);
                var merged = MergeCustomerOrders(existingRaw, raw, email);
                RestaurantDb.SaveOperationalOrdersJson(OperationalOrdersKey, merged);
            }
            else
            {
                RestaurantDb.SaveOperationalOrdersJson(OperationalOrdersKey, raw);
            }
            return Ok(new { ok = true });
        }
        catch (Exception ex) { return StatusCode(503, new { ok = false, error = ex.Message }); }
    }

    // Filtra los pedidos para mostrar solo los del cliente indicado.
    private static string FilterOrdersForCustomer(string raw, string email)
    {
        var result = new List<JsonElement>();
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(raw) ? "[]" : raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return "[]";
            foreach (var item in doc.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object) continue;
                if (item.TryGetProperty("customer", out var customer) && string.Equals(customer.GetString(), email, StringComparison.OrdinalIgnoreCase))
                    result.Add(item.Clone());
            }
        }
        catch { return "[]"; }
        return JsonSerializer.Serialize(result);
    }

    // Combina los pedidos del cliente con la información de la sesión.
    private static string MergeCustomerOrders(string existingRaw, string incomingRaw, string email)
    {
        var byId = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        void AddExisting(string raw)
        {
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(raw) ? "[]" : raw);
                if (doc.RootElement.ValueKind != JsonValueKind.Array) return;
                foreach (var item in doc.RootElement.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.Object) continue;
                    var id = item.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                    if (!string.IsNullOrWhiteSpace(id)) byId[id] = item.Clone();
                }
            }
            catch { }
        }
        AddExisting(existingRaw);
        var incomingIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(incomingRaw) ? "[]" : incomingRaw);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.RootElement.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.Object) continue;
                    if (!item.TryGetProperty("customer", out var c) || !string.Equals(c.GetString(), email, StringComparison.OrdinalIgnoreCase)) continue;
                    var id = item.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                    if (string.IsNullOrWhiteSpace(id)) continue;
                    incomingIds.Add(id);
                    byId[id] = item.Clone();
                }
            }
        }
        catch { }
        var customerKeys = byId.Keys
            .Where(key => HasCustomer(key, byId, email))
            .ToList();

        foreach (var key in customerKeys)
        {
            if (!incomingIds.Contains(key))
                byId.Remove(key);
        }
        return JsonSerializer.Serialize(byId.Values.ToList());
    }


    // Comprueba si la cuenta tiene un cliente asociado.
    private static bool HasCustomer(string key, Dictionary<string, JsonElement> orders, string email)
    {
        try
        {
            using var document = JsonDocument.Parse(JsonSerializer.Serialize(orders[key]));
            return document.RootElement.TryGetProperty("customer", out var customer)
                && string.Equals(customer.GetString(), email, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    [HttpPost("chat/ask")]
    [ValidateAntiForgeryToken]
    // Recibe y procesa los mensajes enviados al chatbot.
    public async Task<IActionResult> Chat([FromBody] ChatRequest request, CancellationToken cancellationToken)
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (!string.IsNullOrWhiteSpace(email) && UserStore.TryGet(email, out var user) && user is not null && user.Activo)
            return Ok(new
            {
                answer = await _assistant.AskAsync(
                    user,
                    request.Message ?? string.Empty,
                    cancellationToken),
                role = user.Rol
            });
        return Ok(new
        {
            answer = await _assistant.AskPublicAsync(
                request.Message ?? string.Empty,
                cancellationToken),
            role = "Publico"
        });
    }
}

public sealed class OperationalOrdersRequest
{
    // Procesa la información de orders.
    public JsonElement Orders { get; set; }
}

public sealed class StateSyncRequest
{
    // Obtiene o valida la clave utilizada por el módulo.
    public string Key { get; set; } = string.Empty;
    // Obtiene el valor configurado para el dato actual.
    public JsonElement Value { get; set; }
}

public sealed class ChatRequest
{
    // Procesa el mensaje recibido desde la interfaz.
    public string? Message { get; set; }
}
