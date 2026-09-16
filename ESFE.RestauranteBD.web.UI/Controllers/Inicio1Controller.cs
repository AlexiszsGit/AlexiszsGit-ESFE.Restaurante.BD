using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;
namespace ESFE.RestauranteBD.web.UI.Controllers
{
    [RequirePermission(RoleStore.Dashboard)]
public class Inicio1Controller : Controller
    {
        public IActionResult Index() => View();
        public IActionResult Privacidad() => View("~/Views/Inicio1/Privacy.cshtml");
        public IActionResult Error() => View("~/Views/Shared/Error.cshtml");
    }
}
