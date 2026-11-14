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
