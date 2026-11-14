using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ShopApi.Services;

// Saves product photos. Cloud: Cloudinary (free tier). Your PC: wwwroot/uploads.
// Cloud servers wipe their disk on every deploy, so Cloudinary must be set in production.
public class ImageService(HttpClient http, IConfiguration cfg, IWebHostEnvironment env)
{
    static readonly string[] Allowed = [".jpg", ".jpeg", ".png", ".webp"];
    const long MaxBytes = 5 * 1024 * 1024;

    public async Task<string> Save(IFormFile file)
    {
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!Allowed.Contains(ext)) throw new AppError("Only JPG, PNG or WEBP images.");
        if (file.Length > MaxBytes) throw new AppError("Image must be under 5 MB.");

        var cloud = cfg["CLOUDINARY_CLOUD_NAME"];
        if (string.IsNullOrEmpty(cloud))
        {
            var dir = Path.Combine(env.WebRootPath, "uploads");
            Directory.CreateDirectory(dir);
            var name = $"{Guid.NewGuid():N}{ext}";               // random name: no overwriting, no path tricks
            await using var fs = File.Create(Path.Combine(dir, name));
            await file.CopyToAsync(fs);
            return $"/uploads/{name}";
        }

        // Cloudinary signed upload: signature = SHA1("folder=...&timestamp=..." + api_secret)
        var ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var sig = Convert.ToHexStringLower(SHA1.HashData(Encoding.UTF8.GetBytes($"folder=shop&timestamp={ts}{cfg["CLOUDINARY_API_SECRET"]}")));
        using var form = new MultipartFormDataContent
        {
            { new StreamContent(file.OpenReadStream()), "file", file.FileName },
            { new StringContent(cfg["CLOUDINARY_API_KEY"]!), "api_key" },
            { new StringContent(ts), "timestamp" },
            { new StringContent("shop"), "folder" },
            { new StringContent(sig), "signature" },
        };
        var res = await http.PostAsync($"https://api.cloudinary.com/v1_1/{cloud}/image/upload", form);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("secure_url").GetString()!;
    }
}
