
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using ESFE.RestauranteBD.web.UI.Data;

namespace ESFE.RestauranteBD.web.UI.Models;

// Datos de la cuenta, acceso, perfil y estado del usuario.
public sealed class UserAccount
{
    // Identificador único de la cuenta.
    public int AccountId { get; set; }
    // Nombre completo del usuario.
    public string Nombre { get; set; } = string.Empty;
    // Correo electrónico utilizado por la cuenta.
    public string Email { get; set; } = string.Empty;
    // Número de teléfono asociado a la cuenta.
    public string Telefono { get; set; } = string.Empty;
    // Documento de identidad asociado a la cuenta.
    public string Dui { get; set; } = string.Empty;
    // Dirección registrada para la cuenta.
    public string Direccion { get; set; } = string.Empty;
    // Rol actual asignado al usuario.
    public string Rol { get; set; } = "Cliente";
    // Hash utilizado para validar la contraseña.
    public string PasswordHash { get; set; } = string.Empty;
    // Valor adicional usado para proteger el hash de la contraseña.
    public string PasswordSalt { get; set; } = string.Empty;
    // Cantidad de iteraciones usadas al derivar la contraseña.
    public int PasswordIterations { get; set; } = 120_000;
    // Tamaño de la clave derivada para la contraseña.
    public int PasswordKeyBytes { get; set; } = 32;
    // Indica si la contraseña debe cambiarse al iniciar sesión.
    public bool PasswordNeedsChange { get; set; }
    // Referencia a la foto almacenada en MediaAssets.
    // Identificador del archivo de foto almacenado en MediaAssets.
    public long? ProfilePhotoMediaAssetId { get; set; }
    // Datos de la foto de perfil disponibles para mostrarla.
    public string ProfilePhotoData { get; set; } = string.Empty;
    // Cantidad de intentos fallidos de inicio de sesión.
    public int FailedLoginCount { get; set; }
    // Fecha y hora hasta la que la cuenta permanece bloqueada.
    public DateTime? LockedUntil { get; set; }
    // Indica si la cuenta está activa.
    public bool Activo { get; set; } = true;
    // Fecha en la que se creó la cuenta.
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;
}

