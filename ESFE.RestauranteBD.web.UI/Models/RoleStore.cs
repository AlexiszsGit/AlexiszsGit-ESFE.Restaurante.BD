using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using System.Text.Json;

namespace ESFE.RestauranteBD.web.UI.Models;

public sealed class RoleDefinition
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public List<string> Permissions { get; set; } = [];
}

public static class RoleStore
{
    public const string Dashboard = "Dashboard";
    public const string Menu = "Menu";
    public const string Orders = "Orders";
    public const string Kitchen = "Kitchen";
    public const string Delivery = "Delivery";
    public const string Reservations = "Reservations";
    public const string Customers = "Customers";
    public const string Notifications = "Notifications";
    public const string Reports = "Reports";
    public const string Payments = "Payments";
    public const string Profile = "Profile";
    public const string LocalOrders = "LocalOrders";
    public const string Workers = "Workers";
    public const string Ratings = "Ratings";
    public const string Information = "Information";

    private static readonly ConcurrentDictionary<string, RoleDefinition> Roles = new(StringComparer.OrdinalIgnoreCase);
    private static readonly object FileLock = new();
    private static readonly string LocalFile = Path.Combine(AppContext.BaseDirectory, "roles.local.json");

    static RoleStore()
    {
        Seed("Dueno", "Administrador", [Dashboard, Menu, Orders, Kitchen, Delivery, Reservations, Customers, Notifications, Reports, Payments, Profile, LocalOrders, Workers, Ratings, Information]);
        Seed("Cocina", "Cocina", [Kitchen, Notifications, Profile]);
        Seed("Barra", "Barra", [Menu, Orders, Reservations, Customers, Notifications, Payments, Profile, LocalOrders]);
        Seed("Delivery", "Delivery", [Delivery, Notifications, Profile]);
        Seed("Mesero", "Mesero", [Orders, Reservations, Customers, Notifications, Profile]);
        LoadCustomRoles();
    }

    private static void Seed(string name, string displayName, IEnumerable<string> permissions) => Roles[name] = new RoleDefinition
    {
        Name = name,
        DisplayName = displayName,
        Permissions = permissions.Distinct(StringComparer.OrdinalIgnoreCase).ToList()
    };

    public static IReadOnlyCollection<RoleDefinition> All() => Roles.Values
        .OrderBy(x => x.Name == "Dueno" ? 0 : 1)
        .ThenBy(x => x.DisplayName)
        .Select(Clone)
        .ToArray();

    public static RoleDefinition? Get(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return null;
        return Roles.TryGetValue(role.Trim(), out var definition) ? Clone(definition) : null;
    }

    public static bool IsKnown(string? role) => !string.IsNullOrWhiteSpace(role) && Roles.ContainsKey(role.Trim());
    public static bool HasPermission(string? role, string permission) => Get(role)?.Permissions.Contains(permission, StringComparer.OrdinalIgnoreCase) == true;
    public static bool CanAccess(string? role, string permission)
    {
        if (string.IsNullOrWhiteSpace(role)) return false;
        if (permission.Equals(Profile, StringComparison.OrdinalIgnoreCase))
            return true;
        // El cliente tiene un conjunto de pantallas propio. Las cuentas de
        // trabajador y los roles personalizados respetan exactamente los permisos
        // almacenados en RoleStore para que el administrador pueda editarlos.
        if (role.Equals("Cliente", StringComparison.OrdinalIgnoreCase))
            return permission.Equals(Orders, StringComparison.OrdinalIgnoreCase)
                || permission.Equals(Reservations, StringComparison.OrdinalIgnoreCase)
                || permission.Equals(Payments, StringComparison.OrdinalIgnoreCase)
                || permission.Equals(Ratings, StringComparison.OrdinalIgnoreCase)
                || permission.Equals(Information, StringComparison.OrdinalIgnoreCase)
                || permission.Equals(Dashboard, StringComparison.OrdinalIgnoreCase)
                || permission.Equals(Notifications, StringComparison.OrdinalIgnoreCase);
        return HasPermission(role, permission);
    }
    public static string DisplayName(string? role) => Get(role)?.DisplayName ?? role ?? string.Empty;

    public static bool TryAdd(string rawName, IEnumerable<string> permissions, out RoleDefinition? role, out string error)
    {
        role = null;
        error = string.Empty;
        var clean = Regex.Replace((rawName ?? string.Empty).Trim(), @"\s+", " ");
        if (clean.Length < 3 || clean.Length > 40 || !Regex.IsMatch(clean, @"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ0-9 _-]*$"))
        {
            error = "El nombre del rol debe tener entre 3 y 40 caracteres y solo puede contener letras, números, espacios, guiones y guiones bajos.";
            return false;
        }
        if (clean.Equals("Cliente", StringComparison.OrdinalIgnoreCase) || clean.Equals("Dueno", StringComparison.OrdinalIgnoreCase) || clean.Equals("Delivery", StringComparison.OrdinalIgnoreCase) || clean.Equals("Repartidor", StringComparison.OrdinalIgnoreCase))
        {
            error = "Ese nombre está reservado por el sistema.";
            return false;
        }
        if (Roles.ContainsKey(clean))
        {
            error = "Ese rol ya existe.";
            return false;
        }

        var validPermissions = new HashSet<string>(permissions ?? [], StringComparer.OrdinalIgnoreCase);
        var definition = new RoleDefinition
        {
            Name = clean,
            DisplayName = clean,
            Permissions = validPermissions.Where(p => PermissionLabels.ContainsKey(p)).Distinct(StringComparer.OrdinalIgnoreCase).ToList()
        };
        // Toda cuenta de trabajador conserva como mínimo Inicio y Perfil. El resto lo decide el administrador.
        if (!definition.Permissions.Contains(Dashboard, StringComparer.OrdinalIgnoreCase)) definition.Permissions.Insert(0, Dashboard);
        if (!definition.Permissions.Contains(Profile, StringComparer.OrdinalIgnoreCase)) definition.Permissions.Add(Profile);
        if (!Roles.TryAdd(clean, definition))
        {
            error = "No se pudo crear el rol porque ya existe.";
            return false;
        }
        SaveCustomRoles();
        role = Clone(definition);
        return true;
    }

