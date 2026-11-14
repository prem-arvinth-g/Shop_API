using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ShopApi.Data;
using ShopApi.Models;

namespace ShopApi.Services;

// Email OTP login: send a 6-digit code, then check it. No passwords anywhere.
public class AuthService(AppDb db, EmailService email, IConfiguration cfg)
{
    const int CodeMinutes = 5, MaxAttempts = 5;

    // Returns the code (so Development can show it on screen) or throws if asked too often.
    public async Task<string> SendOtp(string address)
    {
        address = Normalize(address);
        var tooSoon = await db.OtpCodes.AnyAsync(o => o.Email == address && o.CreatedAt > DateTime.UtcNow.AddSeconds(-60));
        if (tooSoon) throw new AppError("Please wait a minute before asking for a new code.");

        db.OtpCodes.RemoveRange(db.OtpCodes.Where(o => o.Email == address));        // old codes stop working
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");      // crypto-random, 000000-999999
        db.OtpCodes.Add(new OtpCode { Email = address, CodeHash = Hash(address, code), ExpiresAt = DateTime.UtcNow.AddMinutes(CodeMinutes) });
        await db.SaveChangesAsync();

        await email.Send(address, "Your Anand Cotton Sarees login code",
            $"Your login code is {code}. It expires in {CodeMinutes} minutes. If you did not ask for it, ignore this email.");
        return code;
    }

    // Returns the user if the code is right (creating the user on first login), otherwise null.
    public async Task<User?> VerifyOtp(string address, string code)
    {
        address = Normalize(address);
        var otp = await db.OtpCodes.Where(o => o.Email == address).OrderByDescending(o => o.Id).FirstOrDefaultAsync();
        if (otp == null || otp.ExpiresAt < DateTime.UtcNow || otp.Attempts >= MaxAttempts) return null;

        var ok = CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(otp.CodeHash), Encoding.UTF8.GetBytes(Hash(address, code)));
        if (!ok)
        {
            otp.Attempts++;               // 5 wrong tries and this code is dead
            await db.SaveChangesAsync();
            return null;
        }

        db.OtpCodes.Remove(otp);          // a code works only once
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == address);
        if (user == null) db.Users.Add(user = new User { Email = address });
        await db.SaveChangesAsync();
        return user;
    }

    // Admins are the emails listed in the ADMIN_EMAILS setting (comma separated).
    public bool IsAdmin(string address) =>
        (cfg["ADMIN_EMAILS"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Contains(Normalize(address), StringComparer.OrdinalIgnoreCase);

    static string Normalize(string address) => address.Trim().ToLowerInvariant();
    static string Hash(string address, string code) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{address}:{code}")));
}
