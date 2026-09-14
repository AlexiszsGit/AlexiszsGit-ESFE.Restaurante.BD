using Microsoft.AspNetCore.Mvc;
namespace ESFE.RestauranteBD.web.UI.Controllers
{
    public class MenuDigital1Controller : Controller
    {
        public IActionResult Index() => RedirectToAction("Index", "GestionDeMenu1");
    }
}
