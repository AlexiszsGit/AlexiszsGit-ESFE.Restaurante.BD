using System.Globalization;
using System.Text;
using System.Text.Json;
using ESFE.RestauranteBD.web.UI.Data;
using ESFE.RestauranteBD.web.UI.Models;

namespace ESFE.RestauranteBD.web.UI.Services;

// Detecta acciones sencillas de pedido para que el chatbot pueda usar las funciones reales de la página.
public sealed class ChatOrderAgent
{
    public ChatActionResult Process(
        UserAccount user,
        string question,
        JsonElement cartElement,
        JsonElement draftElement)
    {
        if (!string.Equals(user.Rol, "Cliente", StringComparison.OrdinalIgnoreCase))
            return ChatActionResult.Empty;

        var text = Normalize(question);

        if (string.IsNullOrWhiteSpace(text))
            return ChatActionResult.Empty;

        var cart = ReadCart(cartElement);
        var draft = ReadDraft(draftElement);

        var actions = new List<object>();
        var notes = new List<string>();

        ApplyOrderType(text, draft);
        ApplyDeliveryData(text, draft);
        ApplyPayment(text, draft);

        if (LooksLikeOrderRequest(text))
        {
            var product = FindProduct(text);

            if (product is not null)
            {
                var quantity = DetectQuantity(text);

                var existing = cart.FirstOrDefault(x =>
                    x.Name.Equals(
                        product.Name,
                        StringComparison.OrdinalIgnoreCase));

                if (existing is not null)
                {
                    var updatedQuantity = Math.Min(
                        20,
                        existing.Quantity + quantity);

                    var index = cart.IndexOf(existing);

                    cart[index] = existing with
                    {
                        Quantity = updatedQuantity
                    };
                }
                else
                {
                    cart.Add(
                        new ChatCartItem(
                            product.ProductId,
                            product.Name,
                            product.Price,
                            quantity));
                }

                actions.Add(new
                {
                    type = "cart.replace",
                    cart = cart.Select(x => new
                    {
                        productId = $"db-{x.ProductId}",
                        dbId = x.ProductId,
                        name = x.Name,
                        price = x.Price,
                        qty = x.Quantity
                    }).ToArray()
                });

                draft.Awaiting =
                    string.IsNullOrWhiteSpace(draft.OrderType)
                        ? "orderType"
                        : string.IsNullOrWhiteSpace(draft.PaymentMethod)
                            ? "payment"
                            : "confirm";

                notes.Add(
                    $"Se agrego al carrito {quantity} unidad(es) de {product.Name}. " +
                    "El carrito visible debe actualizarse. " +
                    "No digas que el pedido ya esta creado. " +
                    "Si falta el tipo de pedido, pregunta si lo quiere para llevar o a domicilio.");
            }
        }

        if (text.Contains("carrito vacio")
            || text.Contains("vaciar carrito")
            || text.Contains("borra el carrito"))
        {
            cart.Clear();

            actions.Add(
                new
                {
                    type = "cart.replace",
                    cart = Array.Empty<object>()
                });

            draft = new ChatDraft();

            notes.Add(
                "El carrito fue vaciado. Confirma esto brevemente y pregunta si necesita otra cosa.");
        }

        if (cart.Count > 0)
        {
            if (draft.OrderType is null && NeedsCheckout(text))
            {
                draft.Awaiting = "orderType";

                notes.Add(
                    "Hay productos listos para comprar. " +
                    "Pregunta solamente si lo quiere para llevar, en mesa o a domicilio.");
            }

            if (string.Equals(
                    draft.OrderType,
                    "Domicilio",
                    StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(draft.Address)
                    && string.IsNullOrWhiteSpace(user.Direccion))
                {
                    draft.Awaiting = "address";

                    notes.Add(
                        "Para el domicilio falta la direccion. Pidela de forma directa.");
                }
                else if (string.IsNullOrWhiteSpace(draft.Phone)
                    && string.IsNullOrWhiteSpace(user.Telefono))
                {
                    draft.Awaiting = "phone";

                    notes.Add(
                        "Para el domicilio falta el telefono. Pidelo de forma directa.");
                }
                else if (string.IsNullOrWhiteSpace(draft.PaymentMethod))
                {
                    draft.Awaiting = "payment";

                    notes.Add(
                        "Los datos de entrega estan completos. " +
                        "Pregunta si pagara en efectivo, tarjeta o transferencia.");
                }
            }
            else if (!string.IsNullOrWhiteSpace(draft.OrderType)
                && string.IsNullOrWhiteSpace(draft.PaymentMethod)
                && NeedsCheckout(text))
            {
                draft.Awaiting = "payment";

                notes.Add(
                    "Pregunta si pagara en efectivo, tarjeta o transferencia.");
            }

            if (!string.IsNullOrWhiteSpace(draft.PaymentMethod)
                && LooksLikeConfirmation(text))
            {
                if (string.IsNullOrWhiteSpace(draft.OrderType))
                {
                    draft.Awaiting = "orderType";

                    notes.Add(
                        "Antes de confirmar el pedido falta saber si sera para llevar, " +
                        "en mesa o a domicilio. Preguntalo de forma breve.");
                }
                else if (string.Equals(
                    draft.PaymentMethod,
                    "Efectivo",
                    StringComparison.OrdinalIgnoreCase))
                {
                    actions.Add(
                        new
                        {
                            type = "checkout.open",
                            method = "Efectivo",
                            orderType = draft.OrderType ?? "Para llevar",
                            phone = draft.Phone ?? user.Telefono,
                            address = draft.Address ?? user.Direccion,
                            autoSubmit = true
                        });

                    notes.Add(
                        "El cliente confirmo el pedido y eligio efectivo. " +
                        "Abre el pago con efectivo y registra el pedido. " +
                        "El pago queda pendiente hasta que el efectivo sea recibido; " +
                        "nunca digas que ya esta pagado.");

                    draft.Awaiting = "completed";
                }
                else
                {
                    actions.Add(
                        new
                        {
                            type = "checkout.open",
                            method = draft.PaymentMethod,
                            orderType = draft.OrderType ?? "Para llevar",
                            phone = draft.Phone ?? user.Telefono,
                            address = draft.Address ?? user.Direccion,
                            autoSubmit = false
                        });

                    notes.Add(
                        "El cliente confirmo. " +
                        "Abre el formulario real de pago con el metodo elegido. " +
                        "No digas que el pago ya se completo hasta que el formulario lo confirme.");

                    draft.Awaiting = "paymentScreen";
                }
            }
        }

        var handled = actions.Count > 0 || notes.Count > 0;

        return new ChatActionResult(
            handled,
            string.Join(
                "\n",
                notes.Where(x => !string.IsNullOrWhiteSpace(x))),
            actions,
            draft);
    }

