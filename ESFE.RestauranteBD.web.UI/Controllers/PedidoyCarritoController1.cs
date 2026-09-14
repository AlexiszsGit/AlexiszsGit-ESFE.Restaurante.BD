using Microsoft.AspNetCore.Mvc;
namespace ESFE.RestauranteBD.web.UI.Controllers { public class PedidoyCarrito1Controller : Controller { public IActionResult Index() { if (HttpContext.Session.GetString("RolUsuario") == "Dueno") return RedirectToAction("Index", "GestionDeMenu1"); return View(); } } }
