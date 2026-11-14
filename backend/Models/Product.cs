namespace ShopApi.Models;

// One saree / item for sale. Price is whole rupees (no paise needed for this shop).
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public int Price { get; set; }
    public int Stock { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;   // false = hidden from customers, kept for old orders
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
}
