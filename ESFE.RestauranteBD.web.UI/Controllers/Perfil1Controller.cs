using Microsoft.AspNetCore.Mvc;
using ESFE.RestauranteBD.web.UI.Models;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;

namespace ESFE.RestauranteBD.web.UI.Controllers;

[RequirePermission(RoleStore.Profile)]
public class Perfil1Controller : Controller
{
    [HttpGet]
    public IActionResult Index()
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null)
        {
            return RedirectToAction("Index", "IniciarSesion1");
        }

        return View(user);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(3 * 1024 * 1024)]
    public async Task<IActionResult> ActualizarFoto(IFormFile? foto)
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null)
            return RedirectToAction("Index", "IniciarSesion1");

        if (foto is null || foto.Length == 0)
        {
            TempData["ProfileError"] = "Selecciona una imagen.";
            return RedirectToAction(nameof(Index));
        }

        if (foto.Length > 2 * 1024 * 1024)
        {
            TempData["ProfileError"] = "La foto no puede superar 2 MB.";
            return RedirectToAction(nameof(Index));
        }

        var allowed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = "jpeg",
            ["image/png"] = "png",
            ["image/webp"] = "webp"
        };

        if (!allowed.ContainsKey(foto.ContentType ?? string.Empty))
        {
            TempData["ProfileError"] = "Solo se permiten imágenes JPG, PNG o WebP.";
            return RedirectToAction(nameof(Index));
        }

        await using var stream = new MemoryStream();
        await foto.CopyToAsync(stream);
        var bytes = stream.ToArray();

        if (!IsValidImageSignature(bytes, foto.ContentType))
        {
            TempData["ProfileError"] = "El archivo seleccionado no es una imagen válida.";
            return RedirectToAction(nameof(Index));
        }

        user.ProfilePhotoData = $"data:{foto.ContentType};base64,{Convert.ToBase64String(bytes)}";
        if (!UserStore.Update(user))
        {
            TempData["ProfileError"] = "No se pudo guardar la foto de perfil.";
            return RedirectToAction(nameof(Index));
        }

        TempData["ProfileSuccess"] = "Foto de perfil actualizada correctamente.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult EliminarFoto()
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null)
            return RedirectToAction("Index", "IniciarSesion1");

        user.ProfilePhotoData = string.Empty;
        UserStore.Update(user);
        TempData["ProfileSuccess"] = "Foto de perfil eliminada.";
        return RedirectToAction(nameof(Index));
    }

    private static bool IsValidImageSignature(byte[] bytes, string contentType)
    {
        if (contentType.Equals("image/jpeg", StringComparison.OrdinalIgnoreCase))
            return bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
        if (contentType.Equals("image/png", StringComparison.OrdinalIgnoreCase))
            return bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        if (contentType.Equals("image/webp", StringComparison.OrdinalIgnoreCase))
            return bytes.Length >= 12 && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8);
        return false;
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Actualizar(string nombre, string telefono, string dui, string direccion)
    {
        var email = HttpContext.Session.GetString("UsuarioLogueado");
        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null)
        {
            return RedirectToAction("Index", "IniciarSesion1");
        }

        nombre = (nombre ?? string.Empty).Trim();
        telefono = (telefono ?? string.Empty).Trim();
        dui = (dui ?? string.Empty).Trim();
        direccion = (direccion ?? string.Empty).Trim();

        if (!IsValidName(nombre))
        {
            TempData["ProfileError"] = "El nombre solo puede contener letras, espacios, apóstrofes y guiones.";
            return RedirectToAction(nameof(Index));
        }

        if (!IsValidPhone(telefono))
        {
            TempData["ProfileError"] = "El teléfono no tiene un formato válido.";
            return RedirectToAction(nameof(Index));
        }

        if (!IsValidDui(dui))
        {
            TempData["ProfileError"] = "El DUI debe tener el formato 00000000-0.";
            return RedirectToAction(nameof(Index));
        }

        if (direccion.Length < 5 || direccion.Length > 250)
        {
            TempData["ProfileError"] = "La dirección debe tener entre 5 y 250 caracteres.";
            return RedirectToAction(nameof(Index));
        }

        var duplicateDui = UserStore.All().Any(existing =>
            !existing.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase)
            && existing.Dui.Equals(dui, StringComparison.OrdinalIgnoreCase));

        if (duplicateDui)
        {
            TempData["ProfileError"] = "Ese DUI ya está registrado en otra cuenta.";
            return RedirectToAction(nameof(Index));
        }

        user.Nombre = nombre;
        user.Telefono = telefono;
        user.Dui = dui;
        user.Direccion = direccion;
        UserStore.Update(user);

        HttpContext.Session.SetString("NombreUsuario", user.Nombre);
        HttpContext.Session.SetString("TelefonoUsuario", user.Telefono);
        HttpContext.Session.SetString("DuiUsuario", user.Dui);
        HttpContext.Session.SetString("DireccionUsuario", user.Direccion);
        HttpContext.Session.SetString("RolUsuario", user.Rol);

        TempData["ProfileSuccess"] = "Perfil actualizado correctamente.";
        return RedirectToAction(nameof(Index));
    }

    private static bool IsValidName(string value) =>
        Regex.IsMatch(value, @"^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ])[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,80}$");

    private static bool IsValidPhone(string value) =>
        Regex.IsMatch(value, @"^\+\d{1,3}\s\d{3,4}(?:[ -]\d{3,4}){1,3}$|^\d{4}-\d{4}$");

    private static bool IsValidDui(string value) =>
        Regex.IsMatch(value, @"^\d{8}-\d$");
}
