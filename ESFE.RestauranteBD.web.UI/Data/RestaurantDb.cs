using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using ESFE.RestauranteBD.web.UI.Models;

namespace ESFE.RestauranteBD.web.UI.Data;

public static class RestaurantDb
{
    private static string? _connectionString;

    public static void Configure(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("RestaurantDb")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__RestaurantDb");
    }

    public static bool IsConfigured => !string.IsNullOrWhiteSpace(_connectionString)
        && !_connectionString.Contains("TU_USUARIO_SQL", StringComparison.OrdinalIgnoreCase)
        && !_connectionString.Contains("TU_PASSWORD_SQL", StringComparison.OrdinalIgnoreCase);

    private static SqlConnection Open()
    {
        if (!IsConfigured)
            throw new InvalidOperationException("La conexión SQL Server no está configurada.");
        var connection = new SqlConnection(_connectionString!);
        connection.Open();
        return connection;
    }

    private static SqlCommand Command(SqlConnection connection, string sql, IDictionary<string, object?>? parameters = null)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        cmd.CommandTimeout = 60;
        if (parameters is not null)
        {
            foreach (var pair in parameters)
            {
                var parameter = cmd.Parameters.Add("@" + pair.Key, SqlDbType.NVarChar, -1);
                parameter.Value = pair.Value ?? DBNull.Value;
            }
        }
        return cmd;
    }

    public static void EnsureBridgeSchema()
    {
        if (!IsConfigured) return;
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandTimeout = 120;
        cmd.CommandText = @"
IF OBJECT_ID(N'dbo.AppUserState', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppUserState
    (
        AppUserStateId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AppUserState PRIMARY KEY,
        AccountId int NOT NULL,
        StateKey nvarchar(160) NOT NULL,
        StateJson nvarchar(max) NOT NULL,
        UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_AppUserState_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AppUserState_Account FOREIGN KEY(AccountId) REFERENCES dbo.Accounts(AccountId) ON DELETE CASCADE
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_AppUserState_Account_Key' AND object_id=OBJECT_ID(N'dbo.AppUserState'))
    CREATE UNIQUE INDEX UX_AppUserState_Account_Key ON dbo.AppUserState(AccountId, StateKey);
IF OBJECT_ID(N'dbo.AppGlobalState', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppGlobalState
    (
        StateKey nvarchar(160) NOT NULL CONSTRAINT PK_AppGlobalState PRIMARY KEY,
        StateJson nvarchar(max) NOT NULL,
        UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_AppGlobalState_UpdatedAt DEFAULT SYSUTCDATETIME()
    );
END;

INSERT dbo.Permissions(PermissionKey,DisplayName,Description,ModuleName,IsActive)
SELECT v.PermissionKey,v.DisplayName,v.Description,v.PermissionKey,1
FROM (VALUES
(N'Dashboard',N'Dashboard',N'Acceso al panel'),(N'Menu',N'Menú',N'Consulta/gestión del menú'),
(N'Orders',N'Pedidos',N'Pedidos'),(N'Kitchen',N'Cocina',N'Operación de cocina'),(N'Delivery',N'Delivery',N'Operación de entregas'),
(N'Reservations',N'Reservas',N'Reservas'),(N'Customers',N'Clientes',N'Clientes'),(N'Notifications',N'Notificaciones',N'Centro de avisos'),
(N'Reports',N'Reportes',N'Reportes'),(N'Payments',N'Pagos',N'Pagos y caja'),(N'Profile',N'Perfil',N'Perfil'),
(N'LocalOrders',N'Pedidos locales',N'Pedidos presenciales'),(N'Workers',N'Trabajadores',N'Personal y roles'),
(N'Ratings',N'Calificaciones',N'Calificaciones'),(N'Information',N'Información',N'Información general')
) v(PermissionKey,DisplayName,Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions p WHERE p.PermissionKey=v.PermissionKey);

INSERT dbo.Roles(Name,DisplayName,Description,IsSystemRole,IsActive,CreatedAt)
SELECT v.Name,v.DisplayName,v.Description,1,1,SYSUTCDATETIME()
FROM (VALUES
(N'Administrador',N'Administrador',N'Administrador del sistema'),
(N'Dueno',N'Administrador',N'Administrador principal'),
(N'Gerente',N'Gerente',N'Gestión operativa y reportes'),
(N'Cajero',N'Cajero',N'Caja y atención'),
(N'Inventario',N'Inventario',N'Inventario y catálogo'),
(N'Cocina',N'Cocina',N'Operación de cocina'),
(N'Barra',N'Barra',N'Operación de barra'),
(N'Delivery',N'Delivery',N'Operación de entregas'),
(N'Mesero',N'Mesero',N'Atención de sala'),
(N'Cliente',N'Cliente',N'Usuario final')
) v(Name,DisplayName,Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Roles r WHERE r.Name=v.Name);

/* Si existía un rol Administrador creado manualmente como personalizado,
   sus cuentas pasan al administrador canónico y el duplicado se elimina. */
IF EXISTS (SELECT 1 FROM dbo.Roles WHERE Name=N'Administrador' AND IsSystemRole=0)
BEGIN
    UPDATE a
       SET a.RoleId=(SELECT TOP(1) RoleId FROM dbo.Roles WHERE Name=N'Dueno' AND IsActive=1)
    FROM dbo.Accounts a
    INNER JOIN dbo.Roles oldRole ON oldRole.RoleId=a.RoleId
    WHERE oldRole.Name=N'Administrador' AND oldRole.IsSystemRole=0
      AND EXISTS (SELECT 1 FROM dbo.Roles WHERE Name=N'Dueno' AND IsActive=1);

    DELETE rp FROM dbo.RolePermissions rp
    INNER JOIN dbo.Roles oldRole ON oldRole.RoleId=rp.RoleId
    WHERE oldRole.Name=N'Administrador' AND oldRole.IsSystemRole=0;

    DELETE FROM dbo.Roles WHERE Name=N'Administrador' AND IsSystemRole=0;
END;

IF EXISTS (SELECT 1 FROM dbo.Roles WHERE Name=N'Administrador')
    UPDATE dbo.Roles SET IsSystemRole=1,IsActive=1,DisplayName=N'Administrador',Description=N'Administrador del sistema' WHERE Name=N'Administrador';

/* Limpia variantes como 'Administrador ' y las mueve al Administrador canónico. */
IF EXISTS (SELECT 1 FROM dbo.Roles WHERE Name<>LTRIM(RTRIM(Name)) AND LTRIM(RTRIM(Name))=N'Administrador')
BEGIN
    DECLARE @canonicalAdminId int=(SELECT TOP(1) RoleId FROM dbo.Roles WHERE Name=N'Administrador' AND IsSystemRole=1 ORDER BY RoleId);
    IF @canonicalAdminId IS NOT NULL
    BEGIN
        UPDATE a SET RoleId=@canonicalAdminId
        FROM dbo.Accounts a
        INNER JOIN dbo.Roles oldRole ON oldRole.RoleId=a.RoleId
        WHERE oldRole.RoleId<>@canonicalAdminId AND LTRIM(RTRIM(oldRole.Name))=N'Administrador';
        DELETE rp
        FROM dbo.RolePermissions rp
        INNER JOIN dbo.Roles oldRole ON oldRole.RoleId=rp.RoleId
        WHERE oldRole.RoleId<>@canonicalAdminId AND LTRIM(RTRIM(oldRole.Name))=N'Administrador';
        DELETE FROM dbo.Roles
        WHERE Name<>LTRIM(RTRIM(Name)) AND LTRIM(RTRIM(Name))=N'Administrador';
    END;
END;

IF EXISTS (SELECT 1 FROM dbo.Roles WHERE Name=N'Dueno')
    UPDATE dbo.Roles SET IsSystemRole=1,IsActive=1,DisplayName=N'Administrador',Description=N'Administrador principal' WHERE Name=N'Dueno';

DECLARE @all TABLE(PermissionKey nvarchar(50) NOT NULL);
INSERT @all VALUES (N'Dashboard'),(N'Menu'),(N'Orders'),(N'Kitchen'),(N'Delivery'),(N'Reservations'),(N'Customers'),(N'Notifications'),(N'Reports'),(N'Payments'),(N'Profile'),(N'LocalOrders'),(N'Workers'),(N'Ratings'),(N'Information');
INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt)
SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME()
FROM dbo.Roles r CROSS JOIN @all a JOIN dbo.Permissions p ON p.PermissionKey=a.PermissionKey
WHERE r.Name IN(N'Administrador',N'Dueno') AND p.IsActive=1
AND NOT EXISTS(SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt)
SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME()
FROM dbo.Roles r JOIN dbo.Permissions p ON p.PermissionKey IN(N'Dashboard',N'Menu',N'Orders',N'Kitchen',N'Delivery',N'Reservations',N'Customers',N'Notifications',N'Reports',N'Payments',N'Profile',N'LocalOrders',N'Ratings',N'Information')
WHERE r.Name=N'Gerente' AND p.IsActive=1
AND NOT EXISTS(SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt)
SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME()
FROM dbo.Roles r JOIN dbo.Permissions p ON p.PermissionKey IN(N'Dashboard',N'Orders',N'LocalOrders',N'Payments',N'Customers',N'Reservations',N'Notifications',N'Profile')
WHERE r.Name=N'Cajero' AND p.IsActive=1
AND NOT EXISTS(SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt)
SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME()
FROM dbo.Roles r JOIN dbo.Permissions p ON p.PermissionKey IN(N'Dashboard',N'Menu',N'Reports',N'Notifications',N'Profile')
WHERE r.Name=N'Inventario' AND p.IsActive=1
AND NOT EXISTS(SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt)
SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME()
FROM dbo.Roles r JOIN dbo.Permissions p ON p.PermissionKey IN(N'Kitchen',N'Orders',N'Notifications',N'Profile')
WHERE r.Name=N'Cocina' AND p.IsActive=1
AND NOT EXISTS(SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt)
SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME()
FROM dbo.Roles r JOIN dbo.Permissions p ON p.PermissionKey IN(N'Menu',N'Orders',N'Reservations',N'Customers',N'Notifications',N'Payments',N'Profile',N'LocalOrders')
WHERE r.Name=N'Barra' AND p.IsActive=1
AND NOT EXISTS(SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt)
SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME()
FROM dbo.Roles r JOIN dbo.Permissions p ON p.PermissionKey IN(N'Delivery',N'Notifications',N'Profile')
WHERE r.Name=N'Delivery' AND p.IsActive=1
AND NOT EXISTS(SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt)
SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME()
FROM dbo.Roles r JOIN dbo.Permissions p ON p.PermissionKey IN(N'Orders',N'Reservations',N'Customers',N'Notifications',N'Profile')
WHERE r.Name=N'Mesero' AND p.IsActive=1
AND NOT EXISTS(SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt)
SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME()
FROM dbo.Roles r JOIN dbo.Permissions p ON p.PermissionKey IN(N'Dashboard',N'Orders',N'Reservations',N'Payments',N'Ratings',N'Information',N'Notifications',N'Profile')
WHERE r.Name=N'Cliente' AND p.IsActive=1
AND NOT EXISTS(SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);
";
        cmd.ExecuteNonQuery();
    }

    private static UserAccount MapAccount(SqlDataReader rd)
    {
        return new UserAccount
        {
            AccountId = rd.GetInt32(0),
            Nombre = rd.IsDBNull(1) ? "" : rd.GetString(1),
            Email = rd.IsDBNull(2) ? "" : rd.GetString(2),
            Rol = rd.IsDBNull(3) ? "Cliente" : rd.GetString(3),
            PasswordHash = rd.IsDBNull(4) ? "" : rd.GetString(4),
            PasswordSalt = rd.IsDBNull(5) ? "" : rd.GetString(5),
            Activo = !rd.IsDBNull(6) && rd.GetBoolean(6),
            CreadoEn = rd.IsDBNull(7) ? DateTime.UtcNow : rd.GetDateTime(7),
            ProfilePhotoData = ""
        };
    }

    public static UserAccount? GetAccount(string email)
    {
        if (!IsConfigured) return null;
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"SELECT TOP(1) a.AccountId,a.FullName,a.Email,r.Name,a.PasswordHash,a.PasswordSalt,a.IsActive,a.CreatedAt
FROM dbo.Accounts a JOIN dbo.Roles r ON r.RoleId=a.RoleId
WHERE LOWER(LTRIM(RTRIM(COALESCE(a.EmailNormalized,a.Email))))=@email AND a.IsActive=1;";
        cmd.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = (email ?? "").Trim().ToLowerInvariant();
        using var rd = cmd.ExecuteReader();
        return rd.Read() ? MapAccount(rd) : null;
    }

    public static List<UserAccount> GetAccounts()
    {
        if (!IsConfigured) return [];
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"SELECT a.AccountId,a.FullName,a.Email,r.Name,a.PasswordHash,a.PasswordSalt,a.IsActive,a.CreatedAt
FROM dbo.Accounts a JOIN dbo.Roles r ON r.RoleId=a.RoleId ORDER BY a.FullName,a.Email;";
        using var rd = cmd.ExecuteReader();
        var list = new List<UserAccount>();
        while (rd.Read()) list.Add(MapAccount(rd));
        return list;
    }

    public static bool CreateAccount(UserAccount user)
    {
        if (!IsConfigured) return false;
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandTimeout = 60;
        cmd.CommandText = @"
OPEN SYMMETRIC KEY SK_RestauranteSensitiveData DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
DECLARE @roleId int=(SELECT TOP(1) RoleId FROM dbo.Roles WHERE Name=@role AND IsActive=1);
IF @roleId IS NULL BEGIN CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData; THROW 50001, 'El rol indicado no existe.', 1; END;
INSERT dbo.Accounts(RoleId,FullName,Email,Phone,Dui,Address,PasswordHash,PasswordSalt,IsActive,EmailConfirmed,CreatedAt,PasswordAlgorithm,PasswordIterations,PasswordKeyBytes,PasswordNeedsChange,FailedLoginCount,IsDemoAccount,LastPasswordChangedAt,EmailNormalized,EmailLookupHash,PhoneLookupHash,DuiLookupHash,PhoneCipher,DuiCipher,AddressCipher)
VALUES(@roleId,@name,@email,NULL,NULL,NULL,@hash,@salt,1,1,SYSUTCDATETIME(),N'PBKDF2-HMAC-SHA256',@iters,@keyBytes,0,0,0,SYSUTCDATETIME(),@email,HASHBYTES('SHA2_256',CONVERT(varbinary(max),@email)),CASE WHEN NULLIF(@phone,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@phone))))) END,CASE WHEN NULLIF(@dui,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@dui))))) END,CASE WHEN NULLIF(@phone,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@phone)) END,CASE WHEN NULLIF(@dui,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@dui)) END,CASE WHEN NULLIF(@address,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@address)) END);
CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;";
        AddParameters(cmd, user);
        return cmd.ExecuteNonQuery() == 1;
    }

    public static bool UpdateAccount(UserAccount user)
    {
        if (!IsConfigured) return false;
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandTimeout = 60;
        cmd.CommandText = @"
OPEN SYMMETRIC KEY SK_RestauranteSensitiveData DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
DECLARE @roleId int=(SELECT TOP(1) RoleId FROM dbo.Roles WHERE Name=@role AND IsActive=1);
IF @roleId IS NULL BEGIN CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData; THROW 50002, 'El rol indicado no existe.', 1; END;
UPDATE dbo.Accounts SET RoleId=@roleId,FullName=@name,Phone=NULL,Dui=NULL,Address=NULL,PasswordHash=@hash,PasswordSalt=@salt,IsActive=@active,UpdatedAt=SYSUTCDATETIME(),EmailNormalized=@email,EmailLookupHash=HASHBYTES('SHA2_256',CONVERT(varbinary(max),@email)),PhoneLookupHash=CASE WHEN NULLIF(@phone,N'') IS NULL THEN PhoneLookupHash ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@phone))))) END,DuiLookupHash=CASE WHEN NULLIF(@dui,N'') IS NULL THEN DuiLookupHash ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@dui))))) END,PhoneCipher=CASE WHEN NULLIF(@phone,N'') IS NULL THEN PhoneCipher ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@phone)) END,DuiCipher=CASE WHEN NULLIF(@dui,N'') IS NULL THEN DuiCipher ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@dui)) END,AddressCipher=CASE WHEN NULLIF(@address,N'') IS NULL THEN AddressCipher ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@address)) END WHERE AccountId=@id;
CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;";
        AddParameters(cmd, user);
        cmd.Parameters.Add("@id", SqlDbType.Int).Value = user.AccountId;
        return cmd.ExecuteNonQuery() == 1;
    }

    public static bool ChangePassword(int accountId, string password)
    {
        if (!IsConfigured) return false;
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password ?? "", salt, 120_000, HashAlgorithmName.SHA256, 32);
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"UPDATE dbo.Accounts SET PasswordHash=@hash,PasswordSalt=@salt,PasswordAlgorithm=N'PBKDF2-HMAC-SHA256',PasswordIterations=120000,PasswordKeyBytes=32,PasswordNeedsChange=0,FailedLoginCount=0,UpdatedAt=SYSUTCDATETIME(),LastPasswordChangedAt=SYSUTCDATETIME() WHERE AccountId=@id;";
        cmd.Parameters.Add("@hash", SqlDbType.NVarChar, 500).Value = Convert.ToBase64String(hash);
        cmd.Parameters.Add("@salt", SqlDbType.NVarChar, 500).Value = Convert.ToBase64String(salt);
        cmd.Parameters.Add("@id", SqlDbType.Int).Value = accountId;
        return cmd.ExecuteNonQuery() == 1;
    }

    private static void AddParameters(SqlCommand cmd, UserAccount user)
    {
        cmd.Parameters.Add("@role", SqlDbType.NVarChar, 50).Value = user.Rol;
        cmd.Parameters.Add("@name", SqlDbType.NVarChar, 120).Value = user.Nombre;
        cmd.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = user.Email;
        cmd.Parameters.Add("@phone", SqlDbType.NVarChar, 40).Value = user.Telefono;
        cmd.Parameters.Add("@dui", SqlDbType.NVarChar, 10).Value = user.Dui;
        cmd.Parameters.Add("@address", SqlDbType.NVarChar, 250).Value = user.Direccion;
        cmd.Parameters.Add("@hash", SqlDbType.NVarChar, 500).Value = user.PasswordHash;
        cmd.Parameters.Add("@salt", SqlDbType.NVarChar, 500).Value = user.PasswordSalt;
        cmd.Parameters.Add("@iters", SqlDbType.Int).Value = Math.Max(1, user.PasswordIterations);
        cmd.Parameters.Add("@keyBytes", SqlDbType.Int).Value = Math.Max(16, user.PasswordKeyBytes);
        cmd.Parameters.Add("@active", SqlDbType.Bit).Value = user.Activo;
    }

    public static List<RoleDefinition> GetRoles()
    {
        if (!IsConfigured) return [];
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"SELECT r.RoleId,r.Name,r.DisplayName,p.PermissionKey
FROM dbo.Roles r LEFT JOIN dbo.RolePermissions rp ON rp.RoleId=r.RoleId LEFT JOIN dbo.Permissions p ON p.PermissionId=rp.PermissionId AND p.IsActive=1
WHERE r.IsActive=1 ORDER BY CASE WHEN r.Name=N'Administrador' THEN 0 WHEN r.Name=N'Dueno' THEN 1 ELSE 2 END,r.Name,p.PermissionKey;";
        using var rd = cmd.ExecuteReader();
        var map = new Dictionary<int, RoleDefinition>();
        while (rd.Read())
        {
            var id = rd.GetInt32(0);
            if (!map.TryGetValue(id, out var role))
            {
                role = new RoleDefinition { Name = rd.IsDBNull(1) ? "" : rd.GetString(1), DisplayName = rd.IsDBNull(2) ? "" : rd.GetString(2) };
                map[id] = role;
            }
            if (!rd.IsDBNull(3)) role.Permissions.Add(rd.GetString(3));
        }
        return map.Values.ToList();
    }

    public static Dictionary<string,string> GetUserStates(int accountId, IEnumerable<string> keys)
    {
        if (!IsConfigured) return [];
        var keyList = keys.Where(k => !string.IsNullOrWhiteSpace(k)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (keyList.Length == 0) return [];
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        var paramsSql = new List<string>();
        for (var i=0;i<keyList.Length;i++) { var p=cmd.Parameters.Add("@k"+i,SqlDbType.NVarChar,160);p.Value=keyList[i];paramsSql.Add(p.ParameterName); }
        cmd.Parameters.Add("@accountId",SqlDbType.Int).Value=accountId;
        cmd.CommandText=$"SELECT StateKey,StateJson FROM dbo.AppUserState WHERE AccountId=@accountId AND StateKey IN ({string.Join(",",paramsSql)});";
        using var rd=cmd.ExecuteReader();
        var result=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
        while(rd.Read()) result[rd.GetString(0)]=rd.GetString(1);
        return result;
    }

    public static Dictionary<string,string> GetGlobalStates(IEnumerable<string> keys)
    {
        if (!IsConfigured) return [];
        var keyList=keys.Where(k=>!string.IsNullOrWhiteSpace(k)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if(keyList.Length==0)return [];
        using var connection=Open(); using var cmd=connection.CreateCommand();
        var ps=new List<string>(); for(var i=0;i<keyList.Length;i++){var p=cmd.Parameters.Add("@k"+i,SqlDbType.NVarChar,160);p.Value=keyList[i];ps.Add(p.ParameterName);} cmd.CommandText=$"SELECT StateKey,StateJson FROM dbo.AppGlobalState WHERE StateKey IN ({string.Join(",",ps)});";
        using var rd=cmd.ExecuteReader(); var result=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase); while(rd.Read())result[rd.GetString(0)]=rd.GetString(1); return result;
    }

    public static void SaveUserState(int accountId,string key,string rawJson)
    {
        using var connection=Open(); using var cmd=connection.CreateCommand();
        cmd.CommandText=@"UPDATE dbo.AppUserState SET StateJson=@json,UpdatedAt=SYSUTCDATETIME() WHERE AccountId=@accountId AND StateKey=@key;
IF @@ROWCOUNT=0 INSERT dbo.AppUserState(AccountId,StateKey,StateJson) VALUES(@accountId,@key,@json);";
        cmd.Parameters.Add("@accountId",SqlDbType.Int).Value=accountId; cmd.Parameters.Add("@key",SqlDbType.NVarChar,160).Value=key; cmd.Parameters.Add("@json",SqlDbType.NVarChar,-1).Value=rawJson; cmd.ExecuteNonQuery();
    }

    public static void SaveGlobalState(string key,string rawJson)
    {
        using var connection=Open(); using var cmd=connection.CreateCommand(); cmd.CommandText=@"UPDATE dbo.AppGlobalState SET StateJson=@json,UpdatedAt=SYSUTCDATETIME() WHERE StateKey=@key; IF @@ROWCOUNT=0 INSERT dbo.AppGlobalState(StateKey,StateJson) VALUES(@key,@json);"; cmd.Parameters.Add("@key",SqlDbType.NVarChar,160).Value=key;cmd.Parameters.Add("@json",SqlDbType.NVarChar,-1).Value=rawJson;cmd.ExecuteNonQuery();
    }

    public static void DeleteUserState(int accountId,string key)
    {
        using var connection=Open(); using var cmd=connection.CreateCommand();cmd.CommandText="DELETE dbo.AppUserState WHERE AccountId=@accountId AND StateKey=@key;";cmd.Parameters.Add("@accountId",SqlDbType.Int).Value=accountId;cmd.Parameters.Add("@key",SqlDbType.NVarChar,160).Value=key;cmd.ExecuteNonQuery();
    }

    public static int Execute(string sql, IDictionary<string, object?> parameters)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        cmd.CommandTimeout = 60;
        foreach (var pair in parameters) { var p = cmd.Parameters.Add("@" + pair.Key, SqlDbType.NVarChar, -1); p.Value = pair.Value ?? DBNull.Value; }
        return cmd.ExecuteNonQuery();
    }

    public static string BuildAssistantContext(UserAccount user)
    {
        if (!IsConfigured) return "Base de datos no configurada. Usa la información pública del sitio y no inventes datos.";
        using var connection=Open();
        var lines=new List<string>();
        using(var cmd=connection.CreateCommand())
        {
            cmd.CommandText=@"SELECT TOP(40)c.Name,p.Name,p.Description,p.Price,p.IsAvailable FROM dbo.Products p LEFT JOIN dbo.MenuCategories c ON c.CategoryId=p.CategoryId WHERE p.IsDeleted=0 AND p.IsAvailable=1 ORDER BY c.DisplayOrder,p.DisplayOrder,p.Name;";
            using var rd=cmd.ExecuteReader();
            while (rd.Read())
            {
                var category = rd.IsDBNull(0) ? string.Empty : rd.GetString(0);
                var name = rd.GetString(1);
                var description = rd.IsDBNull(2) ? string.Empty : rd.GetString(2);
                var price = rd.GetDecimal(3);
                var availability = rd.GetBoolean(4) ? "Sí" : "No";
                lines.Add($"PRODUCTO | {category} | {name} | {description} | Precio {price:0.00} | Disponible {availability}");
            }
        }
        var isAdmin=RoleStore.IsAdministrator(user.Rol);
        if (isAdmin)
        {
            using var cmd=connection.CreateCommand(); cmd.CommandText=@"SELECT
(SELECT COUNT(*) FROM dbo.Accounts WHERE IsActive=1) AS Accounts,
(SELECT COUNT(*) FROM dbo.Customers) AS Customers,
(SELECT COUNT(*) FROM dbo.Products WHERE IsDeleted=0) AS Products,
(SELECT COUNT(*) FROM dbo.Orders) AS Orders,
(SELECT COUNT(*) FROM dbo.Reservations) AS Reservations,
(SELECT COUNT(*) FROM dbo.Payments) AS Payments,
(SELECT ISNULL(SUM(o.Total),0) FROM dbo.Orders o WHERE CONVERT(date,o.CreatedAt)=CONVERT(date,SYSUTCDATETIME())) AS SalesToday;";
            using var rd=cmd.ExecuteReader(); if(rd.Read()) lines.Add($"RESUMEN ADMIN | cuentas={rd.GetInt32(0)} clientes={rd.GetInt32(1)} productos={rd.GetInt32(2)} pedidos={rd.GetInt32(3)} reservas={rd.GetInt32(4)} pagos={rd.GetInt32(5)} ventas_hoy={rd.GetDecimal(6):0.00}");
        }
        else if (RoleStore.CanAccess(user.Rol, RoleStore.Orders))
        {
            using var cmd=connection.CreateCommand(); cmd.CommandText="SELECT COUNT(*) FROM dbo.Orders WHERE OrderStatusId IN (SELECT OrderStatusId FROM dbo.OrderStatuses WHERE Code IN(N'Pendiente',N'Preparando',N'Listo'));"; lines.Add("PEDIDOS PENDIENTES | "+Convert.ToInt32(cmd.ExecuteScalar()));
        }
        if (user.Rol.Equals("Cliente",StringComparison.OrdinalIgnoreCase)) lines.Add("PRIVACIDAD | Solo puedes recibir información pública o de tu propia cuenta/pedidos. Nunca reveles datos de otros usuarios ni datos administrativos.");
        else if (isAdmin) lines.Add("PRIVACIDAD | Eres Administrador. Puedes consultar información operativa/empresarial disponible al asistente, pero nunca contraseñas, hashes, API keys, claves criptográficas, CVV o PAN completo.");
        else lines.Add($"PRIVACIDAD | Rol {user.Rol}. Solo responde con información pública y con información operativa que corresponda al rol y sus permisos. Nunca reveles datos privados de terceros.");
        return string.Join("\n",lines);
    }

    public static void SaveChatExchange(int accountId,string question,string answer,string role)
    {
        if (!IsConfigured || accountId<=0) return;
        using var connection=Open(); using var tx=connection.BeginTransaction();
        var sessionKey="assistant-"+accountId;
        long sessionId;
        using(var s=connection.CreateCommand()){s.Transaction=tx;s.CommandText=@"DECLARE @id bigint=(SELECT TOP(1) ChatSessionId FROM dbo.ChatSessions WHERE AccountId=@a AND Status=N'Abierta' ORDER BY ChatSessionId DESC); IF @id IS NULL BEGIN INSERT dbo.ChatSessions(AccountId,SessionKey,Status,StartedAt) VALUES(@a,@key,N'Abierta',SYSUTCDATETIME()); SET @id=CONVERT(bigint,SCOPE_IDENTITY()); END SELECT @id;";s.Parameters.Add("@a",SqlDbType.Int).Value=accountId;s.Parameters.Add("@key",SqlDbType.NVarChar,160).Value=sessionKey;sessionId=Convert.ToInt64(s.ExecuteScalar());}
        using(var m=connection.CreateCommand()){m.Transaction=tx;m.CommandText="INSERT dbo.ChatMessages(ChatSessionId,SenderType,MessageText,Intent,CreatedAt) VALUES(@sid,N'Usuario',@q,@role,SYSUTCDATETIME()),(@sid,N'Bot',@a,@role,SYSUTCDATETIME());";m.Parameters.Add("@sid",SqlDbType.BigInt).Value=sessionId;m.Parameters.Add("@q",SqlDbType.NVarChar,-1).Value=question;m.Parameters.Add("@a",SqlDbType.NVarChar,-1).Value=answer;m.Parameters.Add("@role",SqlDbType.NVarChar,40).Value=role;m.ExecuteNonQuery();}
        tx.Commit();
    }
}
