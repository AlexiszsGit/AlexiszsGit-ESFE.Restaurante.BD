using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers
{
    [RequirePermission(RoleStore.Payments)]
public class ProcesarPago1Controller : Controller
    {
        public IActionResult Index() => View();
    }
}
