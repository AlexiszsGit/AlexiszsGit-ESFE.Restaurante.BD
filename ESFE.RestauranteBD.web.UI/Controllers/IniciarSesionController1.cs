using System.Collections.Concurrent;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;

namespace ESFE.RestauranteBD.web.UI.Controllers
{
    public class IniciarSesion1Controller : Controller
    {
        // Usuarios en memoria por ahora. La base de datos se integrará después sin cambiar el flujo de la UI.
        private static readonly ConcurrentDictionary<string, UsuarioLocal> Users = new(StringComparer.OrdinalIgnoreCase)
        {
            ["admin@restaurante.com"] = CreateUser("Dueño", "admin@restaurante.com", "", "123", true),
            ["cliente@restaurante.com"] = CreateUser("Cliente Demo", "cliente@restaurante.com", "", "1234", false)
        };

        [HttpGet]
        public IActionResult Index() => View();

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Login(string email, string password, bool remember = false)
        {
            var normalizedEmail = NormalizeEmail(email);
            if (!TryAuthenticate(normalizedEmail, password, out var user))
            {
                ViewBag.Error = "Correo o contraseña incorrectos.";
                ViewBag.Email = email;
                ViewBag.ActiveTab = "login";
                return View("Index");
            }

            HttpContext.Session.SetString("UsuarioLogueado", user!.Email);
            HttpContext.Session.SetString("RolUsuario", user.EsDueno ? "Dueno" : "Cliente");
            HttpContext.Session.SetString("NombreUsuario", user.Nombre);
            TempData["UsuarioLogueado"] = user.Email;
            TempData["NombreUsuario"] = user.Nombre;
            TempData["LoginExitoso"] = "1";

            if (remember)
            {
                Response.Cookies.Append("RestauranteBD.Remember", user.Email, new CookieOptions
                {
                    HttpOnly = false,
                    IsEssential = true,
                    MaxAge = TimeSpan.FromDays(30),
                    SameSite = SameSiteMode.Lax,
                    Secure = Request.IsHttps
                });
            }
            else
            {
                Response.Cookies.Delete("RestauranteBD.Remember");
            }

            return RedirectToAction("Index", "Inicio1");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Registrar(string nombre, string email, string telefono, string password, string confirmPassword)
        {
            nombre = (nombre ?? string.Empty).Trim();
            email = NormalizeEmail(email);
            telefono = (telefono ?? string.Empty).Trim();
            password ??= string.Empty;
            confirmPassword ??= string.Empty;

            if (nombre.Length < 3)
                return RegisterError("Escribe un nombre válido de al menos 3 caracteres.", nombre, email, telefono);

            if (!IsValidEmail(email))
                return RegisterError("Escribe un correo electrónico válido.", nombre, email, telefono);

            var phoneDigits = new string(telefono.Where(char.IsDigit).ToArray());
            if (!string.IsNullOrWhiteSpace(telefono) && phoneDigits.Length < 8)
                return RegisterError("El teléfono debe tener al menos 8 dígitos.", nombre, email, telefono);

            if (password.Length < 8 || !password.Any(char.IsUpper) || !password.Any(char.IsLower) || !password.Any(char.IsDigit))
                return RegisterError("La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.", nombre, email, telefono);

            if (!string.Equals(password, confirmPassword, StringComparison.Ordinal))
                return RegisterError("Las contraseñas no coinciden.", nombre, email, telefono);

            if (!Users.TryAdd(email, CreateUser(nombre, email, telefono, password, false)))
                return RegisterError("Ese correo ya tiene una cuenta registrada.", nombre, email, telefono);

            ViewBag.Success = "Cuenta creada correctamente. Ahora puedes iniciar sesión.";
            ViewBag.ActiveTab = "login";
            ViewBag.Email = email;
            return View("Index");
        }

        [HttpGet]
        public IActionResult CerrarSesion()
        {
            HttpContext.Session.Clear();
            TempData.Clear();
            Response.Cookies.Delete("RestauranteBD.Remember");
            return RedirectToAction("Index");
        }

        private IActionResult RegisterError(string message, string nombre, string email, string telefono)
        {
            ViewBag.Error = message;
            ViewBag.ActiveTab = "register";
            ViewBag.RegisterName = nombre;
            ViewBag.RegisterEmail = email;
            ViewBag.RegisterPhone = telefono;
            return View("Index");
        }

        private static bool TryAuthenticate(string email, string password, out UsuarioLocal? user)
        {
            user = null;
            if (!Users.TryGetValue(email, out var candidate)) return false;
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

        private static UsuarioLocal CreateUser(string nombre, string email, string telefono, string password, bool esDueno)
        {
            var salt = RandomNumberGenerator.GetBytes(16);
            var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 120_000, HashAlgorithmName.SHA256, 32);
            return new UsuarioLocal
            {
                Nombre = nombre,
                Email = email,
                Telefono = telefono,
                PasswordHash = Convert.ToBase64String(hash),
                PasswordSalt = Convert.ToBase64String(salt),
                EsDueno = esDueno
            };
        }

        private static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();
        private static bool IsValidEmail(string email) => email.Length >= 6 && email.Contains('@') && email.Contains('.') && !email.Contains(' ');

        private sealed class UsuarioLocal
        {
            public string Nombre { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string Telefono { get; set; } = string.Empty;
            public string PasswordHash { get; set; } = string.Empty;
            public string PasswordSalt { get; set; } = string.Empty;
            public bool EsDueno { get; set; }
        }
    }
}
