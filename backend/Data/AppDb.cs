using Microsoft.EntityFrameworkCore;
using ShopApi.Models;

namespace ShopApi.Data;

// EF Core turns these C# classes into database tables and LINQ queries into SQL.
public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<User> Users => Set<User>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Banner> Banners => Set<Banner>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();
        b.Entity<OtpCode>().HasIndex(o => o.Email);
        b.Entity<Order>().HasIndex(o => o.RazorpayOrderId);
        // Can't delete a category that still has products (the API returns a friendly message instead).
        b.Entity<Product>().HasOne(p => p.Category).WithMany(c => c.Products).OnDelete(DeleteBehavior.Restrict);
    }
}
