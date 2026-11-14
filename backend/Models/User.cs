namespace ShopApi.Models;

// A customer. Created the first time someone logs in with an email OTP. No password is stored.
public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// A one-time login code waiting to be used. We store only a hash of the code, never the code itself.
public class OtpCode
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string CodeHash { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
}
