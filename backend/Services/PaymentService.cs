using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ShopApi.Services;

// Talks to Razorpay. Keys come from environment variables, never from code.
// Without keys, Development uses a fake "test payment" so you can try the shop; Production refuses.
public class PaymentService(HttpClient http, IConfiguration cfg, IHostEnvironment env)
{
    string? KeyId => cfg["RAZORPAY_KEY_ID"];
    string? KeySecret => cfg["RAZORPAY_KEY_SECRET"];
    public bool Enabled => !string.IsNullOrEmpty(KeyId) && !string.IsNullOrEmpty(KeySecret);
    public string? PublicKeyId => Enabled ? KeyId : null;   // the key id is public; the secret never leaves the server

    // Step 1: ask Razorpay to create an order for this amount. Returns Razorpay's order id ("order_...").
    public async Task<string> CreateOrder(int amountRupees, int shopOrderId)
    {
        if (!Enabled)
        {
            if (!env.IsDevelopment()) throw new InvalidOperationException("Payments are not configured.");
            return $"dev_order_{shopOrderId}";
        }
        var req = new HttpRequestMessage(HttpMethod.Post, "https://api.razorpay.com/v1/orders")
        {
            Content = JsonContent.Create(new { amount = amountRupees * 100, currency = "INR", receipt = $"order_{shopOrderId}" }),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{KeyId}:{KeySecret}")));
        var res = await http.SendAsync(req);
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("id").GetString()!;
    }

    // Step 2: after the popup, Razorpay gives the browser a signature = HMAC-SHA256(orderId|paymentId, secret).
    // Only Razorpay and this server know the secret, so a matching signature proves the payment is real.
    public bool VerifyPayment(string razorpayOrderId, string paymentId, string signature) =>
        Enabled ? SignatureMatches($"{razorpayOrderId}|{paymentId}", KeySecret!, signature) : env.IsDevelopment();

    // Backup path: Razorpay calls our webhook server-to-server, signed with the webhook secret.
    public bool VerifyWebhook(string body, string signature) =>
        cfg["RAZORPAY_WEBHOOK_SECRET"] is { Length: > 0 } secret && SignatureMatches(body, secret, signature);

    public static bool SignatureMatches(string payload, string secret, string signature)
    {
        var expected = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload)));
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(signature ?? ""));
    }
}
