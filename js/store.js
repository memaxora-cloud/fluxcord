/* ==========================================================================
   FLUXCORD — Data layer
   Everything is stored in the browser's localStorage so the whole site
   works with zero backend/server. This is perfect for getting started and
   for a single-admin shop. See GUIDE.md "Going further" section for how to
   swap this for a real always-online database later without changing the
   rest of the site's design.
   ========================================================================== */

const FluxStore = (() => {
  const KEYS = {
    products: "fx_products",
    users: "fx_users",
    orders: "fx_orders",
    session: "fx_session",
    admin: "fx_admin_session",
    pendingAuth: "fx_pending_auth",
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function uid(prefix) { return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }

  // ---------------- Seed demo products on first run ----------------
  function seedIfEmpty() {
    if (read(KEYS.products, null)) return;
    const demo = [
      {
        id: uid("prod"),
        title: "The Focused Founder",
        category: "Business",
        price: 450,
        oldPrice: 650,
        description: "A no-fluff playbook for building a one-person online business from zero.",
        initials: "FF",
        createdAt: Date.now(),
      },
      {
        id: uid("prod"),
        title: "Bangla Copywriting Mastery",
        category: "Marketing",
        price: 350,
        oldPrice: null,
        description: "Write ad copy in Bangla that actually converts — with 40 real examples.",
        initials: "BC",
        createdAt: Date.now(),
      },
      {
        id: uid("prod"),
        title: "Freelancing From Dhaka",
        category: "Career",
        price: 300,
        oldPrice: 400,
        description: "How I went from zero to full-time freelancing, step by step, with client scripts.",
        initials: "FD",
        createdAt: Date.now(),
      },
      {
        id: uid("prod"),
        title: "Crypto for Beginners (BD Edition)",
        category: "Finance",
        price: 500,
        oldPrice: null,
        description: "Everything a Bangladeshi beginner needs to know before buying their first crypto.",
        initials: "CB",
        createdAt: Date.now(),
      },
    ];
    write(KEYS.products, demo);
  }
  seedIfEmpty();
  if (!read(KEYS.users, null)) write(KEYS.users, []);
  if (!read(KEYS.orders, null)) write(KEYS.orders, []);

  // ---------------- Products ----------------
  const products = {
    all: () => read(KEYS.products, []),
    get: (id) => products.all().find(p => p.id === id),
    add: (p) => {
      const list = products.all();
      list.unshift({ id: uid("prod"), createdAt: Date.now(), ...p });
      write(KEYS.products, list);
    },
    update: (id, patch) => {
      const list = products.all().map(p => p.id === id ? { ...p, ...patch } : p);
      write(KEYS.products, list);
    },
    remove: (id) => {
      write(KEYS.products, products.all().filter(p => p.id !== id));
    },
  };

  // ---------------- Users (demo auth — see GUIDE.md before going live) ----------------
  function simpleHash(str) { return btoa(unescape(encodeURIComponent(str))); }

  const users = {
    all: () => read(KEYS.users, []),
    byEmail: (email) => users.all().find(u => u.email.toLowerCase() === email.toLowerCase()),
    create: ({ name, email, phone, password }) => {
      const list = users.all();
      const u = { id: uid("usr"), name, email, phone, passHash: simpleHash(password), createdAt: Date.now() };
      list.push(u);
      write(KEYS.users, list);
      return u;
    },
    verifyPassword: (user, password) => user.passHash === simpleHash(password),
  };

  // ---------------- OTP (demo — see GUIDE.md to connect a real email/SMS sender) ----------------
  const otp = {
    generateAndStore: (payload) => {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      write(KEYS.pendingAuth, { ...payload, code, expiresAt: Date.now() + 5 * 60 * 1000 });
      return code;
    },
    getPending: () => read(KEYS.pendingAuth, null),
    verify: (code) => {
      const p = otp.getPending();
      if (!p) return { ok: false, reason: "expired" };
      if (Date.now() > p.expiresAt) return { ok: false, reason: "expired" };
      if (String(code) !== String(p.code)) return { ok: false, reason: "mismatch" };
      return { ok: true, payload: p };
    },
    clearPending: () => localStorage.removeItem(KEYS.pendingAuth),
  };

  // ---------------- Session ----------------
  const session = {
    login: (userId) => localStorage.setItem(KEYS.session, userId),
    logout: () => localStorage.removeItem(KEYS.session),
    currentUser: () => {
      const id = localStorage.getItem(KEYS.session);
      if (!id) return null;
      return users.all().find(u => u.id === id) || null;
    },
  };

  // ---------------- Orders ----------------
  const orders = {
    all: () => read(KEYS.orders, []),
    byUser: (userId) => orders.all().filter(o => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt),
    add: (o) => {
      const list = orders.all();
      const rec = { id: uid("ord"), status: "pending", createdAt: Date.now(), ...o };
      list.unshift(rec);
      write(KEYS.orders, list);
      return rec;
    },
    setStatus: (id, status) => {
      write(KEYS.orders, orders.all().map(o => o.id === id ? { ...o, status } : o));
    },
  };

  // ---------------- Admin gate (demo password — CHANGE THIS, see GUIDE.md) ----------------
  const ADMIN_PASSWORD = "fluxcord-admin"; // <-- change me, then read GUIDE.md to do this properly
  const admin = {
    login: (password) => {
      if (password === ADMIN_PASSWORD) {
        localStorage.setItem(KEYS.admin, "1");
        return true;
      }
      return false;
    },
    isLoggedIn: () => localStorage.getItem(KEYS.admin) === "1",
    logout: () => localStorage.removeItem(KEYS.admin),
  };

  return { products, users, otp, session, orders, admin, uid };
})();
