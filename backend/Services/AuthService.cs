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

        // Send first, save after: if the email fails, nothing is saved and the user can retry straight away.
        // Code first in the subject: it shows in the phone notification, and Gmail/iPhone offer "Copy code".
        await email.Send(address, $"{code} is your Anand Cotton Sarees login code",
            $"Your Anand Cotton Sarees login code is {code}. It expires in {CodeMinutes} minutes. If you did not ask for it, you can ignore this email.",
            LoginEmailHtml(code));
        await db.SaveChangesAsync();
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

    // Email apps don't run JavaScript or most CSS, so this is simple inline-styled HTML in the logo colours.
    static string LoginEmailHtml(string code) => $"""
        <div style="background:#faf3e1;padding:32px 12px;font-family:Georgia,'Times New Roman',serif">
          <div style="max-width:440px;margin:0 auto;background:#fffdf7;border:1px solid #e7dcc2;border-radius:12px;overflow:hidden">
            <div style="background:#12391e;padding:20px;text-align:center">
              <div style="color:#e8d6a8;font-size:26px;letter-spacing:4px;font-weight:bold">ANAND</div>
              <div style="color:#e8d6a8;font-size:11px;letter-spacing:5px">COTTON SAREES</div>
            </div>
            <div style="padding:28px 24px;text-align:center;color:#23201a;font-family:Arial,sans-serif">
              <p style="margin:0 0 6px;font-size:15px">Your login code is</p>
              <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:bold;letter-spacing:10px;color:#8e0e25;background:#faf3e1;border:1px dashed #b8913f;border-radius:8px;padding:14px 0;margin:8px 0 14px">{code}</div>
              <p style="margin:0;font-size:13px;color:#6d665a">It expires in {CodeMinutes} minutes. Never share this code with anyone.</p>
              <p style="margin:14px 0 0;font-size:12px;color:#6d665a">Didn't ask for it? You can safely ignore this email.</p>
            </div>
            <div style="border-top:1px solid #e7dcc2;padding:12px;text-align:center;font-size:12px;color:#8e0e25;font-style:italic">Rooted in Tradition. Woven for You.</div>
          </div>
        </div>
        """;

    static string Normalize(string address) => address.Trim().ToLowerInvariant();
    static string Hash(string address, string code) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{address}:{code}")));
}
