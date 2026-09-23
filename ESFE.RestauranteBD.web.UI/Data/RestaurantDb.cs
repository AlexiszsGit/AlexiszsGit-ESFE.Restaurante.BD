
using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using ESFE.RestauranteBD.web.UI.Models;

namespace ESFE.RestauranteBD.web.UI.Data;

public static class RestaurantDb
{
    // Conexión y operaciones principales de SQL Server.
    private static string? _connectionString;

    // Toma la conexión desde configuración, secretos locales o variables del servidor.
    public static void Configure(IConfiguration configuration)
    {
        _connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__RestaurantDb")
            ?? configuration.GetConnectionString("RestaurantDb")
            ?? configuration["RestaurantDb:ConnectionString"];
    }

    // Comprueba que exista una cadena utilizable antes de intentar abrir SQL Server.
    public static bool IsConfigured => HasUsableConnectionString(_connectionString);

    private static bool HasUsableConnectionString(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString)) return false;
        if (connectionString.Contains("TU_USUARIO_SQL", StringComparison.OrdinalIgnoreCase)) return false;
        if (connectionString.Contains("TU_PASSWORD_SQL", StringComparison.OrdinalIgnoreCase)) return false;

        var lower = connectionString.ToLowerInvariant();
        if (lower.Contains("password=;") || lower.Contains("pwd=;")) return false;

        return connectionString.Contains("Integrated Security", StringComparison.OrdinalIgnoreCase)
            || connectionString.Contains("User Id=", StringComparison.OrdinalIgnoreCase)
            || connectionString.Contains("UID=", StringComparison.OrdinalIgnoreCase);
    }

    // Abre una conexión activa con SQL Server.
    private static SqlConnection Open()
    {
        if (!IsConfigured)
            throw new InvalidOperationException("La conexión SQL Server no está configurada.");
        var connection = new SqlConnection(_connectionString!);
        connection.Open();
        return connection;
    }

    // Prepara el comando SQL y sus parámetros.
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

    // Inicializa tablas auxiliares necesarias para el estado de la aplicación.
    // Crea y sincroniza las tablas auxiliares que necesita la aplicación.
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

