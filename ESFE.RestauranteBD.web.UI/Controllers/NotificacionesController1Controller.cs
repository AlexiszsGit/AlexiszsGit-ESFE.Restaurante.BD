using ESFE.RestauranteBD.web.UI.Models;
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers
{
    [RequirePermission(RoleStore.Notifications)]
public class NotificacionesController1Controller : Controller
    {
        // Centro de comunicación común para todos los perfiles autenticados.
        // La lista de destinatarios reutiliza el mismo UserStore del sistema.
        public IActionResult Index()
        {
            if (string.IsNullOrWhiteSpace(HttpContext.Session.GetString("UsuarioLogueado")))
                return RedirectToAction("Index", "IniciarSesion1");

            ViewBag.Contactos = UserStore.All()
                .Where(u => u.Activo)
                .Select(u => new
                {
                    u.Nombre,
                    u.Email,
                    u.Rol,
                    u.ProfilePhotoData
                })
                .OrderBy(u => u.Rol)
                .ThenBy(u => u.Nombre)
                .ToList();

            return View();
        }
    }
}
