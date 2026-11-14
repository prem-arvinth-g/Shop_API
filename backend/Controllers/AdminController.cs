using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShopApi.Data;
using ShopApi.Models;
using ShopApi.Services;

namespace ShopApi.Controllers;

// Only logins whose email is in ADMIN_EMAILS get the "Admin" role. Everyone else gets 403.
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController(AppDb db, ImageService images) : ControllerBase
{
    // ---------- Products ----------
    [HttpGet("products")]
    public async Task<List<ProductDto>> Products() =>
        await db.Products.OrderBy(p => p.Category!.Name).ThenBy(p => p.Name).Select(CatalogController.ToDto).ToListAsync();

    [HttpPost("products")]
    public async Task<ActionResult<int>> CreateProduct(ProductInput input)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId)) return BadRequest(new { message = "Pick a category." });
        var p = new Product();
        Apply(p, input);
        db.Products.Add(p);
        await db.SaveChangesAsync();
        return p.Id;
    }

    [HttpPut("products/{id:int}")]
    public async Task<IActionResult> UpdateProduct(int id, ProductInput input)
    {
        var p = await db.Products.FindAsync(id);
        if (p == null) return NotFound();
        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId)) return BadRequest(new { message = "Pick a category." });
        Apply(p, input);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("products/{id:int}")]
    public async Task<IActionResult> DeleteProduct(int id)
    {
        await db.Products.Where(p => p.Id == id).ExecuteDeleteAsync();   // old orders keep their own copy of name + price
        return NoContent();
    }

    static void Apply(Product p, ProductInput i)
    {
        p.Name = i.Name.Trim();
        p.Description = i.Description?.Trim() ?? "";
        p.Price = i.Price;
        p.Stock = i.Stock;
        p.ImageUrl = i.ImageUrl;
        p.IsActive = i.IsActive;
        p.CategoryId = i.CategoryId;
    }

    // ---------- Categories ----------
    [HttpPost("categories")]
    public async Task<ActionResult<int>> CreateCategory(CategoryInput input)
    {
        var c = new Category { Name = input.Name.Trim(), ImageUrl = input.ImageUrl };
        db.Categories.Add(c);
        await db.SaveChangesAsync();
        return c.Id;
    }

    [HttpPut("categories/{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, CategoryInput input)
    {
        var c = await db.Categories.FindAsync(id);
        if (c == null) return NotFound();
        c.Name = input.Name.Trim();
        c.ImageUrl = input.ImageUrl;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        if (await db.Products.AnyAsync(p => p.CategoryId == id))
            return BadRequest(new { message = "Move or delete this category's products first." });
        await db.Categories.Where(c => c.Id == id).ExecuteDeleteAsync();
        return NoContent();
    }

    // ---------- Orders ----------
    [HttpGet("orders")]
    public async Task<List<OrderDto>> Orders() =>
        (await db.Orders.Include(o => o.Items).Include(o => o.User).OrderByDescending(o => o.Id).ToListAsync())
            .Select(OrderDto.From).ToList();

    [HttpPut("orders/{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, StatusInput input)
    {
        if (!OrderStatus.All.Contains(input.Status)) return BadRequest(new { message = "Unknown status." });
        var n = await db.Orders.Where(o => o.Id == id).ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, input.Status));
        return n == 0 ? NotFound() : NoContent();
    }

    // ---------- Image upload ----------
    [HttpPost("upload")]
    public async Task<object> Upload(IFormFile file) => new { url = await images.Save(file) };
}
