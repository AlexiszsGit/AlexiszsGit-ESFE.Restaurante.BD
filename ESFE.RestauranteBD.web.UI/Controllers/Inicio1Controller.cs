
using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers;

[RequirePermission(RoleStore.Dashboard)]
public class Inicio1Controller : Controller
{
    // Carga la vista principal del módulo.
    public IActionResult Index() => View();

    // Muestra la pantalla de privacidad.
    public IActionResult Privacidad() => View("~/Views/Inicio1/Privacy.cshtml");

    // Muestra la página de error.
    public IActionResult Error() => View("~/Views/Shared/Error.cshtml");
}