IF OBJECT_ID(N'dbo.AppAuthCodes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppAuthCodes
    (
        AuthCodeId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AppAuthCodes PRIMARY KEY,
        AccountId int NOT NULL,
        Email nvarchar(254) NOT NULL,
        Purpose nvarchar(40) NOT NULL,
        CodeHash nvarchar(128) NOT NULL,
        ExpiresAt datetime2(3) NOT NULL,
        UsedAt datetime2(3) NULL,
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_AppAuthCodes_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AppAuthCodes_Account FOREIGN KEY(AccountId) REFERENCES dbo.Accounts(AccountId) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_AppAuthCodes_Email_Purpose' AND object_id=OBJECT_ID(N'dbo.AppAuthCodes'))
    CREATE INDEX IX_AppAuthCodes_Email_Purpose ON dbo.AppAuthCodes(Email,Purpose,CreatedAt DESC);

IF OBJECT_ID(N'dbo.AppMailMessages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppMailMessages
    (
        AppMailMessageId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AppMailMessages PRIMARY KEY,
        SenderAccountId int NULL,
        SenderEmail nvarchar(254) NOT NULL,
        SenderName nvarchar(120) NOT NULL,
        RecipientAccountId int NULL,
        RecipientEmail nvarchar(254) NOT NULL,
        RecipientName nvarchar(120) NULL,
        CcJson nvarchar(max) NULL,
        BccJson nvarchar(max) NULL,
        Subject nvarchar(120) NOT NULL,
        Body nvarchar(max) NOT NULL,
        AttachmentsJson nvarchar(max) NULL,
        IsRead bit NOT NULL CONSTRAINT DF_AppMailMessages_IsRead DEFAULT 0,
        IsStarred bit NOT NULL CONSTRAINT DF_AppMailMessages_IsStarred DEFAULT 0,
        IsArchived bit NOT NULL CONSTRAINT DF_AppMailMessages_IsArchived DEFAULT 0,
        SentAt datetime2(3) NOT NULL CONSTRAINT DF_AppMailMessages_SentAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AppMailMessages_Sender FOREIGN KEY(SenderAccountId) REFERENCES dbo.Accounts(AccountId),
        CONSTRAINT FK_AppMailMessages_Recipient FOREIGN KEY(RecipientAccountId) REFERENCES dbo.Accounts(AccountId)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_AppMailMessages_Recipient' AND object_id=OBJECT_ID(N'dbo.AppMailMessages'))
    CREATE INDEX IX_AppMailMessages_Recipient ON dbo.AppMailMessages(RecipientAccountId,SentAt DESC);

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
(N'Dueno',N'Dueño',N'Administrador principal'),
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
    UPDATE dbo.Roles SET IsSystemRole=1,IsActive=1,DisplayName=N'Dueño',Description=N'Administrador principal' WHERE Name=N'Dueno';

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

    // Convierte los datos de la cuenta de SQL al modelo de la aplicación.
    private static UserAccount MapAccount(SqlDataReader rd)
    {
        var photoId = rd.IsDBNull(14) ? (long?)null : rd.GetInt64(14);
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
            PasswordIterations = rd.IsDBNull(8) ? 120_000 : rd.GetInt32(8),
            PasswordKeyBytes = rd.IsDBNull(9) ? 32 : rd.GetInt32(9),
            PasswordNeedsChange = !rd.IsDBNull(10) && rd.GetBoolean(10),
            Telefono = rd.IsDBNull(11) ? "" : rd.GetString(11),
            Dui = rd.IsDBNull(12) ? "" : rd.GetString(12),
            Direccion = rd.IsDBNull(13) ? "" : rd.GetString(13),
            ProfilePhotoMediaAssetId = photoId,
            FailedLoginCount = rd.IsDBNull(15) ? 0 : rd.GetInt32(15),
            LockedUntil = rd.IsDBNull(16) ? null : rd.GetDateTime(16),
            EmailVerified = rd.IsDBNull(17) || rd.GetBoolean(17),
            ProfilePhotoData = photoId.HasValue ? $"/Perfil1/Foto?accountId={rd.GetInt32(0)}&v={photoId.Value}" : string.Empty
        };
    }

    private const string AccountSelect = @"
OPEN SYMMETRIC KEY SK_RestauranteSensitiveData DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
SELECT TOP(1) a.AccountId,a.FullName,a.Email,r.Name,a.PasswordHash,a.PasswordSalt,a.IsActive,a.CreatedAt,
       a.PasswordIterations,a.PasswordKeyBytes,a.PasswordNeedsChange,
       CONVERT(nvarchar(40),DecryptByKey(a.PhoneCipher)) AS Phone,
       CONVERT(nvarchar(10),DecryptByKey(a.DuiCipher)) AS Dui,
       CONVERT(nvarchar(250),DecryptByKey(a.AddressCipher)) AS Address,
       a.ProfilePhotoMediaAssetId,a.FailedLoginCount,a.LockedUntil,a.EmailConfirmed
FROM dbo.Accounts a JOIN dbo.Roles r ON r.RoleId=a.RoleId
WHERE LOWER(LTRIM(RTRIM(COALESCE(a.EmailNormalized,a.Email))))=@email AND (@includeInactive=1 OR a.IsActive=1);
CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;";

    // Obtiene los datos de la cuenta solicitada.
    public static UserAccount? GetAccount(string email, bool includeInactive = false)
    {
        if (!IsConfigured) return null;
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = AccountSelect;
        cmd.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = (email ?? "").Trim().ToLowerInvariant();
        cmd.Parameters.Add("@includeInactive", SqlDbType.Bit).Value = includeInactive;
        using var rd = cmd.ExecuteReader();
        return rd.Read() ? MapAccount(rd) : null;
    }

    // Obtiene las cuentas que cumplen los filtros indicados.
    public static List<UserAccount> GetAccounts()
    {
        if (!IsConfigured) return [];
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
OPEN SYMMETRIC KEY SK_RestauranteSensitiveData DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
SELECT a.AccountId,a.FullName,a.Email,r.Name,a.PasswordHash,a.PasswordSalt,a.IsActive,a.CreatedAt,
       a.PasswordIterations,a.PasswordKeyBytes,a.PasswordNeedsChange,
       CONVERT(nvarchar(40),DecryptByKey(a.PhoneCipher)) AS Phone,
       CONVERT(nvarchar(10),DecryptByKey(a.DuiCipher)) AS Dui,
       CONVERT(nvarchar(250),DecryptByKey(a.AddressCipher)) AS Address,
       a.ProfilePhotoMediaAssetId,a.FailedLoginCount,a.LockedUntil,a.EmailConfirmed
FROM dbo.Accounts a JOIN dbo.Roles r ON r.RoleId=a.RoleId
ORDER BY a.FullName,a.Email;
CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;";
        using var rd = cmd.ExecuteReader();
        var list = new List<UserAccount>();
        while (rd.Read()) list.Add(MapAccount(rd));
        return list;
    }

    // Crea una nueva cuenta y registra sus datos de acceso.
    public static bool CreateAccount(UserAccount user)
    {
        if (!IsConfigured) return false;
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandTimeout = 60;
        cmd.CommandText = @"
SET XACT_ABORT ON;
BEGIN TRAN;
OPEN SYMMETRIC KEY SK_RestauranteSensitiveData DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
DECLARE @roleId int=(SELECT TOP(1) RoleId FROM dbo.Roles WHERE Name=@role AND IsActive=1);
IF @roleId IS NULL BEGIN CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData; ROLLBACK; THROW 50001, 'El rol indicado no existe.', 1; END;
INSERT dbo.Accounts(RoleId,FullName,Email,Phone,Dui,Address,PasswordHash,PasswordSalt,IsActive,EmailConfirmed,CreatedAt,PasswordAlgorithm,PasswordIterations,PasswordKeyBytes,PasswordNeedsChange,FailedLoginCount,IsDemoAccount,LastPasswordChangedAt,EmailNormalized,EmailLookupHash,PhoneLookupHash,DuiLookupHash,PhoneCipher,DuiCipher,AddressCipher)
VALUES(@roleId,@name,@email,NULL,NULL,NULL,@hash,@salt,1,0,SYSUTCDATETIME(),N'PBKDF2-HMAC-SHA256',@iters,@keyBytes,0,0,0,SYSUTCDATETIME(),@email,HASHBYTES('SHA2_256',CONVERT(varbinary(max),@email)),CASE WHEN NULLIF(@phone,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@phone))))) END,CASE WHEN NULLIF(@dui,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@dui))))) END,CASE WHEN NULLIF(@phone,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@phone)) END,CASE WHEN NULLIF(@dui,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@dui)) END,CASE WHEN NULLIF(@address,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@address)) END);
DECLARE @accountId int=CONVERT(int,SCOPE_IDENTITY());
IF @role=N'Cliente'
BEGIN
    INSERT dbo.Customers(AccountId,FullName,Email,Phone,Dui,Address,CustomerType,IsActive,CreatedAt,EmailNormalized,EmailLookupHash,PhoneLookupHash,DuiLookupHash,PhoneCipher,DuiCipher,AddressCipher)
    VALUES(@accountId,@name,@email,@phone,@dui,@address,N'Registrado',1,SYSUTCDATETIME(),LOWER(LTRIM(RTRIM(@email))),HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@email))))),CASE WHEN NULLIF(@phone,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@phone))))) END,CASE WHEN NULLIF(@dui,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@dui))))) END,CASE WHEN NULLIF(@phone,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@phone)) END,CASE WHEN NULLIF(@dui,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@dui)) END,CASE WHEN NULLIF(@address,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@address)) END);
END
ELSE
BEGIN
    INSERT dbo.EmployeeProfiles(AccountId,PositionTitle,IsActive,CreatedAt,UpdatedAt)
    VALUES(@accountId,@role,1,SYSUTCDATETIME(),SYSUTCDATETIME());
