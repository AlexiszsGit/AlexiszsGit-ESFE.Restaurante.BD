using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers;

public class Configuracion1Controller : Controller
{
    // Muestra las preferencias personales de la cuenta.
    [HttpGet("/Configuracion")]
    public IActionResult Index()
    {
        var hasSession = !string.IsNullOrWhiteSpace(HttpContext.Session.GetString("UsuarioLogueado"));
        var isAuthenticated = User.Identity?.IsAuthenticated == true;

        if (!hasSession && !isAuthenticated)
            return RedirectToAction("Index", "IniciarSesion1");

        return View();
    }
}
