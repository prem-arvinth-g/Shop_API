# How it works: click → code → database → screen

Every flow below is traced in order. `file:line` points to the exact line. Open it in VS Code with **Ctrl+P**, then type the path followed by `:line`.

## 1. The big picture

```
 Browser (Angular)                         Server (.NET, one app)                    Outside services
 ─────────────────                         ──────────────────────                    ────────────────
 page component (.html + .ts)
   │ click
   ▼
 service (.ts)  ── HTTP JSON + cookie ──►  Controller  (reads request, checks login)
                                             │
                                             ▼
                                           Service     (business rules) ──────────►  Razorpay / Cloudinary / Email
                                             │
                                             ▼
                                           AppDb (EF Core) ── SQL ──►  SQLite (your PC) / PostgreSQL (Neon, cloud)
   ▲                                         │
   └──────────── JSON response ◄─────────────┘
 signal updates → HTML re-renders → toast pop-up
```

**MVC in this project**
| Layer | Backend (C#) | Frontend (Angular) |
|---|---|---|
| **Model**: data shapes | `backend/Models/*.cs` (DB tables + DTOs) | `frontend/src/app/models/models.ts` |
| **Controller**: receives requests | `backend/Controllers/*.cs` | page `.ts` files (`pages/*/*.ts`) |
| **Service**: the logic | `backend/Services/*.cs` | `frontend/src/app/services/*.ts` (API calls, cart, login state) |
| **View**: what you see | (none: the API returns JSON) | `.html` templates + `src/styles.css` |

In production, one Docker container serves both: the .NET app answers `/api/*` and returns the built Angular files for every other URL (`backend/Program.cs:90`).

---

## 2. Flow: customer clicks **"Add to cart"**

No server call. The cart lives in the browser until checkout.

1. **Click**: `frontend/src/app/pages/product/product.html:20`, `(click)="addToCart(p)"`
2. **Component method**: `frontend/src/app/pages/product/product.ts:30`, `addToCart(p)` calls the cart service with the chosen quantity.
3. **Cart service**: `frontend/src/app/services/cart.service.ts:28`, `add()` finds the item, adds the quantity, caps it at stock, and updates the `items` **signal**.
4. **Auto-save**: `cart.service.ts:24`, an `effect()` notices `items` changed and writes it to `localStorage`, so the cart survives a page refresh.
5. **Badge updates**: `frontend/src/app/components/header/header.html:16`, `{{ cart.count() }}`. `count` is a `computed()` signal built from `items`, so Angular redraws the number on its own.
6. **Pop-up**: `product.ts` calls `toast.show(...)`, which sets the signal in `frontend/src/app/services/toast.service.ts:10`. Then `frontend/src/app/app.html:31`, `@if (toast.message(); as m)`, draws the message. A timer clears it after 4 seconds.

> **Signals** are values Angular watches. When one changes, every place in the HTML that reads it redraws automatically.

### Buy now (one saree, without touching the cart)
- `product.html` **Buy now** → `product.ts:37`, `buyNow()` → `cart.service.ts:50`, `startBuyNow()`, which stores just that saree in the `buyNow` signal (kept in sessionStorage), then goes to `/checkout`.
- Checkout pays for `checkoutItems`: the Buy now saree only. The back link goes to that saree's page.
- The cart's own **Checkout** button clears `buyNow`, so checkout pays for the whole cart and the back link goes to `/cart`.

> **Why `zone.run`?** Razorpay's popup calls our `handler` from its own code, outside Angular's change tracking ("zone"). Without `this.zone.run(...)` (`checkout.ts:73`), the payment succeeds but the page may not redraw or navigate, and the customer stays stuck on checkout.

---

## 3. Flow: **search** for "green"

1. **Submit**: `frontend/src/app/components/header/header.html:8`, `(ngSubmit)="search()"`
2. `frontend/src/app/components/header/header.ts`, `search()`, navigates to `/?q=green#shop`. The URL holds the filter, and `#shop` scrolls down to the sarees section of the home page. There is no separate shop page; `/shop` just redirects to `/`.
3. `frontend/src/app/pages/shop/shop.ts` (the sarees section, shown inside `pages/home/home.html`) watches the URL's query params. `switchMap` calls the API each time they change and cancels any older request still in flight.
4. `frontend/src/app/services/catalog.service.ts:14`, `products()` sends `GET /api/products?q=green`.
5. **Server**: `backend/Controllers/CatalogController.cs:22`, `Products(categoryId, q)`. EF Core builds the SQL `WHERE`. Line 28 lowercases both sides so the search ignores capital letters on both SQLite and PostgreSQL.
6. Line 43, `ToDto`, picks only the needed columns and joins the category name in **one** SQL query.
7. The JSON comes back, the `products` signal updates, and `shop.html` draws the cards with `@for`.

---

## 4. Flow: **login with email OTP**

### Step A: "Send code"
1. `frontend/src/app/pages/login/login.html:5`, `(ngSubmit)="f.valid && sendCode()"`. The form validates the email first.
2. `frontend/src/app/pages/login/login.ts:26`, `sendCode()` calls `auth.sendOtp(email)`.
3. `frontend/src/app/services/auth.service.ts:17` sends `POST /api/auth/send-otp { email }`.
4. **Rate limit**: `backend/Program.cs:44` allows at most 10 requests per IP per 10 minutes. The 11th gets HTTP 429.
5. `backend/Controllers/AuthController.cs:18`, `SendOtp` calls the service.
6. `backend/Services/AuthService.cs:15`, `SendOtp`:
   - refuses if a code was sent in the last 60 seconds
   - deletes this email's old codes
   - line 22 makes a **crypto-random** 6-digit code
   - saves only a **SHA-256 hash** of the code, never the code itself, with a 5-minute expiry
   - emails it through `backend/Services/EmailService.cs`, which calls Brevo's HTTPS API. SMTP is not used because Render's free plan blocks SMTP ports. The email is sent **before** the code is saved, so if sending fails the user isn't locked out for 60 seconds. On your PC, with no `BREVO_API_KEY` set, it is printed in the console, and the API also returns `devCode` so the login page can show it.
7. The browser switches to the "enter code" step.

### Step B: "Verify & log in"
1. `login.html:13` calls `verify()`, which runs `login.ts:40`, then `auth.service.ts:21`, which sends `POST /api/auth/verify-otp`.
2. `backend/Services/AuthService.cs:32`, `VerifyOtp`:
   - takes the newest code and rejects it if expired or already tried 5 times
   - line 38 compares hashes with `FixedTimeEquals`, which takes the same time whether the guess is close or not, so timing reveals nothing
   - a wrong code runs line 41, `Attempts++`
   - a right code is deleted (one use only), and the user row is created on first login
3. `backend/Controllers/AuthController.cs:34` builds **claims**: user id, email, and the "Admin" role if the email is listed in `ADMIN_EMAILS` (`AuthService.cs:54`).
4. `AuthController.cs:39`, `SignInAsync(...)`: ASP.NET **encrypts and signs** the claims into the `acs_auth` cookie, set up at `backend/Program.cs:26`:
   - `HttpOnly`: JavaScript can't read it (we checked: `document.cookie` doesn't contain it)
   - `SameSite=Lax`: other sites can't make your browser send it with their POSTs
   - `Secure` in production: sent only over HTTPS
   - 7-day sliding expiry (`Program.cs:32`)
   - the encryption key itself is stored in the database, table `DataProtectionKeys` (`Program.cs:41`, `AppDb.cs:9`). If it lived on the server's disk, every Render sleep/restart/deploy would create a new key, old cookies could no longer be read, and everyone would have to log in again.