    public static bool TryUpdatePermissions(string? roleName, IEnumerable<string> permissions, out string error)
    {
        error = string.Empty;
        if (string.IsNullOrWhiteSpace(roleName) || !Roles.TryGetValue(roleName.Trim(), out var role))
        {
            error = "El rol indicado no existe.";
            return false;
        }

        var valid = new HashSet<string>(permissions ?? [], StringComparer.OrdinalIgnoreCase);
        var cleaned = valid.Where(p => PermissionLabels.ContainsKey(p))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (!cleaned.Contains(Dashboard, StringComparer.OrdinalIgnoreCase)) cleaned.Insert(0, Dashboard);
        if (!cleaned.Contains(Profile, StringComparer.OrdinalIgnoreCase)) cleaned.Add(Profile);

        role.Permissions = cleaned;
        SaveCustomRoles();
        return true;
    }

    public static bool TryRemove(string? role, out string error)
    {
        error = string.Empty;
        if (string.IsNullOrWhiteSpace(role) || role.Equals("Dueno", StringComparison.OrdinalIgnoreCase) || role.Equals("Cocina", StringComparison.OrdinalIgnoreCase) || role.Equals("Barra", StringComparison.OrdinalIgnoreCase) || role.Equals("Delivery", StringComparison.OrdinalIgnoreCase) || role.Equals("Mesero", StringComparison.OrdinalIgnoreCase))
        {
            error = "Los roles base del sistema no pueden eliminarse.";
            return false;
        }
        if (!Roles.TryRemove(role.Trim(), out _))
        {
            error = "El rol indicado no existe.";
            return false;
        }
        SaveCustomRoles();
        return true;
    }

    public static IReadOnlyDictionary<string, string> PermissionLabels { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        [Dashboard] = "Panel de inicio",
        [Menu] = "Menú",
        [Orders] = "Pedidos",
        [Kitchen] = "Cocina",
        [Delivery] = "Delivery / entregas",
        [Reservations] = "Reservas y mesas",
        [Customers] = "Clientes",
        [Notifications] = "Notificaciones",
        [Reports] = "Reportes",
        [Payments] = "Pagos",
        [Profile] = "Perfil",
        [LocalOrders] = "Pedidos presenciales",
        [Workers] = "Trabajadores",
        [Ratings] = "Calificaciones",
        [Information] = "Información"
    };


    private static void LoadCustomRoles()
    {
        try
        {
            if (!File.Exists(LocalFile)) return;
            var json = File.ReadAllText(LocalFile);
            var roles = JsonSerializer.Deserialize<List<RoleDefinition>>(json) ?? [];
            foreach (var role in roles)
            {
                if (string.IsNullOrWhiteSpace(role.Name)) continue;
                var permissions = role.Permissions?.Where(x => PermissionLabels.ContainsKey(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToList() ?? [];
                if (!permissions.Contains(Dashboard, StringComparer.OrdinalIgnoreCase)) permissions.Insert(0, Dashboard);
                if (!permissions.Contains(Profile, StringComparer.OrdinalIgnoreCase)) permissions.Add(Profile);
                Roles[role.Name] = new RoleDefinition { Name = role.Name, DisplayName = string.IsNullOrWhiteSpace(role.DisplayName) ? role.Name : role.DisplayName, Permissions = permissions };
            }
        }
        catch { /* El sistema funciona aunque el archivo local no pueda leerse. */ }
    }

    private static void SaveCustomRoles()
    {
        try
        {
            lock (FileLock)
            {
                var custom = Roles.Values.Select(Clone).OrderBy(x => x.Name == "Dueno" ? 0 : 1).ThenBy(x => x.Name).ToList();
                File.WriteAllText(LocalFile, JsonSerializer.Serialize(custom, new JsonSerializerOptions { WriteIndented = true }));
            }
        }
        catch { /* No bloqueamos la operación por un problema de almacenamiento local. */ }
    }

    private static bool IsBaseRole(string name) => new[] { "Dueno", "Cocina", "Barra", "Delivery", "Mesero" }.Contains(name, StringComparer.OrdinalIgnoreCase);

    private static RoleDefinition Clone(RoleDefinition source) => new()
    {
        Name = source.Name,
        DisplayName = source.DisplayName,
        Permissions = source.Permissions.ToList()
    };
}