END;
CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;
COMMIT;";
        AddParameters(cmd, user);
        cmd.ExecuteNonQuery();
        return true;
    }

    // Actualiza los datos principales de una cuenta.
    public static bool UpdateAccount(UserAccount user) => UpdateAccount(user, false);

    // Actualiza los datos principales de una cuenta.
    public static bool UpdateAccount(UserAccount user, bool resetLoginState)
    {
        if (!IsConfigured) return false;
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandTimeout = 60;
        cmd.CommandText = @"
SET XACT_ABORT ON;
BEGIN TRAN;
OPEN SYMMETRIC KEY SK_RestauranteSensitiveData DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
DECLARE @roleId int=(SELECT TOP(1) RoleId FROM dbo.Roles WHERE Name=@role AND IsActive=1);
IF @roleId IS NULL BEGIN CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData; ROLLBACK; THROW 50002, 'El rol indicado no existe.', 1; END;
UPDATE dbo.Accounts SET RoleId=@roleId,FullName=@name,PasswordHash=@hash,PasswordSalt=@salt,IsActive=@active,PasswordIterations=CASE WHEN @resetLoginState=1 THEN @iters ELSE PasswordIterations END,PasswordKeyBytes=CASE WHEN @resetLoginState=1 THEN @keyBytes ELSE PasswordKeyBytes END,PasswordNeedsChange=CASE WHEN @resetLoginState=1 THEN 0 ELSE PasswordNeedsChange END,FailedLoginCount=CASE WHEN @resetLoginState=1 THEN 0 ELSE FailedLoginCount END,LockedUntil=CASE WHEN @resetLoginState=1 THEN NULL ELSE LockedUntil END,LastPasswordChangedAt=CASE WHEN @resetLoginState=1 THEN SYSUTCDATETIME() ELSE LastPasswordChangedAt END,UpdatedAt=SYSUTCDATETIME(),EmailNormalized=@email,EmailLookupHash=HASHBYTES('SHA2_256',CONVERT(varbinary(max),@email)),PhoneLookupHash=CASE WHEN NULLIF(@phone,N'') IS NULL THEN PhoneLookupHash ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@phone))))) END,DuiLookupHash=CASE WHEN NULLIF(@dui,N'') IS NULL THEN DuiLookupHash ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@dui))))) END,PhoneCipher=CASE WHEN NULLIF(@phone,N'') IS NULL THEN PhoneCipher ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@phone)) END,DuiCipher=CASE WHEN NULLIF(@dui,N'') IS NULL THEN DuiCipher ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@dui)) END,AddressCipher=CASE WHEN NULLIF(@address,N'') IS NULL THEN AddressCipher ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@address)) END WHERE AccountId=@id;
IF @@ROWCOUNT=0 BEGIN CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData; ROLLBACK; THROW 50003, 'La cuenta indicada no existe.', 1; END;
IF @role=N'Cliente'
BEGIN
    IF EXISTS(SELECT 1 FROM dbo.Customers WHERE AccountId=@id)
        UPDATE dbo.Customers SET IsActive=@active,FullName=@name,Email=@email,EmailNormalized=LOWER(LTRIM(RTRIM(@email))),EmailLookupHash=HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@email))))),PhoneLookupHash=CASE WHEN NULLIF(@phone,N'') IS NULL THEN PhoneLookupHash ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@phone))))) END,DuiLookupHash=CASE WHEN NULLIF(@dui,N'') IS NULL THEN DuiLookupHash ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@dui))))) END,PhoneCipher=CASE WHEN NULLIF(@phone,N'') IS NULL THEN PhoneCipher ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@phone)) END,DuiCipher=CASE WHEN NULLIF(@dui,N'') IS NULL THEN DuiCipher ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@dui)) END,AddressCipher=CASE WHEN NULLIF(@address,N'') IS NULL THEN AddressCipher ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@address)) END,UpdatedAt=SYSUTCDATETIME() WHERE AccountId=@id;
    ELSE
    BEGIN
        DECLARE @phoneCurrent nvarchar(40)=CONVERT(nvarchar(40),DecryptByKey((SELECT PhoneCipher FROM dbo.Accounts WHERE AccountId=@id))),
                @duiCurrent nvarchar(10)=CONVERT(nvarchar(10),DecryptByKey((SELECT DuiCipher FROM dbo.Accounts WHERE AccountId=@id))),
                @addressCurrent nvarchar(250)=CONVERT(nvarchar(250),DecryptByKey((SELECT AddressCipher FROM dbo.Accounts WHERE AccountId=@id)));
        INSERT dbo.Customers(AccountId,FullName,Email,Phone,Dui,Address,CustomerType,IsActive,CreatedAt,EmailNormalized,EmailLookupHash,PhoneLookupHash,DuiLookupHash,PhoneCipher,DuiCipher,AddressCipher)
        VALUES(@id,@name,@email,@phoneCurrent,@duiCurrent,@addressCurrent,N'Registrado',@active,SYSUTCDATETIME(),LOWER(LTRIM(RTRIM(@email))),HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@email))))),CASE WHEN NULLIF(@phoneCurrent,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@phoneCurrent))))) END,CASE WHEN NULLIF(@duiCurrent,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@duiCurrent))))) END,CASE WHEN NULLIF(@phoneCurrent,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@phoneCurrent)) END,CASE WHEN NULLIF(@duiCurrent,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@duiCurrent)) END,CASE WHEN NULLIF(@addressCurrent,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@addressCurrent)) END);
    END
END
ELSE
BEGIN
    UPDATE dbo.Customers SET IsActive=0,UpdatedAt=SYSUTCDATETIME() WHERE AccountId=@id;
END;

IF @role=N'Cliente'
BEGIN
    IF EXISTS(SELECT 1 FROM dbo.EmployeeProfiles WHERE AccountId=@id)
        UPDATE dbo.EmployeeProfiles SET IsActive=0,UpdatedAt=SYSUTCDATETIME() WHERE AccountId=@id;
END
ELSE
BEGIN
    IF EXISTS(SELECT 1 FROM dbo.EmployeeProfiles WHERE AccountId=@id)
        UPDATE dbo.EmployeeProfiles SET PositionTitle=@role,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE AccountId=@id;
    ELSE
        INSERT dbo.EmployeeProfiles(AccountId,PositionTitle,IsActive,CreatedAt,UpdatedAt)
        VALUES(@id,@role,@active,SYSUTCDATETIME(),SYSUTCDATETIME());
