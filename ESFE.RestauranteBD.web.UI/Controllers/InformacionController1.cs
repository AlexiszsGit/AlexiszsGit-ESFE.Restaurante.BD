using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;
namespace ESFE.RestauranteBD.web.UI.Controllers
{
    [RequirePermission(RoleStore.Information)]
public class Informacion1Controller : Controller
    {
        public IActionResult Index() => View();
    }
}
