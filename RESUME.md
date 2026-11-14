# RESUME: read this first each session

**Done (2026-11-14):**
- Backend: .NET 10 API, EF Core with SQLite locally and Postgres in the cloud, email-OTP cookie login, Razorpay create/verify/webhook, admin CRUD, image upload (Cloudinary or local), 4 xUnit tests.
- Frontend: Angular 20 storefront (home, shop and search, product, cart, checkout, orders, policy pages) plus admin (products, categories, orders).
- Tested end to end in the browser: OTP login → checkout → test payment → Paid; admin add product with photo; phone layout.
- Dockerfile, render.yaml, docs/HOW-IT-WORKS.md (file:line guide).

**Run:**

```bash
dotnet run --project backend --launch-profile http
```

```bash
npx --prefix frontend ng serve
```

Open http://localhost:4200. Admin is `admin@shop.local` (the code shows on screen).

**Next:**
1. Push to GitHub (`prem-arvinth-g/Shop_API`, private).
2. Create the Neon, Cloudinary, Brevo and Razorpay test accounts, then deploy on Render with the README steps.
3. The owner fills the `[brackets]` in `frontend/src/app/pages/policy/policy.ts` and adds the real products in /admin.
4. Before changing models on the live DB: switch `Seed.cs` EnsureCreated to EF migrations.