5. Back in the browser, the response `{ id, email, isAdmin }` is stored in the `auth.me` signal. The header's `@if (auth.me())` flips to show Orders / Logout / Admin.

### How later requests know who you are
- The browser attaches the cookie to every `/api` call by itself.
- `backend/Program.cs:88`, `UseAuthentication()`, decrypts it and fills `User` with the claims.
- `[Authorize]` on a controller makes the server answer **401** when there's no valid cookie.
- `backend/Controllers/OrdersController.cs:18`: the user id comes **from the cookie**, never from the request body, so nobody can place or read orders as someone else.

### Page refresh
`frontend/src/app/services/auth.service.ts:14`: on app start, `GET /api/auth/me` asks "is my cookie still valid?". Route guards (`frontend/src/app/services/guards.ts:8`) wait for that answer before deciding whether to open `/checkout` or send you to `/login?returnUrl=/checkout`.

### Logout
`header.html` Logout → `auth.service.ts:25` → `POST /api/auth/logout` → `AuthController.cs:51`, `SignOutAsync()`, tells the browser to delete the cookie. `me` becomes null and the header switches back to "Login".

> **Cookie vs JWT, for interviews.** Both are signed "passes". A **JWT** is a token the frontend stores and sends in an `Authorization: Bearer ...` header. That suits mobile apps and separate API domains, but if JavaScript stores it, an XSS bug can steal it. Here the site and API share one domain, so an **HttpOnly cookie** is simpler and safer. To switch to JWT, swap `AddCookie` for `AddJwtBearer` in `Program.cs:25`, return the token from `verify-otp`, and add an Angular HTTP interceptor that sets the header.

