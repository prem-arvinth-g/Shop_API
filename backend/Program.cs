using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using ShopApi.Data;
using ShopApi.Services;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// ---------- Database ----------
// Cloud: set ConnectionStrings__Postgres (Neon). Your PC: nothing to set, uses the shop.db SQLite file.
var postgres = cfg.GetConnectionString("Postgres");
if (string.IsNullOrEmpty(postgres) && !builder.Environment.IsDevelopment())
    throw new InvalidOperationException("Set ConnectionStrings__Postgres. A cloud container's disk is wiped on every deploy, so SQLite would lose all orders.");
builder.Services.AddDbContext<AppDb>(o =>
{
    if (string.IsNullOrEmpty(postgres)) o.UseSqlite("Data Source=shop.db");
    else o.UseNpgsql(postgres);
});

// ---------- Login (cookie) ----------
// After OTP login the server writes an encrypted, HttpOnly cookie. JavaScript can't read it, so injected scripts can't steal it.
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.Cookie.Name = "acs_auth";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Lax;   // other websites can't make your browser send it with their POSTs
        o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        o.ExpireTimeSpan = TimeSpan.FromDays(7);
        o.SlidingExpiration = true;
        // This is an API: answer 401/403 instead of redirecting to a login page.
        o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
        o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
    });
builder.Services.AddAuthorization();
// shortcut: cookie encryption keys live in the container, so customers must log in again after each deploy.

// ---------- Rate limit: max 10 OTP requests per IP per 10 minutes ----------
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(10) }));
});
// Render/AWS sit in front of the app; trust their X-Forwarded-For so we see the real visitor IP.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

// ---------- Our services (MVC: controllers call these) ----------
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddSingleton<EmailService>();
builder.Services.AddHttpClient<PaymentService>();
builder.Services.AddHttpClient<ImageService>();
builder.Services.AddControllers();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    Seed.Run(scope.ServiceProvider.GetRequiredService<AppDb>());

app.UseForwardedHeaders();

// Friendly errors: AppError -> 400 { message }. Anything else -> 500 with no internal details.
app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (AppError e)
    {
        ctx.Response.StatusCode = 400;
        await ctx.Response.WriteAsJsonAsync(new { message = e.Message });
    }
});

app.UseDefaultFiles();     // serves the built Angular app from wwwroot
app.UseStaticFiles();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
// Angular handles its own pages (/product/5, /cart...). Any non-API URL without a file extension gets index.html.
// (nonfile matters: without it, /uploads/photo.png would also be sent here instead of to the static files.)
app.MapFallbackToFile("{*path:regex(^(?!api/).*$):nonfile}", "index.html");

app.Run();

public partial class Program;
