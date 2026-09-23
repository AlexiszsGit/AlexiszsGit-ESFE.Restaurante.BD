using System.Net;
using System.Text;
using System.Text.Json;
using System.Collections.Concurrent;
using ESFE.RestauranteBD.web.UI.Data;
using ESFE.RestauranteBD.web.UI.Models;

namespace ESFE.RestauranteBD.web.UI.Services;

// Coordina las distintas IAs y cambia de proveedor cuando una no responde.
public sealed class GeminiAssistantService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GeminiAssistantService> _logger;
    private static readonly ConcurrentDictionary<string, CachedContext> ContextCache = new(StringComparer.OrdinalIgnoreCase);
    private static readonly TimeSpan ContextCacheDuration = TimeSpan.FromSeconds(5);

    private sealed record CachedContext(string Value, DateTime ExpiresAt);

    public GeminiAssistantService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<GeminiAssistantService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    // Responde usando la cuenta y guarda la conversación en SQL Server.
    public async Task<string> AskAsync(
        UserAccount user,
        string question,
        string? language,
        CancellationToken cancellationToken)
    {
        var answer = await AskCoreAsync(user, question, language, cancellationToken);

        try
        {
            RestaurantDb.SaveChatExchange(user.AccountId, question, answer, user.Rol);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo guardar la respuesta del chatbot.");
        }

        return answer;
    }

    // Devuelve los proveedores que tienen una clave lista para usarse.
    public IReadOnlyList<string> GetConfiguredProviders()
    {
        var providers = new[]
        {
            (Name: "gemini", Key: "AI_GEMINI_API_KEY"),
            (Name: "openrouter", Key: "AI_OPENROUTER_API_KEY"),
            (Name: "groq", Key: "AI_GROQ_API_KEY"),
            (Name: "cloudflare", Key: "AI_CLOUDFLARE_API_TOKEN"),
            (Name: "mistral", Key: "AI_MISTRAL_API_KEY"),
            (Name: "huggingface", Key: "AI_HUGGINGFACE_API_KEY"),
            (Name: "compatible", Key: "AI_COMPATIBLE_API_KEY")
        };

        return providers
            .Where(x => !string.IsNullOrWhiteSpace(GetSetting(x.Key)))
            .Select(x => x.Name)
            .ToArray();
    }

    // Responde sin exponer información privada.
    public Task<string> AskPublicAsync(
        string question,
        string? language,
        CancellationToken cancellationToken)
        => AskCoreAsync(null, question, language, cancellationToken);

    // Prepara el contexto y prueba los proveedores configurados en orden.
    private async Task<string> AskCoreAsync(
        UserAccount? user,
        string question,
        string? language,
        CancellationToken cancellationToken)
    {
        question = (question ?? string.Empty).Trim();

        if (question.Length == 0)
            return "Escribe tu pregunta y te ayudo.";

        string context;
        try
        {
            var contextKey = user is null ? "public" : $"{user.AccountId}:{user.Rol}";
            if (ContextCache.TryGetValue(contextKey, out var cached) && cached.ExpiresAt > DateTime.UtcNow)
            {
                context = cached.Value;
            }
            else
            {
                context = user is null
                    ? BuildPublicContext()
                    : RestaurantDb.BuildAssistantContext(user);
                ContextCache[contextKey] = new CachedContext(context, DateTime.UtcNow.Add(ContextCacheDuration));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "No se pudo consultar la información del restaurante.");
            return "No pude consultar la información del restaurante en este momento.";
        }

        var privacyRule = GetPrivacyRule(user);
        var messages = BuildMessages(user, question, context, privacyRule, language);

        foreach (var provider in GetProviderOrder())
        {
            try
            {
                var result = await AskProviderAsync(provider, messages, cancellationToken);

                if (!string.IsNullOrWhiteSpace(result))
                    return result.Trim();
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "El proveedor {Provider} no respondió. Se probará el siguiente.", provider);
            }
        }

        return "En este momento ninguno de los servicios de IA configurados está disponible. Intenta nuevamente en unos segundos.";
    }

    // Define el orden de respaldo. Se puede cambiar desde el servidor sin tocar el código.
    private IReadOnlyList<string> GetProviderOrder()
    {
        var configured = GetSetting("AI_PROVIDER_ORDER");

        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => x.ToLowerInvariant())
                .Distinct()
                .ToArray();
        }

        return ["gemini", "openrouter", "groq", "cloudflare", "mistral", "huggingface", "compatible"];
    }

    // Envía la misma conversación al proveedor que corresponda.
    private async Task<string?> AskProviderAsync(
        string provider,
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken)
    {
        return provider switch
        {
            "gemini" => await AskGeminiAsync(messages, cancellationToken),
            "openrouter" => await AskOpenAiCompatibleAsync(
                "https://openrouter.ai/api/v1/chat/completions",
                GetSetting("AI_OPENROUTER_API_KEY"),
                GetSetting("AI_OPENROUTER_MODEL") ?? "openrouter/free",
                messages,
                cancellationToken,
                "OpenRouter"),
            "groq" => await AskOpenAiCompatibleAsync(
                "https://api.groq.com/openai/v1/chat/completions",
                GetSetting("AI_GROQ_API_KEY"),
                GetSetting("AI_GROQ_MODEL") ?? "openai/gpt-oss-20b",
                messages,
                cancellationToken,
                "Groq"),
            "huggingface" => await AskOpenAiCompatibleAsync(
                "https://router.huggingface.co/v1/chat/completions",
                GetSetting("AI_HUGGINGFACE_API_KEY"),
                GetSetting("AI_HUGGINGFACE_MODEL") ?? "openai/gpt-oss-120b",
                messages,
                cancellationToken,
                "Hugging Face"),
            "cloudflare" => await AskCloudflareAsync(messages, cancellationToken),
            "mistral" => await AskOpenAiCompatibleAsync(
                "https://api.mistral.ai/v1/chat/completions",
                GetSetting("AI_MISTRAL_API_KEY"),
                GetSetting("AI_MISTRAL_MODEL") ?? "mistral-small-latest",
                messages,
                cancellationToken,
                "Mistral"),
            "compatible" => await AskOpenAiCompatibleAsync(
                GetSetting("AI_COMPATIBLE_ENDPOINT"),
                GetSetting("AI_COMPATIBLE_API_KEY"),
                GetSetting("AI_COMPATIBLE_MODEL") ?? "openai/gpt-oss-20b",
                messages,
                cancellationToken,
                "Proveedor adicional"),
            _ => null
        };
    }

    // Envía una conversación a Gemini.
    private async Task<string?> AskGeminiAsync(
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken)
    {
        var apiKey = GetSetting("AI_GEMINI_API_KEY")
                     ?? GetSetting("GEMINI_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey))
            return null;

        var model = GetSetting("AI_GEMINI_MODEL")
                    ?? _configuration["Gemini:Model"]
                    ?? "gemini-3.8-flash";

        var contents = messages
            .Where(x => x.Role != "system")
            .Select(x => new
            {
                role = x.Role == "assistant" ? "model" : "user",
                parts = new[] { new { text = x.Content } }
            })
            .ToArray();

        var systemText = messages.FirstOrDefault(x => x.Role == "system")?.Content ?? "";

        var payload = new
        {
            systemInstruction = new
            {
                parts = new[] { new { text = systemText } }
            },
            contents,
            generationConfig = new
            {
                maxOutputTokens = 720,
                temperature = 0.7
            }
        };

        var endpoint =
            $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:generateContent";

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);
        request.Content = JsonContent(payload);

        using var response = await SendWithRetryAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Gemini devolvió HTTP {StatusCode}.", (int)response.StatusCode);
            return null;
        }

        using var document = JsonDocument.Parse(body);

        if (!document.RootElement.TryGetProperty("candidates", out var candidates)
            || candidates.GetArrayLength() == 0)
            return null;

        var parts = candidates[0]
            .GetProperty("content")
            .GetProperty("parts");

        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("text", out var text)
                && !string.IsNullOrWhiteSpace(text.GetString()))
                return text.GetString();
        }

        return null;
    }

    // Envía la conversación a APIs que usan el formato compatible con OpenAI.
    private async Task<string?> AskOpenAiCompatibleAsync(
        string? endpoint,
        string? apiKey,
        string model,
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken,
        string providerName)
    {
        if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(apiKey))
            return null;

        var payload = new
        {
            model,
            messages = messages.Select(x => new
            {
                role = x.Role,
                content = x.Content
            }),
            temperature = 0.7,
            max_tokens = 720
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        request.Headers.TryAddWithoutValidation("X-Title", "RestauranteBD");
        request.Content = JsonContent(payload);

        using var response = await SendWithRetryAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("{Provider} devolvió HTTP {StatusCode}.", providerName, (int)response.StatusCode);
            return null;
        }

        using var document = JsonDocument.Parse(body);

        if (document.RootElement.TryGetProperty("choices", out var choices)
            && choices.GetArrayLength() > 0)
        {
            var choice = choices[0];

            if (choice.TryGetProperty("message", out var message)
                && message.TryGetProperty("content", out var content))
                return content.GetString();
        }

        return null;
    }

    // Envía la conversación a Cloudflare Workers AI.
    private async Task<string?> AskCloudflareAsync(
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken)
    {
        var token = GetSetting("AI_CLOUDFLARE_API_TOKEN");
        var accountId = GetSetting("AI_CLOUDFLARE_ACCOUNT_ID");

        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(accountId))
            return null;

        var model = GetSetting("AI_CLOUDFLARE_MODEL")
                    ?? "@cf/zai-org/glm-4.7-flash";

        var endpoint =
            $"https://api.cloudflare.com/client/v4/accounts/{Uri.EscapeDataString(accountId)}/ai/run/{Uri.EscapeDataString(model)}";

        var payload = new
        {
            messages = messages.Select(x => new
            {
                role = x.Role,
                content = x.Content
            })
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent(payload);

        using var response = await SendWithRetryAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
            return null;

        using var document = JsonDocument.Parse(body);

        if (document.RootElement.TryGetProperty("result", out var result)
            && result.TryGetProperty("response", out var answer))
            return answer.GetString();

        return null;
    }

    // Reintenta solo los errores temporales para no gastar llamadas innecesarias.
    private async Task<HttpResponseMessage> SendWithRetryAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("AI");
        client.Timeout = TimeSpan.FromSeconds(15);

        for (var attempt = 1; attempt <= 2; attempt++)
        {
            using var copy = await CloneRequestAsync(request, cancellationToken);
            var response = await client.SendAsync(copy, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

            if ((int)response.StatusCode == 429)
                return response;

            if ((int)response.StatusCode < 500 || attempt == 2)
                return response;

            response.Dispose();
            await Task.Delay(TimeSpan.FromMilliseconds(300 * attempt), cancellationToken);
        }

        throw new InvalidOperationException("No se pudo contactar al proveedor.");
    }

    private static async Task<HttpRequestMessage> CloneRequestAsync(
        HttpRequestMessage source,
        CancellationToken cancellationToken)
    {
        var copy = new HttpRequestMessage(source.Method, source.RequestUri);

        foreach (var header in source.Headers)
            copy.Headers.TryAddWithoutValidation(header.Key, header.Value);

        if (source.Content is not null)
        {
            var content = await source.Content.ReadAsStringAsync(cancellationToken);
            copy.Content = new StringContent(content, Encoding.UTF8, source.Content.Headers.ContentType?.MediaType ?? "application/json");
        }

        return copy;
    }

    // Arma el contexto fijo, la conversación anterior y la pregunta actual.
    private static List<ChatMessage> BuildMessages(
        UserAccount? user,
        string question,
        string context,
        string privacyRule,
        string? language)
    {
        var safeLanguage = NormalizeLanguage(language);
        var languageName = LanguageName(safeLanguage);
        var system = $"""
Eres el asistente virtual de RestauranteBD.

Responde siempre en {languageName}. Mantén el tono natural, amable y claro.
No uses Markdown técnico, JSON, SQL, nombres de tablas, endpoints ni claves.
No inventes precios, productos, pedidos, reservas, empleados, horarios ni datos de la base.
Si un dato no está disponible, dilo claramente.
No muestres contraseñas, hashes, API keys, claves criptográficas, CVV, números completos de tarjetas ni datos privados de terceros.

Rol del usuario:
{user?.Rol ?? "Publico"}

Reglas de privacidad:
{privacyRule}

Información actual del restaurante:
{context}
""";

        var messages = new List<ChatMessage>
        {
            new("system", system)
        };

        if (user is not null)
        {
            try
            {
                foreach (var history in RestaurantDb.GetRecentChatHistory(user.AccountId, 8))
                {
                    var role = history.SenderType.Equals("Bot", StringComparison.OrdinalIgnoreCase)
                        ? "assistant"
                        : "user";

                    messages.Add(new ChatMessage(role, history.MessageText));
                }
            }
            catch
            {
                // La conversación puede continuar aunque no se pueda leer el historial.
            }
        }

        messages.Add(new ChatMessage("user", question));
        return messages;
    }

    // Reglas de privacidad según el tipo de cuenta.
    private static string GetPrivacyRule(UserAccount? user)
    {
        if (user is null)
            return "Solo información pública del restaurante.";

        if (RoleStore.IsAdministrator(user.Rol))
            return "Puede consultar información operativa y empresarial disponible, pero nunca secretos técnicos ni datos de seguridad.";

        if (user.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase))
            return "Solo información pública y datos de su propia cuenta y pedidos. Nunca datos de terceros.";

        return $"Solo información pública y datos operativos permitidos para el cargo {user.Rol}. Nunca datos privados de terceros.";
    }

    // Construye la información pública cuando no hay una sesión.
    private static string BuildPublicContext()
    {
        try
        {
            return RestaurantDb.IsConfigured
                ? RestaurantDb.BuildAssistantContext(new UserAccount { Rol = "Cliente", AccountId = 0 })
                : "La base de datos no está configurada.";
        }
        catch
        {
            return "No fue posible obtener información pública de la base de datos.";
        }
    }

    // Normaliza el idioma que llega desde la interfaz.
    private static string NormalizeLanguage(string? language)
    {
        var code = (language ?? string.Empty).Trim().ToLowerInvariant();
        return code is "es" or "en" or "pt" or "fr" or "de" or "it" or "nl" or "tr" or "ru" or "pl" or "zh" or "ja" or "ko" or "ar" or "hi" or "id" or "vi" or "th" or "he" or "sv" ? code : "es";
    }

    // Devuelve el nombre del idioma para indicárselo al modelo.
    private static string LanguageName(string code) => code switch
    {
        "en" => "English", "pt" => "Português", "fr" => "Français", "de" => "Deutsch",
        "it" => "Italiano", "nl" => "Nederlands", "tr" => "Türkçe", "ru" => "Русский",
        "pl" => "Polski", "zh" => "中文", "ja" => "日本語", "ko" => "한국어",
        "ar" => "العربية", "hi" => "हिन्दी", "id" => "Bahasa Indonesia", "vi" => "Tiếng Việt",
        "th" => "ไทย", "he" => "עברית", "sv" => "Svenska", _ => "Español"
    };

    // Lee una configuración primero desde las variables del servidor y luego desde appsettings.
    private string? GetSetting(string name)
    {
        var environmentValue = Environment.GetEnvironmentVariable(name);
        if (!string.IsNullOrWhiteSpace(environmentValue))
            return environmentValue;

        var configName = name switch
        {
            "AI_PROVIDER_ORDER" => "AI:ProviderOrder",
            "AI_GEMINI_API_KEY" => "AI:GeminiApiKey",
            "AI_GEMINI_MODEL" => "AI:GeminiModel",
            "AI_OPENROUTER_API_KEY" => "AI:OpenRouterApiKey",
            "AI_OPENROUTER_MODEL" => "AI:OpenRouterModel",
            "AI_GROQ_API_KEY" => "AI:GroqApiKey",
            "AI_GROQ_MODEL" => "AI:GroqModel",
            "AI_CLOUDFLARE_API_TOKEN" => "AI:CloudflareApiToken",
            "AI_CLOUDFLARE_ACCOUNT_ID" => "AI:CloudflareAccountId",
            "AI_CLOUDFLARE_MODEL" => "AI:CloudflareModel",
            "AI_MISTRAL_API_KEY" => "AI:MistralApiKey",
            "AI_MISTRAL_MODEL" => "AI:MistralModel",
            "AI_HUGGINGFACE_API_KEY" => "AI:HuggingFaceApiKey",
            "AI_HUGGINGFACE_MODEL" => "AI:HuggingFaceModel",
            "AI_COMPATIBLE_ENDPOINT" => "AI:CompatibleEndpoint",
            "AI_COMPATIBLE_API_KEY" => "AI:CompatibleApiKey",
            "AI_COMPATIBLE_MODEL" => "AI:CompatibleModel",
            "GEMINI_API_KEY" => "Gemini:ApiKey",
            _ => name
        };

        return _configuration[configName];
    }

    private static StringContent JsonContent(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    private sealed record ChatMessage(string Role, string Content);
}
