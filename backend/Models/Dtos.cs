using System.ComponentModel.DataAnnotations;

namespace ShopApi.Models;

// DTOs = the exact JSON shapes the API sends and receives.
// [ApiController] checks the [Required]/[Range] rules and returns 400 automatically if they fail.

public record ProductDto(int Id, string Name, string Description, int Price, int Stock,
    string? ImageUrl, bool IsActive, int CategoryId, string CategoryName);

public record CategoryDto(int Id, string Name, string? ImageUrl, int ProductCount);

public record ProductInput(
    [Required, MaxLength(120)] string Name,
    [MaxLength(2000)] string? Description,
    [Range(1, 1_000_000)] int Price,
    [Range(0, 100_000)] int Stock,
    [MaxLength(500)] string? ImageUrl,
    bool IsActive,
    int CategoryId);

public record CategoryInput([Required, MaxLength(80)] string Name, [MaxLength(500)] string? ImageUrl);

public record SendOtpRequest([Required, EmailAddress, MaxLength(200)] string Email);
public record VerifyOtpRequest([Required, EmailAddress] string Email, [Required, StringLength(6, MinimumLength = 6)] string Code);
public record MeDto(int Id, string Email, bool IsAdmin);

public record CartLine(int ProductId, [Range(1, 50)] int Quantity);
public record CreateOrderRequest(
    [Required, MaxLength(100)] string CustomerName,
    [Required, RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Enter a 10-digit mobile number")] string Phone,
    [Required, MaxLength(500)] string Address,
    [Required, MinLength(1)] List<CartLine> Items);

// What the browser needs to open the Razorpay popup.
public record CheckoutDto(int OrderId, int Total, string RazorpayOrderId, string? RazorpayKeyId);
public record VerifyPaymentRequest([Required] string RazorpayOrderId, [Required] string RazorpayPaymentId, [Required] string RazorpaySignature);

public record OrderItemDto(int ProductId, string ProductName, int Price, int Quantity);
public record OrderDto(int Id, string CustomerName, string Phone, string Address, int Total, string Status,
    DateTime CreatedAt, string? Email, List<OrderItemDto> Items)
{
    // SpecifyKind: SQLite forgets the time is UTC; marking it adds the "Z" so browsers convert to IST correctly.
    public static OrderDto From(Order o) => new(o.Id, o.CustomerName, o.Phone, o.Address, o.Total, o.Status,
        DateTime.SpecifyKind(o.CreatedAt, DateTimeKind.Utc), o.User?.Email, o.Items.Select(i => new OrderItemDto(i.ProductId, i.ProductName, i.Price, i.Quantity)).ToList());
}

public record StatusInput([Required] string Status);
