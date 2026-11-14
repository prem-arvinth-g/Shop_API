namespace ShopApi.Services;

// Sends email through Brevo's HTTPS API (port 443).
// Not SMTP: Render's free plan blocks outgoing SMTP ports (25/465/587), so SMTP just hangs there.
// If BREVO_API_KEY is not set (your PC), the email is printed in the server console instead.
public class EmailService(HttpClient http, IConfiguration cfg, ILogger<EmailService> log)
{
    public async Task Send(string to, string subject, string body, string? html = null)
    {
        var apiKey = cfg["BREVO_API_KEY"];
        if (string.IsNullOrEmpty(apiKey))
        {
            log.LogWarning("BREVO_API_KEY not set. Email to {To}: {Body}", to, body);
            return;
        }

        var req = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email")
        {
            Content = JsonContent.Create(new
            {
                sender = new { name = "Anand Cotton Sarees", email = cfg["EMAIL_FROM"] },   // must be a verified sender in Brevo
                to = new[] { new { email = to } },
                subject,
                textContent = body,   // plain version for old mail apps
                htmlContent = html,   // styled version most apps show
            }),
        };
        req.Headers.Add("api-key", apiKey);

        var res = await http.SendAsync(req);
        if (!res.IsSuccessStatusCode)
        {
            // Brevo's reply says exactly what's wrong (bad key, unverified sender...). Log it; show the user a simple message.
            log.LogError("Brevo send failed {Status}: {Reply}", (int)res.StatusCode, await res.Content.ReadAsStringAsync());
            throw new AppError("We couldn't send the email right now. Please try again in a minute.");
        }
    }
}
