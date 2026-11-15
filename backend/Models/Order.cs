namespace ShopApi.Models;

public static class OrderStatus
{
    public const string Pending = "Pending";     // created, waiting for payment
    public const string Paid = "Paid";
    public const string Shipped = "Shipped";
    public const string Delivered = "Delivered";
    public const string Cancelled = "Cancelled";
    public static readonly string[] All = [Pending, Paid, Shipped, Delivered, Cancelled];
}

public class Order
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public double? Latitude { get; set; }          // optional map pin from checkout, for addresses that are hard to find
    public double? Longitude { get; set; }
    public string? PinAddress { get; set; }        // OpenStreetMap's address for that pin, e.g. "Bazaar Street, Andipatti, ..."
    public int Total { get; set; }                 // rupees, calculated on the server
    public string Status { get; set; } = OrderStatus.Pending;
    public string? RazorpayOrderId { get; set; }
    public string? RazorpayPaymentId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<OrderItem> Items { get; set; } = [];
}

// A copy of the product name and price at the moment of buying,
// so old orders stay correct even if the admin later edits or deletes the product.
public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public int Price { get; set; }
    public int Quantity { get; set; }
}
