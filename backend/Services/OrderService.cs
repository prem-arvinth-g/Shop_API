using Microsoft.EntityFrameworkCore;
using ShopApi.Data;
using ShopApi.Models;

namespace ShopApi.Services;

public class OrderService(AppDb db, PaymentService payments)
{
    // Builds an order from the cart. Prices come from the DATABASE, never from the browser,
    // so nobody can edit the page and pay less.
    public async Task<Order> Create(int userId, CreateOrderRequest req)
    {
        var ids = req.Items.Select(i => i.ProductId).ToList();
        var products = await db.Products.Where(p => ids.Contains(p.Id) && p.IsActive).ToDictionaryAsync(p => p.Id);

        if (req.Latitude.HasValue != req.Longitude.HasValue) throw new AppError("The map pin is incomplete. Set it again or remove it.");
        var order = new Order
        {
            UserId = userId, CustomerName = req.CustomerName.Trim(), Phone = req.Phone, Address = req.Address.Trim(),
            // 6 decimals = about 10 cm. More digits are just noise.
            Latitude = req.Latitude is { } lat ? Math.Round(lat, 6) : null,
            Longitude = req.Longitude is { } lng ? Math.Round(lng, 6) : null,
            PinAddress = req.Latitude.HasValue ? req.PinAddress?.Trim() : null,
        };
        foreach (var line in req.Items)
        {
            if (!products.TryGetValue(line.ProductId, out var p))
                throw new AppError("A product in your cart is no longer available.");
            if (line.Quantity > p.Stock)
                throw new AppError($"Only {p.Stock} left of {p.Name}.");
            order.Items.Add(new OrderItem { ProductId = p.Id, ProductName = p.Name, Price = p.Price, Quantity = line.Quantity });
        }
        order.Total = order.Items.Sum(i => i.Price * i.Quantity);

        db.Orders.Add(order);
        await db.SaveChangesAsync();                                   // now order.Id exists
        order.RazorpayOrderId = await payments.CreateOrder(order.Total, order.Id);
        await db.SaveChangesAsync();
        return order;
    }

    // Called by both the browser (after the popup) and the Razorpay webhook. Safe to call twice.
    public async Task<Order?> MarkPaid(string razorpayOrderId, string paymentId)
    {
        var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.RazorpayOrderId == razorpayOrderId);
        if (order == null || order.Status != OrderStatus.Pending) return order;

        order.Status = OrderStatus.Paid;
        order.RazorpayPaymentId = paymentId;
        // shortcut: stock is reduced on payment, not reserved at checkout. Fine for low traffic; two buyers of the last piece could both pay.
        var ids = order.Items.Select(i => i.ProductId).ToList();
        foreach (var p in await db.Products.Where(p => ids.Contains(p.Id)).ToListAsync())
            p.Stock = Math.Max(0, p.Stock - order.Items.Where(i => i.ProductId == p.Id).Sum(i => i.Quantity));
        await db.SaveChangesAsync();
        return order;
    }
}