END;
CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;
COMMIT;";
        AddParameters(cmd, user);
        cmd.Parameters.Add("@id", SqlDbType.Int).Value = user.AccountId;
        cmd.Parameters.Add("@resetLoginState", SqlDbType.Bit).Value = resetLoginState;
        cmd.ExecuteNonQuery();
        return true;
    }

    // Actualiza el rol asignado a una cuenta.
    public static bool UpdateAccountRole(int accountId, string role, bool? active = null)
    {
        if (!IsConfigured || accountId <= 0 || string.IsNullOrWhiteSpace(role)) return false;

        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandTimeout = 60;
        cmd.CommandText = @"
SET XACT_ABORT ON;
BEGIN TRAN;
DECLARE @roleId int=(SELECT TOP(1) RoleId FROM dbo.Roles WHERE Name=@role AND IsActive=1);
IF @roleId IS NULL THROW 50010,'El rol indicado no existe.',1;

DECLARE @effectiveActive bit;
SELECT @effectiveActive = CASE WHEN @active IS NULL THEN IsActive ELSE @active END
FROM dbo.Accounts WHERE AccountId=@accountId;
IF @effectiveActive IS NULL THROW 50011,'La cuenta indicada no existe.',1;

UPDATE dbo.Accounts
SET RoleId=@roleId,
    IsActive=@effectiveActive,
    UpdatedAt=SYSUTCDATETIME()
WHERE AccountId=@accountId;

IF @role=N'Cliente'
BEGIN
    OPEN SYMMETRIC KEY SK_RestauranteSensitiveData DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
    DECLARE @phone nvarchar(40)=CONVERT(nvarchar(40),DecryptByKey((SELECT PhoneCipher FROM dbo.Accounts WHERE AccountId=@accountId))),
            @dui nvarchar(10)=CONVERT(nvarchar(10),DecryptByKey((SELECT DuiCipher FROM dbo.Accounts WHERE AccountId=@accountId))),
            @address nvarchar(250)=CONVERT(nvarchar(250),DecryptByKey((SELECT AddressCipher FROM dbo.Accounts WHERE AccountId=@accountId))),
            @name nvarchar(120)=(SELECT FullName FROM dbo.Accounts WHERE AccountId=@accountId),
            @email nvarchar(254)=(SELECT Email FROM dbo.Accounts WHERE AccountId=@accountId);
    IF EXISTS(SELECT 1 FROM dbo.Customers WHERE AccountId=@accountId)
    BEGIN
        UPDATE dbo.Customers
        SET IsActive=@effectiveActive,
            FullName=@name,
            Email=@email,
            Phone=@phone,
            Dui=@dui,
            Address=@address,
            CustomerType=N'Registrado',
            EmailNormalized=LOWER(LTRIM(RTRIM(@email))),
            EmailLookupHash=HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@email))))),
            PhoneLookupHash=CASE WHEN NULLIF(@phone,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@phone))))) END,
            DuiLookupHash=CASE WHEN NULLIF(@dui,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@dui))))) END,
            PhoneCipher=CASE WHEN NULLIF(@phone,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@phone)) END,
            DuiCipher=CASE WHEN NULLIF(@dui,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@dui)) END,
            AddressCipher=CASE WHEN NULLIF(@address,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@address)) END,
            UpdatedAt=SYSUTCDATETIME()
        WHERE AccountId=@accountId;
    END
    ELSE
    BEGIN
        INSERT dbo.Customers(AccountId,FullName,Email,Phone,Dui,Address,CustomerType,IsActive,CreatedAt,EmailNormalized,EmailLookupHash,PhoneLookupHash,DuiLookupHash,PhoneCipher,DuiCipher,AddressCipher)
        VALUES(@accountId,@name,@email,@phone,@dui,@address,N'Registrado',@effectiveActive,SYSUTCDATETIME(),LOWER(LTRIM(RTRIM(@email))),HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@email))))),CASE WHEN NULLIF(@phone,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@phone))))) END,CASE WHEN NULLIF(@dui,N'') IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@dui))))) END,CASE WHEN NULLIF(@phone,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@phone)) END,CASE WHEN NULLIF(@dui,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@dui)) END,CASE WHEN NULLIF(@address,N'') IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@address)) END);
    END
END
ELSE
BEGIN
    UPDATE dbo.Customers
    SET IsActive=0,UpdatedAt=SYSUTCDATETIME()
    WHERE AccountId=@accountId;

    IF EXISTS(SELECT 1 FROM dbo.EmployeeProfiles WHERE AccountId=@accountId)
        UPDATE dbo.EmployeeProfiles
        SET PositionTitle=@role,IsActive=@effectiveActive,UpdatedAt=SYSUTCDATETIME()
        WHERE AccountId=@accountId;
    ELSE
        INSERT dbo.EmployeeProfiles(AccountId,PositionTitle,IsActive,CreatedAt,UpdatedAt)
        VALUES(@accountId,@role,@effectiveActive,SYSUTCDATETIME(),SYSUTCDATETIME());
END;

IF @role=N'Cliente'
BEGIN
    IF EXISTS(SELECT 1 FROM dbo.EmployeeProfiles WHERE AccountId=@accountId)
        UPDATE dbo.EmployeeProfiles SET IsActive=0,UpdatedAt=SYSUTCDATETIME() WHERE AccountId=@accountId;
END;

IF @role=N'Cliente' CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;
COMMIT;";
        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        cmd.Parameters.Add("@role", SqlDbType.NVarChar, 50).Value = role.Trim();
        var activeParameter = cmd.Parameters.Add("@active", SqlDbType.Bit);
        activeParameter.IsNullable = true;
        activeParameter.Value = active.HasValue ? (object)active.Value : DBNull.Value;
        cmd.ExecuteNonQuery();
        return true;
    }

    // Convierte una cuenta existente en trabajador y crea su perfil laboral.
    public static bool PromoteAccountToWorker(int accountId, string role, string password)
    {
        if (!IsConfigured || accountId <= 0 || string.IsNullOrWhiteSpace(role) || string.IsNullOrWhiteSpace(password)) return false;
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 120_000, HashAlgorithmName.SHA256, 32);

        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandTimeout = 60;
        cmd.CommandText = @"
SET XACT_ABORT ON;
BEGIN TRAN;
DECLARE @roleId int=(SELECT TOP(1) RoleId FROM dbo.Roles WHERE Name=@role AND IsActive=1);
IF @roleId IS NULL THROW 50012,'El rol indicado no existe.',1;
UPDATE dbo.Accounts
SET RoleId=@roleId,
    IsActive=1,
    PasswordHash=@hash,
    PasswordSalt=@salt,
    PasswordAlgorithm=N'PBKDF2-HMAC-SHA256',
    PasswordIterations=120000,
    PasswordKeyBytes=32,
    PasswordNeedsChange=0,
    FailedLoginCount=0,
    LockedUntil=NULL,
    LastPasswordChangedAt=SYSUTCDATETIME(),
    UpdatedAt=SYSUTCDATETIME()
WHERE AccountId=@accountId;
IF @@ROWCOUNT=0 THROW 50013,'La cuenta indicada no existe.',1;
UPDATE dbo.Customers SET IsActive=0,UpdatedAt=SYSUTCDATETIME() WHERE AccountId=@accountId;
IF EXISTS(SELECT 1 FROM dbo.EmployeeProfiles WHERE AccountId=@accountId)
    UPDATE dbo.EmployeeProfiles SET PositionTitle=@role,IsActive=1,UpdatedAt=SYSUTCDATETIME() WHERE AccountId=@accountId;
ELSE
    INSERT dbo.EmployeeProfiles(AccountId,PositionTitle,IsActive,CreatedAt,UpdatedAt)
    VALUES(@accountId,@role,1,SYSUTCDATETIME(),SYSUTCDATETIME());