    private MenuCatalogMatch? FindProduct(string normalizedText)
    {
        if (!RestaurantDb.IsConfigured)
            return null;

        List<RestaurantDb.MenuCatalogItem> products;

        try
        {
            products = RestaurantDb.GetMenuCatalog();
        }
        catch
        {
            return null;
        }

        MenuCatalogMatch? best = null;

        foreach (var product in products.Where(x => x.IsAvailable))
        {
            var name = Normalize(product.Name);

            var words = SignificantWords(name).ToArray();

            var score = words.Count(
                word => normalizedText.Contains(
                    word,
                    StringComparison.OrdinalIgnoreCase));

            if (score == 0)
                continue;

            if (normalizedText.Contains(
                    name,
                    StringComparison.OrdinalIgnoreCase))
            {
                score += 4;
            }

            if (best is null || score > best.Score)
            {
                best = new MenuCatalogMatch(
                    product.ProductId,
                    product.Name,
                    product.Price,
                    score);
            }
        }

        if (best is null || best.Score < 1)
            return null;

        return best;
    }

    private static void ApplyOrderType(
        string text,
        ChatDraft draft)
    {
        if (text.Contains(
                "domicilio",
                StringComparison.OrdinalIgnoreCase)
            || text.Contains(
                "a casa",
                StringComparison.OrdinalIgnoreCase)
            || text.Contains(
                "que me lo lleven",
                StringComparison.OrdinalIgnoreCase))
        {
            draft.OrderType = "Domicilio";
        }
        else if (text.Contains(
                     "para llevar",
                     StringComparison.OrdinalIgnoreCase)
                 || text.Contains(
                     "recoger",
                     StringComparison.OrdinalIgnoreCase)
                 || text.Contains(
                     "paso por el",
                     StringComparison.OrdinalIgnoreCase))
        {
            draft.OrderType = "Para llevar";
        }
        else if (text.Contains(
                     "en mesa",
                     StringComparison.OrdinalIgnoreCase)
                 || text.Contains(
                     "en el restaurante",
                     StringComparison.OrdinalIgnoreCase))
        {
            draft.OrderType = "Mesa";
        }
    }

