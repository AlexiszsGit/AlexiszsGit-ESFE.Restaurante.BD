using Microsoft.AspNetCore.Authentication;
using ESFE.RestauranteBD.web.UI.Data;
using ESFE.RestauranteBD.web.UI.Models;
using ESFE.RestauranteBD.web.UI.Services;
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers;

public class IniciarSesion1Controller : Controller
{
    private readonly EmailService _emailService;

    public IniciarSesion1Controller(EmailService emailService)
    {
        _emailService = emailService;
    }

    [HttpGet]
    // Carga la pantalla de acceso.
    public IActionResult Index() => View();

    [HttpPost]
    [ValidateAntiForgeryToken]
    // Inicia la sesión del usuario.
    public async Task<IActionResult> Login(string email, string password, bool remember = false)
    {
        var normalizedEmail = UserStore.NormalizeEmail(email);

        if (UserStore.TryGet(normalizedEmail, out var pendingUser, true)
            && pendingUser is not null
            && !pendingUser.EmailVerified)
        {
            ViewBag.Error = "Primero confirma tu correo. Puedes pedir un nuevo código desde aquí.";
            ViewBag.ActiveTab = "verify";
            ViewBag.VerificationEmail = normalizedEmail;
            return View("Index");
        }

        if (!UserStore.Authenticate(normalizedEmail, password, out var user) || user is null)
        {
            ViewBag.Error = "Correo o contraseña incorrectos.";
            ViewBag.Email = email;
            ViewBag.ActiveTab = "login";
            return View("Index");
        }

        await SignInUserAsync(user, remember);
        SetSession(user);

        TempData["UsuarioLogueado"] = user.Email;
        TempData["NombreUsuario"] = user.Nombre;
        TempData["LoginExitoso"] = "1";
        TempData["LoginWelcome"] = BuildWelcomeMessage(user.Rol);

        return RedirectToAction("Index", "Inicio1");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    // Crea una cuenta y envía el código de verificación.
    public async Task<IActionResult> Registrar(
        string nombre,
        string email,
        string codigoPais,
        string telefono,
        string dui,
        string direccion,
        string password,
        string confirmPassword)
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
            return RegisterError("El nombre solo puede contener letras, espacios, apóstrofes y guiones.", nombre, email, telefono, dui, direccion, codigoPais);

        if (!IsValidEmail(email))
            return RegisterError("Escribe un correo electrónico válido.", nombre, email, telefono, dui, direccion, codigoPais);

        if (!IsValidDui(dui))
            return RegisterError("El DUI debe tener el formato 00000000-0.", nombre, email, telefono, dui, direccion, codigoPais);

        if (string.IsNullOrWhiteSpace(codigoPais))
            return RegisterError("Selecciona un código de país.", nombre, email, telefono, dui, direccion, codigoPais);

        if (!TryNormalizeInternationalPhone(codigoPais, telefono, out var fullPhone))
            return RegisterError("El teléfono no corresponde al país seleccionado. Revisa la cantidad de dígitos.", nombre, email, telefono, dui, direccion, codigoPais);

        if (direccion.Length < 5)
            return RegisterError("Escribe una dirección válida.", nombre, email, telefono, dui, direccion, codigoPais);

        if (password.Length < 8 || !password.Any(char.IsUpper) || !password.Any(char.IsLower) || !password.Any(char.IsDigit))
            return RegisterError("La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.", nombre, email, telefono, dui, direccion, codigoPais);

        if (!string.Equals(password, confirmPassword, StringComparison.Ordinal))
            return RegisterError("Las contraseñas no coinciden.", nombre, email, telefono, dui, direccion, codigoPais);

        if (UserStore.All().Any(x => x.Dui.Equals(dui, StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(dui)))
            return RegisterError("Ese DUI ya está registrado.", nombre, email, telefono, dui, direccion, codigoPais);

        if (!_emailService.IsConfigured)
            return RegisterError("El correo del sistema todavía no está configurado en el servidor. No se creó la cuenta.", nombre, email, telefono, dui, direccion, codigoPais);

        var newUser = UserStore.Create(nombre, email, fullPhone, dui, direccion, "Cliente", password);
        newUser.EmailVerified = false;

        if (!UserStore.Add(newUser))
            return RegisterError("Ese correo ya tiene una cuenta registrada.", nombre, email, telefono, dui, direccion, codigoPais);

        if (!UserStore.TryGet(email, out var createdUser, true) || createdUser is null)
            return RegisterError("La cuenta se creó, pero no pudimos preparar la verificación. Intenta nuevamente.", nombre, email, telefono, dui, direccion, codigoPais);

        try
        {
            var code = CreateCode();
            RestaurantDb.SaveAuthCode(createdUser.AccountId, createdUser.Email, "EmailVerification", code, DateTime.UtcNow.AddMinutes(10));
            await _emailService.SendVerificationCodeAsync(createdUser.Email, createdUser.Nombre, code, HttpContext.RequestAborted);
        }
        catch
        {
            if (createdUser is not null)
            {
                createdUser.Activo = false;
                UserStore.Update(createdUser);
            }

            ViewBag.Error = "No pudimos entregar el código a ese correo. Revisa la dirección e inténtalo nuevamente.";
            ViewBag.ActiveTab = "register";
            ViewBag.RegisterName = nombre;
            ViewBag.RegisterEmail = email;
            ViewBag.RegisterPhone = telefono;
            ViewBag.RegisterDui = dui;
            ViewBag.RegisterAddress = direccion;
            ViewBag.RegisterCountryCode = codigoPais;
            return View("Index");
        }

        ViewBag.ActiveTab = "verify";
        ViewBag.VerificationEmail = email;
        ViewBag.Success = "Te enviamos un código de verificación a tu correo.";
        return View("Index");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    // Confirma el correo de una cuenta nueva.
    public IActionResult VerificarCorreo(string email, string code)
    {
        email = UserStore.NormalizeEmail(email);
        code = (code ?? string.Empty).Trim();

        if (!IsValidEmail(email) || !RegexCode(code))
            return VerificationError(email, "Escribe el código de 6 dígitos que recibiste.");

        if (!UserStore.TryGet(email, out var user, true) || user is null)
            return VerificationError(email, "No encontramos una cuenta pendiente de verificación.");

        try
        {
            if (!RestaurantDb.ValidateAuthCode(email, "EmailVerification", code))
                return VerificationError(email, "El código no es correcto o ya venció.");

            if (!RestaurantDb.ConfirmEmail(user.AccountId))
                return VerificationError(email, "No pudimos confirmar la cuenta. Intenta nuevamente.");

            user.EmailVerified = true;
            UserStore.Update(user);

            ViewBag.Success = "Correo confirmado correctamente. Ya puedes iniciar sesión.";
            ViewBag.CodeVerificationState = "success";
            ViewBag.ActiveTab = "login";
            ViewBag.Email = email;
            return View("Index");
        }
        catch
        {
            return VerificationError(email, "No pudimos confirmar el correo en este momento.");
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    // Envía nuevamente el código de verificación.
    public async Task<IActionResult> ReenviarCodigo(string email)
    {
        email = UserStore.NormalizeEmail(email);

        if (!_emailService.IsConfigured)
            return VerificationError(email, "El correo del sistema no está configurado en el servidor.");

        if (!UserStore.TryGet(email, out var user, true) || user is null)
            return VerificationError(email, "No encontramos una cuenta pendiente de verificación.");

        if (user.EmailVerified)
        {
            ViewBag.Success = "Esta cuenta ya está verificada. Puedes iniciar sesión.";
            ViewBag.ActiveTab = "login";
            ViewBag.Email = email;
            return View("Index");
        }

        try
        {
            var code = CreateCode();
            RestaurantDb.SaveAuthCode(user.AccountId, user.Email, "EmailVerification", code, DateTime.UtcNow.AddMinutes(10));
            await _emailService.SendVerificationCodeAsync(user.Email, user.Nombre, code, HttpContext.RequestAborted);
            ViewBag.Success = "Te enviamos un nuevo código de verificación.";
        }
        catch
        {
            ViewBag.Error = "No pudimos enviar el código. Revisa la configuración de correo del servidor.";
        }

        ViewBag.ActiveTab = "verify";
        ViewBag.VerificationEmail = email;
        return View("Index");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    // Envía el código para recuperar la contraseña.
    public async Task<IActionResult> SolicitarRecuperacion(string email)
    {
        email = UserStore.NormalizeEmail(email);

        if (!IsValidEmail(email))
        {
            ViewBag.Error = "Escribe un correo válido.";
            ViewBag.ActiveTab = "forgot";
            ViewBag.RecoveryEmail = email;
            return View("Index");
        }

        if (!_emailService.IsConfigured)
        {
            ViewBag.Error = "El correo del sistema todavía no está configurado.";
            ViewBag.ActiveTab = "forgot";
            ViewBag.RecoveryEmail = email;
            return View("Index");
        }

        if (!UserStore.TryGet(email, out var user, true) || user is null || !user.Activo || !user.EmailVerified)
        {
            ViewBag.Error = "No encontramos una cuenta activa con ese correo.";
            ViewBag.ActiveTab = "forgot";
            ViewBag.RecoveryEmail = email;
            return View("Index");
        }

        try
        {
            var code = CreateCode();
            RestaurantDb.SaveAuthCode(user.AccountId, user.Email, "PasswordReset", code, DateTime.UtcNow.AddMinutes(10));
            await _emailService.SendPasswordResetCodeAsync(user.Email, user.Nombre, code, HttpContext.RequestAborted);
            ViewBag.Success = "Código enviado. Revisa tu correo para continuar.";
            ViewBag.ActiveTab = "resetCode";
            ViewBag.RecoveryEmail = email;
            return View("Index");
        }
        catch
        {
            ViewBag.Error = "No pudimos enviar el código a ese correo. Revisa la configuración o inténtalo nuevamente.";
            ViewBag.ActiveTab = "forgot";
            ViewBag.RecoveryEmail = email;
            return View("Index");
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    // Comprueba el código antes de permitir cambiar la contraseña.
    public IActionResult VerificarRecuperacion(string email, string code)
    {
        email = UserStore.NormalizeEmail(email);
        code = (code ?? string.Empty).Trim();

        if (!RegexCode(code))
            return RecoveryCodeError(email, "Escribe el código de 6 dígitos que recibiste.");

        try
        {
            if (!RestaurantDb.ValidateAuthCode(email, "PasswordReset", code))
                return RecoveryCodeError(email, "El código no es correcto o ya venció.");

            if (!UserStore.TryGet(email, out var user, true) || user is null || !user.Activo)
                return RecoveryCodeError(email, "No pudimos validar esta cuenta.");

            HttpContext.Session.SetString("PasswordResetVerified", email);
            ViewBag.ActiveTab = "resetPassword";
            ViewBag.CodeVerificationState = "success";
            ViewBag.RecoveryEmail = email;
            return View("Index");
        }
        catch
        {
            return RecoveryCodeError(email, "No pudimos validar el código en este momento.");
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    // Guarda la nueva contraseña después de validar el código.
    public IActionResult RestablecerPassword(string email, string password, string confirmPassword)
    {
        email = UserStore.NormalizeEmail(email);
        var verifiedEmail = UserStore.NormalizeEmail(HttpContext.Session.GetString("PasswordResetVerified"));

        if (string.IsNullOrWhiteSpace(verifiedEmail) || !string.Equals(verifiedEmail, email, StringComparison.OrdinalIgnoreCase))
            return RecoveryCodeError(email, "La recuperación expiró. Solicita un código nuevo.");

        if (password.Length < 8 || !password.Any(char.IsUpper) || !password.Any(char.IsLower) || !password.Any(char.IsDigit))
            return ResetPasswordError(email, "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.");

        if (!string.Equals(password, confirmPassword, StringComparison.Ordinal))
            return ResetPasswordError(email, "Las contraseñas no coinciden.");

        if (!UserStore.TryGet(email, out var user, true) || user is null)
            return ResetPasswordError(email, "No encontramos la cuenta.");

        if (!UserStore.ChangePassword(user, password))
            return ResetPasswordError(email, "No pudimos cambiar la contraseña.");

        HttpContext.Session.Remove("PasswordResetVerified");
        ViewBag.Success = "Contraseña actualizada correctamente. Ya puedes iniciar sesión.";
        ViewBag.ActiveTab = "login";
        ViewBag.Email = email;
        return View("Index");
    }

    [HttpGet]
    // Cierra la sesión actual y elimina la sesión recordada.
    public async Task<IActionResult> CerrarSesion()
    {
        HttpContext.Session.Clear();
        TempData.Clear();
        await HttpContext.SignOutAsync(Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationDefaults.AuthenticationScheme);
        Response.Cookies.Delete("RestauranteBD.Remember");
        return RedirectToAction("Index");
    }

    // Inicia la sesión con una cookie de navegador o una cookie persistente.
    private async Task SignInUserAsync(UserAccount user, bool remember)
    {
        var claims = new List<System.Security.Claims.Claim>
        {
            new(System.Security.Claims.ClaimTypes.NameIdentifier, user.AccountId.ToString()),
            new(System.Security.Claims.ClaimTypes.Name, user.Email),
            new(System.Security.Claims.ClaimTypes.Role, user.Rol)
        };

        var identity = new System.Security.Claims.ClaimsIdentity(
            claims,
            Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationDefaults.AuthenticationScheme);

        var principal = new System.Security.Claims.ClaimsPrincipal(identity);

        await HttpContext.SignInAsync(
            Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new Microsoft.AspNetCore.Authentication.AuthenticationProperties
            {
                IsPersistent = remember,
                ExpiresUtc = remember ? DateTimeOffset.UtcNow.AddDays(30) : null,
                AllowRefresh = true
            });
    }

    // Prepara el mensaje que aparece al entrar según el tipo de usuario.
    private static string BuildWelcomeMessage(string rol)
    {
        return rol?.Trim().ToLowerInvariant() switch
        {
            "administrador" => "Bienvenido de nuevo. Tienes acceso al panel de administración.",
            "dueno" => "Bienvenido de nuevo. Aquí puedes revisar y administrar tu restaurante.",
            "barra" => "Bienvenido de nuevo. Ya puedes revisar y gestionar tus pedidos.",
            "cocina" => "Bienvenido de nuevo. Ya puedes revisar los pedidos de cocina.",
            "repartidor" => "Bienvenido de nuevo. Ya puedes revisar tus entregas.",
            "cliente" => "Bienvenido de nuevo. Ya puedes continuar con tus pedidos.",
            _ => "Bienvenido de nuevo."
        };
    }

    // Actualiza los datos que usa el resto de la aplicación durante la sesión.
    private void SetSession(UserAccount user)
    {
        HttpContext.Session.SetString("UsuarioLogueado", user.Email);
        HttpContext.Session.SetString("RolUsuario", user.Rol);
        HttpContext.Session.SetString("NombreUsuario", user.Nombre);
        HttpContext.Session.SetString("TelefonoUsuario", user.Telefono ?? string.Empty);
        HttpContext.Session.SetString("DuiUsuario", user.Dui ?? string.Empty);
        HttpContext.Session.SetString("DireccionUsuario", user.Direccion ?? string.Empty);
    }

    // Muestra un error sin perder los datos del formulario de registro.
    private IActionResult RegisterError(string message, string nombre, string email, string telefono, string dui, string direccion, string codigoPais = "503")
    {
        ViewBag.Error = message;
        ViewBag.ActiveTab = "register";
        ViewBag.RegisterName = nombre;
        ViewBag.RegisterEmail = email;
        ViewBag.RegisterPhone = telefono;
        ViewBag.RegisterDui = dui;
        ViewBag.RegisterAddress = direccion;
        ViewBag.RegisterCountryCode = string.IsNullOrWhiteSpace(codigoPais) ? "503" : codigoPais;
        return View("Index");
    }

    // Muestra el error de verificación.
    private IActionResult VerificationError(string email, string message)
    {
        ViewBag.Error = message;
        ViewBag.CodeVerificationState = "error";
        ViewBag.ActiveTab = "verify";
        ViewBag.VerificationEmail = email;
        return View("Index");
    }

    // Muestra el error del código de recuperación.
    private IActionResult RecoveryCodeError(string email, string message)
    {
        ViewBag.Error = message;
        ViewBag.CodeVerificationState = "error";
        ViewBag.ActiveTab = "resetCode";
        ViewBag.RecoveryEmail = email;
        return View("Index");
    }

    // Muestra un error al crear la nueva contraseña.
    private IActionResult ResetPasswordError(string email, string message)
    {
        ViewBag.Error = message;
        ViewBag.ActiveTab = "resetPassword";
        ViewBag.RecoveryEmail = email;
        return View("Index");
    }

    // Genera un código corto para los correos de seguridad.
    private static string CreateCode() => Random.Shared.Next(100000, 1000000).ToString();

    // Comprueba que el código tenga exactamente seis números.
    private static bool RegexCode(string code) => System.Text.RegularExpressions.Regex.IsMatch(code ?? "", @"^\d{6}$");

    // Comprueba que el correo tenga un formato válido.
    private static bool IsValidEmail(string email)
    {
        try
        {
            var address = new System.Net.Mail.MailAddress(email);
            return address.Address.Equals(email, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    // Comprueba que el nombre cumpla el formato permitido.
    private static bool IsValidName(string value) =>
        System.Text.RegularExpressions.Regex.IsMatch(value, @"^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ])[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,80}$");

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

    // Normaliza el teléfono con el código del país seleccionado.
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

        if (string.IsNullOrWhiteSpace(rule.Code))
            return false;

        var digits = new string((number ?? string.Empty).Where(char.IsDigit).ToArray());

        if (digits.StartsWith(rule.Code, StringComparison.Ordinal) && !rule.Code.Equals("1") && digits.Length > rule.Max)
            digits = digits[rule.Code.Length..];

        if (rule.Code.Equals("1") && digits.Length > rule.Max && digits.StartsWith("1", StringComparison.Ordinal))
            digits = digits[1..];

        if (digits.Length < rule.Min || digits.Length > rule.Max)
            return false;

        var grouped = digits;
        if (rule.Groups.Length > 0)
        {
            var parts = new List<string>();
            var cursor = 0;

            foreach (var size in rule.Groups)
            {
                if (cursor >= digits.Length)
                    break;

                var take = Math.Min(size, digits.Length - cursor);
                parts.Add(digits.Substring(cursor, take));
                cursor += take;
            }

            if (cursor < digits.Length)
                parts.Add(digits[cursor..]);

            grouped = string.Join(" ", parts);
        }

        normalized = $"+{rule.Code} {grouped}";
        return true;
    }

    // Comprueba que el DUI cumpla el formato permitido.
    private static bool IsValidDui(string dui) =>
        System.Text.RegularExpressions.Regex.IsMatch(dui, @"^\d{8}-\d$");
}
