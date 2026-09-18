using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using ESFE.RestauranteBD.web.UI.Data;
using ESFE.RestauranteBD.web.UI.Models;

namespace ESFE.RestauranteBD.web.UI.Services;

public sealed class GeminiAssistantService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GeminiAssistantService> _logger;

    public GeminiAssistantService(IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<GeminiAssistantService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string> AskAsync(UserAccount user, string question, CancellationToken cancellationToken)
    {
        var answer = await AskCoreAsync(user, question, cancellationToken);
        try { RestaurantDb.SaveChatExchange(user.AccountId, question, answer, user.Rol); } catch { }
        return answer;
    }

    public Task<string> AskPublicAsync(string question, CancellationToken cancellationToken) => AskCoreAsync(null, question, cancellationToken);

    private async Task<string> AskCoreAsync(UserAccount? user, string question, CancellationToken cancellationToken)
    {
        question = (question ?? string.Empty).Trim();
        if (question.Length == 0) return "Escribe tu pregunta y te ayudo.";

        var enabled = _configuration.GetValue<bool>("Gemini:Enabled");
        var apiKey =
    Environment.GetEnvironmentVariable("GEMINI_API_KEY")
    ?? _configuration["Gemini:ApiKey"];
        var model = _configuration["Gemini:Model"] ?? "gemini-3.1-flash-lite";
        var role = user?.Rol ?? "Publico";
        string context;
        try
        {
            context = user is null ? BuildPublicContext() : RestaurantDb.BuildAssistantContext(user);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo consultar el contexto de SQL Server para el asistente.");
            context = "No fue posible consultar la base de datos en este momento. No inventes datos y limita la respuesta a información general del restaurante.";
        }

        if (!enabled || string.IsNullOrWhiteSpace(apiKey) || apiKey.StartsWith("PON_AQUI", StringComparison.OrdinalIgnoreCase))
            return Fallback(question, user, context);

        try
        {
            var client = _httpClientFactory.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:generateContent");
            request.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);
            var prompt = $"Eres el asistente virtual de un restaurante. Responde siempre en español, claro y útil.\nROL ACTUAL: {role}\nREGLAS DE PRIVACIDAD: {GetPrivacyRule(user)}\nCONTEXTO DE LA BASE DE DATOS:\n{context}\n\nPREGUNTA DEL USUARIO:\n{question}\n\nNo inventes datos que no estén en el contexto. Si algo no aparece, dilo. No muestres secretos técnicos ni credenciales.";
            var payload = JsonSerializer.Serialize(new { contents = new[] { new { parts = new[] { new { text = prompt } } } } });
            request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("Gemini respondió HTTP {StatusCode}: {Body}", (int)response.StatusCode, errorBody.Length > 1200 ? errorBody[..1200] : errorBody);
                return Fallback(question, user, context);
            }
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            var answer = document.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
            return string.IsNullOrWhiteSpace(answer) ? Fallback(question, user, context) : answer.Trim();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falló la consulta al asistente Gemini.");
            return Fallback(question, user, context);
        }
    }

    private static string GetPrivacyRule(UserAccount? user)
    {
        if (user is null) return "Solo información pública del restaurante.";
        if (RoleStore.IsAdministrator(user.Rol)) return "El administrador puede consultar información operativa y empresarial disponible, pero nunca secretos técnicos, contraseñas, hashes, API keys, claves criptográficas, CVV ni PAN completo.";
        if (user.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase)) return "Solo información pública y datos de su propia cuenta/pedidos. Nunca datos de terceros.";
        return $"Solo información pública y datos operativos permitidos para el cargo {user.Rol}. Nunca datos privados de terceros.";
    }

    private static string BuildPublicContext()
    {
        try
        {
            if (!RestaurantDb.IsConfigured) return "Menú local del sitio disponible en pantalla; horarios predeterminados 06:00-22:00.";
            return RestaurantDb.BuildAssistantContext(new UserAccount { Rol = "Cliente", AccountId = 0 });
        }
        catch { return "Información pública básica del restaurante."; }
    }

    private static string Fallback(string question, UserAccount? user, string context)
    {
        var q = question.ToLowerInvariant();
        if (q.Contains("horario") || q.Contains("abre") || q.Contains("cierra")) return "El horario configurado en el sitio es de 06:00 a 22:00. Puedes verificarlo también en Información.";
        if (q.Contains("menu") || q.Contains("menú") || q.Contains("producto") || q.Contains("hamburg") || q.Contains("pizza"))
        {
            var first = context.Split('\n').FirstOrDefault(x => x.StartsWith("PRODUCTO", StringComparison.OrdinalIgnoreCase));
            return first is null ? "Puedes consultar el menú directamente en la sección Menú." : "Sí, puedo consultar el menú que está guardado en la base de datos. " + first.Replace("PRODUCTO | ", "");
        }
        if (RoleStore.IsAdministrator(user?.Rol) && q.Contains("venta")) return "Puedo consultar las ventas empresariales cuando la API de IA esté configurada; la aplicación ya puede leer el resumen desde SQL Server.";
        return "El asistente está conectado a la base de datos, pero la API de IA todavía no está configurada. Configura Gemini en appsettings.json para activar las respuestas inteligentes.";
    }
}
