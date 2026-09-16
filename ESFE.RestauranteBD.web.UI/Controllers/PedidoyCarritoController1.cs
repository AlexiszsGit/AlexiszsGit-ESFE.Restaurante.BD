using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers;

[RequirePermission(RoleStore.Orders)]
public class PedidoyCarrito1Controller : Controller
{
    public IActionResult Index()
    {
        if (!string.Equals(HttpContext.Session.GetString("RolUsuario"), "Cliente", StringComparison.OrdinalIgnoreCase))
            return Forbid();
        return View();
    }
}
