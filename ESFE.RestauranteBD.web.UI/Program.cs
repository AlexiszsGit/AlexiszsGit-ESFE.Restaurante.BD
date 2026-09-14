using Microsoft.AspNetCore.Http;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(8);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Inicio1/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseSession();

// El menú es la única zona pública. Cualquier operación, pedido, reserva,
// pago o pantalla administrativa exige una sesión válida.
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var controller = context.Request.RouteValues["controller"]?.ToString() ?? string.Empty;
    var isPublic = path == "/"
                   || path.StartsWith("/IniciarSesion1", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/GestionDeMenu1", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/MenuDigital1", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/favicon", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/css", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/js", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/images", StringComparison.OrdinalIgnoreCase);

    if (!isPublic && string.IsNullOrWhiteSpace(context.Session.GetString("UsuarioLogueado")))
    {
        context.Response.Redirect("/IniciarSesion1/Index");
        return;
    }

    await next();
});

// Segunda capa: autorización por rol en servidor. Ocultar botones nunca es suficiente.
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
        "Dueno" => new[] { "Inicio1", "GestionDeMenu1", "PedidoyCarrito1", "GestionDePedidos1", "ReservarMesas1", "CalificarServicio1", "Informacion1", "NotificacionesController1", "ProcesarPago1", "PantallaDeCocina1", "PedidoListo1", "Reportes1", "Trabajadores1", "Clientes1", "Perfil1" },
        "Cocina" => new[] { "PantallaDeCocina1", "Perfil1" },
        "Barra" => new[] { "GestionDePedidos1", "PedidoListo1", "ReservarMesas1", "Clientes1", "Perfil1" },
        "Repartidor" => new[] { "PedidoListo1", "Perfil1" },
        "Cliente" => new[] { "Inicio1", "GestionDeMenu1", "PedidoyCarrito1", "GestionDePedidos1", "ReservarMesas1", "CalificarServicio1", "Informacion1", "NotificacionesController1", "ProcesarPago1", "Perfil1" },
        _ => Array.Empty<string>()
    };

    if (!allowed.Contains(controller, StringComparer.OrdinalIgnoreCase))
    {
        context.Response.Redirect(role switch
        {
            "Cocina" => "/PantallaDeCocina1/Index",
            "Barra" => "/GestionDePedidos1/Index",
            "Repartidor" => "/PedidoListo1/Index",
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
