using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;
namespace ESFE.RestauranteBD.web.UI.Controllers
{
    [RequirePermission(RoleStore.Ratings)]
public class CalificarServicio1Controller : Controller
    {
        [HttpGet]
        public IActionResult Index() => View();
        [HttpPost]
        public IActionResult GuardarCalificacion(int estrellas, string comentario)
        {
            ViewBag.Mensaje = "Gracias por tus comentarios.";
            return View("Index");
        }
    }
}