public static class UserStore
{
    private static readonly ConcurrentDictionary<string, UserAccount> Users =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["admin@restaurante.com"] = Create(
                "Administrador",
                "admin@restaurante.com",
                "7000-0000",
                "00000000-0",
                "Oficina administrativa",
                "Dueno",
                "123"),
            ["cliente@restaurante.com"] = Create(
                "Cliente Demo",
                "cliente@restaurante.com",
                "7000-0001",
                "00000001-1",
                "Dirección de demostración",
                "Cliente",
                "1234")
        };

    private static readonly object FileLock = new();
    private static readonly string LocalFile =
        Path.Combine(AppContext.BaseDirectory, "users.local.json");

    static UserStore() => LoadLocalUsers();

    // Obtiene la colección completa de registros disponibles.
    public static IReadOnlyCollection<UserAccount> All()
    {
        if (RestaurantDb.IsConfigured)
        {
            try
            {
                var dbUsers = RestaurantDb.GetAccounts();
                Users.Clear();

                foreach (var dbUser in dbUsers)
                {
                    if (!string.IsNullOrWhiteSpace(dbUser.Email))
                        Users[NormalizeEmail(dbUser.Email)] = dbUser;
                }

                return dbUsers.OrderBy(x => x.Nombre).ToArray();
            }
            catch
            {
                // SQL es la fuente de verdad cuando está configurado.
                return Users.Values
                    .Where(x => x.AccountId > 0)
                    .OrderBy(x => x.Nombre)
                    .ToArray();
            }
        }

        return Users.Values.OrderBy(x => x.Nombre).ToArray();
    }

    // Busca una cuenta y devuelve sus datos si existe.
    public static bool TryGet(
        string email,
        out UserAccount? user,
        bool includeInactive = false)
    {
        var normalized = NormalizeEmail(email);

        if (RestaurantDb.IsConfigured)
        {
            try
            {
                var dbUser = RestaurantDb.GetAccount(normalized, includeInactive);

                if (dbUser is not null)
                {
                    Users[normalized] = dbUser;
                    user = dbUser;
                    return true;
                }

                user = null;
                return false;
            }
            catch
            {
                user = null;
                return false;
            }
        }

        return Users.TryGetValue(normalized, out user);
    }

    // Agrega un nuevo elemento a la interfaz.
    public static bool Add(UserAccount user)
    {
        var key = NormalizeEmail(user.Email);

        if (RestaurantDb.IsConfigured)
        {
            try
            {
                if (!RestaurantDb.CreateAccount(user))
                    return false;
            }
            catch
            {
                return false;
            }

            var dbUser = RestaurantDb.GetAccount(key);
            if (dbUser is not null)
                user = dbUser;
        }

        if (!Users.TryAdd(key, user))
            return false;

        SaveLocalUsers();
        return true;
    }

    // Actualiza un registro existente con los nuevos datos.
    public static bool Update(UserAccount user)
    {
        var key = NormalizeEmail(user.Email);

        if (RestaurantDb.IsConfigured)
        {
            try
            {
                if (user.AccountId <= 0)
                {
                    var dbUser = RestaurantDb.GetAccount(key);
                    if (dbUser is not null)
                        user.AccountId = dbUser.AccountId;
                }

                if (user.AccountId <= 0 || !RestaurantDb.UpdateAccount(user))
                    return false;
            }
            catch
            {
                return false;
            }
        }

        Users[key] = user;
        SaveLocalUsers();
        return true;
    }

    // Normaliza el correo para mantener un formato consistente.
    public static string NormalizeEmail(string? email) =>
        (email ?? string.Empty).Trim().ToLowerInvariant();

    // Carga de respaldo para ejecución local sin SQL Server.
    // Carga los usuarios guardados localmente cuando la base de datos no está disponible.
    private static void LoadLocalUsers()
    {
        if (RestaurantDb.IsConfigured)
            return;

        try
        {
            if (!File.Exists(LocalFile))
                return;

            var json = File.ReadAllText(LocalFile);
            var localUsers = JsonSerializer.Deserialize<List<UserAccount>>(json) ?? [];

            foreach (var user in localUsers)
            {
                if (string.IsNullOrWhiteSpace(user.Email)
                    || string.IsNullOrWhiteSpace(user.PasswordHash)
                    || string.IsNullOrWhiteSpace(user.PasswordSalt))
                {
                    continue;
                }

                user.Email = NormalizeEmail(user.Email);
                if (string.IsNullOrWhiteSpace(user.Rol))
                    user.Rol = "Cliente";

                Users[user.Email] = user;
            }
        }
        catch
        {
            // Los usuarios demo de código permanecen disponibles.
        }
    }

    // Registros locales utilizados como respaldo de las cuentas.
    private static void SaveLocalUsers()
    {
        if (RestaurantDb.IsConfigured)
            return;

        try
        {
            lock (FileLock)
            {
                var snapshot = Users.Values
                    .OrderBy(x => x.Email)
                    .Select(x => new UserAccount
                    {
                        AccountId = x.AccountId,
                        Nombre = x.Nombre,
                        Email = x.Email,
                        Telefono = x.Telefono,
                        Dui = x.Dui,
                        Direccion = x.Direccion,
                        Rol = x.Rol,
                        ProfilePhotoMediaAssetId = x.ProfilePhotoMediaAssetId,
                        ProfilePhotoData = x.ProfilePhotoData,
                        PasswordHash = x.PasswordHash,
                        PasswordSalt = x.PasswordSalt,
                        PasswordIterations = x.PasswordIterations,
                        PasswordKeyBytes = x.PasswordKeyBytes,
                        PasswordNeedsChange = x.PasswordNeedsChange,
                        Activo = x.Activo,
                        CreadoEn = x.CreadoEn
                    })
                    .ToList();

                File.WriteAllText(
                    LocalFile,
                    JsonSerializer.Serialize(
                        snapshot,
                        new JsonSerializerOptions { WriteIndented = true }));
            }
        }
        catch
        {
            // El respaldo local no debe impedir el funcionamiento de la aplicación.
        }
    }

    // Crea un nuevo registro con los datos recibidos.
    public static UserAccount Create(
        string nombre,
        string email,
        string telefono,
        string dui,
        string direccion,
        string rol,
        string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password ?? string.Empty,
            salt,
            120_000,
            HashAlgorithmName.SHA256,
            32);

        return new UserAccount
        {
            Nombre = nombre.Trim(),
            Email = NormalizeEmail(email),
            Telefono = telefono.Trim(),
            Dui = dui.Trim(),
            Direccion = direccion.Trim(),
            Rol = rol,
            PasswordHash = Convert.ToBase64String(hash),
            PasswordSalt = Convert.ToBase64String(salt),
            CreadoEn = DateTime.UtcNow,
            Activo = true,
            PasswordIterations = 120_000,
            PasswordKeyBytes = 32
        };
    }

    // Actualiza la contraseña de la cuenta.
    public static bool ChangePassword(UserAccount user, string password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return false;

        if (RestaurantDb.IsConfigured)
        {
            try
            {
                if (user.AccountId <= 0)
                {
                    var db = RestaurantDb.GetAccount(user.Email, true);
                    if (db is null)
                        return false;

                    user.AccountId = db.AccountId;
                }

                if (!RestaurantDb.ChangePassword(user.AccountId, password))
                    return false;

                var refreshed = RestaurantDb.GetAccount(user.Email, true);
                if (refreshed is null)
                    return false;

                user.PasswordHash = refreshed.PasswordHash;
                user.PasswordSalt = refreshed.PasswordSalt;
                user.PasswordIterations = refreshed.PasswordIterations;
                user.PasswordKeyBytes = refreshed.PasswordKeyBytes;
                user.PasswordNeedsChange = refreshed.PasswordNeedsChange;
                user.FailedLoginCount = refreshed.FailedLoginCount;
                user.LockedUntil = refreshed.LockedUntil;
                Users[NormalizeEmail(user.Email)] = user;
                return true;
            }
            catch
            {
                return false;
            }
        }

        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            120_000,
            HashAlgorithmName.SHA256,
            32);

        user.PasswordHash = Convert.ToBase64String(hash);
        user.PasswordSalt = Convert.ToBase64String(salt);
        user.PasswordIterations = 120_000;
        user.PasswordKeyBytes = 32;
        user.PasswordNeedsChange = false;
        Users[NormalizeEmail(user.Email)] = user;
        SaveLocalUsers();
        return true;
    }

    // Obtiene o actualiza el rol de la cuenta según la operación realizada.
    public static bool ChangeRole(UserAccount user, string role, bool? active = null)
    {
        if (user is null
            || user.AccountId <= 0
            || string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        role = role.Trim();

        if (RestaurantDb.IsConfigured)
        {
            try
            {
                if (!RestaurantDb.UpdateAccountRole(user.AccountId, role, active))
                    return false;
            }
            catch
            {
                return false;
            }
        }

        user.Rol = role;
        if (active.HasValue)
            user.Activo = active.Value;

        Users[NormalizeEmail(user.Email)] = user;
        SaveLocalUsers();
        return true;
    }

    // Convierte una cuenta en trabajador y crea su perfil.
    public static bool PromoteToWorker(UserAccount user, string role, string password)
    {
        if (user is null
            || user.AccountId <= 0
            || string.IsNullOrWhiteSpace(role)
            || string.IsNullOrWhiteSpace(password))
        {
            return false;
        }

        if (RestaurantDb.IsConfigured)
        {
            try
            {
                if (!RestaurantDb.PromoteAccountToWorker(user.AccountId, role, password))
                    return false;

                var refreshed = RestaurantDb.GetAccount(user.Email, true);
                if (refreshed is null)
                    return false;

                Users[NormalizeEmail(user.Email)] = refreshed;
                user.Rol = refreshed.Rol;
                user.Activo = refreshed.Activo;
                user.PasswordHash = refreshed.PasswordHash;
                user.PasswordSalt = refreshed.PasswordSalt;
                user.PasswordIterations = refreshed.PasswordIterations;
                user.PasswordKeyBytes = refreshed.PasswordKeyBytes;
                user.PasswordNeedsChange = refreshed.PasswordNeedsChange;
                return true;
            }
            catch
            {
                return false;
            }
        }

        user.Rol = role.Trim();
        return ChangePassword(user, password);
    }

    // Valida las credenciales y obtiene la cuenta del usuario.
    public static bool Authenticate(
        string email,
        string password,
        out UserAccount? user)
    {
        user = null;

        if (!TryGet(email, out var candidate)
            || candidate is null
            || !candidate.Activo)
        {
            return false;
        }

        if (candidate.LockedUntil.HasValue
            && candidate.LockedUntil.Value > DateTime.UtcNow)
        {
            return false;
        }

        try
        {
            var salt = Convert.FromBase64String(candidate.PasswordSalt);
            var expected = Convert.FromBase64String(candidate.PasswordHash);
            var iterations = candidate.PasswordIterations > 0
                ? candidate.PasswordIterations
                : 120_000;

            var actual = Rfc2898DeriveBytes.Pbkdf2(
                password ?? string.Empty,
                salt,
                iterations,
                HashAlgorithmName.SHA256,
                expected.Length);

            if (!CryptographicOperations.FixedTimeEquals(actual, expected))
            {
                if (RestaurantDb.IsConfigured && candidate.AccountId > 0)
                {
                    try
                    {
                        RestaurantDb.RecordLoginFailure(candidate.AccountId);
                    }
                    catch
                    {
                        // El registro de auditoría no debe bloquear el login.
                    }
                }

                return false;
            }

            if (RestaurantDb.IsConfigured && candidate.AccountId > 0)
            {
                try
                {
                    RestaurantDb.RecordLoginSuccess(candidate.AccountId);
                }
                catch
                {
                    // El registro de auditoría no debe bloquear el login.
                }
            }

            user = candidate;
            return true;
        }
        catch
        {
            return false;
        }
    }
}
