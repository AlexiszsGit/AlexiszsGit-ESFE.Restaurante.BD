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
        var fromName = Get("FromName");
        if (string.IsNullOrWhiteSpace(fromName) || fromName.Equals("RestauranteBD", StringComparison.OrdinalIgnoreCase))
            fromName = "Equipo de soporte";
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

    // Arma un correo de seguridad limpio y reconocible para reducir confusiones.
    private static string BuildVerificationMessage(string name, string code, string action)
    {
        var safeName = System.Net.WebUtility.HtmlEncode(name ?? "");
        var safeAction = System.Net.WebUtility.HtmlEncode(action ?? "continuar");
        var safeCode = System.Net.WebUtility.HtmlEncode(code ?? "");

        return $"""
<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;background:#f3f1eb;font-family:Inter,Segoe UI,Arial,Helvetica,sans-serif;color:#1b2430;">
  <div style="max-width:640px;margin:36px auto;padding:0 16px;">
    <div style="background:#0d1727;border-radius:24px 24px 0 0;padding:28px 30px;">
      <div style="font-size:11px;letter-spacing:2.4px;font-weight:800;color:#d7b566;text-transform:uppercase;">Equipo de soporte</div>
      <div style="margin-top:8px;font-size:24px;font-weight:800;color:#ffffff;">Confirma tu cuenta</div>
      <div style="margin-top:7px;font-size:13px;color:#d6dde7;line-height:1.5;">Un paso rápido para mantener tu cuenta protegida.</div>
    </div>
    <div style="background:#ffffff;border:1px solid #e6e0d4;border-top:0;border-radius:0 0 24px 24px;padding:32px 30px;box-shadow:0 18px 45px rgba(18,24,36,.08);">
      <p style="margin:0 0 12px;font-size:15px;">Hola {safeName},</p>
      <p style="margin:0;color:#616a75;line-height:1.7;">Recibimos una solicitud para <strong>{safeAction}</strong>. Escribe este código en la pantalla de seguridad:</p>
      <div style="margin:28px 0;padding:24px 18px;text-align:center;border:1px solid #e8dcc2;background:#fffaf0;border-radius:20px;">
        <div style="font-size:10px;letter-spacing:2px;font-weight:800;color:#86652e;text-transform:uppercase;">Código de seguridad</div>
        <div style="margin-top:11px;font-size:40px;line-height:1;letter-spacing:12px;font-weight:900;color:#172033;">{safeCode}</div>
      </div>
      <div style="padding:14px 16px;border-radius:14px;background:#f7f6f2;color:#69727c;font-size:12px;line-height:1.6;">Este código es válido durante 10 minutos y solo puede usarse una vez.</div>
      <p style="margin:18px 0 0;color:#8a929c;font-size:11px;line-height:1.6;">Si no hiciste esta solicitud, no tienes que hacer nada. Nunca compartas este código.</p>
      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #ece8df;color:#98a0a8;font-size:10px;">Mensaje automático de seguridad · No respondas a este correo.</div>
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
