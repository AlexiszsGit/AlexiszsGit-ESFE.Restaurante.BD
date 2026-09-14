using Microsoft.AspNetCore.Mvc;
namespace ESFE.RestauranteBD.web.UI.Controllers
{
    public class NotificacionesController1Controller : Controller
    {
        public IActionResult Index()
        {
            if (HttpContext.Session.GetString("RolUsuario") == "Dueno")
                return RedirectToAction("Index", "Inicio1");
            return View();
        }
    }
}
