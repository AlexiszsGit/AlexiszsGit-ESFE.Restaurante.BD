using Microsoft.AspNetCore.Mvc;
using ESFE.RestauranteBD.web.UI.Models;

namespace ESFE.RestauranteBD.web.UI.Controllers;

public class IniciarSesion1Controller : Controller
{
    [HttpGet]
    public IActionResult Index() => View();

    [HttpPost]
    [ValidateAntiForgeryToken]
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

        if (remember)
            Response.Cookies.Append("RestauranteBD.Remember", user.Email, new CookieOptions { HttpOnly = false, IsEssential = true, MaxAge = TimeSpan.FromDays(30), SameSite = SameSiteMode.Lax, Secure = Request.IsHttps });
        else Response.Cookies.Delete("RestauranteBD.Remember");

        return RedirectToAction("Index", "Inicio1");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
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

        if (!IsValidName(nombre)) return RegisterError("El nombre solo puede contener letras, espacios, apóstrofes y guiones.", nombre, email, telefono, dui, direccion);
        if (!IsValidEmail(email)) return RegisterError("Escribe un correo electrónico válido.", nombre, email, telefono, dui, direccion);
        if (!IsValidDui(dui)) return RegisterError("El DUI debe tener el formato 00000000-0.", nombre, email, telefono, dui, direccion);
        var fullPhone = NormalizeInternationalPhone(codigoPais, telefono);
        if (!IsValidPhone(fullPhone)) return RegisterError("El teléfono debe tener un código de país y una numeración válida.", nombre, email, telefono, dui, direccion);
        if (direccion.Length < 5) return RegisterError("Escribe una dirección válida.", nombre, email, telefono, dui, direccion);
        if (password.Length < 8 || !password.Any(char.IsUpper) || !password.Any(char.IsLower) || !password.Any(char.IsDigit)) return RegisterError("La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.", nombre, email, telefono, dui, direccion);
        if (!string.Equals(password, confirmPassword, StringComparison.Ordinal)) return RegisterError("Las contraseñas no coinciden.", nombre, email, telefono, dui, direccion);
        if (UserStore.All().Any(x => x.Dui.Equals(dui, StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(dui))) return RegisterError("Ese DUI ya está registrado.", nombre, email, telefono, dui, direccion);
        if (!UserStore.Add(UserStore.Create(nombre, email, fullPhone, dui, direccion, "Cliente", password))) return RegisterError("Ese correo ya tiene una cuenta registrada.", nombre, email, telefono, dui, direccion);

        ViewBag.Success = "Cuenta creada correctamente. Ahora puedes iniciar sesión.";
        ViewBag.ActiveTab = "login";
        ViewBag.Email = email;
        return View("Index");
    }

    [HttpGet]
    public IActionResult CerrarSesion()
    {
        HttpContext.Session.Clear();
        TempData.Clear();
        Response.Cookies.Delete("RestauranteBD.Remember");
        return RedirectToAction("Index");
    }

    private void SetSession(UserAccount user)
    {
        HttpContext.Session.SetString("UsuarioLogueado", user.Email);
        HttpContext.Session.SetString("RolUsuario", user.Rol);
        HttpContext.Session.SetString("NombreUsuario", user.Nombre);
        HttpContext.Session.SetString("TelefonoUsuario", user.Telefono ?? string.Empty);
        HttpContext.Session.SetString("DuiUsuario", user.Dui ?? string.Empty);
        HttpContext.Session.SetString("DireccionUsuario", user.Direccion ?? string.Empty);
    }

    private IActionResult RegisterError(string message, string nombre, string email, string telefono, string dui, string direccion)
    {
        ViewBag.Error = message; ViewBag.ActiveTab = "register"; ViewBag.RegisterName = nombre; ViewBag.RegisterEmail = email;
        ViewBag.RegisterPhone = telefono; ViewBag.RegisterDui = dui; ViewBag.RegisterAddress = direccion;
        return View("Index");
    }

    private static bool IsValidEmail(string email)
    {
        try { var address = new System.Net.Mail.MailAddress(email); return address.Address.Equals(email, StringComparison.OrdinalIgnoreCase); }
        catch { return false; }
    }

    private static bool IsValidName(string value) =>
        System.Text.RegularExpressions.Regex.IsMatch(value, @"^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ])[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,80}$");

    private static bool IsValidPhone(string value) =>
        System.Text.RegularExpressions.Regex.IsMatch(value, @"^\+\d{1,3}\s\d{3,4}(?:[ -]\d{3,4}){1,3}$");

    private static string NormalizeInternationalPhone(string countryCode, string number)
    {
        var country = new string((countryCode ?? string.Empty).Where(char.IsDigit).ToArray());
        var digits = new string((number ?? string.Empty).Where(char.IsDigit).ToArray());
        return string.IsNullOrWhiteSpace(country) || string.IsNullOrWhiteSpace(digits)
            ? string.Empty
            : $"+{country} {digits}";
    }

    private static bool IsValidDui(string dui) =>
        System.Text.RegularExpressions.Regex.IsMatch(dui, @"^\d{8}-\d$");
}
