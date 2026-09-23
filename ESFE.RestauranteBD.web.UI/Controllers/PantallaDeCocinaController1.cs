
using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers;

[RequirePermission(RoleStore.Kitchen)]
public class PantallaDeCocina1Controller : Controller
{
    // Carga la vista principal del módulo.
    public IActionResult Index() => View();
}
