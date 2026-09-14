using Microsoft.AspNetCore.Mvc;
using ESFE.RestauranteBD.web.UI.Models;
using System.Text.RegularExpressions;

namespace ESFE.RestauranteBD.web.UI.Controllers;

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
