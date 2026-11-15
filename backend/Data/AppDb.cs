using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ShopApi.Models;

namespace ShopApi.Data;

// EF Core turns these C# classes into database tables and LINQ queries into SQL.
// IDataProtectionKeyContext: the login-cookie encryption keys are stored here too (see Program.cs), so they survive restarts.
public class AppDb(DbContextOptions<AppDb> options) : DbContext(options), IDataProtectionKeyContext
{
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<User> Users => Set<User>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Banner> Banners => Set<Banner>();
    public DbSet<SavedAddress> SavedAddresses => Set<SavedAddress>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();
        b.Entity<OtpCode>().HasIndex(o => o.Email);
        b.Entity<Order>().HasIndex(o => o.RazorpayOrderId);
        b.Entity<SavedAddress>().HasIndex(a => a.UserId);
        // Can't delete a category that still has products (the API returns a friendly message instead).
        b.Entity<Product>().HasOne(p => p.Category).WithMany(c => c.Products).OnDelete(DeleteBehavior.Restrict);
    }
}
