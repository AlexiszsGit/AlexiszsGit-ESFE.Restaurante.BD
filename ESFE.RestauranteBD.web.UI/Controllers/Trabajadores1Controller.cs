using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;
using System.Text.RegularExpressions;

namespace ESFE.RestauranteBD.web.UI.Controllers;

[RequirePermission(RoleStore.Workers)]
public class Trabajadores1Controller : Controller
{
    [HttpGet]
    public IActionResult Index()
    {
        if (!IsOwner()) return Forbid();
        ViewBag.Clients = UserStore.All().Where(x => x.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase)).OrderBy(x => x.Nombre).ToArray();
        ViewBag.Roles = RoleStore.All();
        ViewBag.PermissionLabels = RoleStore.PermissionLabels;
        return View(UserStore.All().Where(x => !x.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase)).OrderBy(x => RoleStore.IsAdministrator(x.Rol) ? 0 : 1).ThenBy(x => x.Nombre).ToArray());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult CrearRol(string nombre, string[] permisos)
    {
        if (!IsOwner()) return Forbid();
        if (!RoleStore.TryAdd(nombre, permisos, out _, out var error))
        {
            TempData["WorkerError"] = error;
            return RedirectToAction(nameof(Index));
        }
        TempData["WorkerSuccess"] = $"Rol {RoleStore.DisplayName(nombre)} creado correctamente y disponible para nuevas asignaciones.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult EditarPermisos(string rol, string[] permisos)
    {
        if (!IsOwner()) return Forbid();
        if (!RoleStore.TryUpdatePermissions(rol, permisos, out var error))
        {
            TempData["WorkerError"] = error;
            return RedirectToAction(nameof(Index));
        }
        TempData["WorkerSuccess"] = $"Permisos de {RoleStore.DisplayName(rol)} actualizados correctamente.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult EliminarRol(string rol)
    {
        if (!IsOwner()) return Forbid();
        if (!RoleStore.TryRemove(rol, out var error))
        {
            TempData["WorkerError"] = error;
            return RedirectToAction(nameof(Index));
        }
        foreach (var user in UserStore.All().Where(x => x.Rol.Equals(rol, StringComparison.OrdinalIgnoreCase)).ToArray())
        {
            user.Rol = "Cliente";
            UserStore.Update(user);
        }
        TempData["WorkerSuccess"] = $"Rol {rol} eliminado. Las cuentas que lo usaban volvieron a Cliente.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult AgregarDesdeCliente(string email, string rol, string password)
    {
        if (!IsOwner()) return Forbid();
        email = UserStore.NormalizeEmail(email);
        rol = (rol ?? string.Empty).Trim();
        password ??= string.Empty;
        if (rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase) || !RoleStore.IsKnown(rol)) return WorkerError("Selecciona un rol de trabajador válido.");
        if (!IsValidPassword(password)) return WorkerError("La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.");
        if (!UserStore.TryGet(email, out var user) || user is null) return WorkerError("No existe una cuenta con ese correo.");
        if (!user.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase)) return WorkerError("Ese correo ya pertenece a un trabajador o administrador.");
        user.Rol = rol;
        if (!UserStore.ChangePassword(user, password)) return WorkerError("No se pudo actualizar la contraseña del trabajador.");
        TempData["WorkerSuccess"] = $"{user.Nombre} fue agregado como {RoleStore.DisplayName(user.Rol)}.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult CambiarRol(string email, string rol)
    {
        if (!IsOwner()) return Forbid();
        rol = (rol ?? string.Empty).Trim();
        if (!RoleStore.IsKnown(rol) || rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase)) return WorkerError("Ese rol no está disponible.");
        if (UserStore.TryGet(email, out var user) && user is not null && !RoleStore.IsAdministrator(user.Rol))
        {
            user.Rol = rol;
            UserStore.Update(user);
            TempData["WorkerSuccess"] = $"Rol actualizado para {user.Nombre}: {RoleStore.DisplayName(user.Rol)}.";
        }
        else TempData["WorkerError"] = "No se pudo cambiar el rol.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult CambiarACliente(string email)
    {
        if (!IsOwner()) return Forbid();
        email = UserStore.NormalizeEmail(email);
        if (!UserStore.TryGet(email, out var user) || user is null) return WorkerError("No se encontró el trabajador indicado.");
        if (RoleStore.IsAdministrator(user.Rol)) return WorkerError("El administrador principal no puede convertirse en Cliente.");
        user.Rol = "Cliente"; user.Activo = true; UserStore.Update(user);
        TempData["WorkerSuccess"] = $"{user.Nombre} volvió a tener el rol Cliente.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult CambiarEstado(string email)
    {
        if (!IsOwner()) return Forbid();
        if (UserStore.TryGet(email, out var user) && user is not null && !RoleStore.IsAdministrator(user.Rol))
        {
            user.Activo = !user.Activo; UserStore.Update(user);
            TempData["WorkerSuccess"] = $"{user.Nombre} ahora está {(user.Activo ? "activo" : "inactivo")}.";
        }
        return RedirectToAction(nameof(Index));
    }

    private IActionResult WorkerError(string message) { TempData["WorkerError"] = message; return RedirectToAction(nameof(Index)); }
    private bool IsOwner() => RoleStore.IsAdministrator(HttpContext.Session.GetString("RolUsuario"));
    private static bool IsValidPassword(string value) => value.Length >= 8 && value.Any(char.IsUpper) && value.Any(char.IsLower) && value.Any(char.IsDigit);
}
