
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
        "restaurantebd_product_overrides","restaurantebd_product_deleted","restaurantebd_custom_categories","restaurantebd_global_currency"
    };
    private const string OperationalOrdersKey = "esfe_pedidos_operational";
    private static readonly HashSet<string> OperationalRoles = new(StringComparer.OrdinalIgnoreCase)
    { "Dueno", "Administrador", "Cocina", "Barra", "Delivery" };
    private readonly GeminiAssistantService _assistant;
    private readonly EmailService _emailService;
    private readonly ChatOrderAgent _chatOrderAgent;

    public RestaurantApiController(
        GeminiAssistantService assistant,
        EmailService emailService,
        ChatOrderAgent chatOrderAgent)
    {
        _assistant = assistant;
        _emailService = emailService;
        _chatOrderAgent = chatOrderAgent;
    }

    [HttpGet("system/status")]
    // Consulta el estado actual del servicio o registro.
    public IActionResult Status() => Ok(new { configured = RestaurantDb.IsConfigured });

    [HttpGet("connections/status")]
    // Muestra al administrador si las conexiones del servidor están listas.
    public IActionResult ConnectionsStatus()
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email)
            || !UserStore.TryGet(email, out var user)
            || user is null
            || !user.Activo
            || !user.EmailVerified
            || !RoleStore.IsAdministrator(user.Rol))
        {
            return Unauthorized();
        }

        object? database = null;
        if (RestaurantDb.IsConfigured)
        {
            try
            {
                database = RestaurantDb.GetHealth();
            }
            catch
            {
                database = new { connected = false };
            }
        }

        return Ok(new
        {
            databaseConfigured = RestaurantDb.IsConfigured,
            database,
            smtpConfigured = _emailService.IsConfigured,
            aiProviders = _assistant.GetConfiguredProviders()
        });
    }

    [HttpGet("database/health")]
    // Comprueba que la conexión y los componentes principales de la base estén disponibles.
    public IActionResult DatabaseHealth()
    {
        try
        {
            var health = RestaurantDb.GetHealth();
            return Ok(health);
        }
        catch
        {
            return StatusCode(503, new { connected = false, error = "No se pudo conectar con la base de datos." });
        }
    }

    [HttpGet("menu/catalog")]
    // Carga los productos actuales para que el menú use la base de datos como fuente principal.
    public IActionResult MenuCatalog()
    {
        try
        {
            var products = RestaurantDb.GetMenuCatalog();
            var categories = products
                .GroupBy(x => x.CategoryName, StringComparer.OrdinalIgnoreCase)
                .Select((group, index) => new
                {
                    id = group.Key,
                    order = index,
                    productCount = group.Count(x => x.IsAvailable)
                })
                .ToArray();

            return Ok(new
            {
                configured = RestaurantDb.IsConfigured,
                products,
                categories
            });
        }
        catch
        {
            return StatusCode(503, new
            {
                configured = RestaurantDb.IsConfigured,
                error = "No se pudo cargar el menú desde la base de datos."
            });
        }
    }

    [HttpGet("settings/global")]
    // Obtiene las preferencias generales que deben compartir todas las cuentas.
    public IActionResult GlobalSettings()
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null || !user.Activo || !user.EmailVerified)
            return Unauthorized();

        if (!RestaurantDb.IsConfigured)
            return Ok(new { configured = false, currency = "USD" });

        try
        {
            var state = RestaurantDb.GetGlobalStates(["restaurantebd_global_currency"]);
            var raw = state.TryGetValue("restaurantebd_global_currency", out var value) ? value : string.Empty;
            var currency = "USD";
            if (!string.IsNullOrWhiteSpace(raw))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<string>(raw);
                    if (!string.IsNullOrWhiteSpace(parsed)) currency = parsed.ToUpperInvariant();
                }
                catch { currency = raw.Trim('\"').ToUpperInvariant(); }
            }
            return Ok(new { configured = true, currency });
        }
        catch
        {
            return StatusCode(503, new { configured = true, currency = "USD" });
        }
    }

    [HttpGet("chat/status")]
    // Comprueba si al menos un proveedor de IA tiene una clave configurada.
    public IActionResult ChatStatus()
    {
        var configured = _assistant.GetConfiguredProviders();

        return Ok(new
        {
            enabled = configured.Count > 0,
            configuredProviders = configured,
            databaseConfigured = RestaurantDb.IsConfigured
        });
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

    [HttpGet("mail/inbox")]
    // Carga los correos guardados para la cuenta actual.
    public IActionResult MailInbox()
    {
        if (!TryGetCurrentUser(out var user))
            return Unauthorized();

        try
        {
            var messages = RestaurantDb.GetMailMessages(user!.AccountId)
                .Select(m => new
                {
                    id = $"MAIL-{m.Id}",
                    date = m.SentAt.ToUniversalTime().ToString("O"),
                    title = m.Subject,
                    message = m.Body,
                    detail = m.Body,
                    type = "mensaje",
                    read = m.IsRead,
                    starred = m.IsStarred,
                    archived = m.IsArchived,
                    sent = m.SenderAccountId == user.AccountId,
                    user = user.Email,
                    roles = Array.Empty<string>(),
                    fromName = m.SenderName,
                    fromEmail = m.SenderEmail,
                    toName = m.RecipientName ?? "",
                    toEmail = m.RecipientEmail,
                    cc = JsonSerializer.Deserialize<string[]>(m.CcJson) ?? Array.Empty<string>(),
                    bcc = Array.Empty<string>(),
                    toList = new[] { m.RecipientEmail },
                    recipientType = "Para",
                    orderId = "",
                    attachments = JsonSerializer.Deserialize<object[]>(m.AttachmentsJson) ?? Array.Empty<object>()
                });

            return Ok(messages);
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { error = ex.Message });
        }
    }

    [HttpPost("mail/send")]
    [ValidateAntiForgeryToken]
    // Envía el correo y guarda una copia en las cuentas internas.
    public async Task<IActionResult> SendMail([FromBody] MailSendRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUser(out var sender))
            return Unauthorized();

        var to = CleanEmails(request.To);
        var cc = CleanEmails(request.Cc);
        var bcc = CleanEmails(request.Bcc);

        if (to.Count == 0 || to.Any(x => !IsEmail(x)))
            return BadRequest(new { error = "Revisa los destinatarios." });

        if (to.Count > 10 || cc.Count > 10 || bcc.Count > 10)
            return BadRequest(new { error = "Hay demasiados destinatarios." });

        if (string.IsNullOrWhiteSpace(request.Subject))
            return BadRequest(new { error = "El asunto es obligatorio." });

        if (string.IsNullOrWhiteSpace(request.Body))
            return BadRequest(new { error = "El mensaje está vacío." });

        var allRecipients = to.Concat(cc).Concat(bcc)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (allRecipients.Contains(sender!.Email, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { error = "No puedes enviarte el mensaje a tu propia cuenta." });

        var hasExternalRecipient = allRecipients.Any(recipientEmail =>
            !UserStore.TryGet(recipientEmail, out var recipient, true)
            || recipient is null
            || !recipient.Activo);

        if (hasExternalRecipient && !_emailService.IsConfigured)
            return StatusCode(503, new { error = "El correo del servidor todavía no está configurado para enviar a direcciones externas." });

        List<EmailService.EmailAttachment> attachments;
        try
        {
            attachments = ParseAttachments(request.Attachments);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }

        try
        {
            // Primero guarda las copias de las cuentas que pertenecen al sistema.
            foreach (var recipientEmail in allRecipients)
            {
                UserStore.TryGet(recipientEmail, out var recipient, true);

                var internalRecipient = recipient is not null && recipient.Activo;
                var recipientName = internalRecipient ? recipient!.Nombre : recipientEmail;
                var copyCc = cc.Where(x => !x.Equals(recipientEmail, StringComparison.OrdinalIgnoreCase)).ToArray();
                var copyBcc = bcc.Where(x => !x.Equals(recipientEmail, StringComparison.OrdinalIgnoreCase)).ToArray();

                RestaurantDb.SaveMailMessage(
                    sender.AccountId,
                    sender.Email,
                    sender.Nombre,
                    internalRecipient ? recipient!.AccountId : null,
                    recipientEmail,
                    recipientName,
                    request.Subject.Trim(),
                    request.Body.Trim(),
                    JsonSerializer.Serialize(copyCc),
                    JsonSerializer.Serialize(copyBcc),
                    JsonSerializer.Serialize(request.Attachments ?? []));
            }

            // También envía el correo real para que llegue a direcciones externas.
            if (_emailService.IsConfigured)
            {
                await _emailService.SendMessageAsync(
                    to,
                    request.Subject.Trim(),
                    request.Body.Trim(),
                    cc,
                    bcc,
                    attachments,
                    cancellationToken);
            }

            return Ok(new { ok = true });
        }
        catch
        {
            return StatusCode(503, new { ok = false, error = "No se pudo enviar el correo. Revisa el correo del servidor." });
        }
    }

    [HttpPost("mail/read")]
    [ValidateAntiForgeryToken]
    // Marca un correo interno como leído.
    public IActionResult ReadMail([FromBody] MailFlagRequest request)
    {
        if (!TryGetCurrentUser(out var user))
            return Unauthorized();

        if (!TryParseMailId(request.Id, out var id))
            return BadRequest();

        RestaurantDb.MarkMailRead(user!.AccountId, id, request.Read);
        return Ok(new { ok = true });
    }

    [HttpPost("mail/delete")]
    [ValidateAntiForgeryToken]
    // Elimina un correo interno de la bandeja.
    public IActionResult DeleteMail([FromBody] MailFlagRequest request)
    {
        if (!TryGetCurrentUser(out var user))
            return Unauthorized();

        if (!TryParseMailId(request.Id, out var id))
            return BadRequest();

        RestaurantDb.DeleteMail(user!.AccountId, id);
        return Ok(new { ok = true });
    }

    [HttpPost("mail/flags")]
    [ValidateAntiForgeryToken]
    // Guarda los cambios de destacado o archivado del correo.
    public IActionResult MailFlags([FromBody] MailFlagRequest request)
    {
        if (!TryGetCurrentUser(out var user))
            return Unauthorized();

        if (!TryParseMailId(request.Id, out var id))
            return BadRequest();

        RestaurantDb.UpdateMailFlags(user!.AccountId, id, request.Starred, request.Archived);
        return Ok(new { ok = true });
    }

    // Convierte los archivos del formulario en adjuntos seguros para el correo.
    private static List<EmailService.EmailAttachment> ParseAttachments(MailAttachmentRequest[]? values)
    {
        var result = new List<EmailService.EmailAttachment>();
        var total = 0L;

        foreach (var item in values ?? [])
        {
            if (string.IsNullOrWhiteSpace(item.Name) || string.IsNullOrWhiteSpace(item.Data))
                continue;

            var base64 = item.Data.Contains(',')
                ? item.Data[(item.Data.IndexOf(',') + 1)..]
                : item.Data;

            byte[] content;
            try
            {
                content = Convert.FromBase64String(base64);
            }
            catch
            {
                throw new InvalidOperationException($"El archivo {item.Name} no es válido.");
            }

            if (content.Length > 10 * 1024 * 1024)
                throw new InvalidOperationException($"El archivo {item.Name} supera el límite de 10 MB.");

            total += content.Length;
            if (total > 10 * 1024 * 1024)
                throw new InvalidOperationException("Los archivos adjuntos no pueden superar 10 MB en total.");

            result.Add(new EmailService.EmailAttachment(
                Path.GetFileName(item.Name),
                string.IsNullOrWhiteSpace(item.ContentType) ? "application/octet-stream" : item.ContentType,
                content));
        }

        return result;
    }

    // Obtiene la cuenta que está usando la aplicación.
    private bool TryGetCurrentUser(out UserAccount? user)
    {
        user = null;
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        return !string.IsNullOrWhiteSpace(email)
            && UserStore.TryGet(email, out user)
            && user is not null
            && user.Activo
            && user.EmailVerified;
    }

    // Limpia y normaliza la lista de correos.
    private static List<string> CleanEmails(IEnumerable<string>? values) =>
        (values ?? [])
            .Select(x => (x ?? "").Trim().ToLowerInvariant())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static bool IsEmail(string value) =>
        System.Net.Mail.MailAddress.TryCreate(value, out var address)
        && address.Address.Equals(value, StringComparison.OrdinalIgnoreCase);

    private static bool TryParseMailId(string value, out long id)
    {
        id = 0;
        if (!value.StartsWith("MAIL-", StringComparison.OrdinalIgnoreCase))
            return false;

        return long.TryParse(value[5..], out id);
    }

    [HttpPost("chat/ask")]
    [ValidateAntiForgeryToken]
    // Recibe y procesa los mensajes enviados al chatbot.
    public async Task<IActionResult> Chat([FromBody] ChatRequest request, CancellationToken cancellationToken)
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (!string.IsNullOrWhiteSpace(email) && UserStore.TryGet(email, out var user) && user is not null && user.Activo && user.EmailVerified)
        {
            var actionResult = _chatOrderAgent.Process(
                user,
                request.Message ?? string.Empty,
                request.Cart,
                request.Draft);

            var answer = await _assistant.AskAsync(
                user,
                request.Message ?? string.Empty,
                request.Language,
                cancellationToken,
                actionResult.SystemNote);

            return Ok(new
            {
                answer,
                role = user.Rol,
                actions = actionResult.Actions,
                draft = actionResult.Draft
            });
        }

        return Ok(new
        {
            answer = await _assistant.AskPublicAsync(
                request.Message ?? string.Empty,
                request.Language,
                cancellationToken),
            role = "Publico",
            actions = Array.Empty<object>(),
            draft = new ChatOrderAgent.ChatDraft()
        });
    }
}

public sealed class MailSendRequest
{
    public string[] To { get; set; } = [];
    public string[] Cc { get; set; } = [];
    public string[] Bcc { get; set; } = [];
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public MailAttachmentRequest[] Attachments { get; set; } = [];
}

public sealed class MailAttachmentRequest
{
    public string Name { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public string Data { get; set; } = string.Empty;
}

public sealed class MailFlagRequest
{
    public string Id { get; set; } = string.Empty;
    public bool Read { get; set; }
    public bool? Starred { get; set; }
    public bool? Archived { get; set; }
}

public sealed class OperationalOrdersRequest
{
    // Convierte los pedidos recibidos en una lista utilizable.
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
    public string? Language { get; set; }
    public JsonElement Cart { get; set; }
    public JsonElement Draft { get; set; }
}
