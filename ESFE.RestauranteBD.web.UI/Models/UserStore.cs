using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace ESFE.RestauranteBD.web.UI.Models;

public sealed class UserAccount
{
    public string Nombre { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Telefono { get; set; } = string.Empty;
    public string Dui { get; set; } = string.Empty;
    public string Direccion { get; set; } = string.Empty;
    public string Rol { get; set; } = "Cliente";
    public string PasswordHash { get; set; } = string.Empty;
    public string PasswordSalt { get; set; } = string.Empty;
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

    public static IReadOnlyCollection<UserAccount> All() => Users.Values.OrderBy(x => x.Nombre).ToArray();
    public static bool TryGet(string email, out UserAccount? user) => Users.TryGetValue(NormalizeEmail(email), out user);
    public static bool Add(UserAccount user) => Users.TryAdd(NormalizeEmail(user.Email), user);
    public static bool Update(UserAccount user)
    {
        var key = NormalizeEmail(user.Email);
        if (!Users.TryGetValue(key, out var current)) return false;
        return Users.TryUpdate(key, user, current);
    }
    public static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    public static UserAccount Create(string nombre, string email, string telefono, string dui, string direccion, string rol, string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password ?? string.Empty, salt, 120_000, HashAlgorithmName.SHA256, 32);
        return new UserAccount
        {
            Nombre = nombre.Trim(), Email = NormalizeEmail(email), Telefono = telefono.Trim(), Dui = dui.Trim(),
            Direccion = direccion.Trim(), Rol = rol, PasswordHash = Convert.ToBase64String(hash),
            PasswordSalt = Convert.ToBase64String(salt), CreadoEn = DateTime.UtcNow, Activo = true
        };
    }


    public static bool ChangePassword(UserAccount user, string password)
    {
        if (string.IsNullOrWhiteSpace(password)) return false;

        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            120_000,
            HashAlgorithmName.SHA256,
            32);

        user.PasswordHash = Convert.ToBase64String(hash);
        user.PasswordSalt = Convert.ToBase64String(salt);
        return Update(user);
    }

    public static bool Authenticate(string email, string password, out UserAccount? user)
    {
        user = null;
        if (!TryGet(email, out var candidate) || candidate is null || !candidate.Activo) return false;
        try
        {
            var salt = Convert.FromBase64String(candidate.PasswordSalt);
            var expected = Convert.FromBase64String(candidate.PasswordHash);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password ?? string.Empty, salt, 120_000, HashAlgorithmName.SHA256, expected.Length);
            if (!CryptographicOperations.FixedTimeEquals(actual, expected)) return false;
            user = candidate;
            return true;
        }
        catch
        {
            return false;
        }
    }
}
