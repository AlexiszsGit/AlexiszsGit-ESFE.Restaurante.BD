
using ESFE.RestauranteBD.web.UI.Data;
using ESFE.RestauranteBD.web.UI.Models;
using ESFE.RestauranteBD.web.UI.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

// Configuración de servicios.
var builder = WebApplication.CreateBuilder(args);
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddUserSecrets<Program>(optional: true);
}
builder.Services.AddControllersWithViews();
builder.Services.AddHttpClient("AI", client =>
{
    client.Timeout = TimeSpan.FromSeconds(12);
    client.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/json");
});
builder.Services.AddSingleton<GeminiAssistantService>();
builder.Services.AddSingleton<ChatOrderAgent>();
builder.Services.AddSingleton<EmailService>();

// Mantiene la cuenta abierta solo cuando el usuario lo pidió.
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "RestauranteBD.Auth";
        options.LoginPath = "/IniciarSesion1/Index";
        options.AccessDeniedPath = "/IniciarSesion1/Index";
        options.ExpireTimeSpan = TimeSpan.FromDays(30);
        options.SlidingExpiration = true;
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.IsEssential = true;
    });
RestaurantDb.Configure(builder.Configuration);
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(8);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

// Construcción y middleware de la aplicación.
var app = builder.Build();
try
{
    RestaurantDb.EnsureBridgeSchema();
}
catch (Exception ex)
{
    // La aplicación puede iniciar aunque SQL todavía no esté listo.
    app.Logger.LogWarning(ex, "No se pudo preparar el puente auxiliar de SQL Server al iniciar.");
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Inicio1/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseSession();
app.UseAuthentication();

// Protección de rutas.
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var isPublic = path == "/"
                   || path.StartsWith("/Publico", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/IniciarSesion1", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/GestionDeMenu1", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/MenuDigital1", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/favicon", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/css", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/js", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/images", StringComparison.OrdinalIgnoreCase)
                   || path.Equals("/api/chat/ask", StringComparison.OrdinalIgnoreCase)
                   || path.Equals("/api/chat/status", StringComparison.OrdinalIgnoreCase)
                   || path.Equals("/api/database/health", StringComparison.OrdinalIgnoreCase)
                   || path.Equals("/api/connections/status", StringComparison.OrdinalIgnoreCase)
                   || path.Equals("/api/menu/catalog", StringComparison.OrdinalIgnoreCase);

    var loggedEmail = context.Session.GetString("UsuarioLogueado");

    // Recupera la sesión de la cookie cuando el usuario eligió mantenerla activa.
    if (string.IsNullOrWhiteSpace(loggedEmail) && context.User.Identity?.IsAuthenticated == true)
    {
        loggedEmail = context.User.Identity.Name;
        if (!string.IsNullOrWhiteSpace(loggedEmail)
            && UserStore.TryGet(loggedEmail, out var cookieUser)
            && cookieUser is not null
            && cookieUser.Activo
            && cookieUser.EmailVerified)
        {
            context.Session.SetString("UsuarioLogueado", cookieUser.Email);
            context.Session.SetString("RolUsuario", cookieUser.Rol);
            context.Session.SetString("NombreUsuario", cookieUser.Nombre);
            context.Session.SetString("TelefonoUsuario", cookieUser.Telefono ?? string.Empty);
            context.Session.SetString("DuiUsuario", cookieUser.Dui ?? string.Empty);
            context.Session.SetString("DireccionUsuario", cookieUser.Direccion ?? string.Empty);
        }
    }

    if (!isPublic && string.IsNullOrWhiteSpace(loggedEmail))
    {
        context.Response.Redirect("/IniciarSesion1/Index");
        return;
    }

    if (!isPublic && !string.IsNullOrWhiteSpace(loggedEmail))
    {
        if (!UserStore.TryGet(loggedEmail, out var loggedUser) || loggedUser is null || !loggedUser.Activo || !loggedUser.EmailVerified)
        {
            context.Session.Clear();
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
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
    // Las API controlan sus propios permisos y respuestas 401/403.
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        await next();
        return;
    }

    var controller = context.Request.RouteValues["controller"]?.ToString() ?? string.Empty;

    if (controller.Equals("Publico", StringComparison.OrdinalIgnoreCase)
        || controller.Equals("IniciarSesion1", StringComparison.OrdinalIgnoreCase)
        || controller.Equals("GestionDeMenu1", StringComparison.OrdinalIgnoreCase)
        || controller.Equals("MenuDigital1", StringComparison.OrdinalIgnoreCase)
        || controller.Equals("Configuracion1", StringComparison.OrdinalIgnoreCase))
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

// Activa las rutas definidas directamente en los controladores de la API.
app.MapControllers();
app.MapControllerRoute(name: "default", pattern: "{controller=Publico}/{action=Index}/{id?}");
app.Run();

static string[] ControllersForRole(string role)
{
    var controllers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    if (RoleStore.CanAccess(role, RoleStore.Dashboard)) controllers.Add("Inicio1");
    if (RoleStore.CanAccess(role, RoleStore.Menu)) controllers.Add("GestionDeMenu1");
    if (RoleStore.CanAccess(role, RoleStore.Orders)) controllers.Add("GestionDePedidos1");
    if (RoleStore.CanAccess(role, RoleStore.Kitchen)) controllers.Add("PantallaDeCocina1");
    if (RoleStore.CanAccess(role, RoleStore.Delivery) || RoleStore.CanAccess(role, RoleStore.LocalOrders)) controllers.Add("PedidoListo1");
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
