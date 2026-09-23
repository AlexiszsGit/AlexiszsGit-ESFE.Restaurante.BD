
using Microsoft.AspNetCore.Mvc;
using ESFE.RestauranteBD.web.UI.Models;

namespace ESFE.RestauranteBD.web.UI.Controllers;

public class IniciarSesion1Controller : Controller
{
    [HttpGet]
    // Carga la vista principal del módulo.
    public IActionResult Index() => View();

    [HttpPost]
    [ValidateAntiForgeryToken]
    // Procesa la información de login.
    public IActionResult Login(string email, string password, bool remember = false)
    {
        var normalizedEmail = UserStore.NormalizeEmail(email);
        if (!UserStore.Authenticate(normalizedEmail, password, out var user) || user is null)
        {
            ViewBag.Error = "Correo o contraseña incorrectos.";
            ViewBag.Email = email;
            ViewBag.ActiveTab = "login";
            return View("Index");
        }

        SetSession(user);
        TempData["UsuarioLogueado"] = user.Email;
        TempData["NombreUsuario"] = user.Nombre;
        TempData["LoginExitoso"] = "1";
        TempData["LoginWelcome"] = BuildWelcomeMessage(user.Rol);

        if (remember)
            Response.Cookies.Append(
                "RestauranteBD.Remember",
                user.Email,
                new CookieOptions
                {
                    HttpOnly = false,
                    IsEssential = true,
                    MaxAge = TimeSpan.FromDays(30),
                    SameSite = SameSiteMode.Lax,
                    Secure = Request.IsHttps
                });
        else Response.Cookies.Delete("RestauranteBD.Remember");

        return RedirectToAction("Index", "Inicio1");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    // Procesa la información de registrar.
    public IActionResult Registrar(string nombre, string email, string codigoPais, string telefono, string dui, string direccion, string password, string confirmPassword)
    {
        nombre = (nombre ?? string.Empty).Trim();
        email = UserStore.NormalizeEmail(email);
        codigoPais = (codigoPais ?? string.Empty).Trim();
        telefono = (telefono ?? string.Empty).Trim();
        dui = (dui ?? string.Empty).Trim();
        direccion = (direccion ?? string.Empty).Trim();
        password ??= string.Empty;
        confirmPassword ??= string.Empty;

        if (!IsValidName(nombre))
        {
            return RegisterError(
                "El nombre solo puede contener letras, espacios, apóstrofes y guiones.",
                nombre, email, telefono, dui, direccion, codigoPais);
        }
        if (!IsValidEmail(email)) return RegisterError("Escribe un correo electrónico válido.", nombre, email, telefono, dui, direccion, codigoPais);
        if (!IsValidDui(dui)) return RegisterError("El DUI debe tener el formato 00000000-0.", nombre, email, telefono, dui, direccion, codigoPais);
        if (string.IsNullOrWhiteSpace(codigoPais)) return RegisterError("Selecciona un código de país.", nombre, email, telefono, dui, direccion, codigoPais);
        if (!TryNormalizeInternationalPhone(codigoPais, telefono, out var fullPhone))
        {
            return RegisterError(
                "El teléfono no corresponde al país seleccionado. Revisa la cantidad de dígitos.",
                nombre, email, telefono, dui, direccion, codigoPais);
        }
        if (direccion.Length < 5) return RegisterError("Escribe una dirección válida.", nombre, email, telefono, dui, direccion, codigoPais);
        if (password.Length < 8
            || !password.Any(char.IsUpper)
            || !password.Any(char.IsLower)
            || !password.Any(char.IsDigit))
        {
            return RegisterError(
                "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.",
                nombre, email, telefono, dui, direccion, codigoPais);
        }
        if (!string.Equals(password, confirmPassword, StringComparison.Ordinal))
        {
            return RegisterError(
                "Las contraseñas no coinciden.",
                nombre, email, telefono, dui, direccion, codigoPais);
        }
        if (UserStore.All().Any(x =>
                x.Dui.Equals(dui, StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(dui)))
        {
            return RegisterError(
                "Ese DUI ya está registrado.",
                nombre, email, telefono, dui, direccion, codigoPais);
        }
        if (!UserStore.Add(UserStore.Create(nombre, email, fullPhone, dui, direccion, "Cliente", password)))
        {
            return RegisterError(
                "Ese correo ya tiene una cuenta registrada.",
                nombre, email, telefono, dui, direccion, codigoPais);
        }

        ViewBag.Success = "Cuenta creada correctamente. Ahora puedes iniciar sesión.";
        ViewBag.ActiveTab = "login";
        ViewBag.Email = email;
        return View("Index");
    }

    [HttpGet]
    // Cierra la sesión actual y limpia sus datos temporales.
    public IActionResult CerrarSesion()
    {
        HttpContext.Session.Clear();
        TempData.Clear();
        Response.Cookies.Delete("RestauranteBD.Remember");
        return RedirectToAction("Index");
    }

    // Procesa la información de build welcome message.
    private static string BuildWelcomeMessage(string role)
    {
        var messages = role switch
        {
            "Administrador" => new[]
            {
                "Bienvenido al panel administrativo.",
                "Puedes administrar el menú, pedidos, personal, pagos y reportes."
            },
            "Dueno" => new[]
            {
                "Bienvenido nuevamente. Es un gusto recibirte; el panel de administración está listo.",
                "Nos alegra tenerte de nuevo. Todo está preparado para continuar con la gestión del restaurante.",
                "Es un placer recibirte otra vez. La operación del restaurante está lista para continuar."
            },
            "Cocina" => new[]
            {
                "Bienvenido nuevamente. Es un gusto recibirte; el área de cocina está lista para continuar.",
                "Nos alegra tenerte de nuevo. Las órdenes están listas para continuar su proceso en cocina.",
                "Es un placer recibirte otra vez. Tu estación está preparada para continuar el servicio."
            },
            "Barra" => new[]
            {
                "Bienvenido nuevamente. Es un gusto recibirte; la atención en barra está lista para continuar.",
                "Nos alegra tenerte de nuevo. Pedidos y reservas están preparados para la jornada.",
                "Es un placer recibirte otra vez. La operación de barra está lista para continuar."
            },
            "Delivery" => new[]
            {
                "Bienvenido nuevamente. Es un gusto recibirte; las entregas están listas para continuar.",
                "Nos alegra tenerte de nuevo. Los pedidos disponibles están preparados para entrega.",
                "Es un placer recibirte otra vez. El servicio de entregas está listo para continuar."
            },
            "Mesero" => new[]
            {
                "Bienvenido nuevamente. Es un gusto recibirte; la atención en sala está lista para continuar.",
                "Nos alegra tenerte de nuevo. Las mesas y pedidos están preparados para tu jornada.",
                "Es un placer recibirte otra vez. El servicio en sala está listo para continuar."
            },
            _ => new[]
            {
                "Bienvenido nuevamente. Es un gusto tenerte de vuelta en RestauranteBD.",
                "Nos alegra recibirte otra vez. Tu cuenta está lista para continuar.",
                "Es un placer tenerte de nuevo. Tu experiencia en RestauranteBD continúa desde aquí."
            }
        };
        return messages[Random.Shared.Next(messages.Length)];
    }

    // Actualiza los datos de sesión del usuario autenticado.
    private void SetSession(UserAccount user)
    {
        HttpContext.Session.SetString("UsuarioLogueado", user.Email);
        HttpContext.Session.SetString("RolUsuario", user.Rol);
        HttpContext.Session.SetString("NombreUsuario", user.Nombre);
        HttpContext.Session.SetString("TelefonoUsuario", user.Telefono ?? string.Empty);
        HttpContext.Session.SetString("DuiUsuario", user.Dui ?? string.Empty);
        HttpContext.Session.SetString("DireccionUsuario", user.Direccion ?? string.Empty);
    }

    // Muestra el error ocurrido durante el registro.
    private IActionResult RegisterError(string message, string nombre, string email, string telefono, string dui, string direccion, string codigoPais = "503")
    {
        ViewBag.Error = message;
        ViewBag.ActiveTab = "register";
        ViewBag.RegisterName = nombre;
        ViewBag.RegisterEmail = email;
        ViewBag.RegisterPhone = telefono;
        ViewBag.RegisterDui = dui;
        ViewBag.RegisterAddress = direccion;
        ViewBag.RegisterCountryCode = string.IsNullOrWhiteSpace(codigoPais)
            ? "503"
            : codigoPais;
        return View("Index");
    }

    // Comprueba que el correo tenga un formato válido.
    private static bool IsValidEmail(string email)
    {
        try
        {
            var address = new System.Net.Mail.MailAddress(email);
            return address.Address.Equals(email, StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    // Comprueba que el nombre cumpla el formato permitido.
    private static bool IsValidName(string value) =>
        System.Text.RegularExpressions.Regex.IsMatch(
            value,
            @"^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ])[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,80}$");

    private static readonly Dictionary<string, (string Code, int Min, int Max, int[] Groups)> PhoneRules = new(StringComparer.OrdinalIgnoreCase)
    {
        ["sv"] = ("503", 8, 8, [4, 4]), ["gt"] = ("502", 8, 8, [4, 4]), ["hn"] = ("504", 8, 8, [4, 4]),
        ["ni"] = ("505", 8, 8, [4, 4]), ["cr"] = ("506", 8, 8, [4, 4]), ["pa"] = ("507", 8, 8, [4, 4]),
        ["mx"] = ("52", 10, 10, [3, 3, 4]), ["us"] = ("1", 10, 10, [3, 3, 4]), ["ca"] = ("1", 10, 10, [3, 3, 4]),
        ["do"] = ("1", 10, 10, [3, 3, 4]), ["pr"] = ("1", 10, 10, [3, 3, 4]), ["es"] = ("34", 9, 9, [3, 3, 3]),
        ["ar"] = ("54", 10, 10, [3, 3, 2, 2]), ["bo"] = ("591", 8, 8, [4, 4]), ["br"] = ("55", 10, 11, [2, 5, 4]),
        ["cl"] = ("56", 9, 9, [3, 3, 3]), ["co"] = ("57", 10, 10, [3, 3, 4]), ["ec"] = ("593", 9, 9, [3, 3, 3]),
        ["pe"] = ("51", 9, 9, [3, 3, 3]), ["py"] = ("595", 9, 9, [3, 3, 3]), ["uy"] = ("598", 8, 8, [3, 4, 1]),
        ["ve"] = ("58", 10, 10, [3, 3, 4]), ["cu"] = ("53", 8, 8, [4, 4]), ["gb"] = ("44", 10, 11, [4, 3, 4]),
        ["fr"] = ("33", 9, 9, [1, 2, 2, 2, 2]), ["de"] = ("49", 10, 11, [3, 3, 4]), ["it"] = ("39", 9, 10, [3, 3, 3]),
        ["jp"] = ("81", 10, 10, [2, 4, 4]), ["cn"] = ("86", 11, 11, [3, 4, 4]), ["in"] = ("91", 10, 10, [5, 5]),
        ["au"] = ("61", 9, 9, [1, 4, 4]), ["nz"] = ("64", 9, 10, [2, 3, 4]), ["za"] = ("27", 9, 9, [3, 3, 3]),
        ["kr"] = ("82", 9, 10, [2, 3, 4])
    };

    // Procesa la información de try normalize international phone.
    private static bool TryNormalizeInternationalPhone(string countryIdOrCode, string number, out string normalized)
    {
        normalized = string.Empty;
        var raw = (countryIdOrCode ?? string.Empty).Trim().TrimStart('+').ToLowerInvariant();
        var rule = PhoneRules.FirstOrDefault(x => x.Key.Equals(raw, StringComparison.OrdinalIgnoreCase)).Value;
        if (string.IsNullOrWhiteSpace(rule.Code))
        {
            var digitsCode = new string(raw.Where(char.IsDigit).ToArray());
            rule = PhoneRules.FirstOrDefault(x => x.Value.Code == digitsCode).Value;
        }
        if (string.IsNullOrWhiteSpace(rule.Code)) return false;

        var digits = new string((number ?? string.Empty).Where(char.IsDigit).ToArray());
        // A user may paste the complete international number. Strip the selected calling code once.
        if (digits.StartsWith(rule.Code, StringComparison.Ordinal) && !rule.Code.Equals("1") && digits.Length > rule.Max)
            digits = digits[rule.Code.Length..];
        if (rule.Code.Equals("1") && digits.Length > rule.Max && digits.StartsWith("1", StringComparison.Ordinal))
            digits = digits[1..];
        if (digits.Length < rule.Min || digits.Length > rule.Max) return false;

        var grouped = digits;
        var groups = rule.Groups;
        if (groups.Length > 0)
        {
            var parts = new List<string>(); var cursor = 0;
            foreach (var size in groups)
            {
                if (cursor >= digits.Length) break;
                var take = Math.Min(size, digits.Length - cursor);
                parts.Add(digits.Substring(cursor, take)); cursor += take;
            }
            if (cursor < digits.Length) parts.Add(digits[cursor..]);
            grouped = string.Join(" ", parts);
        }
        normalized = $"+{rule.Code} {grouped}";
        return true;
    }

    // Comprueba que el DUI cumpla el formato permitido.
    private static bool IsValidDui(string dui) =>
        System.Text.RegularExpressions.Regex.IsMatch(dui, @"^\d{8}-\d$");
}
