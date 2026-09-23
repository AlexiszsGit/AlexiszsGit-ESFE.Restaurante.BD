using System.Net;
using System.Net.Mail;
using System.Text;

namespace ESFE.RestauranteBD.web.UI.Services;

// Se encarga de enviar los correos que necesita el sistema.
public sealed class EmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    // Indica si el servidor de correo está listo para usarse.
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Get("Host")) &&
        !string.IsNullOrWhiteSpace(Get("User")) &&
        !string.IsNullOrWhiteSpace(Get("Password")) &&
        !string.IsNullOrWhiteSpace(Get("From"));

    // Envía el código para confirmar una cuenta nueva.
    public Task SendVerificationCodeAsync(string email, string name, string code, CancellationToken cancellationToken = default)
    {
        return SendAsync(
            new[] { email },
            "Código de verificación de tu cuenta",
            BuildVerificationMessage(name, code, "verificar tu cuenta"),
            cancellationToken);
    }

    // Envía el código para recuperar una contraseña.
    public Task SendPasswordResetCodeAsync(string email, string name, string code, CancellationToken cancellationToken = default)
    {
        return SendAsync(
            new[] { email },
            "Código para recuperar tu contraseña",
            BuildVerificationMessage(name, code, "recuperar tu contraseña"),
            cancellationToken);
    }

    // Envía un mensaje escrito desde el centro de correo.
    public Task SendMessageAsync(
        IEnumerable<string> recipients,
        string subject,
        string body,
        IEnumerable<string>? cc = null,
        IEnumerable<string>? bcc = null,
        IEnumerable<EmailAttachment>? attachments = null,
        CancellationToken cancellationToken = default)
    {
        return SendAsync(recipients, subject, body, cancellationToken, cc, bcc, attachments);
    }

    // Envía el correo usando el servidor SMTP configurado en el hosting.
    private async Task SendAsync(
        IEnumerable<string> recipients,
        string subject,
        string body,
        CancellationToken cancellationToken,
        IEnumerable<string>? cc = null,
        IEnumerable<string>? bcc = null,
        IEnumerable<EmailAttachment>? attachments = null)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("El correo no está configurado en el servidor.");

        cancellationToken.ThrowIfCancellationRequested();

        var host = Get("Host")!;
        var port = GetInt("Port", 587);
        var user = Get("User")!;
        var password = Get("Password")!;
        var from = Get("From")!;
        var fromName = Get("FromName") ?? "RestauranteBD";
        var enableSsl = GetBool("EnableSsl", true);

        using var message = new MailMessage
        {
            From = new MailAddress(from, fromName, Encoding.UTF8),
            Subject = subject,
            Body = body,
            IsBodyHtml = true,
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8
        };

        foreach (var recipient in recipients.Where(IsValidAddress))
            message.To.Add(new MailAddress(recipient));

        AddRecipients(message.CC, cc);
        AddRecipients(message.Bcc, bcc);

        var attachmentStreams = new List<MemoryStream>();
        try
        {
            foreach (var file in attachments ?? [])
            {
                var stream = new MemoryStream(file.Content, writable: false);
                attachmentStreams.Add(stream);
                message.Attachments.Add(new Attachment(stream, file.FileName, file.ContentType));
            }

            using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl,
            Credentials = new NetworkCredential(user, password),
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Timeout = 30000
        };

            try
            {
                await client.SendMailAsync(message, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "No se pudo enviar el correo del centro de comunicación.");
                throw;
            }
        }
        finally
        {
            foreach (var stream in attachmentStreams)
                stream.Dispose();
        }
    }

    // Agrega los correos de Cc o Cco.
    private static void AddRecipients(MailAddressCollection collection, IEnumerable<string>? values)
    {
        if (values is null)
            return;

        foreach (var value in values.Where(IsValidAddress))
            collection.Add(new MailAddress(value));
    }

    private static bool IsValidAddress(string value) =>
        MailAddress.TryCreate(value, out _);

    public sealed record EmailAttachment(
        string FileName,
        string ContentType,
        byte[] Content);

    // Arma el correo de seguridad con un diseño claro y sencillo.
    private static string BuildVerificationMessage(string name, string code, string action)
    {
        var safeName = System.Net.WebUtility.HtmlEncode(name ?? "");
        var safeAction = System.Net.WebUtility.HtmlEncode(action ?? "continuar");
        var safeCode = System.Net.WebUtility.HtmlEncode(code ?? "");

        return $"""
<!doctype html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f1eb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
  <div style="max-width:620px;margin:32px auto;padding:0 16px;">
    <div style="background:#0d1727;border-radius:22px 22px 0 0;padding:24px 28px;">
      <div style="font-size:12px;letter-spacing:3px;font-weight:700;color:#d7b566;text-transform:uppercase;">RestauranteBD</div>
      <div style="margin-top:5px;font-size:22px;font-weight:800;color:#fff;">Seguridad de tu cuenta</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e0d6;border-top:0;border-radius:0 0 22px 22px;padding:30px 28px;box-shadow:0 18px 45px rgba(18,24,36,.08);">
      <p style="margin:0 0 10px;font-size:15px;">Hola {safeName},</p>
      <p style="margin:0;color:#606872;line-height:1.7;">Recibimos una solicitud para <strong>{safeAction}</strong>. Usa el siguiente código para continuar:</p>
      <div style="margin:26px 0;padding:20px;text-align:center;border:1px solid #eadfc9;background:#fffaf0;border-radius:18px;">
        <div style="font-size:10px;letter-spacing:2px;font-weight:800;color:#8b6a31;text-transform:uppercase;">Código de seguridad</div>
        <div style="margin-top:10px;font-size:38px;letter-spacing:10px;font-weight:900;color:#172033;">{safeCode}</div>
      </div>
      <p style="margin:0;color:#737b85;font-size:12px;line-height:1.6;">Este código vence en 10 minutos. Si no realizaste esta solicitud, puedes ignorar este mensaje.</p>
      <p style="margin:20px 0 0;color:#9399a1;font-size:11px;line-height:1.6;">Por seguridad, no compartas este código con nadie.</p>
      <div style="margin-top:26px;padding-top:16px;border-top:1px solid #eeeae3;color:#969ca3;font-size:10px;">Mensaje automático de RestauranteBD.</div>
    </div>
  </div>
</body>
</html>
""";
    }

    private string? Get(string key) =>
        Environment.GetEnvironmentVariable($"SMTP_{key}")
        ?? Environment.GetEnvironmentVariable($"SMTP__{key}")
        ?? _configuration[$"Smtp:{key}"];

    private int GetInt(string key, int fallback)
        => int.TryParse(Get(key), out var value) ? value : fallback;

    private bool GetBool(string key, bool fallback)
        => bool.TryParse(Get(key), out var value) ? value : fallback;
}
