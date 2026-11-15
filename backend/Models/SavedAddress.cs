namespace ShopApi.Models;

// A delivery address the customer saved with a name ("Home", "Work", "Amma's house"), picked again at checkout.
public class SavedAddress
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Label { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public double? Latitude { get; set; }          // optional map pin, same as on Order
    public double? Longitude { get; set; }
    public string? PinAddress { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
