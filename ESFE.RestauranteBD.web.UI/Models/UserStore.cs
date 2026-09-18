using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using ESFE.RestauranteBD.web.UI.Data;

namespace ESFE.RestauranteBD.web.UI.Models;

public sealed class UserAccount
{
    public int AccountId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Telefono { get; set; } = string.Empty;
    public string Dui { get; set; } = string.Empty;
    public string Direccion { get; set; } = string.Empty;
    public string Rol { get; set; } = "Cliente";
    public string PasswordHash { get; set; } = string.Empty;
    public string PasswordSalt { get; set; } = string.Empty;
    public int PasswordIterations { get; set; } = 120_000;
    public int PasswordKeyBytes { get; set; } = 32;
    public bool PasswordNeedsChange { get; set; }
    public string ProfilePhotoData { get; set; } = string.Empty;
    public bool Activo { get; set; } = true;
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;
}

public static class UserStore
{
    private static readonly ConcurrentDictionary<string, UserAccount> Users = new(StringComparer.OrdinalIgnoreCase)
    {
        ["admin@restaurante.com"] = Create("Administrador", "admin@restaurante.com", "7000-0000", "00000000-0", "Oficina administrativa", "Dueno", "123"),
        ["cliente@restaurante.com"] = Create("Cliente Demo", "cliente@restaurante.com", "7000-0001", "00000001-1", "Dirección de demostración", "Cliente", "1234")
    };

    private static readonly object FileLock = new();
    private static readonly string LocalFile = Path.Combine(AppContext.BaseDirectory, "users.local.json");

    static UserStore() => LoadLocalUsers();

    public static IReadOnlyCollection<UserAccount> All()
    {
        if (RestaurantDb.IsConfigured)
        {
            try
            {
                var dbUsers = RestaurantDb.GetAccounts();
                foreach (var dbUser in dbUsers)
                {
                    if (!string.IsNullOrWhiteSpace(dbUser.Email)) Users[NormalizeEmail(dbUser.Email)] = dbUser;
                }
            }
            catch { }
        }
        return Users.Values.OrderBy(x => x.Nombre).ToArray();
    }

    public static bool TryGet(string email, out UserAccount? user)
    {
        var normalized = NormalizeEmail(email);
        if (RestaurantDb.IsConfigured)
        {
            try
            {
                var dbUser = RestaurantDb.GetAccount(normalized);
                if (dbUser is not null)
                {
                    if (Users.TryGetValue(normalized, out var local) && !string.IsNullOrWhiteSpace(local.ProfilePhotoData)) dbUser.ProfilePhotoData = local.ProfilePhotoData;
                    Users[normalized] = dbUser;
                    user = dbUser;
                    return true;
                }
            }
            catch { }
        }
        return Users.TryGetValue(normalized, out user);
    }

    public static bool Add(UserAccount user)
    {
        var key = NormalizeEmail(user.Email);
        if (RestaurantDb.IsConfigured)
        {
            try { if (!RestaurantDb.CreateAccount(user)) return false; }
            catch { return false; }
            var dbUser = RestaurantDb.GetAccount(key);
            if (dbUser is not null) user = dbUser;
        }
        if (!Users.TryAdd(key, user)) return false;
        SaveLocalUsers();
        return true;
    }

    public static bool Update(UserAccount user)
    {
        var key = NormalizeEmail(user.Email);
        if (RestaurantDb.IsConfigured)
        {
            try { if (user.AccountId <= 0) { var dbUser = RestaurantDb.GetAccount(key); if (dbUser is not null) user.AccountId = dbUser.AccountId; } if (user.AccountId <= 0 || !RestaurantDb.UpdateAccount(user)) return false; }
            catch { return false; }
        }
        Users[key] = user;
        SaveLocalUsers();
        return true;
    }

    public static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static void LoadLocalUsers()
    {
        try
        {
            if (!File.Exists(LocalFile)) return;
            var json = File.ReadAllText(LocalFile);
            var localUsers = JsonSerializer.Deserialize<List<UserAccount>>(json) ?? [];
            foreach (var user in localUsers)
            {
                if (string.IsNullOrWhiteSpace(user.Email) || string.IsNullOrWhiteSpace(user.PasswordHash) || string.IsNullOrWhiteSpace(user.PasswordSalt)) continue;
                user.Email = NormalizeEmail(user.Email);
                if (string.IsNullOrWhiteSpace(user.Rol)) user.Rol = "Cliente";
                Users[user.Email] = user;
            }
        }
        catch { }
    }

    private static void SaveLocalUsers()
    {
        try
        {
            lock (FileLock)
            {
                var snapshot = Users.Values.OrderBy(x => x.Email).Select(x => new UserAccount
                {
                    AccountId=x.AccountId,Nombre=x.Nombre,Email=x.Email,Telefono=x.Telefono,Dui=x.Dui,Direccion=x.Direccion,Rol=x.Rol,
                    ProfilePhotoData=x.ProfilePhotoData,PasswordHash=x.PasswordHash,PasswordSalt=x.PasswordSalt,PasswordIterations=x.PasswordIterations,
                    PasswordKeyBytes=x.PasswordKeyBytes,PasswordNeedsChange=x.PasswordNeedsChange,Activo=x.Activo,CreadoEn=x.CreadoEn
                }).ToList();
                File.WriteAllText(LocalFile, JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { WriteIndented = true }));
            }
        }
        catch { }
    }

    public static UserAccount Create(string nombre, string email, string telefono, string dui, string direccion, string rol, string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password ?? string.Empty, salt, 120_000, HashAlgorithmName.SHA256, 32);
        return new UserAccount { Nombre=nombre.Trim(),Email=NormalizeEmail(email),Telefono=telefono.Trim(),Dui=dui.Trim(),Direccion=direccion.Trim(),Rol=rol,PasswordHash=Convert.ToBase64String(hash),PasswordSalt=Convert.ToBase64String(salt),CreadoEn=DateTime.UtcNow,Activo=true,PasswordIterations=120_000,PasswordKeyBytes=32 };
    }

    public static bool ChangePassword(UserAccount user, string password)
    {
        if (string.IsNullOrWhiteSpace(password)) return false;
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 120_000, HashAlgorithmName.SHA256, 32);
        user.PasswordHash = Convert.ToBase64String(hash);
        user.PasswordSalt = Convert.ToBase64String(salt);
        user.PasswordIterations=120_000; user.PasswordKeyBytes=32; user.PasswordNeedsChange=false;
        if (RestaurantDb.IsConfigured)
        {
            try { if (user.AccountId <= 0) { var db=RestaurantDb.GetAccount(user.Email); if(db is not null)user.AccountId=db.AccountId; } if(user.AccountId<=0 || !RestaurantDb.ChangePassword(user.AccountId,password)) return false; }
            catch { return false; }
        }
        Users[NormalizeEmail(user.Email)] = user; SaveLocalUsers(); return true;
    }

    public static bool Authenticate(string email, string password, out UserAccount? user)
    {
        user = null;
        if (!TryGet(email, out var candidate) || candidate is null || !candidate.Activo) return false;
        try
        {
            var salt = Convert.FromBase64String(candidate.PasswordSalt);
            var expected = Convert.FromBase64String(candidate.PasswordHash);
            var iterations = candidate.PasswordIterations > 0 ? candidate.PasswordIterations : 120_000;
            var actual = Rfc2898DeriveBytes.Pbkdf2(password ?? string.Empty, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            if (!CryptographicOperations.FixedTimeEquals(actual, expected)) return false;
            user = candidate; return true;
        }
        catch { return false; }
    }
}
