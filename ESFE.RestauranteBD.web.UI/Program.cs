using ESFE.RestauranteBD.web.UI.Models;
using ESFE.RestauranteBD.web.UI.Data;
using ESFE.RestauranteBD.web.UI.Services;
using Microsoft.AspNetCore.Http;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<GeminiAssistantService>();
RestaurantDb.Configure(builder.Configuration);
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(8);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

var app = builder.Build();
try { RestaurantDb.EnsureBridgeSchema(); } catch { /* La aplicación sigue funcionando localmente hasta configurar SQL Server. */ }

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Inicio1/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseSession();

app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var isPublic = path == "/"
                   || path.StartsWith("/IniciarSesion1", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/GestionDeMenu1", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/MenuDigital1", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/favicon", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/css", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/js", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/images", StringComparison.OrdinalIgnoreCase);

    var loggedEmail = context.Session.GetString("UsuarioLogueado");
    if (!isPublic && string.IsNullOrWhiteSpace(loggedEmail))
    {
        context.Response.Redirect("/IniciarSesion1/Index");
        return;
    }

    if (!isPublic && !string.IsNullOrWhiteSpace(loggedEmail))
    {
        if (!UserStore.TryGet(loggedEmail, out var loggedUser) || loggedUser is null || !loggedUser.Activo)
        {
            context.Session.Clear();
            context.Response.Redirect("/IniciarSesion1/Index");
            return;
        }

        // Sincroniza el rol con la cuenta real en cada solicitud para que un cambio
        // de permisos del administrador no dependa de una sesión antigua.
        context.Session.SetString("RolUsuario", loggedUser.Rol);
        context.Session.SetString("NombreUsuario", loggedUser.Nombre);
        context.Session.SetString("TelefonoUsuario", loggedUser.Telefono ?? string.Empty);
        context.Session.SetString("DuiUsuario", loggedUser.Dui ?? string.Empty);
        context.Session.SetString("DireccionUsuario", loggedUser.Direccion ?? string.Empty);
    }

    await next();
});

app.Use(async (context, next) =>
{
    var controller = context.Request.RouteValues["controller"]?.ToString() ?? string.Empty;
    if (controller.Equals("IniciarSesion1", StringComparison.OrdinalIgnoreCase)
        || controller.Equals("GestionDeMenu1", StringComparison.OrdinalIgnoreCase)
        || controller.Equals("MenuDigital1", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    var role = context.Session.GetString("RolUsuario") ?? string.Empty;
    var allowed = role switch
    {
        "Cliente" => new[] { "Inicio1", "GestionDeMenu1", "PedidoyCarrito1", "GestionDePedidos1", "ReservarMesas1", "CalificarServicio1", "Informacion1", "NotificacionesController1", "ProcesarPago1", "Perfil1" },
        _ => ControllersForRole(role)
    };

    if (!allowed.Contains(controller, StringComparer.OrdinalIgnoreCase))
    {
        context.Response.Redirect(role switch
        {
            "Cocina" => "/PantallaDeCocina1/Index",
            "Barra" => "/GestionDePedidos1/Index",
            "Delivery" => "/PedidoListo1/Index",
            "Dueno" => "/Inicio1/Index",
            "Cliente" => "/Inicio1/Index",
            _ => "/IniciarSesion1/Index"
        });
        return;
    }

    await next();
});

app.MapControllerRoute(name: "default", pattern: "{controller=GestionDeMenu1}/{action=Index}/{id?}");
app.Run();

static string[] ControllersForRole(string role)
{
    var controllers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    if (RoleStore.CanAccess(role, RoleStore.Dashboard)) controllers.Add("Inicio1");
    if (RoleStore.CanAccess(role, RoleStore.Menu)) controllers.Add("GestionDeMenu1");
    if (RoleStore.CanAccess(role, RoleStore.Orders)) controllers.Add("GestionDePedidos1");
    if (RoleStore.CanAccess(role, RoleStore.Kitchen)) controllers.Add("PantallaDeCocina1");
    if (RoleStore.CanAccess(role, RoleStore.Delivery)) controllers.Add("PedidoListo1");
    if (RoleStore.CanAccess(role, RoleStore.Reservations)) controllers.Add("ReservarMesas1");
    if (RoleStore.CanAccess(role, RoleStore.Customers)) controllers.Add("Clientes1");
    if (RoleStore.CanAccess(role, RoleStore.Notifications)) controllers.Add("NotificacionesController1");
    if (RoleStore.CanAccess(role, RoleStore.Reports)) controllers.Add("Reportes1");
    if (RoleStore.CanAccess(role, RoleStore.Payments)) controllers.Add("ProcesarPago1");
    if (RoleStore.CanAccess(role, RoleStore.Profile)) controllers.Add("Perfil1");
    if (RoleStore.CanAccess(role, RoleStore.Workers)) controllers.Add("Trabajadores1");
    if (RoleStore.CanAccess(role, RoleStore.LocalOrders)) controllers.Add("GestionDePedidos1");
    if (RoleStore.CanAccess(role, RoleStore.Ratings)) controllers.Add("CalificarServicio1");
    if (RoleStore.CanAccess(role, RoleStore.Information)) controllers.Add("Informacion1");
    return controllers.ToArray();
}
