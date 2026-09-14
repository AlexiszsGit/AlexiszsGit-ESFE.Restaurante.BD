var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(8);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
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
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var publicPath = path.StartsWith("/IniciarSesion1", StringComparison.OrdinalIgnoreCase) || path.StartsWith("/favicon", StringComparison.OrdinalIgnoreCase);
    if (!publicPath && string.IsNullOrWhiteSpace(context.Session.GetString("UsuarioLogueado")))
    {
        context.Response.Redirect("/IniciarSesion1/Index");
        return;
    }
    await next();
});
app.UseAuthorization();
app.Use(async (context, next) =>
{
    var role = context.Session.GetString("RolUsuario") ?? "Cliente";
    var controller = context.Request.RouteValues["controller"]?.ToString() ?? string.Empty;
    var clientePermitidos = new[] { "Inicio1", "GestionDeMenu1", "PedidoyCarrito1", "GestionDePedidos1", "ReservarMesas1", "CalificarServicio1", "Informacion1", "NotificacionesController1", "ProcesarPago1" };
    if (!controller.Equals("IniciarSesion1", StringComparison.OrdinalIgnoreCase) && role != "Dueno" && !clientePermitidos.Contains(controller, StringComparer.OrdinalIgnoreCase))
    {
        context.Response.Redirect("/Inicio1/Index");
        return;
    }
    await next();
});
app.MapControllerRoute(name: "default", pattern: "{controller=IniciarSesion1}/{action=Index}/{id?}");
app.Run();