    private static void ApplyDeliveryData(
        string text,
        ChatDraft draft)
    {
        var phone = System.Text.RegularExpressions.Regex.Match(
            text,
            @"(?:telefono|tel|celular)\s*[:#-]?\s*(\d{7,15})",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        if (phone.Success)
            draft.Phone = phone.Groups[1].Value;

        var address = System.Text.RegularExpressions.Regex.Match(
            text,
            @"(?:direccion|ubicacion)\s*[:#-]?\s*(.{6,100})$",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        if (address.Success)
            draft.Address = address.Groups[1].Value.Trim();
    }

    private static void ApplyPayment(
        string text,
        ChatDraft draft)
    {
        if (text.Contains(
                "en efectivo",
                StringComparison.OrdinalIgnoreCase)
            || text.Contains(
                "efectivo",
                StringComparison.OrdinalIgnoreCase))
        {
            draft.PaymentMethod = "Efectivo";
        }
        else if (text.Contains(
                     "tarjeta",
                     StringComparison.OrdinalIgnoreCase)
                 || text.Contains(
                     "con tarjeta",
                     StringComparison.OrdinalIgnoreCase))
        {
            draft.PaymentMethod = "Tarjeta";
        }
        else if (text.Contains(
                     "transferencia",
                     StringComparison.OrdinalIgnoreCase))
        {
            draft.PaymentMethod = "Transferencia";
        }
    }

    private static int DetectQuantity(string text)
    {
        var match = System.Text.RegularExpressions.Regex.Match(
            text,
            @"\b(\d{1,2})\b");

        if (match.Success
            && int.TryParse(
                match.Groups[1].Value,
                out var number))
        {
            return Math.Clamp(number, 1, 20);
        }

        foreach (var pair in new Dictionary<string, int>(
            StringComparer.OrdinalIgnoreCase)
        {
            ["una"] = 1,
            ["un"] = 1,
            ["dos"] = 2,
            ["tres"] = 3,
            ["cuatro"] = 4,
            ["cinco"] = 5,
            ["seis"] = 6,
            ["siete"] = 7,
            ["ocho"] = 8,
            ["nueve"] = 9,
            ["diez"] = 10
        })
        {
            if (text.Contains(
                    pair.Key,
                    StringComparison.OrdinalIgnoreCase))
            {
                return pair.Value;
            }
        }

        return 1;
    }

    private static bool LooksLikeOrderRequest(
        string text) =>
        text.Contains(
            "quiero",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "quiero pedir",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "pide",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "pedir",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "ordena",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "agrega",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "añade",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "dame",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "anade",
            StringComparison.OrdinalIgnoreCase);

    private static bool NeedsCheckout(
        string text) =>
        text.Contains(
            "pedido",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "pagar",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "comprar",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "terminar",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "finalizar",
            StringComparison.OrdinalIgnoreCase)
        || text.Contains(
            "checkout",
            StringComparison.OrdinalIgnoreCase);

    private static bool LooksLikeConfirmation(
        string text) =>
        text is "si"
        or "sí"
        or "confirmo"
        or "confirmar"
        or "dale"
        or "hazlo"
        or "procede"
        or "ok"
        or "okay";

    private static List<ChatCartItem> ReadCart(
        JsonElement element)
    {
        var result = new List<ChatCartItem>();

        if (element.ValueKind != JsonValueKind.Array)
            return result;

        foreach (var item in element.EnumerateArray())
        {
            var name =
                item.TryGetProperty(
                    "name",
                    out var nameElement)
                    ? nameElement.GetString()
                    : null;

            var price =
                item.TryGetProperty(
                    "price",
                    out var priceElement)
                && priceElement.TryGetDecimal(
                    out var value)
                    ? value
                    : 0m;

            var qty =
                item.TryGetProperty(
                    "qty",
                    out var qtyElement)
                && qtyElement.TryGetInt32(
                    out var amount)
                    ? amount
                    : 1;

            var dbId =
                item.TryGetProperty(
                    "dbId",
                    out var dbElement)
                && dbElement.TryGetInt32(
                    out var id)
                    ? id
                    : 0;

            if (!string.IsNullOrWhiteSpace(name)
                && price >= 0
                && dbId > 0)
            {
                result.Add(
                    new ChatCartItem(
                        dbId,
                        name,
                        price,
                        Math.Clamp(qty, 1, 20)));
            }
        }

        return result;
    }

    private static ChatDraft ReadDraft(
        JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object)
            return new ChatDraft();

        return new ChatDraft
        {
            OrderType = ReadString(
                element,
                "orderType"),

            Phone = ReadString(
                element,
                "phone"),

            Address = ReadString(
                element,
                "address"),

            PaymentMethod = ReadString(
                element,
                "paymentMethod"),

            Awaiting = ReadString(
                element,
                "awaiting")
        };
    }

    private static string? ReadString(
        JsonElement element,
        string property) =>
        element.TryGetProperty(
            property,
            out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static IEnumerable<string> SignificantWords(
        string value) =>
        value.Split(
                ' ',
                StringSplitOptions.RemoveEmptyEntries
                | StringSplitOptions.TrimEntries)
            .Where(
                x => x.Length >= 4
                     && !new[]
                     {
                         "para",
                         "con",
                         "del",
                         "las",
                         "los",
                         "una",
                         "uno",
                         "como",
                         "casa"
                     }.Contains(x));

    private static string Normalize(
        string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var normalized =
            value.Normalize(
                NormalizationForm.FormD);

        var builder =
            new StringBuilder(
                normalized.Length);

        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c)
                != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(
                    char.ToLowerInvariant(c));
            }
        }

        return builder
            .ToString()
            .Normalize(
                NormalizationForm.FormC);
    }

    private sealed record MenuCatalogMatch(
        int ProductId,
        string Name,
        decimal Price,
        int Score);

    private sealed record ChatCartItem(
        int ProductId,
        string Name,
        decimal Price,
        int Quantity);

    public sealed class ChatDraft
    {
        public string? OrderType { get; set; }

        public string? Phone { get; set; }

        public string? Address { get; set; }

        public string? PaymentMethod { get; set; }

        public string? Awaiting { get; set; }
    }
}

public sealed record ChatActionResult(
    bool Handled,
    string SystemNote,
    IReadOnlyList<object> Actions,
    ChatOrderAgent.ChatDraft Draft)
{
    public static ChatActionResult Empty =>
        new(
            false,
            string.Empty,
            Array.Empty<object>(),
            new ChatOrderAgent.ChatDraft());
}