# Anand Cotton Sarees: online shop

A full-stack store for [@anandcottonsarees](https://www.instagram.com/anandcottonsarees).

**Stack:** Angular 20 + TypeScript · ASP.NET Core (.NET 10) Web API · EF Core · PostgreSQL (Neon) / SQLite · Razorpay · Cloudinary · Docker · Render

**Features:** 10 categories · search · cart · email-OTP login (no passwords) · Razorpay checkout with server-side signature check and webhook · order history · admin panel (products, categories, photo upload, order status) · responsive on every screen size.

**How it works, click by click with file:line references:** [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md)

```
backend/     .NET API     Controllers/ → Services/ → Data/AppDb.cs → database;  Models/ = tables + JSON shapes
frontend/    Angular      pages/ (screens) · components/ (shared UI) · services/ (API calls, cart, login) · models/
tests/       xUnit tests for the money logic (server-side totals, stock, paid-once, signature check)
brand/       logo crops
Dockerfile   builds Angular + .NET into one container
render.yaml  Render deploy blueprint (no secrets in it)
```

## Run on your PC

You need the .NET 10 SDK and Node 22. Use two terminals.

```bash
dotnet run --project backend --launch-profile http
```

```bash
cd frontend && npm install && npx ng serve
```

Open http://localhost:4200.
- **Test mode:** no keys are needed. The login code appears on screen, and payment is a "pretend to pay" box.
- **Admin:** log in as `admin@shop.local`, then open http://localhost:4200/admin.
- **Tests:**

```bash
dotnet test tests
```

## Put it online (free to start)

1. **Neon** (database): create a free project at neon.tech. Copy the connection string in **.NET format**.
2. **Cloudinary** (photos): create a free account. Copy the cloud name, API key and API secret.
3. **Email** for login codes: create a free Brevo account, add and verify a sender, then go to Settings → SMTP & API → **API keys** and generate an API key (`xkeysib-...`). Use the API, not SMTP: Render's free plan blocks SMTP ports.
4. **Razorpay**: sign up, stay in **Test mode**, and go to Settings → API Keys to copy the key id and secret. Then add a webhook at Settings → Webhooks:
   - URL: `https://<your-app>.onrender.com/api/orders/webhook`
   - event: `payment.captured`
   - pick a webhook secret and keep it
5. **Render**:
   - New → **Blueprint** → choose this GitHub repo. Render reads `render.yaml`.
   - Paste each value from steps 1–4 into the environment variables. `ADMIN_EMAILS` = the owner's email.
   - Every `git push` redeploys the site.

Note: Render's free plan sleeps after 15 idle minutes, and the first visit then takes 30–60 seconds. Upgrade to a paid plan at launch.

### Going live
- Finish Razorpay KYC: PAN, bank account, and the policy pages that are already on the site. Fill in the `[brackets]` in `frontend/src/app/pages/policy/policy.ts` first.
- Swap the `rzp_test_` keys for `rzp_live_` keys in Render.
- Optional: buy a domain and add it in Render → Settings → Custom domain. HTTPS is free.

### Moving to AWS later
The same Docker image runs on AWS Lightsail Containers or App Runner. Set the same environment variables there and point the domain at it. The database can stay on Neon, or be copied to AWS RDS with `pg_dump` / `pg_restore`.

## Environment variables

| Name | What it is |
|---|---|
| `ConnectionStrings__Postgres` | Neon connection string (required in production) |
| `ADMIN_EMAILS` | comma-separated emails that get the admin role |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay API keys |
| `RAZORPAY_WEBHOOK_SECRET` | the secret you typed when creating the webhook |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | photo storage |
| `BREVO_API_KEY` | Brevo API key that sends the login-code emails |
| `EMAIL_FROM` | the sender email you verified in Brevo |

**Never commit these.** They belong only in Render's dashboard (or a local `.env`, which git ignores).