---

## 5. Flow: **checkout and payment** (the important one)

1. **Pay button**: `frontend/src/app/pages/checkout/checkout.html:11`, `(ngSubmit)="f.valid && placeOrder()"`. Name, 10-digit mobile and address are required.
2. `frontend/src/app/pages/checkout/checkout.ts:31`, `placeOrder()`:
   - line 34 takes `cart.checkoutItems()`: the single **Buy now** saree if there is one, otherwise the whole cart (`cart.service.ts:20`)
   - **line 35**: `orders.create(...)` sends **only product ids + quantities**, never prices, via `frontend/src/app/services/order.service.ts:17` → `POST /api/orders`.
3. **Server, controller**: `backend/Controllers/OrdersController.cs:22`, `Create`. `[Authorize]` means you must be logged in. `[ApiController]` checks the DTO rules first (for example, the phone regex at `backend/Models/Dtos.cs:31`) and returns 400 if they fail.
4. **Server, service**: `backend/Services/OrderService.cs:11`, `Create`:
   - line 14 loads the real products from the database
   - line 21: asking for more than the stock throws `AppError("Only 2 left...")`, which `backend/Program.cs:75` turns into HTTP 400 `{ message }`
   - each item copies the name and **database price**
   - line 25: **total = Σ price × qty, calculated on the server**
   - saves the order as `Pending`
   - line 29 calls `PaymentService.CreateOrder`
5. **Razorpay order**: `backend/Services/PaymentService.cs:18`, which POSTs to `api.razorpay.com/v1/orders` (line 25) with the amount in paise and the secret key. Razorpay returns an id like `order_ABC`. That id is locked to the amount, so the popup can't charge a different total.
6. The response `{ orderId, total, razorpayOrderId, razorpayKeyId }` goes back to the browser. Only the public **key id** is sent; the secret never leaves the server.
7. **Popup**: `checkout.ts:37` calls `pay()`, then `checkout.ts:63`, `new Razorpay({...}).open()`. The customer pays by UPI or card **on Razorpay's own window**, so card numbers never touch our code.
   - Success → `checkout.ts:73`, `handler`, receives `razorpay_payment_id` and `razorpay_signature`.
   - Closed → `checkout.ts:78`, `ondismiss`. The order stays `Pending` and the error toast "Payment cancelled" is shown.
   - Test mode (no keys, your PC only): a `confirm()` box pretends to pay.
