using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers;

[RequireAnyPermission(RoleStore.Orders, RoleStore.LocalOrders)]
public class GestionDePedidos1Controller : Controller
{
    [HttpGet]
    public IActionResult Index()
    {
        var role = HttpContext.Session.GetString("RolUsuario") ?? "";
        var canCreateLocal = RoleStore.IsAdministrator(role) || role.Equals("Barra", StringComparison.OrdinalIgnoreCase);
        var users = canCreateLocal ? UserStore.All() : Array.Empty<UserAccount>();
        ViewBag.Customers = canCreateLocal
            ? users.Where(x => x.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase) && x.Activo).OrderBy(x => x.Nombre).ToArray()
            : Array.Empty<UserAccount>();
        ViewBag.Attendants = canCreateLocal
            ? users.Where(x => x.Activo && !x.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase) && !RoleStore.IsAdministrator(x.Rol)).OrderBy(x => x.Nombre).ToArray()
            : Array.Empty<UserAccount>();
        ViewBag.CanCreateLocal = canCreateLocal;
        ViewBag.CanViewAllOrders = RoleStore.IsAdministrator(role) || role.Equals("Barra", StringComparison.OrdinalIgnoreCase);
        return View();
    }
}
