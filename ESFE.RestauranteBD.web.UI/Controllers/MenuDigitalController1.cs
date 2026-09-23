
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers;

public class MenuDigital1Controller : Controller
{
    // Carga la vista principal del módulo.
    public IActionResult Index() => RedirectToAction("Index", "GestionDeMenu1");
}
