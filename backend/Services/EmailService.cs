using System.Net;
using System.Net.Mail;

namespace ShopApi.Services;

// Sends email through any SMTP provider (Brevo, Resend, Gmail app password...).
// If SMTP_HOST is not set (your PC), the email is printed in the server console instead.
public class EmailService(IConfiguration cfg, ILogger<EmailService> log)
{
    public async Task Send(string to, string subject, string body)
    {
        var host = cfg["SMTP_HOST"];
        if (string.IsNullOrEmpty(host))
        {
            log.LogWarning("SMTP not configured. Email to {To}: {Body}", to, body);
            return;
        }
        using var smtp = new SmtpClient(host, int.Parse(cfg["SMTP_PORT"] ?? "587"))
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(cfg["SMTP_USER"], cfg["SMTP_PASS"]),
        };
        await smtp.SendMailAsync(new MailMessage(cfg["SMTP_FROM"]!, to, subject, body));
    }
}
