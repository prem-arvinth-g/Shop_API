using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShopApi.Data;
using ShopApi.Models;

namespace ShopApi.Controllers;

// Public, no login: what any visitor can browse.
[ApiController]
[Route("api")]
public class CatalogController(AppDb db) : ControllerBase
{
    // GET /api/categories
    [HttpGet("categories")]
    public async Task<List<CategoryDto>> Categories() =>
        await db.Categories.OrderBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.ImageUrl, c.Products.Count(p => p.IsActive)))
            .ToListAsync();

    // GET /api/products?categoryId=3&q=green   (both optional)
    [HttpGet("products")]
    public async Task<List<ProductDto>> Products(int? categoryId, string? q)
    {
        var query = db.Products.Where(p => p.IsActive);
        if (categoryId != null) query = query.Where(p => p.CategoryId == categoryId);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();   // ToLower on both sides = case-insensitive search on SQLite and PostgreSQL
            query = query.Where(p => p.Name.ToLower().Contains(term) || p.Description.ToLower().Contains(term) || p.Category!.Name.ToLower().Contains(term));
        }
        return await query.OrderBy(p => p.Name).Select(ToDto).ToListAsync();
    }

    // GET /api/products/5
    [HttpGet("products/{id:int}")]
    public async Task<ActionResult<ProductDto>> Product(int id)
    {
        var p = await db.Products.Where(p => p.Id == id && p.IsActive).Select(ToDto).FirstOrDefaultAsync();
        return p == null ? NotFound() : p;
    }

    // One expression shared by every query, so EF turns it into a single SQL SELECT with a JOIN.
    internal static readonly System.Linq.Expressions.Expression<Func<Product, ProductDto>> ToDto = p =>
        new ProductDto(p.Id, p.Name, p.Description, p.Price, p.Stock, p.ImageUrl, p.IsActive, p.CategoryId, p.Category!.Name);
}
