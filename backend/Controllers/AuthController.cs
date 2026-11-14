using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ShopApi.Models;
using ShopApi.Services;

namespace ShopApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService auth, IHostEnvironment env) : ControllerBase
{
    // POST /api/auth/send-otp  { email }
    [HttpPost("send-otp"), EnableRateLimiting("auth")]
    public async Task<IActionResult> SendOtp(SendOtpRequest req)
    {
        var code = await auth.SendOtp(req.Email);
        // On your PC there is no email server, so show the code to make testing easy. Never in production.
        return Ok(new { sent = true, devCode = env.IsDevelopment() ? code : null });
    }

    // POST /api/auth/verify-otp  { email, code }  -> sets the login cookie
    [HttpPost("verify-otp"), EnableRateLimiting("auth")]
    public async Task<ActionResult<MeDto>> VerifyOtp(VerifyOtpRequest req)
    {
        var user = await auth.VerifyOtp(req.Email, req.Code);
        if (user == null) return BadRequest(new { message = "Wrong or expired code." });

        var isAdmin = auth.IsAdmin(user.Email);
        // Claims = facts about the user, stored inside the encrypted cookie ("the signed pass").
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, user.Id.ToString()), new(ClaimTypes.Email, user.Email) };
        if (isAdmin) claims.Add(new Claim(ClaimTypes.Role, "Admin"));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));

        // Writes the HttpOnly cookie. The browser sends it back on every request automatically.
        await HttpContext.SignInAsync(principal, new AuthenticationProperties { IsPersistent = true });
        return new MeDto(user.Id, user.Email, isAdmin);
    }

    // GET /api/auth/me  -> who am I? (401 if not logged in)
    [HttpGet("me"), Authorize]
    public MeDto Me() => new(int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!), User.FindFirstValue(ClaimTypes.Email)!, User.IsInRole("Admin"));

    // POST /api/auth/logout  -> deletes the cookie
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync();
        return NoContent();
    }
}
