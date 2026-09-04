# FluxCord Store — Vercel + Supabase Edition

This version is designed to be uploaded to a **private GitHub repository** and deployed to **Vercel**.

The project is intentionally split into readable, multiline files. There is no `.env` file in the repository.

## Stack

- Frontend: HTML + CSS + JavaScript
- API: Node.js + Express on Vercel Serverless Functions
- Database: Supabase PostgreSQL
- OTP email: SMTP + Nodemailer
- Admin session: HTTP-only JWT cookie
- Product images: URL / Imgur URL
- Digital delivery: Product file URL is emailed when an admin changes an order to `DELIVERED`

## Features

- Dark premium storefront
- Floating FluxCord logo
- Bangla + English
- Automatic browser-language detection
- OTP login/register
- Cart
- bKash / Nagad / LTC / BTC / USDT BEP-20 checkout
- Coupon system
- Unique order IDs such as `#001`, `#002`, `#003`
- Order tracking
- Automatic support ticket creation after order submission
- Customer/admin chat
- Reviews + moderation
- Rating statistics
- Customer + sold statistics with configurable bonuses
- Top-spender leaderboard
- FAQ
- Admin product management
- Admin order management
- Admin coupon management
- Admin review management
- Admin ticket management
- Admin website customization
- Admin sales graph
- Supabase persistent database
- Vercel-ready API

# 1. Create Supabase project

Create a project in Supabase.

Open **SQL Editor** and run the complete file:

```text
supabase/schema.sql
```

This creates all tables and the initial FluxCord settings/products.

# 2. Get Supabase keys

In Supabase, open your project settings and copy:

- Project URL
- Service role key

The **service role key is secret**. It must only be stored in Vercel Environment Variables.

Never put it inside `public/` or frontend JavaScript.

# 3. Create GitHub repository

Create a new **private** repository.

Upload the complete contents of this project.

Do not upload:

```text
.env
.env.local
.env.production
```

The `.gitignore` already blocks these files.

# 4. Deploy to Vercel

Import the private GitHub repository into Vercel.

Vercel should detect the project automatically.

No build command is required for the static files/API setup.

# 5. Add Vercel Environment Variables

Open:

```text
Vercel → Project → Settings → Environment Variables
```

Add these:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
DEMO_OTP
```

Use these values:

```text
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
JWT_SECRET=use-a-long-random-secret
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-strong-admin-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=FluxCord <no-reply@fluxcord.store>
DEMO_OTP=false
BKASH_NUMBER=01873735925
NAGAD_NUMBER=01715735925
LTC_ADDRESS=LULFfKWEV2bpqgFUUGqQD3uL4g29DJFp4p
BTC_ADDRESS=bc1qp2v7lwax22attps47g242ztztcjyms7lazn24g
USDT_BEP20_ADDRESS=0xfc587Abbe701773eCb4711baee534cFec826c83f
```

For Gmail SMTP, use an **App Password**, not your normal Google account password.

# 6. Local development

Install Node.js 20+.

Open the project folder in Terminal:

```bash
npm install
```

Copy `.env.example` to `.env` and fill in your development values.

Then run:

```bash
npm run dev
```

Open the local Vercel URL shown by the terminal.

# 7. Admin dashboard

Open:

```text
https://fluxcord.store/admin.html
```

Use the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values from Vercel Environment Variables.

# 8. Product delivery

When creating a product in the admin panel:

- Add the product image URL.
- Add the downloadable file URL in `Product File URL`.
- Set the price.
- Choose `FRESH`, `HOT`, or `SPECIAL`.

When a customer pays:

1. Customer submits the order and transaction ID.
2. FluxCord creates the order.
3. FluxCord automatically creates a support ticket.
4. Admin checks the transaction.
5. Admin changes order status to `PAID`.
6. Admin can chat with the customer in Support.
7. Admin changes order status to `DELIVERED`.
8. FluxCord attempts to send the product delivery email.

# 9. Important security rules

Never commit:

```text
.env
SUPABASE_SERVICE_ROLE_KEY
SMTP_PASS
JWT_SECRET
ADMIN_PASSWORD
```

Private GitHub is good, but **Vercel Environment Variables are the actual place for production secrets**.

The Supabase service role key must never be placed in `app.js`, `admin.js`, HTML, CSS or any other public file.

# 10. Custom domain

In Vercel:

```text
Project → Settings → Domains → Add
```

Add:

```text
fluxcord.store
```

Then follow the DNS records Vercel gives you.

# 11. Payment details

Payment details are configurable through Vercel Environment Variables:

```text
BKASH_NUMBER
NAGAD_NUMBER
LTC_ADDRESS
BTC_ADDRESS
USDT_BEP20_ADDRESS
```

The project includes your current values in `.env.example` as a starting point. Verify every payment detail before going live.

# 12. If something does not work

Check these first:

1. Supabase SQL was executed successfully.
2. `SUPABASE_URL` is correct.
3. `SUPABASE_SERVICE_ROLE_KEY` is correct.
4. `JWT_SECRET` exists.
5. `ADMIN_EMAIL` and `ADMIN_PASSWORD` exist.
6. SMTP variables are correct.
7. `DEMO_OTP=false` is used for production.
8. Vercel was redeployed after changing Environment Variables.
9. Open `/api/health` on the deployed domain. It should return:

```json
{
  "ok": true
}
```

## Important note about uploads

This project intentionally uses image/file URLs instead of writing files to the Vercel filesystem. Vercel serverless functions do not provide a normal persistent disk for ecommerce uploads.

For PDFs, use a proper storage provider or Supabase Storage and paste the resulting file URL into the product's `Product File URL` field.
