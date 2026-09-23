
using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers;

[RequireAnyPermission(RoleStore.Delivery, RoleStore.LocalOrders)]
public class PedidoListo1Controller : Controller
{
    // Carga la vista principal del módulo.
    public IActionResult Index()
    {
        var role = HttpContext.Session.GetString("RolUsuario") ?? string.Empty;
        var allowed = new[] { "Dueno", "Administrador", "Barra", "Delivery" };
        if (!allowed.Contains(role, StringComparer.OrdinalIgnoreCase))
            return Forbid();

        ViewBag.SoloDomicilio = string.Equals(role, "Delivery", StringComparison.OrdinalIgnoreCase);
        ViewBag.SoloRecogida = string.Equals(role, "Barra", StringComparison.OrdinalIgnoreCase);
        return View();
    }
}
