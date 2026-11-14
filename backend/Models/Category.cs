namespace ShopApi.Models;

// A group of products, e.g. "Chettinad Cotton". One row in the Categories table.
public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? ImageUrl { get; set; }
    public List<Product> Products { get; set; } = [];
}
