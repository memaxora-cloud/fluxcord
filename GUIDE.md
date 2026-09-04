# Fluxcord — Your Beginner's Guide (no coding needed)

Hi! This file explains everything in plain words. Read it once, keep it, come back anytime.

## 1. What you got

A complete website with:
- **Homepage** (`index.html`) — shows all your ebooks, lets people register/login with an OTP code, and buy with bKash, Nagad, or crypto (LTC/BTC/USDT).
- **Admin dashboard** (`admin.html`) — where YOU add ebooks, set prices, and approve/reject orders.
- Automatic **Bangla/English** language — switches to Bangla automatically for visitors in Bangladesh, but anyone can change it with the EN/বাং buttons top-right.

Everything is dark + red, matching your brand.

## 2. How to preview it on your own computer (2 minutes)

1. Find the `fluxcord` folder I gave you.
2. Double-click `index.html`. It opens in your browser. That's your whole store — click around!
3. Open `admin.html` the same way. The admin password is: `fluxcord-admin`

That's it — no installs, no terminal, nothing.

## 3. How to put it on the internet at fluxcord.store (about 15 minutes)

You have a domain (`fluxcord.store`) already, so we just need hosting — a place that shows your files to the world for free.

**Step A — Create a free Netlify account**
1. Go to https://app.netlify.com/signup and sign up (free).

**Step B — Upload your website**
1. On the Netlify dashboard, find the box that says "Drag and drop your site output folder here".
2. Drag your whole `fluxcord` folder into that box.
3. Wait 10 seconds. Netlify gives you a link like `random-name-123.netlify.app` — click it. Your site is now LIVE on the internet (just not yet at fluxcord.store).

**Step C — Connect fluxcord.store**
1. In Netlify, go to "Domain settings" → "Add a domain" → type `fluxcord.store`.
2. Netlify shows you 2 lines of text called "DNS records" (they look like `A 75.2.60.5` and `CNAME www ...`).
3. Log into wherever you bought `fluxcord.store` (Namecheap, GoDaddy, etc.), find "DNS Settings" or "Manage DNS", and copy those same 2 lines in.
4. Wait 30–60 minutes. Your site now loads at **fluxcord.store**.

*(If you get stuck on this step specifically, tell me which company you bought your domain from and I'll write you exact click-by-click instructions for that one.)*

## 4. How to add your ebooks

1. Go to `fluxcord.store/admin.html`, log in with your admin password.
2. Click **Products** in the sidebar → **+ Add new ebook**.
3. Fill in: title, category, price, a short description, and (important) a **download link** — this is where the buyer will get your file from. The easiest way:
   - Upload your ebook PDF to Google Drive.
   - Right-click it → "Share" → "Anyone with the link" → Copy link.
   - Paste that link into the "Download link" box.
4. Click Publish. It appears on your homepage instantly.

## 5. How a sale actually works, day to day

1. A customer buys, picks bKash/Nagad/crypto, and types in their Transaction ID.
2. Their order shows up in your **Admin → Orders** tab as "pending".
3. You check your bKash/Nagad/wallet app to confirm the money really arrived.
4. If it's real, click the ✅ (Approve) button. The customer's order becomes "Delivered" in their Library, and they can now see your download link (currently they'll see a placeholder message — see the "Delivering files automatically" note below for the simple upgrade).
5. If it's fake or wrong, click ❌ (Reject).

This manual-check approach is exactly how most small Bangladeshi digital shops run — there's no risk of losing money to a fake payment, because you personally confirm each one before releasing the file.

## 6. Changing your payment numbers/wallets (important — do this before launch!)

Right now the site has placeholder bKash/Nagad numbers and fake crypto addresses. To fix:

1. Open the `fluxcord` folder → `js` folder → open `app.js` with Notepad (Windows) or TextEdit (Mac).
2. Right at the top you'll see a clearly marked block:
   ```
   const PAYMENT_CONFIG = {
     bkash: { number: "01700-000000", ... },
     ...
   }
   ```
3. Replace `01700-000000` with your real bKash number, same for Nagad, and replace the crypto addresses with your real wallet addresses.
4. Save the file, re-upload the folder to Netlify (drag and drop again) — done.

If typing into code makes you nervous, just tell me your real numbers/addresses (or send them privately) and I'll edit the file for you and give you the new version.

## 7. Changing your logo

Replace `assets/logo.svg` with your own logo image. Easiest way: send me your `image1.png` logo file and I'll swap it in and hand you a new folder — no editing needed on your end.

## 8. Going further (optional — only when you're ready)

The site works fully today using your browser's own storage, which is perfect for starting out. Two things to know:

- **Data is per-browser right now.** Products/orders you add in Admin show up for you; but if you switch computers, it starts fresh. When you're ready to scale, this is upgraded by connecting a real free database (I recommend **Firebase**, made by Google — I can wire this in for you when you're ready, same design, nothing changes visually).
- **Real OTP emails/SMS.** Right now, for demo purposes, the OTP code is shown right on screen so you can test everything today. To send *real* OTP codes by email, the simplest free option is a service called **EmailJS** — again, I can connect this for you whenever you say go; it's a 10-minute job on my end once you've made a free EmailJS account.

Neither of these need to happen before you launch and start selling — the manual-approval system in section 5 works perfectly fine on its own from day one.

## 9. If anything breaks or looks wrong

Just tell me what you see (or send a screenshot) and I'll fix the files and give you a new folder to re-upload. You never need to touch code yourself.