8. **Verify**: `checkout.ts:43` → `order.service.ts:21` → `POST /api/orders/{id}/verify`.
9. **Server**: `backend/Controllers/OrdersController.cs:30`, `Verify`:
   - line 33: the order must belong to **this** user and match the Razorpay order id
   - line 34 calls `PaymentService.VerifyPayment`, then `PaymentService.cs:45`, `SignatureMatches`: **HMAC-SHA256(order_id|payment_id, secret)** must equal the signature. Only Razorpay and our server know the secret, so a fake "paid" message can't pass.
   - line 37 calls `OrderService.MarkPaid` at `OrderService.cs:35`: status becomes `Paid`, the payment id is saved, and stock goes down (line 45). Line 38 makes it **safe to run twice**.
10. **Back in the browser**: `checkout.ts:44`, `finishCheckout()`, removes what was bought: the Buy now item, or the whole cart. The bought sarees now live in **My orders** on the server. Then the toast shows "Payment successful! Order #7 is confirmed.", and `checkout.ts:47` navigates to `/orders/7` with `replaceUrl`, so the browser's Back button skips checkout. There, `frontend/src/app/pages/orders/orders.html:3` shows the green thank-you banner.

### Safety net: webhook
If the customer pays and closes the tab before step 8, the browser never calls `/verify`. Razorpay also calls our server directly at `backend/Controllers/OrdersController.cs:58`, `Webhook`:
- it checks `X-Razorpay-Signature` with the webhook secret (`PaymentService.cs:42`)
- on `payment.captured` it calls the same `MarkPaid`

Because `MarkPaid` runs safely twice, the order is paid exactly once whichever message arrives first.

### Where the money goes
Customer's bank/UPI → **Razorpay** (holds it) → the shop's bank account, settled in about 2–3 working days. Our database only stores order and payment **ids**.

---

## 6. Flow: **admin adds a product with a photo**

1. **Protection, browser**: `frontend/src/app/app.routes.ts:23`, `canActivate: [adminGuard]` (`guards.ts:15`). The admin code is **lazy-loaded**, so customers never download it.
2. **Protection, server (the real one)**: `backend/Controllers/AdminController.cs:13`, `[Authorize(Roles = "Admin")]`. Someone who isn't an admin and calls the API directly gets **403**.
3. **Photo**: `frontend/src/app/pages/admin/admin.html:27`, `(change)="upload($event)"` → `admin.ts:70` → `POST /api/admin/upload` as FormData → `AdminController.cs:107` → `backend/Services/ImageService.cs:14`:
   - only `.jpg/.png/.webp` under 5 MB
   - cloud: uploads to Cloudinary with a SHA-1 signed request (line 42) and returns its `https://res.cloudinary.com/...` URL
   - your PC: saves to `backend/wwwroot/uploads/<random>.png`
4. **Save**: `admin.html:13` → `admin.ts:59`, `save()` → `POST /api/admin/products` → `AdminController.cs:22`, `CreateProduct`. It checks the category exists, saves the product, and `run()` shows the "Product saved" toast and reloads the lists.
5. **Delete**: removes the row only. Old orders keep their own copy of the name and price (`OrderItem`), so order history never breaks.

---

## 7. The moving strip (banner) and one-page home

