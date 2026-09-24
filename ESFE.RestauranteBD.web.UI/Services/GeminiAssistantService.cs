using System.Net;
using System.Text;
using System.Text.Json;
using System.Collections.Concurrent;
using System.Diagnostics;
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
    private static readonly TimeSpan OpenRouterModelCacheDuration = TimeSpan.FromMinutes(10);
    private static readonly ConcurrentDictionary<string, DateTime> ProviderCooldown = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<string, ProviderPerformance> ProviderPerformanceByProvider = new(StringComparer.OrdinalIgnoreCase);
    private static readonly string[] FastBootstrapOrder =
    [
        "groq", "cerebras", "gemini", "sambanova", "mistral",
        "openrouter", "together", "cloudflare", "huggingface"
    ];
    private static IReadOnlyList<string>? OpenRouterFreeModelCache;
    private static DateTime OpenRouterFreeModelCacheExpiresAt;
    private static int OpenRouterModelCursor;

    private sealed record CachedContext(string Value, DateTime ExpiresAt);

    private sealed class ProviderPerformance
    {
        public double? AverageMilliseconds { get; set; }
        public int SuccessfulCalls { get; set; }
        public int FailedCalls { get; set; }
        public DateTime LastSuccessUtc { get; set; }
    }

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
        CancellationToken cancellationToken,
        string? actionContext = null)
    {
        var answer = await AskCoreAsync(user, question, language, cancellationToken, actionContext);

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
        var configured = new List<string>();
        foreach (var provider in GetDefaultProviderOrder())
        {
            var apiKey = GetProviderSetting(provider, "ApiKey");
            var endpoint = GetProviderSetting(provider, "Endpoint");
            var type = GetProviderSetting(provider, "Type") ?? "OpenAICompatible";

            var model = GetProviderSetting(provider, "Model");
            var ready = type.Equals("Cloudflare", StringComparison.OrdinalIgnoreCase)
                ? !string.IsNullOrWhiteSpace(apiKey) && !string.IsNullOrWhiteSpace(GetProviderSetting(provider, "AccountId")) && !string.IsNullOrWhiteSpace(model)
                : type.Equals("Gemini", StringComparison.OrdinalIgnoreCase) || provider.Equals("gemini", StringComparison.OrdinalIgnoreCase)
                    ? !string.IsNullOrWhiteSpace(apiKey) && !string.IsNullOrWhiteSpace(model)
                    : provider.Equals("cohere", StringComparison.OrdinalIgnoreCase)
                        ? !string.IsNullOrWhiteSpace(apiKey) && !string.IsNullOrWhiteSpace(GetProviderSetting(provider, "Endpoint")) && !string.IsNullOrWhiteSpace(model)
                        : !string.IsNullOrWhiteSpace(apiKey) && !string.IsNullOrWhiteSpace(endpoint) && !string.IsNullOrWhiteSpace(model);

            if (ready)
                configured.Add(provider);
        }

        return configured;
    }

    // Busca una clave aunque venga como secreto local o como variable del servidor.
    private string? ReadConfiguredValue(string key)
    {
        var environmentKey = key.Replace(":", "__", StringComparison.Ordinal);
        var environmentValue = Environment.GetEnvironmentVariable(key);
        if (!string.IsNullOrWhiteSpace(environmentValue)) return environmentValue;
        environmentValue = Environment.GetEnvironmentVariable(environmentKey);
        if (!string.IsNullOrWhiteSpace(environmentValue)) return environmentValue;
        return _configuration[key];
    }

    // Lee una propiedad de uno de los 20 espacios de IA configurados.
    private string? GetProviderSetting(string provider, string setting)
    {
        var path = $"AI:Providers:{provider}:{setting}";
        var environmentKey = path.Replace(":", "__", StringComparison.Ordinal);
        var value = Environment.GetEnvironmentVariable(environmentKey);
        if (!string.IsNullOrWhiteSpace(value)) return value;

        value = Environment.GetEnvironmentVariable($"AI_PROVIDERS_{provider.ToUpperInvariant()}_{setting.ToUpperInvariant()}");
        if (!string.IsNullOrWhiteSpace(value)) return value;

        value = _configuration[path];
        if (!string.IsNullOrWhiteSpace(value)) return value;

        // Mantiene compatibilidad con las claves que ya tenias configuradas.
        if (provider.Equals("gemini", StringComparison.OrdinalIgnoreCase) && setting.Equals("ApiKey", StringComparison.OrdinalIgnoreCase))
            return GetSetting("AI_GEMINI_API_KEY");
        if (provider.Equals("openrouter", StringComparison.OrdinalIgnoreCase) && setting.Equals("ApiKey", StringComparison.OrdinalIgnoreCase))
            return GetSetting("AI_OPENROUTER_API_KEY");
        if (provider.Equals("groq", StringComparison.OrdinalIgnoreCase) && setting.Equals("ApiKey", StringComparison.OrdinalIgnoreCase))
            return GetSetting("AI_GROQ_API_KEY");
        if (provider.Equals("mistral", StringComparison.OrdinalIgnoreCase) && setting.Equals("ApiKey", StringComparison.OrdinalIgnoreCase))
            return GetSetting("AI_MISTRAL_API_KEY");
        if (provider.Equals("huggingface", StringComparison.OrdinalIgnoreCase) && setting.Equals("ApiKey", StringComparison.OrdinalIgnoreCase))
            return GetSetting("AI_HUGGINGFACE_API_KEY");
        if (provider.Equals("cloudflare", StringComparison.OrdinalIgnoreCase) && setting.Equals("ApiKey", StringComparison.OrdinalIgnoreCase))
            return GetSetting("AI_CLOUDFLARE_API_TOKEN");

        if (setting.Equals("Model", StringComparison.OrdinalIgnoreCase))
        {
            return provider.ToLowerInvariant() switch
            {
                "groq" => "openai/gpt-oss-20b",
                "cerebras" => "gpt-oss-120b",
                "mistral" => "mistral-small-latest",
                "huggingface" => "openai/gpt-oss-120b",
                "cloudflare" => "@cf/zai-org/glm-4.7-flash",
                "openrouter" => "openrouter/free",
                "together" => "openai/gpt-oss-20b",
                _ => null
            };
        }

        return null;
    }

    // Espacios listos para proveedores directos y para los modelos gratuitos de OpenRouter.
    private static IReadOnlyList<string> GetDefaultProviderOrder() =>
        [
            "groq", "cerebras", "gemini", "sambanova", "mistral",
            "openrouter", "together", "cloudflare", "huggingface"
        ];

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
        CancellationToken cancellationToken,
        string? actionContext = null)
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
        var messages = BuildMessages(user, question, context, privacyRule, language, actionContext);

        foreach (var provider in GetProviderOrder())
        {
            if (ProviderCooldown.TryGetValue(provider, out var cooldownUntil) && cooldownUntil > DateTime.UtcNow)
                continue;

            var stopwatch = Stopwatch.StartNew();

            try
            {
                var result = await AskProviderAsync(provider, messages, cancellationToken);
                stopwatch.Stop();

                if (!string.IsNullOrWhiteSpace(result))
                {
                    RegisterProviderSuccess(provider, stopwatch.Elapsed.TotalMilliseconds);
                    return CleanAssistantText(result);
                }

                RegisterProviderFailure(provider);
                ProviderCooldown[provider] = DateTime.UtcNow.AddSeconds(30);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                RegisterProviderFailure(provider);
                ProviderCooldown[provider] = DateTime.UtcNow.AddSeconds(30);
                _logger.LogWarning(ex, "El proveedor {Provider} no respondió. Se probará el siguiente.", provider);
            }
        }

        return "En este momento ninguno de los servicios de IA configurados está disponible. Intenta nuevamente en unos segundos.";
    }

    // Limpia marcas que suelen sonar mal cuando la respuesta se reproduce por voz.
    // Limpia marcas que suelen sonar mal cuando la respuesta se reproduce por voz.
    private static string CleanAssistantText(string value)
    {
        var text = value.Replace("```", string.Empty)
                        .Replace("**", string.Empty)
                        .Replace("__", string.Empty)
                        .Replace("`", string.Empty)
                        .Replace("•", string.Empty);

        text = System.Text.RegularExpressions.Regex.Replace(text, @"(?m)^\s*[-*]\s+", string.Empty);
        text = System.Text.RegularExpressions.Regex.Replace(text, @"[\p{So}]", string.Empty);
        text = System.Text.RegularExpressions.Regex.Replace(text, @"\n{3,}", "\n\n");
        return text.Trim();
    }

    // Ordena primero los proveedores que realmente están respondiendo más rápido.
    // Si todavía no tenemos datos, usa un orden inicial de baja latencia y luego aprende con el uso real.
    private IReadOnlyList<string> GetProviderOrder()
    {
        var configuredOrder = GetSetting("AI_PROVIDER_ORDER")
            ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.ToLowerInvariant())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var allowed = (configuredOrder is { Count: > 0 } ? configuredOrder : FastBootstrapOrder.ToList())
            .Concat(GetConfiguredProviders())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var bootstrapRank = FastBootstrapOrder
            .Select((provider, index) => new { provider, index })
            .ToDictionary(x => x.provider, x => x.index, StringComparer.OrdinalIgnoreCase);

        return allowed
            .Select((provider, index) =>
            {
                ProviderPerformance? performance = null;
                ProviderPerformanceByProvider.TryGetValue(provider, out performance);

                return new
                {
                    Provider = provider,
                    ConfiguredIndex = index,
                    BootstrapIndex = bootstrapRank.TryGetValue(provider, out var rank) ? rank : 999,
                    AverageMilliseconds = performance?.AverageMilliseconds ?? double.MaxValue,
                    SuccessfulCalls = performance?.SuccessfulCalls ?? 0
                };
            })
            .OrderBy(x => x.SuccessfulCalls == 0 ? 1 : 0)
            .ThenBy(x => x.SuccessfulCalls == 0 ? x.BootstrapIndex : x.AverageMilliseconds)
            .ThenBy(x => x.ConfiguredIndex)
            .Select(x => x.Provider)
            .ToArray();
    }

    private static void RegisterProviderSuccess(string provider, double milliseconds)
    {
        var performance = ProviderPerformanceByProvider.GetOrAdd(provider, _ => new ProviderPerformance());

        lock (performance)
        {
            performance.AverageMilliseconds = performance.AverageMilliseconds is null
                ? milliseconds
                : (performance.AverageMilliseconds.Value * 0.7) + (milliseconds * 0.3);
            performance.SuccessfulCalls++;
            performance.LastSuccessUtc = DateTime.UtcNow;
        }

        ProviderCooldown.TryRemove(provider, out _);
    }

    private static void RegisterProviderFailure(string provider)
    {
        var performance = ProviderPerformanceByProvider.GetOrAdd(provider, _ => new ProviderPerformance());

        lock (performance)
        {
            performance.FailedCalls++;
        }
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
            "openrouter" => await AskOpenRouterCascadeAsync(messages, cancellationToken),
            "cloudflare" => await AskCloudflareAsync(messages, cancellationToken),
            "cohere" => await AskCohereAsync(messages, cancellationToken),
            _ => await AskConfiguredOpenAiProviderAsync(provider, messages, cancellationToken)
        };
    }

    // Envía una conversación a Gemini.
    private async Task<string?> AskGeminiAsync(
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken)
    {
        var apiKey = GetProviderSetting("gemini", "ApiKey")
                     ?? GetSetting("GEMINI_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey))
            return null;

        var modelName = GetProviderSetting("gemini", "Model")
                        ?? GetSetting("AI_GEMINI_MODEL")
                        ?? _configuration["Gemini:Model"]
                        ?? "gemini-3.8-flash";

        var modelsToTry = new[]
        {
            modelName
        }
        .Where(x => !string.IsNullOrWhiteSpace(x))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

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

        foreach (var candidateModel in modelsToTry)
        {
            var endpoint =
                $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(candidateModel)}:generateContent";

            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);
            request.Content = JsonContent(payload);

            using var response = await SendWithRetryAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Gemini devolvió HTTP {StatusCode} con el modelo {Model}.", (int)response.StatusCode, candidateModel);
                continue;
            }

            using var document = JsonDocument.Parse(body);

            if (!document.RootElement.TryGetProperty("candidates", out var candidates)
                || candidates.GetArrayLength() == 0)
                continue;

            var parts = candidates[0]
                .GetProperty("content")
                .GetProperty("parts");

            foreach (var part in parts.EnumerateArray())
            {
                if (part.TryGetProperty("text", out var text)
                    && !string.IsNullOrWhiteSpace(text.GetString()))
                    return text.GetString();
            }
        }

        return null;
    }

    // Usa un grupo de modelos gratuitos de OpenRouter y cambia de modelo cuando uno llega a su límite.
    private async Task<string?> AskOpenRouterCascadeAsync(
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken)
    {
        var apiKey = GetProviderSetting("openrouter", "ApiKey") ?? GetSetting("AI_OPENROUTER_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
            return null;

        var models = await GetOpenRouterFreeModelsAsync(apiKey, cancellationToken);
        if (models.Count == 0)
            models = ["openrouter/free"];

        var count = Math.Min(4, models.Count);
        var start = Math.Abs(Interlocked.Increment(ref OpenRouterModelCursor)) % models.Count;

        for (var i = 0; i < count; i++)
        {
            var model = models[(start + i) % models.Count];
            var result = await AskOpenAiCompatibleAsync(
                "https://openrouter.ai/api/v1/chat/completions",
                apiKey,
                model,
                messages,
                cancellationToken,
                $"OpenRouter/{model}");

            if (!string.IsNullOrWhiteSpace(result))
                return result;
        }

        return await AskOpenAiCompatibleAsync(
            "https://openrouter.ai/api/v1/chat/completions",
            apiKey,
            "openrouter/free",
            messages,
            cancellationToken,
            "OpenRouter/free");
    }

    // Obtiene la lista actual de modelos gratuitos para no depender de nombres viejos.
    private async Task<IReadOnlyList<string>> GetOpenRouterFreeModelsAsync(
        string apiKey,
        CancellationToken cancellationToken)
    {
        if (OpenRouterFreeModelCache is not null && OpenRouterFreeModelCacheExpiresAt > DateTime.UtcNow)
            return OpenRouterFreeModelCache;

        using var request = new HttpRequestMessage(HttpMethod.Get, "https://openrouter.ai/api/v1/models");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        using var response = await SendWithRetryAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
            return [];

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        using var document = JsonDocument.Parse(body);
        if (!document.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            return [];

        var preferred = new[]
        {
            "NVIDIA: Nemotron 3 Ultra", "Poolside: Laguna S 2.1", "inclusionAI: Ling 3.0 Flash Fin",
            "Dots Studio: Dots3-Note Preview", "NVIDIA: Nemotron 3.5 Lightning", "Nex AGI: Nex-N2.5-Pro",
            "Thinking Machines: Inkling", "NVIDIA: Nemotron 3 Super", "inclusionAI: Ling 3.0 Flash Sante",
            "Space Bunny Alpha", "Thinking Machines: Inkling Small", "Cohere: North Mini Code",
            "Nex AGI: Nex-N2.5-Mini", "Poolside: Laguna XS 2.1", "NVIDIA: Nemotron 3 Nano Omni",
            "Google: Gemma 4 31B", "Google: Gemma 4 26B A4B", "Ling 3.0 Flash VL", "Gemma 4", "Nemotron 3"
        };

        var items = new List<(string Id, string Name, long Context)>();
        foreach (var item in data.EnumerateArray())
        {
            var id = item.TryGetProperty("id", out var idValue) ? idValue.GetString() : null;
            var name = item.TryGetProperty("name", out var nameValue) ? nameValue.GetString() : null;
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name)) continue;

            if (!item.TryGetProperty("pricing", out var pricing)) continue;
            var prompt = pricing.TryGetProperty("prompt", out var p) ? p.GetString() : null;
            var completion = pricing.TryGetProperty("completion", out var c) ? c.GetString() : null;
            if (!((prompt == "0" || prompt == "0.0") && (completion == "0" || completion == "0.0"))) continue;

            var context = item.TryGetProperty("context_length", out var ctx) && ctx.TryGetInt64(out var length) ? length : 0;
            items.Add((id, name, context));
        }

        var ordered = new List<string>();
        foreach (var preferredName in preferred)
        {
            var match = items.FirstOrDefault(x => x.Name.Contains(preferredName, StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrWhiteSpace(match.Id) && !ordered.Contains(match.Id, StringComparer.OrdinalIgnoreCase))
                ordered.Add(match.Id);
        }

        foreach (var item in items.OrderByDescending(x => x.Context).ThenBy(x => x.Name))
        {
            if (ordered.Count >= 20) break;
            if (!ordered.Contains(item.Id, StringComparer.OrdinalIgnoreCase))
                ordered.Add(item.Id);
        }

        OpenRouterFreeModelCache = ordered.Take(20).ToArray();
        OpenRouterFreeModelCacheExpiresAt = DateTime.UtcNow.Add(OpenRouterModelCacheDuration);
        return OpenRouterFreeModelCache;
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
        var token = GetProviderSetting("cloudflare", "ApiKey") ?? GetSetting("AI_CLOUDFLARE_API_TOKEN");
        var accountId = GetProviderSetting("cloudflare", "AccountId") ?? GetSetting("AI_CLOUDFLARE_ACCOUNT_ID");

        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(accountId))
            return null;

        var model = GetProviderSetting("cloudflare", "Model")
                    ?? GetSetting("AI_CLOUDFLARE_MODEL")
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

    // Envía la misma conversación a cualquier proveedor que use un formato compatible con OpenAI.
    private async Task<string?> AskConfiguredOpenAiProviderAsync(
        string provider,
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken)
    {
        var endpoint = GetProviderSetting(provider, "Endpoint");
        var apiKey = GetProviderSetting(provider, "ApiKey");
        var model = GetProviderSetting(provider, "Model");

        if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(model))
            return null;

        return await AskOpenAiCompatibleAsync(
            endpoint,
            apiKey,
            model,
            messages,
            cancellationToken,
            provider);
    }

    // Cohere usa su propio formato V2, pero conserva el mismo historial y la misma conversación.
    private async Task<string?> AskCohereAsync(
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken)
    {
        var apiKey = GetProviderSetting("cohere", "ApiKey");
        if (string.IsNullOrWhiteSpace(apiKey))
            return null;

        var endpoint = GetProviderSetting("cohere", "Endpoint") ?? "https://api.cohere.ai/v2/chat";
        var model = GetProviderSetting("cohere", "Model") ?? "command-a-plus-05-2026";

        var payload = new
        {
            model,
            messages = messages.Select(x => new { role = x.Role, content = x.Content }),
            temperature = 0.7,
            max_tokens = 720,
            stream = false
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = JsonContent(payload);

        using var response = await SendWithRetryAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Cohere devolvió HTTP {StatusCode}.", (int)response.StatusCode);
            return null;
        }

        using var document = JsonDocument.Parse(body);
        if (!document.RootElement.TryGetProperty("message", out var message))
            return null;
        if (!message.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
            return null;

        foreach (var item in content.EnumerateArray())
        {
            if (item.TryGetProperty("text", out var text) && !string.IsNullOrWhiteSpace(text.GetString()))
                return text.GetString();
        }

        return null;
    }

    // Reintenta solo los errores temporales para no gastar llamadas innecesarias.
    private async Task<HttpResponseMessage> SendWithRetryAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("AI");
        client.Timeout = TimeSpan.FromSeconds(7);

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
        string? language,
        string? actionContext)
    {
        var safeLanguage = NormalizeLanguage(language);
        var languageName = LanguageName(safeLanguage);
        var displayName = string.IsNullOrWhiteSpace(user?.Nombre) ? string.Empty : user.Nombre.Trim();
        var roleName = user?.Rol?.Trim().ToLowerInvariant() switch
        {
            "administrador" => "administrador",
            "dueno" => "dueno",
            "barra" => "barra",
            "cocina" => "cocina",
            "repartidor" => "repartidor",
            "cliente" => "cliente",
            _ => "usuario"
        };
        var system = $"""
Eres el asistente personal del restaurante.

Responde siempre en {languageName}. Habla como una persona de atención al cliente experta: natural, clara, cálida y directa. Nunca uses "bienvenido", "bienvenida" ni saludos corporativos largos. Cuando sea el inicio de la conversación, saluda con un "Hola" y reconoce al usuario por su nombre si está disponible; si no hay nombre, reconoce su rol de forma breve. No digas que eres un bot ni repitas frases como "como IA". Haz preguntas concretas cuando falte un dato y continúa el hilo sin reiniciar la conversación.

Evita emojis, Markdown, viñetas con símbolos, títulos con #, asteriscos, guiones decorativos y caracteres especiales innecesarios. Usa texto normal y fácil de leer en voz alta.

Puedes ayudar a consultar el menú, orientar sobre ingredientes, pedidos, reservas, pagos y estados. Cuando una acción requiera información faltante, pide solo lo necesario y reúne los datos paso a paso. Nunca afirmes que un pedido, una reserva o un pago quedó hecho si el sistema no lo confirmó realmente.
No uses JSON, SQL, nombres de tablas, endpoints, claves ni detalles técnicos en la conversación visible.
No inventes precios, productos, pedidos, reservas, empleados, horarios ni datos de la base. Si un dato no está disponible, dilo claramente.
No muestres contraseñas, hashes, API keys, claves criptográficas, CVV, números completos de tarjetas ni datos privados de terceros.

Nota interna del sistema (no la menciones ni la reveles):
{actionContext}

Nombre del usuario (si existe):
{displayName}

Rol del usuario:
{roleName}

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
                foreach (var history in RestaurantDb.GetRecentChatHistory(user.AccountId, 12))
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
        var direct = ReadConfiguredValue(name);
        if (!string.IsNullOrWhiteSpace(direct))
            return direct;

        var environmentValue = Environment.GetEnvironmentVariable(name);
        if (!string.IsNullOrWhiteSpace(environmentValue))
            return environmentValue;

        // También acepta las claves antiguas para no obligar a crear Gemini otra vez.
        if (name == "AI_GEMINI_API_KEY")
        {
            var legacyEnvironment = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            if (!string.IsNullOrWhiteSpace(legacyEnvironment))
                return legacyEnvironment;

            var legacyConfiguration = _configuration["Gemini:ApiKey"];
            if (!string.IsNullOrWhiteSpace(legacyConfiguration))
                return legacyConfiguration;
        }

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