COMMIT;";
        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        cmd.Parameters.Add("@role", SqlDbType.NVarChar, 50).Value = role.Trim();
        cmd.Parameters.Add("@hash", SqlDbType.NVarChar, 500).Value = Convert.ToBase64String(hash);
        cmd.Parameters.Add("@salt", SqlDbType.NVarChar, 500).Value = Convert.ToBase64String(salt);
        cmd.ExecuteNonQuery();
        return true;
    }

    // Actualiza la contraseña de la cuenta.
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

    // Obtiene el estado de salud de la conexión y los componentes principales.
    public static DatabaseHealth GetHealth()
    {
        if (!IsConfigured)
            return new DatabaseHealth(false, false, false, false, false, false, false, 0, 0, 0);

        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandTimeout = 30;
        cmd.CommandText = @"
SELECT
    CASE WHEN KEY_ID(N'##MS_DatabaseMasterKey##') IS NOT NULL THEN 1 ELSE 0 END AS MasterKeyExists,
    CASE WHEN CERT_ID(N'Cert_RestauranteSensitiveData') IS NOT NULL THEN 1 ELSE 0 END AS CertificateExists,
    CASE WHEN KEY_ID(N'SK_RestauranteSensitiveData') IS NOT NULL THEN 1 ELSE 0 END AS SymmetricKeyExists,
    CASE WHEN COL_LENGTH(N'dbo.EmployeeProfiles',N'UpdatedAt') IS NOT NULL THEN 1 ELSE 0 END AS EmployeeUpdatedAt,
    CASE WHEN EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Payments') AND name=N'PaidAt' AND is_nullable=1) THEN 1 ELSE 0 END AS PaidAtNullable,
    (SELECT COUNT(*) FROM dbo.Accounts) AS AccountsCount,
    (SELECT COUNT(*) FROM dbo.EmployeeProfiles) AS EmployeeCount,
    (SELECT COUNT(*) FROM dbo.Products) AS ProductCount;";

        bool master, cert, sym, empUpdated, paidNullable;
        int accountsCount, employeeCount, productCount;
        using (var rd = cmd.ExecuteReader())
        {
            if (!rd.Read()) return new DatabaseHealth(true, false, false, false, false, false, false, 0, 0, 0);
            master = rd.GetInt32(0) == 1;
            cert = rd.GetInt32(1) == 1;
            sym = rd.GetInt32(2) == 1;
            empUpdated = rd.GetInt32(3) == 1;
            paidNullable = rd.GetInt32(4) == 1;
            accountsCount = rd.GetInt32(5);
            employeeCount = rd.GetInt32(6);
            productCount = rd.GetInt32(7);
        }
        var encryptionWorks = false;

        if (cert && sym)
        {
            try
            {
                using var test = connection.CreateCommand();
                test.CommandTimeout = 30;
                test.CommandText = @"
OPEN SYMMETRIC KEY SK_RestauranteSensitiveData
    DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
DECLARE @probe varbinary(max)=EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),N'ESFE-HEALTH'));
SELECT CASE WHEN @probe IS NOT NULL AND CONVERT(nvarchar(50),DecryptByKey(@probe))=N'ESFE-HEALTH' THEN 1 ELSE 0 END;
CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;";
                encryptionWorks = Convert.ToInt32(test.ExecuteScalar()) == 1;
            }
            catch { encryptionWorks = false; }
        }

        return new DatabaseHealth(true, master, cert, sym, encryptionWorks, empUpdated, paidNullable, accountsCount, employeeCount, productCount);
    }

    // Registra un inicio de sesión correcto y limpia los intentos fallidos.
    public static bool RecordLoginSuccess(int accountId)
    {
        if (!IsConfigured || accountId <= 0) return false;
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "EXEC dbo.usp_Account_RecordLoginSuccess @AccountId;";
        cmd.Parameters.Add("@AccountId", SqlDbType.Int).Value = accountId;
        cmd.ExecuteNonQuery();
        return true;
    }

    // Registra un intento fallido de inicio de sesión.
    public static bool RecordLoginFailure(int accountId)
    {
        if (!IsConfigured || accountId <= 0) return false;
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "EXEC dbo.usp_Account_RecordLoginFailure @AccountId;";
        cmd.Parameters.Add("@AccountId", SqlDbType.Int).Value = accountId;
        cmd.ExecuteNonQuery();
        return true;
    }

    // Guarda la foto de perfil y su referencia en la base de datos.
    public static bool SaveProfilePhoto(int accountId, string fileName, string contentType, byte[] content)
    {
        if (!IsConfigured || accountId <= 0 || content is null || content.Length == 0) return false;

        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        try
        {
            using var cmd = connection.CreateCommand();
            cmd.Transaction = transaction;
            cmd.CommandTimeout = 60;
            cmd.CommandText = @"
SET XACT_ABORT ON;
DECLARE @oldId bigint = (SELECT ProfilePhotoMediaAssetId FROM dbo.Accounts WHERE AccountId=@AccountId);
IF @oldId IS NOT NULL
BEGIN
    UPDATE dbo.MediaAssets
    SET IsActive=0, IsPrimary=0, DeletedAt=SYSUTCDATETIME(), UpdatedAt=SYSUTCDATETIME()
    WHERE MediaAssetId=@oldId;
END;
DECLARE @newId bigint;
INSERT dbo.MediaAssets
    (EntityType,EntityId,AssetRole,FileName,ContentType,RelativePath,Content,ContentCipher,ContentHash,FileSizeBytes,OriginalFileSizeBytes,Width,Height,AltText,SortOrder,IsPrimary,IsSensitive,IsActive,CreatedByAccountId,CreatedAt)
VALUES
    (N'AccountProfile',@AccountId,N'Perfil',@FileName,@ContentType,NULL,@Content,NULL,
     HASHBYTES('SHA2_256',@Content),DATALENGTH(@Content),DATALENGTH(@Content),NULL,NULL,NULL,0,1,0,1,@AccountId,SYSUTCDATETIME());
SET @newId=CONVERT(bigint,SCOPE_IDENTITY());
UPDATE dbo.Accounts
SET ProfilePhotoMediaAssetId=@newId,
    ProfilePhotoContent=NULL,
    ProfilePhotoContentType=@ContentType,
    ProfilePhotoFileName=@FileName,
    ProfilePhotoData=NULL,
    UpdatedAt=SYSUTCDATETIME()
WHERE AccountId=@AccountId;
SELECT @newId;";
            cmd.Parameters.Add("@AccountId", SqlDbType.Int).Value = accountId;
            cmd.Parameters.Add("@FileName", SqlDbType.NVarChar, 255).Value = fileName;
            cmd.Parameters.Add("@ContentType", SqlDbType.NVarChar, 120).Value = contentType;
            cmd.Parameters.Add("@Content", SqlDbType.VarBinary, -1).Value = content;

            var newId = cmd.ExecuteScalar();
            if (newId is null || newId == DBNull.Value)
            {
                transaction.Rollback();
                return false;
            }

            transaction.Commit();
            return true;
        }
        catch
        {
            try { transaction.Rollback(); } catch { }
            throw;
        }
    }

    // Elimina la foto de perfil asociada a la cuenta.
    public static bool DeleteProfilePhoto(int accountId)
    {
        if (!IsConfigured || accountId <= 0) return false;

        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        try
        {
            using var cmd = connection.CreateCommand();
            cmd.Transaction = transaction;
            cmd.CommandTimeout = 60;
            cmd.CommandText = @"
SET XACT_ABORT ON;
DECLARE @oldId bigint = (SELECT ProfilePhotoMediaAssetId FROM dbo.Accounts WHERE AccountId=@AccountId);
IF @oldId IS NOT NULL
BEGIN
    UPDATE dbo.MediaAssets
    SET IsActive=0, IsPrimary=0, DeletedAt=SYSUTCDATETIME(), UpdatedAt=SYSUTCDATETIME()
    WHERE MediaAssetId=@oldId;
END;
UPDATE dbo.Accounts
SET ProfilePhotoMediaAssetId=NULL,
    ProfilePhotoContent=NULL,
    ProfilePhotoContentType=NULL,
    ProfilePhotoFileName=NULL,
    ProfilePhotoData=NULL,
    UpdatedAt=SYSUTCDATETIME()
WHERE AccountId=@AccountId;";
            cmd.Parameters.Add("@AccountId", SqlDbType.Int).Value = accountId;
            var affected = cmd.ExecuteNonQuery();
            transaction.Commit();
            return affected >= 0;
        }
        catch
        {
            try { transaction.Rollback(); } catch { }
            throw;
        }
    }

    // Obtiene la imagen almacenada en el sistema de medios.
    public sealed record MediaImage(byte[] Content, string ContentType, string FileName);

    // Obtiene la foto de perfil guardada para la cuenta.
    public static MediaImage? GetProfilePhoto(int accountId)
    {
        if (!IsConfigured || accountId <= 0) return null;
        using var connection = Open();

        // Las fotos nuevas se guardan en Content (la imagen no es un secreto),
        // por lo que no dependen de que el motor pueda abrir la clave simétrica
        // para que el perfil funcione.
        using (var plain = connection.CreateCommand())
        {
            plain.CommandText = @"SELECT TOP(1) m.ContentType,m.FileName,m.Content
FROM dbo.Accounts a JOIN dbo.MediaAssets m ON m.MediaAssetId=a.ProfilePhotoMediaAssetId
WHERE a.AccountId=@accountId AND m.IsActive=1 AND m.Content IS NOT NULL
ORDER BY m.IsPrimary DESC,m.MediaAssetId DESC;";
            plain.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
            using var rd = plain.ExecuteReader();
            if (rd.Read() && !rd.IsDBNull(2))
                return new MediaImage(rd.GetFieldValue<byte[]>(2), rd.GetString(0), rd.GetString(1));
        }

        // Compatibilidad con fotos antiguas que se hubieran guardado cifradas.
        using var encrypted = connection.CreateCommand();
        encrypted.CommandText = @"OPEN SYMMETRIC KEY SK_RestauranteSensitiveData DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
SELECT TOP(1) m.ContentType,m.FileName,CONVERT(varbinary(max),DecryptByKey(m.ContentCipher))
FROM dbo.Accounts a JOIN dbo.MediaAssets m ON m.MediaAssetId=a.ProfilePhotoMediaAssetId
WHERE a.AccountId=@accountId AND m.IsActive=1 AND m.ContentCipher IS NOT NULL AND m.IsSensitive=1
ORDER BY m.IsPrimary DESC,m.MediaAssetId DESC;
CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;";
        encrypted.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        using var encryptedReader = encrypted.ExecuteReader();
        if (!encryptedReader.Read() || encryptedReader.IsDBNull(2)) return null;
        return new MediaImage(encryptedReader.GetFieldValue<byte[]>(2), encryptedReader.GetString(0), encryptedReader.GetString(1));
    }

    // Agrega los parámetros al comando SQL antes de ejecutarlo.
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

    // Obtiene los roles disponibles en el sistema.
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

    // Obtiene los estados guardados para un usuario.
    public static Dictionary<string,string> GetUserStates(int accountId, IEnumerable<string> keys)
    {
        if (!IsConfigured) return [];
        var keyList = keys.Where(k => !string.IsNullOrWhiteSpace(k)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (keyList.Length == 0) return [];
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        var paramsSql = new List<string>();
        for (var i = 0; i < keyList.Length; i++)
        {
            var parameter = cmd.Parameters.Add($"@k{i}", SqlDbType.NVarChar, 160);
            parameter.Value = keyList[i];
            paramsSql.Add(parameter.ParameterName);
        }

        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        cmd.CommandText = $"SELECT StateKey,StateJson FROM dbo.AppUserState WHERE AccountId=@accountId AND StateKey IN ({string.Join(",", paramsSql)});";

        using var rd = cmd.ExecuteReader();
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        while (rd.Read())
            result[rd.GetString(0)] = rd.GetString(1);

        return result;
    }

    // Obtiene los estados generales guardados por la aplicación.
    public static Dictionary<string, string> GetGlobalStates(IEnumerable<string> keys)
    {
        if (!IsConfigured)
            return [];

        var keyList = keys
            .Where(k => !string.IsNullOrWhiteSpace(k))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (keyList.Length == 0)
            return [];

        using var connection = Open();
        using var cmd = connection.CreateCommand();
        var parametersSql = new List<string>();

        for (var i = 0; i < keyList.Length; i++)
        {
            var parameter = cmd.Parameters.Add($"@k{i}", SqlDbType.NVarChar, 160);
            parameter.Value = keyList[i];
            parametersSql.Add(parameter.ParameterName);
        }

        cmd.CommandText = $"SELECT StateKey,StateJson FROM dbo.AppGlobalState WHERE StateKey IN ({string.Join(",", parametersSql)});";

        using var rd = cmd.ExecuteReader();
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        while (rd.Read())
            result[rd.GetString(0)] = rd.GetString(1);

        return result;
    }

    // Guarda el estado de interfaz asociado al usuario.
    public static void SaveUserState(int accountId, string key, string rawJson)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"UPDATE dbo.AppUserState SET StateJson=@json,UpdatedAt=SYSUTCDATETIME() WHERE AccountId=@accountId AND StateKey=@key;
IF @@ROWCOUNT=0 INSERT dbo.AppUserState(AccountId,StateKey,StateJson) VALUES(@accountId,@key,@json);";

        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        cmd.Parameters.Add("@key", SqlDbType.NVarChar, 160).Value = key;
        cmd.Parameters.Add("@json", SqlDbType.NVarChar, -1).Value = rawJson;
        cmd.ExecuteNonQuery();
    }

    // Guarda un estado general compartido por la aplicación.
    public static void SaveGlobalState(string key, string rawJson)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"UPDATE dbo.AppGlobalState SET StateJson=@json,UpdatedAt=SYSUTCDATETIME() WHERE StateKey=@key; IF @@ROWCOUNT=0 INSERT dbo.AppGlobalState(StateKey,StateJson) VALUES(@key,@json);";
        cmd.Parameters.Add("@key", SqlDbType.NVarChar, 160).Value = key;
        cmd.Parameters.Add("@json", SqlDbType.NVarChar, -1).Value = rawJson;
        cmd.ExecuteNonQuery();
    }

    // Obtiene el estado persistido de los pedidos operativos.
    public static string GetOperationalOrdersJson(string key)
    {
        if (!IsConfigured) return "[]";
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
SELECT TOP(1) StateJson FROM dbo.AppGlobalState WHERE StateKey=@key;
";
        cmd.Parameters.Add("@key",SqlDbType.NVarChar,160).Value = key;
        var value = cmd.ExecuteScalar();
        if (value is string text && !string.IsNullOrWhiteSpace(text)) return text;

        // Bootstrap legacy orders written before the operational shared channel existed.
        using var legacy = connection.CreateCommand();
        legacy.CommandText = "SELECT StateJson FROM dbo.AppUserState WHERE StateKey=N'esfe_pedidos' ORDER BY UpdatedAt ASC;";
        using var rd = legacy.ExecuteReader();
        var merged = new List<System.Text.Json.JsonElement>();
        while (rd.Read())
        {
            if (rd.IsDBNull(0)) continue;
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(rd.GetString(0));
                if (doc.RootElement.ValueKind != System.Text.Json.JsonValueKind.Array) continue;
                foreach (var item in doc.RootElement.EnumerateArray()) merged.Add(item.Clone());
            }
            catch { }
        }
        return System.Text.Json.JsonSerializer.Serialize(merged);
    }

    // Guarda el estado operativo de los pedidos en la base de datos.
    public static void SaveOperationalOrdersJson(string key, string rawJson)
    {
        SaveGlobalState(key, rawJson);
    }

    // Elimina o limpia los datos de delete user state.
    public static void DeleteUserState(int accountId, string key)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "DELETE dbo.AppUserState WHERE AccountId=@accountId AND StateKey=@key;";
        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        cmd.Parameters.Add("@key", SqlDbType.NVarChar, 160).Value = key;
        cmd.ExecuteNonQuery();
    }


    // Guarda un código temporal para confirmar una cuenta o recuperar una contraseña.
    public static void SaveAuthCode(int accountId, string email, string purpose, string code, DateTime expiresAt)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
