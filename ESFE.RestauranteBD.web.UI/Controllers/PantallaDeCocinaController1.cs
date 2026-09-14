using Microsoft.AspNetCore.Mvc;
namespace ESFE.RestauranteBD.web.UI.Controllers
{
    public class PantallaDeCocina1Controller : Controller
    {
        public IActionResult Index() { if (HttpContext.Session.GetString("RolUsuario") != "Dueno") return RedirectToAction("Index", "GestionDePedidos1"); return View(); }
    }
}
