using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShopApi.Data;
using ShopApi.Models;
using ShopApi.Services;

namespace ShopApi.Controllers;

// The customer's saved delivery addresses (Home, Work, ...). Each customer only ever sees and changes their own.
[ApiController]
[Route("api/addresses")]
[Authorize]
public class AddressesController(AppDb db) : ControllerBase
{
    const int MaxPerCustomer = 10;
    int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/addresses  -> most recently used first
    [HttpGet]
    public async Task<List<AddressDto>> Mine() =>
        await db.SavedAddresses.Where(a => a.UserId == UserId).OrderByDescending(a => a.UpdatedAt)
            .Select(a => new AddressDto(a.Id, a.Label, a.CustomerName, a.Phone, a.Address, a.Latitude, a.Longitude, a.PinAddress))
            .ToListAsync();

    // POST /api/addresses  { label, customerName, phone, address, latitude?, longitude?, pinAddress? }
    [HttpPost]
    public async Task<ActionResult<AddressDto>> Create(AddressInput input)
    {
        if (await db.SavedAddresses.CountAsync(a => a.UserId == UserId) >= MaxPerCustomer)
            return BadRequest(new { message = $"You can save up to {MaxPerCustomer} addresses. Delete one first." });
        var a = new SavedAddress { UserId = UserId };
        Copy(input, a);
        db.SavedAddresses.Add(a);
        await db.SaveChangesAsync();
        return ToDto(a);
    }

    // PUT /api/addresses/5
    [HttpPut("{id:int}")]
    public async Task<ActionResult<AddressDto>> Update(int id, AddressInput input)
    {
        var a = await db.SavedAddresses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == UserId);
        if (a == null) return NotFound();
        Copy(input, a);
        await db.SaveChangesAsync();
        return ToDto(a);
    }

    // DELETE /api/addresses/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var n = await db.SavedAddresses.Where(a => a.Id == id && a.UserId == UserId).ExecuteDeleteAsync();
        return n == 0 ? NotFound() : NoContent();
    }

    static void Copy(AddressInput i, SavedAddress a)
    {
        if (i.Latitude.HasValue != i.Longitude.HasValue) throw new AppError("The map pin is incomplete. Set it again or remove it.");
        a.Label = i.Label.Trim();
        a.CustomerName = i.CustomerName.Trim();
        a.Phone = i.Phone;
        a.Address = i.Address.Trim();
        a.Latitude = i.Latitude is { } lat ? Math.Round(lat, 6) : null;
        a.Longitude = i.Longitude is { } lng ? Math.Round(lng, 6) : null;
        a.PinAddress = i.Latitude.HasValue ? i.PinAddress?.Trim() : null;
        a.UpdatedAt = DateTime.UtcNow;
    }

    static AddressDto ToDto(SavedAddress a) =>
        new(a.Id, a.Label, a.CustomerName, a.Phone, a.Address, a.Latitude, a.Longitude, a.PinAddress);
}