DELETE FROM dbo.AppAuthCodes
WHERE AccountId=@accountId AND Purpose=@purpose AND UsedAt IS NULL;

INSERT dbo.AppAuthCodes(AccountId,Email,Purpose,CodeHash,ExpiresAt)
VALUES(@accountId,@email,@purpose,@hash,@expiresAt);";
        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        cmd.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = email;
        cmd.Parameters.Add("@purpose", SqlDbType.NVarChar, 40).Value = purpose;
        cmd.Parameters.Add("@hash", SqlDbType.NVarChar, 128).Value = HashCode(code);
        cmd.Parameters.Add("@expiresAt", SqlDbType.DateTime2).Value = expiresAt;
        cmd.ExecuteNonQuery();
    }

    // Comprueba un código y lo marca como usado cuando es correcto.
    public static bool ValidateAuthCode(string email, string purpose, string code)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
SELECT TOP(1) AuthCodeId,CodeHash
FROM dbo.AppAuthCodes
WHERE Email=@email AND Purpose=@purpose AND UsedAt IS NULL AND ExpiresAt>SYSUTCDATETIME()
ORDER BY AuthCodeId DESC;";
        cmd.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = email;
        cmd.Parameters.Add("@purpose", SqlDbType.NVarChar, 40).Value = purpose;

        long id;
        string expected;
        using (var rd = cmd.ExecuteReader())
        {
            if (!rd.Read())
                return false;

            id = rd.GetInt64(0);
            expected = rd.GetString(1);
        }

        if (!CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(expected),
                Convert.FromHexString(HashCode(code))))
        {
            return false;
        }

        using var update = connection.CreateCommand();
        update.CommandText = "UPDATE dbo.AppAuthCodes SET UsedAt=SYSUTCDATETIME() WHERE AuthCodeId=@id AND UsedAt IS NULL;";
        update.Parameters.Add("@id", SqlDbType.BigInt).Value = id;
        return update.ExecuteNonQuery() == 1;
    }

    // Marca el correo de una cuenta como confirmado.
    public static bool ConfirmEmail(int accountId)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "UPDATE dbo.Accounts SET EmailConfirmed=1,UpdatedAt=SYSUTCDATETIME() WHERE AccountId=@accountId;";
        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        return cmd.ExecuteNonQuery() == 1;
    }

    // Guarda un correo interno para que aparezca en la bandeja del destinatario.
    public static long SaveMailMessage(
        int senderAccountId,
        string senderEmail,
        string senderName,
        int? recipientAccountId,
        string recipientEmail,
        string? recipientName,
        string subject,
        string body,
        string? ccJson,
        string? bccJson,
        string? attachmentsJson)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