- **Home page** (`pages/home/home.html`): hero with logo and social icons → `<app-marquee />` (the moving strip) → `<app-shop />` (all sarees with filters) → trust strip.
- **"Shop" links** use `routerLink="/" fragment="shop"`. `app.config.ts` turns on `anchorScrolling`, so Angular scrolls to `id="shop"`. `app.ts` sets the scroll offset to the header's height, so the heading isn't hidden under the sticky header. `onSameUrlNavigation: 'reload'` makes a second click scroll again.
- **Strip data**: `components/marquee/marquee.ts` calls `GET /api/banners` (`CatalogController.Banners`), which returns only items marked shown, sorted by Order.
- **The endless motion is pure CSS**: the list is drawn **twice** side by side, and the `marquee` animation (`styles.css`) slides the track left by exactly **50%**. At that point copy 2 sits where copy 1 started, so the loop restarts invisibly. Hovering pauses it so people can click.
- **Admin > Banner tab** (`pages/admin/admin.html`): `POST/PUT/DELETE /api/admin/banners` (`AdminController`). Links must start with `https://` or `/` (`BannerInput` in `Dtos.cs`), so nobody can save a `javascript:` link that runs code when clicked.
- **Social links**: `models/site.ts` (`SOCIAL_LINKS`). Change a link there, commit and push.
- **A new table on a live DB**: `Seed.cs`, `AddMissingTables`, asks EF for the full CREATE script, finds the tables the database doesn't have yet (like `Banners`), and runs only their `CREATE TABLE` / `CREATE INDEX` lines. Existing tables and data are untouched; a test proves it (`tests/OrderServiceTests.cs`, `SeedTests`).

## 8. Errors: how a server problem becomes a red pop-up

- `backend/Services/AppError.cs` covers mistakes the user can fix.
- `backend/Program.cs:75` catches them → HTTP 400 `{ "message": "Only 2 left of ..." }`.
- Anything else → plain 500 with **no** internal details, so attackers learn nothing.
- `frontend/src/app/services/toast.service.ts:17`, `error()`, turns any of these into a readable red toast:
  - 429 → "Too many tries"
  - validation 400 → the first field error
  - AppError → its message

## 9. Database

- `backend/Data/AppDb.cs:7`: one `DbSet` per table (Categories, Products, Users, OtpCodes, Orders, OrderItems).
- `OnModelCreating` (line 16) adds a unique email index, and blocks deleting a category that still has products.
- `backend/Program.cs:19` chooses the database: `ConnectionStrings__Postgres` set means PostgreSQL (Neon); otherwise the `shop.db` SQLite file on your PC. Production **refuses to start** without Postgres, because a cloud disk is wiped on every deploy.
- `backend/Data/Seed.cs` creates the tables and the 10 sample categories × 3 sarees on first run.

## 10. Security checklist, and where each one lives

| Threat | Defence | Where |
|---|---|---|
| Customer edits the price in the browser | Server reads prices from the DB | `OrderService.cs:14-25` |
| Fake "payment success" | HMAC signature check with the secret | `PaymentService.cs:45` |
| Paid but tab closed | Signed webhook | `OrdersController.cs:58` |
| Seeing someone else's orders | User id from the cookie, every query filtered by it | `OrdersController.cs:18` |
| Stealing the login | HttpOnly + Secure + SameSite cookie | `Program.cs:25-31` |
| Guessing OTP codes | 5 tries per code, 5-minute expiry, 10 requests per IP per 10 minutes | `AuthService.cs:41`, `Program.cs:44` |
| Non-admin using the admin API | `[Authorize(Roles="Admin")]` | `AdminController.cs:13` |
| Uploading a script as an "image" | Extension allow-list, random filename, size limit | `ImageService.cs:16-25` |
| Leaked keys | Keys only in environment variables; `.gitignore` blocks `.env` | `render.yaml`, `.gitignore` |
| SQL injection | EF Core always sends parameters, never glued strings | all LINQ queries |

## 11. Known shortcuts (fine for now, fix as the shop grows)

These are marked with `shortcut:` comments in the code.
- `Seed.cs`: `EnsureCreated` + `AddMissingTables` can add **new tables** but not **new columns** to an existing table. Move to EF migrations before adding a field to an existing model on the live database.
- `OrderService.cs`: stock is reduced at payment, not reserved at checkout. Two people could both pay for the last saree.
