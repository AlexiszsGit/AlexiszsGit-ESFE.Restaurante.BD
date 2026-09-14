using Microsoft.AspNetCore.Mvc;
using ESFE.RestauranteBD.web.UI.Models;
using System.Net.Mail;
using System.Text.RegularExpressions;

namespace ESFE.RestauranteBD.web.UI.Controllers;

public class Trabajadores1Controller : Controller
{
    private static readonly string[] WorkerRoles = ["Cocina", "Barra", "Repartidor"];

    [HttpGet]
    public IActionResult Index()
    {
        if (!IsOwner())
        {
            return Forbid();
        }

        var workers = UserStore.All()
            .Where(user => !user.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase))
            .OrderBy(user => user.Rol == "Dueno" ? 0 : 1)
            .ThenBy(user => user.Nombre)
            .ToArray();

        var clients = UserStore.All()
            .Where(user => user.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase))
            .OrderBy(user => user.Nombre)
            .ToArray();

        ViewBag.Clients = clients;
        ViewBag.WorkerSuccess = TempData["WorkerSuccess"];
        ViewBag.WorkerError = TempData["WorkerError"];
        return View(workers);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult AgregarDesdeCliente(string email, string rol, string password)
    {
        if (!IsOwner())
        {
            return Forbid();
        }

        email = UserStore.NormalizeEmail(email);
        rol = (rol ?? string.Empty).Trim();
        password ??= string.Empty;

        if (!WorkerRoles.Contains(rol, StringComparer.Ordinal))
        {
            return WorkerError("Selecciona un rol de trabajador válido.");
        }

        if (!IsValidPassword(password))
        {
            return WorkerError("La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.");
        }

        if (!UserStore.TryGet(email, out var user) || user is null)
        {
            return WorkerError("No existe una cuenta con ese correo.");
        }

        if (!user.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase))
        {
            return WorkerError("Ese correo ya pertenece a un trabajador o administrador.");
        }

        user.Rol = rol;
        if (!UserStore.ChangePassword(user, password))
        {
            return WorkerError("No se pudo actualizar la contraseña del trabajador.");
        }

        TempData["WorkerSuccess"] = $"{user.Nombre} fue agregado como {DisplayRole(rol)}. Su nueva contraseña quedó configurada correctamente.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult CambiarRol(string email, string rol)
    {
        if (!IsOwner())
        {
            return Forbid();
        }

        rol = (rol ?? string.Empty).Trim();
        if (UserStore.TryGet(email, out var user)
            && user is not null
            && !user.Rol.Equals("Dueno", StringComparison.OrdinalIgnoreCase)
            && WorkerRoles.Contains(rol, StringComparer.Ordinal))
        {
            user.Rol = rol;
            UserStore.Update(user);
            TempData["WorkerSuccess"] = $"Rol actualizado para {user.Nombre}: {DisplayRole(rol)}.";
        }
        else
        {
            TempData["WorkerError"] = "No se pudo cambiar el rol.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult CambiarACliente(string email)
    {
        if (!IsOwner())
        {
            return Forbid();
        }

        email = UserStore.NormalizeEmail(email);

        if (!UserStore.TryGet(email, out var user) || user is null)
        {
            return WorkerError("No se encontró el trabajador indicado.");
        }

        if (user.Rol.Equals("Dueno", StringComparison.OrdinalIgnoreCase))
        {
            return WorkerError("El administrador principal no puede convertirse en Cliente desde esta opción.");
        }

        user.Rol = "Cliente";
        user.Activo = true;
        UserStore.Update(user);
        TempData["WorkerSuccess"] = $"{user.Nombre} volvió a tener el rol Cliente.";

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult CambiarEstado(string email)
    {
        if (!IsOwner())
        {
            return Forbid();
        }

        if (UserStore.TryGet(email, out var user)
            && user is not null
            && !user.Rol.Equals("Dueno", StringComparison.OrdinalIgnoreCase))
        {
            user.Activo = !user.Activo;
            UserStore.Update(user);
            TempData["WorkerSuccess"] = $"{user.Nombre} ahora está {(user.Activo ? "activo" : "inactivo")}.";
        }

        return RedirectToAction(nameof(Index));
    }

    private IActionResult WorkerError(string message)
    {
        TempData["WorkerError"] = message;
        return RedirectToAction(nameof(Index));
    }

    private bool IsOwner() => HttpContext.Session.GetString("RolUsuario") == "Dueno";

    private static string DisplayRole(string role) => role switch
    {
        "Dueno" => "Administrador",
        "Cocina" => "Cocina",
        "Barra" => "Barra",
        "Repartidor" => "Repartidor",
        _ => role
    };

    private static bool IsValidPassword(string value) =>
        value.Length >= 8
        && value.Any(char.IsUpper)
        && value.Any(char.IsLower)
        && value.Any(char.IsDigit);
}