INSERT dbo.AppMailMessages
(SenderAccountId,SenderEmail,SenderName,RecipientAccountId,RecipientEmail,RecipientName,CcJson,BccJson,Subject,Body,AttachmentsJson)
OUTPUT INSERTED.AppMailMessageId
VALUES
(@senderAccountId,@senderEmail,@senderName,@recipientAccountId,@recipientEmail,@recipientName,@ccJson,@bccJson,@subject,@body,@attachmentsJson);";
        cmd.Parameters.Add("@senderAccountId", SqlDbType.Int).Value = senderAccountId;
        cmd.Parameters.Add("@senderEmail", SqlDbType.NVarChar, 254).Value = senderEmail;
        cmd.Parameters.Add("@senderName", SqlDbType.NVarChar, 120).Value = senderName;
        cmd.Parameters.Add("@recipientAccountId", SqlDbType.Int).Value = (object?)recipientAccountId ?? DBNull.Value;
        cmd.Parameters.Add("@recipientEmail", SqlDbType.NVarChar, 254).Value = recipientEmail;
        cmd.Parameters.Add("@recipientName", SqlDbType.NVarChar, 120).Value = (object?)recipientName ?? DBNull.Value;
        cmd.Parameters.Add("@ccJson", SqlDbType.NVarChar, -1).Value = (object?)ccJson ?? DBNull.Value;
        cmd.Parameters.Add("@bccJson", SqlDbType.NVarChar, -1).Value = (object?)bccJson ?? DBNull.Value;
        cmd.Parameters.Add("@subject", SqlDbType.NVarChar, 120).Value = subject;
        cmd.Parameters.Add("@body", SqlDbType.NVarChar, -1).Value = body;
        cmd.Parameters.Add("@attachmentsJson", SqlDbType.NVarChar, -1).Value = (object?)attachmentsJson ?? DBNull.Value;
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    // Obtiene los correos que pertenecen a la cuenta actual.
    public static List<MailMessageRecord> GetMailMessages(int accountId)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
SELECT AppMailMessageId,SenderAccountId,SenderEmail,SenderName,RecipientAccountId,RecipientEmail,
       RecipientName,CcJson,BccJson,Subject,Body,AttachmentsJson,IsRead,IsStarred,IsArchived,SentAt
