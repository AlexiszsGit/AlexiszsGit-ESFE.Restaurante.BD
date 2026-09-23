
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ESFE.RestauranteBD.web.UI.Models;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class RequireAnyPermissionAttribute : ActionFilterAttribute
{
    private readonly string[] _permissions;

    public RequireAnyPermissionAttribute(params string[] permissions) => _permissions = permissions;

    // Comprueba los permisos antes de ejecutar la acción del controlador.
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

        if (_permissions.Length == 0 || !_permissions.Any(permission => RoleStore.CanAccess(role, permission)))
            context.Result = new ForbidResult();
    }
}
