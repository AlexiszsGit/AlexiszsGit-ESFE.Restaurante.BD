using Microsoft.AspNetCore.Mvc;
using ESFE.RestauranteBD.web.UI.Models;

namespace ESFE.RestauranteBD.web.UI.Controllers;

[RequirePermission(RoleStore.Customers)]
public class Clientes1Controller : Controller
{
    [HttpGet]
    public IActionResult Index(string? q)
    {
        if (!CanViewCustomers())
        {
            return Forbid();
        }

        var query = (q ?? string.Empty).Trim();
        var customers = UserStore.All()
            .Where(user => user.Rol.Equals("Cliente", StringComparison.OrdinalIgnoreCase))
            .Where(user => string.IsNullOrWhiteSpace(query)
                           || user.Nombre.Contains(query, StringComparison.OrdinalIgnoreCase)
                           || user.Email.Contains(query, StringComparison.OrdinalIgnoreCase)
                           || user.Telefono.Contains(query, StringComparison.OrdinalIgnoreCase)
                           || user.Dui.Contains(query, StringComparison.OrdinalIgnoreCase))
            .OrderBy(user => user.Nombre)
            .ToArray();

        ViewBag.Query = query;
        return View(customers);
    }

    private bool CanViewCustomers()
    {
        var role = HttpContext.Session.GetString("RolUsuario");
        return role is "Dueno" or "Barra";
    }
}
