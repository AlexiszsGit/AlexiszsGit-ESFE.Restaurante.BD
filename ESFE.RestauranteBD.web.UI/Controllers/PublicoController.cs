using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers;

public sealed class PublicoController : Controller
{
    // Muestra la portada pública. Aquí todavía no se puede comprar ni reservar.
    [HttpGet]
    public IActionResult Index() => View();
}
