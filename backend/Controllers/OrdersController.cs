using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShopApi.Data;
using ShopApi.Models;
using ShopApi.Services;

namespace ShopApi.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]   // every action needs the login cookie, except the webhook below
public class OrdersController(AppDb db, OrderService orders, PaymentService payments) : ControllerBase
{
    // The user id comes from the login cookie, NEVER from the request body. You can only touch your own orders.
    int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // POST /api/orders  { customerName, phone, address, items:[{productId, quantity}] }
    [HttpPost]
    public async Task<CheckoutDto> Create(CreateOrderRequest req)
    {
        var order = await orders.Create(UserId, req);
        return new CheckoutDto(order.Id, order.Total, order.RazorpayOrderId!, payments.PublicKeyId);
    }

    // POST /api/orders/5/verify  { razorpayOrderId, razorpayPaymentId, razorpaySignature }
    [HttpPost("{id:int}/verify")]
    public async Task<ActionResult<OrderDto>> Verify(int id, VerifyPaymentRequest req)
    {
        var mine = await db.Orders.AnyAsync(o => o.Id == id && o.UserId == UserId && o.RazorpayOrderId == req.RazorpayOrderId);
        if (!mine) return NotFound();
        if (!payments.VerifyPayment(req.RazorpayOrderId, req.RazorpayPaymentId, req.RazorpaySignature))
            return BadRequest(new { message = "Payment could not be verified." });

        var order = await orders.MarkPaid(req.RazorpayOrderId, req.RazorpayPaymentId);
        return OrderDto.From(order!);
    }

    // GET /api/orders  -> my orders
    [HttpGet]
    public async Task<List<OrderDto>> Mine() =>
        (await db.Orders.Include(o => o.Items).Where(o => o.UserId == UserId).OrderByDescending(o => o.Id).ToListAsync())
            .Select(OrderDto.From).ToList();

    // GET /api/orders/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> One(int id)
    {
        var o = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id && o.UserId == UserId);
        return o == null ? NotFound() : OrderDto.From(o);
    }

    // POST /api/orders/webhook  -- called by Razorpay's servers, not the browser.
    // Covers the case where the customer paid but closed the tab before the browser could call /verify.
    [HttpPost("webhook"), AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        var body = await new StreamReader(Request.Body).ReadToEndAsync();
        if (!payments.VerifyWebhook(body, Request.Headers["X-Razorpay-Signature"].ToString())) return Unauthorized();

        using var doc = JsonDocument.Parse(body);
        if (doc.RootElement.GetProperty("event").GetString() == "payment.captured")
        {
            var payment = doc.RootElement.GetProperty("payload").GetProperty("payment").GetProperty("entity");
            await orders.MarkPaid(payment.GetProperty("order_id").GetString()!, payment.GetProperty("id").GetString()!);
        }
        return Ok();
    }
}