FROM dbo.AppMailMessages
WHERE RecipientAccountId=@accountId OR SenderAccountId=@accountId
ORDER BY SentAt DESC,AppMailMessageId DESC;";
        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;

        using var rd = cmd.ExecuteReader();
        var result = new List<MailMessageRecord>();
        while (rd.Read())
        {
            result.Add(new MailMessageRecord(
                rd.GetInt64(0),
                rd.IsDBNull(1) ? null : rd.GetInt32(1),
                rd.GetString(2),
                rd.GetString(3),
                rd.IsDBNull(4) ? null : rd.GetInt32(4),
                rd.GetString(5),
                rd.IsDBNull(6) ? "" : rd.GetString(6),
                rd.IsDBNull(7) ? "[]" : rd.GetString(7),
                rd.IsDBNull(8) ? "[]" : rd.GetString(8),
                rd.GetString(9),
                rd.GetString(10),
                rd.IsDBNull(11) ? "[]" : rd.GetString(11),
                rd.GetBoolean(12),
                rd.GetBoolean(13),
                rd.GetBoolean(14),
                rd.GetDateTime(15)));
        }

        return result;
    }

    // Actualiza si un correo fue leído.
    public static void MarkMailRead(int accountId, long messageId, bool read)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "UPDATE dbo.AppMailMessages SET IsRead=@read WHERE AppMailMessageId=@id AND RecipientAccountId=@accountId;";
        cmd.Parameters.Add("@read", SqlDbType.Bit).Value = read;
        cmd.Parameters.Add("@id", SqlDbType.BigInt).Value = messageId;
        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        cmd.ExecuteNonQuery();
    }

    // Elimina un correo interno de la bandeja del usuario.
    public static void DeleteMail(int accountId, long messageId)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "DELETE FROM dbo.AppMailMessages WHERE AppMailMessageId=@id AND (RecipientAccountId=@accountId OR SenderAccountId=@accountId);";
        cmd.Parameters.Add("@id", SqlDbType.BigInt).Value = messageId;
        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        cmd.ExecuteNonQuery();
    }

    // Actualiza si un correo está destacado o archivado.
    public static void UpdateMailFlags(int accountId, long messageId, bool? starred = null, bool? archived = null)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
UPDATE dbo.AppMailMessages
SET IsStarred=COALESCE(@starred,IsStarred),
    IsArchived=COALESCE(@archived,IsArchived)
WHERE AppMailMessageId=@id AND RecipientAccountId=@accountId;";
        cmd.Parameters.Add("@starred", SqlDbType.Bit).Value = (object?)starred ?? DBNull.Value;
        cmd.Parameters.Add("@archived", SqlDbType.Bit).Value = (object?)archived ?? DBNull.Value;
        cmd.Parameters.Add("@id", SqlDbType.BigInt).Value = messageId;
        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;
        cmd.ExecuteNonQuery();
    }

    private static string HashCode(string code)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes((code ?? "").Trim()));
        return Convert.ToHexString(bytes);
    }

    public sealed record MailMessageRecord(
        long Id,
        int? SenderAccountId,
        string SenderEmail,
        string SenderName,
        int? RecipientAccountId,
        string RecipientEmail,
        string RecipientName,
        string CcJson,
        string BccJson,
        string Subject,
        string Body,
        string AttachmentsJson,
        bool IsRead,
        bool IsStarred,
        bool IsArchived,
        DateTime SentAt);

    // Lee el catálogo actual directamente desde SQL Server.
    public static List<MenuCatalogItem> GetMenuCatalog()
    {
        if (!IsConfigured) return [];

        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandTimeout = 60;
        cmd.CommandText = @"
SELECT
    p.ProductId,
    c.Name AS CategoryName,
    p.Name,
    p.Description,
    p.Price,
    p.IsAvailable
FROM dbo.Products p
LEFT JOIN dbo.MenuCategories c ON c.CategoryId=p.CategoryId
WHERE p.IsDeleted=0
ORDER BY ISNULL(c.DisplayOrder,9999), ISNULL(p.DisplayOrder,9999), p.Name;";

        using var reader = cmd.ExecuteReader();
        var result = new List<MenuCatalogItem>();

        while (reader.Read())
        {
            result.Add(new MenuCatalogItem(
                reader.GetInt32(0),
                reader.IsDBNull(1) ? "Sin categoría" : reader.GetString(1),
                reader.IsDBNull(2) ? "Producto" : reader.GetString(2),
                reader.IsDBNull(3) ? "" : reader.GetString(3),
                reader.GetDecimal(4),
                !reader.IsDBNull(5) && reader.GetBoolean(5)));
        }

        return result;
    }

    public sealed record MenuCatalogItem(
        int ProductId,
        string CategoryName,
        string Name,
        string Description,
        decimal Price,
        bool IsAvailable);

    // Ejecuta el comando SQL preparado y devuelve su resultado.
    public static int Execute(string sql, IDictionary<string, object?> parameters)
    {
        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        cmd.CommandTimeout = 60;
        foreach (var pair in parameters)
        {
            var parameter = cmd.Parameters.Add("@" + pair.Key, SqlDbType.NVarChar, -1);
            parameter.Value = pair.Value ?? DBNull.Value;
        }
        return cmd.ExecuteNonQuery();
    }

    // Construye el contexto de datos que puede consultar la IA.
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

    // Recupera los últimos mensajes para que la conversación continúe sin empezar de cero.
    public static List<ChatHistoryRecord> GetRecentChatHistory(int accountId, int take = 12)
    {
        if (!IsConfigured || accountId <= 0)
            return [];

        using var connection = Open();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
SELECT TOP(@take) m.SenderType,m.MessageText
FROM dbo.ChatMessages m
INNER JOIN dbo.ChatSessions s ON s.ChatSessionId=m.ChatSessionId
WHERE s.AccountId=@accountId AND s.Status=N'Abierta'
ORDER BY m.ChatMessageId DESC;";
        cmd.Parameters.Add("@take", SqlDbType.Int).Value = Math.Clamp(take, 2, 30);
        cmd.Parameters.Add("@accountId", SqlDbType.Int).Value = accountId;

        using var rd = cmd.ExecuteReader();
        var result = new List<ChatHistoryRecord>();

        while (rd.Read())
            result.Add(new ChatHistoryRecord(rd.GetString(0), rd.GetString(1)));

        result.Reverse();
        return result;
    }

    public sealed record ChatHistoryRecord(string SenderType, string MessageText);

    // Guarda la conversación del chatbot en la base de datos.
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

// Comprueba que la conexión y los componentes principales de la base estén disponibles.
public sealed record DatabaseHealth(
    bool Connected,
    bool MasterKeyExists,
    bool CertificateExists,
    bool SymmetricKeyExists,
    bool EncryptionWorks,
    bool EmployeeUpdatedAt,
    bool PaidAtNullable,
    int AccountsCount,
    int EmployeeCount,
    int ProductCount);

}
