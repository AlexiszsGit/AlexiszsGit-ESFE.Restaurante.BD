using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ESFE.RestauranteBD.web.UI.Models;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class RequirePermissionAttribute : ActionFilterAttribute
{
    private readonly string _permission;

    public RequirePermissionAttribute(string permission) => _permission = permission;

    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var session = context.HttpContext.Session;
        var email = session.GetString("UsuarioLogueado");
        var role = session.GetString("RolUsuario");

        if (string.IsNullOrWhiteSpace(email) || !UserStore.TryGet(email, out var user) || user is null || !user.Activo)
        {
            context.Result = new RedirectToActionResult("Index", "IniciarSesion1", null);
            return;
        }

        // El servidor es la autoridad. La interfaz solo oculta botones, no concede permisos.
        if (!RoleStore.CanAccess(role, _permission))
            context.Result = new ForbidResult();
    }
}
