using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using ESFE.RestauranteBD.web.UI.Data;

namespace ESFE.RestauranteBD.web.UI.Models;

public sealed class RoleDefinition
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public List<string> Permissions { get; set; } = [];
}

public static class RoleStore
{
    public const string Dashboard="Dashboard",Menu="Menu",Orders="Orders",Kitchen="Kitchen",Delivery="Delivery",Reservations="Reservations",Customers="Customers",Notifications="Notifications",Reports="Reports",Payments="Payments",Profile="Profile",LocalOrders="LocalOrders",Workers="Workers",Ratings="Ratings",Information="Information";
    private static readonly ConcurrentDictionary<string,RoleDefinition> Roles=new(StringComparer.OrdinalIgnoreCase);
    private static readonly object FileLock=new();
    private static readonly string LocalFile=Path.Combine(AppContext.BaseDirectory,"roles.local.json");
    private static readonly string[] AllPermissions=[Dashboard,Menu,Orders,Kitchen,Delivery,Reservations,Customers,Notifications,Reports,Payments,Profile,LocalOrders,Workers,Ratings,Information];

    public static IReadOnlyDictionary<string,string> PermissionLabels { get; } = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase)
    { [Dashboard]="Panel de inicio",[Menu]="Menú",[Orders]="Pedidos",[Kitchen]="Cocina",[Delivery]="Delivery / entregas",[Reservations]="Reservas y mesas",[Customers]="Clientes",[Notifications]="Notificaciones",[Reports]="Reportes",[Payments]="Pagos",[Profile]="Perfil",[LocalOrders]="Pedidos presenciales",[Workers]="Trabajadores",[Ratings]="Calificaciones",[Information]="Información" };

    static RoleStore()
    {
        Seed("Administrador","Administrador",AllPermissions);
        Seed("Dueno","Administrador",AllPermissions);
        Seed("Gerente","Gerente",[Dashboard,Menu,Orders,Kitchen,Delivery,Reservations,Customers,Notifications,Reports,Payments,Profile,LocalOrders,Ratings,Information]);
        Seed("Cajero","Cajero",[Dashboard,Orders,LocalOrders,Payments,Customers,Reservations,Notifications,Profile]);
        Seed("Inventario","Inventario",[Dashboard,Menu,Reports,Notifications,Profile]);
        Seed("Cocina","Cocina",[Kitchen,Orders,Notifications,Profile]);
        Seed("Barra","Barra",[Menu,Orders,Reservations,Customers,Notifications,Payments,Profile,LocalOrders]);
        Seed("Delivery","Delivery",[Delivery,Notifications,Profile]);
        Seed("Mesero","Mesero",[Orders,Reservations,Customers,Notifications,Profile]);
        Seed("Cliente","Cliente",[Dashboard,Orders,Reservations,Payments,Ratings,Information,Notifications,Profile]);
        LoadCustomRoles();
    }

    private static void Seed(string name,string displayName,IEnumerable<string> permissions)=>Roles[name]=new RoleDefinition{Name=name,DisplayName=displayName,Permissions=permissions.Distinct(StringComparer.OrdinalIgnoreCase).ToList()};
    public static bool IsAdministrator(string? role)=>string.Equals(role,"Administrador",StringComparison.OrdinalIgnoreCase)||string.Equals(role,"Dueno",StringComparison.OrdinalIgnoreCase);
    public static bool IsSystemRoleName(string? role)=>new[]{"Administrador","Dueno","Gerente","Cajero","Inventario","Cocina","Barra","Delivery","Mesero","Cliente"}.Contains(role ?? string.Empty,StringComparer.OrdinalIgnoreCase);

    private static RoleDefinition Canonicalize(RoleDefinition definition)
    {
        definition.Name = definition.Name.Trim();
        if (IsAdministrator(definition.Name))
        {
            definition.DisplayName = "Administrador";
            definition.Permissions = AllPermissions.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }
        else
        {
            definition.Permissions = definition.Permissions
                .Where(p => PermissionLabels.ContainsKey(p))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
        return definition;
    }

    public static IReadOnlyCollection<RoleDefinition> All()
    {
        try
        {
            var db = RestaurantDb.GetRoles();
            if (db.Count > 0)
            {
                foreach (var d in db) Roles[d.Name] = Canonicalize(d);
            }
        }
        catch { }

        return Roles.Values
            .OrderBy(x => IsAdministrator(x.Name) ? 0 : 1)
            .ThenBy(x => x.Name)
            .Select(Clone)
            .ToArray();
    }

    public static RoleDefinition? Get(string? role)
    {
        if(string.IsNullOrWhiteSpace(role))return null;
        var key=role.Trim();
        try
        {
            var db=RestaurantDb.GetRoles().FirstOrDefault(x=>x.Name.Equals(key,StringComparison.OrdinalIgnoreCase));
            if(db is not null)
            {
                db = Canonicalize(db);
                Roles[key]=db;
                return Clone(db);
            }
        }
        catch{}
        return Roles.TryGetValue(key,out var def)?Clone(Canonicalize(def)):null;
    }
    public static bool IsKnown(string? role)=>Get(role) is not null;
    public static bool HasPermission(string? role,string permission)=>CanAccess(role,permission);
    public static bool CanAccess(string? role,string permission)=>IsAdministrator(role)||Get(role)?.Permissions.Contains(permission,StringComparer.OrdinalIgnoreCase)==true;
    public static string DisplayName(string? role)=>IsAdministrator(role)?"Administrador":Get(role)?.DisplayName??role??string.Empty;

    public static bool TryAdd(string rawName,IEnumerable<string> permissions,out RoleDefinition? role,out string error)
    {
        role=null;error=string.Empty;var clean=Regex.Replace((rawName??string.Empty).Trim(),@"\s+"," ");
        if(clean.Length<3||clean.Length>40||!Regex.IsMatch(clean, @"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ0-9 _-]*$")){error="El nombre del rol no es válido.";return false;}
        if(IsAdministrator(clean)||clean.Equals("Cliente",StringComparison.OrdinalIgnoreCase)||clean.Equals("Delivery",StringComparison.OrdinalIgnoreCase)||clean.Equals("Repartidor",StringComparison.OrdinalIgnoreCase)){error="Ese nombre está reservado por el sistema.";return false;}
        if(IsKnown(clean)){error="Ese rol ya existe.";return false;}
        var perms=new HashSet<string>(permissions??[],StringComparer.OrdinalIgnoreCase);perms.RemoveWhere(p=>!PermissionLabels.ContainsKey(p));perms.Add(Dashboard);perms.Add(Profile);
        try
        {
            if(RestaurantDb.IsConfigured)
            {
                RestaurantDb.Execute("INSERT dbo.Roles(Name,DisplayName,Description,IsSystemRole,IsActive,CreatedAt) VALUES(@name,@display,@desc,0,1,SYSUTCDATETIME())",new Dictionary<string,object?>{{"name",clean},{"display",clean},{"desc","Rol personalizado"}});
                foreach(var p in perms)RestaurantDb.Execute("INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt) SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME() FROM dbo.Roles r CROSS JOIN dbo.Permissions p WHERE r.Name=@role AND p.PermissionKey=@permission AND NOT EXISTS(SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId)",new Dictionary<string,object?>{{"role",clean},{"permission",p}});
            }
        }catch(Exception ex){error=ex.Message;return false;}
        var def=new RoleDefinition{Name=clean,DisplayName=clean,Permissions=perms.ToList()};Roles[clean]=def;SaveCustomRoles();role=Clone(def);return true;
    }

    public static bool TryUpdatePermissions(string? roleName,IEnumerable<string> permissions,out string error)
    {
        error=string.Empty;if(string.IsNullOrWhiteSpace(roleName)||!IsKnown(roleName)){error="El rol indicado no existe.";return false;}if(IsAdministrator(roleName)){error="Los administradores siempre conservan todos los permisos.";return false;}
        var cleaned=permissions.Where(PermissionLabels.ContainsKey).Distinct(StringComparer.OrdinalIgnoreCase).ToList();if(!cleaned.Contains(Dashboard,StringComparer.OrdinalIgnoreCase))cleaned.Insert(0,Dashboard);if(!cleaned.Contains(Profile,StringComparer.OrdinalIgnoreCase))cleaned.Add(Profile);
        try{if(RestaurantDb.IsConfigured){RestaurantDb.Execute("DELETE rp FROM dbo.RolePermissions rp JOIN dbo.Roles r ON r.RoleId=rp.RoleId WHERE r.Name=@role",new Dictionary<string,object?>{{"role",roleName!}});foreach(var p in cleaned)RestaurantDb.Execute("INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt) SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME() FROM dbo.Roles r CROSS JOIN dbo.Permissions p WHERE r.Name=@role AND p.PermissionKey=@permission",new Dictionary<string,object?>{{"role",roleName!},{"permission",p}});}}catch(Exception ex){error=ex.Message;return false;}
        Roles[roleName.Trim()]=new RoleDefinition{Name=roleName.Trim(),DisplayName=Get(roleName)?.DisplayName??roleName.Trim(),Permissions=cleaned};SaveCustomRoles();return true;
    }

    public static bool TryRemove(string? roleName,out string error)
    {
        error=string.Empty;if(string.IsNullOrWhiteSpace(roleName)||IsSystemRoleName(roleName)){error="Los roles del sistema no se pueden eliminar.";return false;}
        try{if(RestaurantDb.IsConfigured)RestaurantDb.Execute("UPDATE dbo.Roles SET IsActive=0 WHERE Name=@role",new Dictionary<string,object?>{{"role",roleName!}});Roles.TryRemove(roleName.Trim(),out _);SaveCustomRoles();return true;}catch(Exception ex){error=ex.Message;return false;}
    }

    private static void LoadCustomRoles()
    {
        try{if(!File.Exists(LocalFile))return;var roles=JsonSerializer.Deserialize<List<RoleDefinition>>(File.ReadAllText(LocalFile))??[];foreach(var role in roles){if(string.IsNullOrWhiteSpace(role.Name)||IsAdministrator(role.Name))continue;var perms=role.Permissions.Where(PermissionLabels.ContainsKey).Distinct(StringComparer.OrdinalIgnoreCase).ToList();if(!perms.Contains(Dashboard,StringComparer.OrdinalIgnoreCase))perms.Insert(0,Dashboard);if(!perms.Contains(Profile,StringComparer.OrdinalIgnoreCase))perms.Add(Profile);Roles[role.Name]=new RoleDefinition{Name=role.Name,DisplayName=string.IsNullOrWhiteSpace(role.DisplayName)?role.Name:role.DisplayName,Permissions=perms};}}catch{}
    }

    private static void SaveCustomRoles(){try{lock(FileLock){var custom=Roles.Values.Where(x=>!IsBaseRole(x.Name)).Select(Clone).OrderBy(x=>x.Name).ToList();File.WriteAllText(LocalFile,JsonSerializer.Serialize(custom,new JsonSerializerOptions{WriteIndented=true}));}}catch{}}
    private static bool IsBaseRole(string name)=>new[]{"Administrador","Dueno","Gerente","Cajero","Inventario","Cocina","Barra","Delivery","Mesero","Cliente"}.Contains(name,StringComparer.OrdinalIgnoreCase);
    private static RoleDefinition Clone(RoleDefinition source)=>new(){Name=source.Name,DisplayName=source.DisplayName,Permissions=source.Permissions.Distinct(StringComparer.OrdinalIgnoreCase).ToList()};
}
