using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using ShopApi.Data;
using ShopApi.Models;
using ShopApi.Services;

// The money logic is the part that must never be wrong, so it gets tests.
public class OrderServiceTests
{
    static (AppDb db, OrderService svc) Setup()
    {
        var conn = new SqliteConnection("Data Source=:memory:");
        conn.Open();
        var db = new AppDb(new DbContextOptionsBuilder<AppDb>().UseSqlite(conn).Options);
        Seed.Run(db);
        db.Users.Add(new User { Email = "a@b.c" });
        db.SaveChanges();
        var payments = new PaymentService(new HttpClient(), new ConfigurationBuilder().Build(), new DevEnv());
        return (db, new OrderService(db, payments));
    }

    static CreateOrderRequest Cart(int productId, int qty) => new("Test", "9876543210", "Andipatti", [new CartLine(productId, qty)]);

    [Fact]
    public async Task Total_comes_from_database_price()
    {
        var (db, svc) = Setup();
        var price = db.Products.Find(1)!.Price;
        var order = await svc.Create(1, Cart(1, 3));
        Assert.Equal(price * 3, order.Total);
    }

    [Fact]
    public async Task Cannot_buy_more_than_stock()
    {
        var (_, svc) = Setup();
        var e = await Assert.ThrowsAsync<AppError>(() => svc.Create(1, Cart(1, 11)));
        Assert.Contains("Only 10 left", e.Message);
    }

    [Fact]
    public async Task Paying_reduces_stock_once_even_if_called_twice()
    {
        var (db, svc) = Setup();
        var order = await svc.Create(1, Cart(1, 4));
        await svc.MarkPaid(order.RazorpayOrderId!, "pay_1");
        await svc.MarkPaid(order.RazorpayOrderId!, "pay_1");   // webhook + browser both arrive
        Assert.Equal(6, db.Products.AsNoTracking().First(p => p.Id == 1).Stock);
        Assert.Equal(OrderStatus.Paid, db.Orders.AsNoTracking().First().Status);
    }

    [Fact]
    public void Razorpay_signature_check_rejects_tampering()
    {
        var sig = Convert.ToHexStringLower(System.Security.Cryptography.HMACSHA256.HashData("secret"u8.ToArray(), "order_1|pay_1"u8.ToArray()));
        Assert.True(PaymentService.SignatureMatches("order_1|pay_1", "secret", sig));
        Assert.False(PaymentService.SignatureMatches("order_1|pay_2", "secret", sig));
    }

    class DevEnv : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "test";
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

// A table added after launch (like Banners) must be created on an existing database without losing data.
public class SeedTests
{
    [Fact]
    public void Missing_table_is_added_and_existing_data_kept()
    {
        var conn = new SqliteConnection("Data Source=:memory:");
        conn.Open();
        var options = new DbContextOptionsBuilder<AppDb>().UseSqlite(conn).Options;
        Seed.Run(new AppDb(options));
        new AppDb(options).Database.ExecuteSqlRaw(@"DROP TABLE ""Banners""");   // pretend the live DB is from before banners existed

        var db = new AppDb(options);   // fresh context, like the app restarting after a deploy
        Seed.Run(db);

        Assert.Equal(7, db.Banners.Count());
        Assert.Equal(30, db.Products.Count());
    }

    [Fact]
    public void Missing_column_is_added_and_old_orders_kept()
    {
        var conn = new SqliteConnection("Data Source=:memory:");
        conn.Open();
        var options = new DbContextOptionsBuilder<AppDb>().UseSqlite(conn).Options;
        Seed.Run(new AppDb(options));
        var old = new AppDb(options);
        old.Database.ExecuteSqlRaw(@"INSERT INTO ""Users"" (""Email"", ""CreatedAt"") VALUES ('a@b.c', '2026-01-01')");
        old.Database.ExecuteSqlRaw(@"INSERT INTO ""Orders"" (""UserId"", ""CustomerName"", ""Phone"", ""Address"", ""Total"", ""Status"", ""CreatedAt"") VALUES (1, 'Old', '9876543210', 'Andipatti', 690, 'Paid', '2026-01-01')");
        old.Database.ExecuteSqlRaw(@"ALTER TABLE ""Orders"" DROP COLUMN ""Latitude""");   // pretend the live DB is from before the map pin
        old.Database.ExecuteSqlRaw(@"ALTER TABLE ""Orders"" DROP COLUMN ""Longitude""");

        var db = new AppDb(options);
        Seed.Run(db);

        var order = db.Orders.Single();
        Assert.Equal("Old", order.CustomerName);
        Assert.Null(order.Latitude);
    }
}
