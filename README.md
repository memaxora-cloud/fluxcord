# FluxCord

Premium digital storefront built for Vercel + Supabase.

## A-Z project structure

```text
FluxCord/
├── api/
│   └── index.js              # Express API, auth, orders, reviews, admin API, email delivery
├── private/
│   └── admin.js              # Private admin dashboard JavaScript; never served as a public static file
├── public/
│   ├── index.html            # Main storefront
│   ├── style.css             # Storefront + profile + reviews styling
│   ├── app.js                # Storefront client logic
│   ├── admin.html             # Admin shell/login
│   ├── admin.css              # Admin styling
│   ├── user.html              # /users/{username} account page
│   ├── reviews.html           # /reviews all-reviews page
│   ├── terms.html             # Terms of Service
│   ├── privacy.html           # Privacy Policy
│   └── logo.png               # FluxCord logo
├── supabase/
│   └── schema.sql             # Database schema + safe migrations
├── .gitignore
├── SETUP-CHECKLIST.txt
├── package.json
├── README.md
└── vercel.json
```

## Important deployment requirements

1. Use Node.js `24.x` on Vercel.
2. Keep `private/admin.js` in the repository. It is included in the API function but is not a public static file.
3. Do **not** create `public/admin.js`. The admin page loads its script only after `/api/admin/script` confirms an admin session.
4. Add all Supabase, JWT, SMTP and admin environment variables in Vercel.
5. Run `supabase/schema.sql` in Supabase SQL Editor after deploying the database changes.
6. Check `https://YOUR-DOMAIN/api/health` after deployment. It should return JSON with `ok: true`.

## Runtime

Vercel supports Node.js 24.x for builds and functions. The project is explicitly pinned to `24.x`.
