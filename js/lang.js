/* ==========================================================================
   FLUXCORD — Language system (English / বাংলা)
   Auto-detects Bangladesh via timezone first (instant, no network),
   then tries a quick IP lookup to confirm/refine. User's manual choice
   (saved in localStorage) always wins after that.
   ========================================================================== */

const DICT = {
  en: {
    nav_login: "Log in",
    nav_register: "Sign up",
    nav_library: "My Library",
    nav_admin: "Admin",
    nav_logout: "Log out",
    hero_eyebrow: "Digital ebook store",
    hero_title_1: "Read something worth",
    hero_title_accent: "your time.",
    hero_sub: "Fluxcord is where I publish every ebook I write — guides, notes and deep dives, delivered straight to your inbox the moment your payment is confirmed.",
    hero_cta_browse: "Browse the library",
    hero_cta_how: "How buying works",
    hero_stat_books: "Ebooks published",
    hero_stat_readers: "Happy readers",
    hero_stat_delivery: "Delivery after payment",
    cover_tag: "Featured",
    library_title: "The library",
    library_sub: "Every title, priced fairly, updated as I publish. Pick one and check out in under a minute.",
    filter_all: "All",
    search_placeholder: "Search ebooks…",
    buy_now: "Buy now",
    empty_books: "No ebooks match that filter yet.",
    how_title: "How buying works",
    how_sub: "No card required, no account needed to browse — just to check out.",
    step1_t: "Pick your ebook",
    step1_d: "Browse the library and hit Buy now on anything you like.",
    step2_t: "Choose a payment method",
    step2_d: "Pay with bKash, Nagad or crypto (LTC / BTC / USDT) — whichever is easiest for you.",
    step3_t: "Send payment & submit proof",
    step3_d: "Send the exact amount, then paste your Transaction ID / TXID into the form.",
    step4_t: "Get your download link",
    step4_d: "Once approved (usually within minutes), your ebook lands in your Library and your email.",
    pay_label: "Accepted payment methods",
    footer_rights: "All ebooks are for personal reading only.",
    footer_contact: "Contact",
    footer_terms: "Terms",
    footer_refunds: "Refund policy",

    // auth
    login_title: "Welcome back",
    login_sub: "Log in to access your ebook library.",
    register_title: "Create your account",
    register_sub: "One quick step — we'll send a code to confirm it's you.",
    field_name: "Full name",
    field_email: "Email address",
    field_phone: "Phone number",
    field_password: "Password",
    btn_send_code: "Send verification code",
    btn_create_account: "Create account",
    btn_login: "Log in",
    otp_title: "Enter the code",
    otp_sub: "We sent a 6-digit code to",
    btn_verify: "Verify & continue",
    resend_code: "Resend code",
    no_account: "Don't have an account?",
    have_account: "Already have an account?",
    demo_otp_note: "Demo mode: no email server connected yet, so your code is",

    // checkout
    checkout_title: "Checkout",
    order_summary: "Order summary",
    select_method: "Select a payment method",
    field_txid: "Transaction ID (TXID)",
    field_txid_hint: "Paste the Transaction ID from your bKash/Nagad SMS or crypto wallet.",
    field_sender: "Your bKash/Nagad number",
    total_due: "Total due",
    btn_submit_order: "Submit order for approval",
    order_placed_title: "Order submitted!",
    order_placed_sub: "We'll verify your payment and unlock your ebook shortly. Track its status anytime in My Library.",
    btn_close: "Close",

    // library
    my_library_title: "My Library",
    my_library_sub: "Every ebook you've bought and its delivery status.",
    status_pending: "Pending review",
    status_approved: "Delivered",
    status_rejected: "Rejected",
    download: "Download",
    empty_library: "You haven't bought any ebooks yet.",

    toast_login_ok: "Welcome back!",
    toast_account_ok: "Account created — you're logged in.",
    toast_order_ok: "Order submitted for review.",
    toast_added_cart: "Added to your order.",
    toast_wrong_otp: "That code isn't right, try again.",
    toast_fill_all: "Please fill in every field.",
  },
  bn: {
    nav_login: "লগইন",
    nav_register: "সাইন আপ",
    nav_library: "আমার লাইব্রেরি",
    nav_admin: "অ্যাডমিন",
    nav_logout: "লগআউট",
    hero_eyebrow: "ডিজিটাল ই-বুক স্টোর",
    hero_title_1: "এমন কিছু পড়ুন যা আপনার সময়ের",
    hero_title_accent: "যোগ্য।",
    hero_sub: "ফ্লাক্সকর্ড হলো সেই জায়গা যেখানে আমি আমার লেখা প্রতিটি ই-বুক প্রকাশ করি — গাইড, নোটস ও গভীর বিশ্লেষণ, পেমেন্ট কনফার্ম হওয়ার সাথে সাথেই সরাসরি আপনার কাছে পৌঁছে যাবে।",
    hero_cta_browse: "লাইব্রেরি দেখুন",
    hero_cta_how: "কেনার পদ্ধতি",
    hero_stat_books: "প্রকাশিত ই-বুক",
    hero_stat_readers: "সন্তুষ্ট পাঠক",
    hero_stat_delivery: "পেমেন্টের পর ডেলিভারি",
    cover_tag: "ফিচার্ড",
    library_title: "লাইব্রেরি",
    library_sub: "প্রতিটি বই ন্যায্য মূল্যে, নতুন বই প্রকাশ হলেই আপডেট হয়। একটি বেছে নিন, এক মিনিটেরও কম সময়ে চেকআউট করুন।",
    filter_all: "সব",
    search_placeholder: "ই-বুক খুঁজুন…",
    buy_now: "কিনুন",
    empty_books: "এই ফিল্টারে কোনো ই-বুক পাওয়া যায়নি।",
    how_title: "কেনার পদ্ধতি",
    how_sub: "দেখার জন্য কার্ড বা অ্যাকাউন্ট লাগবে না — শুধু চেকআউটের সময় লাগবে।",
    step1_t: "আপনার ই-বুক বেছে নিন",
    step1_d: "লাইব্রেরি ঘুরে দেখুন এবং পছন্দের বইয়ে Buy now চাপুন।",
    step2_t: "পেমেন্ট মাধ্যম বেছে নিন",
    step2_d: "বিকাশ, নগদ অথবা ক্রিপ্টো (LTC / BTC / USDT) — যেটা আপনার জন্য সহজ।",
    step3_t: "পেমেন্ট পাঠান ও প্রমাণ জমা দিন",
    step3_d: "সঠিক পরিমাণ পাঠান, তারপর ফর্মে আপনার Transaction ID / TXID বসিয়ে দিন।",
    step4_t: "ডাউনলোড লিংক পান",
    step4_d: "অনুমোদনের পর (সাধারণত কয়েক মিনিটের মধ্যে), আপনার ই-বুক লাইব্রেরি ও ইমেইলে চলে আসবে।",
    pay_label: "গ্রহণযোগ্য পেমেন্ট মাধ্যম",
    footer_rights: "সব ই-বুক শুধুমাত্র ব্যক্তিগত পড়ার জন্য।",
    footer_contact: "যোগাযোগ",
    footer_terms: "শর্তাবলী",
    footer_refunds: "রিফান্ড নীতি",

    login_title: "স্বাগতম ফিরে",
    login_sub: "আপনার ই-বুক লাইব্রেরি দেখতে লগইন করুন।",
    register_title: "অ্যাকাউন্ট তৈরি করুন",
    register_sub: "একটি ছোট ধাপ — আপনি সত্যিই আপনি কিনা যাচাই করতে আমরা একটি কোড পাঠাবো।",
    field_name: "পুরো নাম",
    field_email: "ইমেইল ঠিকানা",
    field_phone: "ফোন নম্বর",
    field_password: "পাসওয়ার্ড",
    btn_send_code: "ভেরিফিকেশন কোড পাঠান",
    btn_create_account: "অ্যাকাউন্ট তৈরি করুন",
    btn_login: "লগইন করুন",
    otp_title: "কোড লিখুন",
    otp_sub: "আমরা ৬-সংখ্যার একটি কোড পাঠিয়েছি এই ঠিকানায়",
    btn_verify: "যাচাই করে এগিয়ে যান",
    resend_code: "আবার কোড পাঠান",
    no_account: "অ্যাকাউন্ট নেই?",
    have_account: "আগে থেকেই অ্যাকাউন্ট আছে?",
    demo_otp_note: "ডেমো মোড: এখনো কোনো ইমেইল সার্ভার যুক্ত হয়নি, তাই আপনার কোড হলো",

    checkout_title: "চেকআউট",
    order_summary: "অর্ডার সারসংক্ষেপ",
    select_method: "পেমেন্ট মাধ্যম বেছে নিন",
    field_txid: "ট্রানজেকশন আইডি (TXID)",
    field_txid_hint: "আপনার বিকাশ/নগদ SMS অথবা ক্রিপ্টো ওয়ালেট থেকে ট্রানজেকশন আইডি বসান।",
    field_sender: "আপনার বিকাশ/নগদ নম্বর",
    total_due: "মোট পরিশোধযোগ্য",
    btn_submit_order: "অনুমোদনের জন্য অর্ডার জমা দিন",
    order_placed_title: "অর্ডার জমা হয়েছে!",
    order_placed_sub: "আমরা আপনার পেমেন্ট যাচাই করে শীঘ্রই আপনার ই-বুক আনলক করবো। যেকোনো সময় My Library-তে স্ট্যাটাস দেখতে পারবেন।",
    btn_close: "বন্ধ করুন",

    my_library_title: "আমার লাইব্রেরি",
    my_library_sub: "আপনার কেনা প্রতিটি ই-বুক ও তার ডেলিভারি স্ট্যাটাস।",
    status_pending: "যাচাই চলছে",
    status_approved: "ডেলিভার হয়েছে",
    status_rejected: "প্রত্যাখ্যাত",
    download: "ডাউনলোড",
    empty_library: "আপনি এখনো কোনো ই-বুক কেনেননি।",

    toast_login_ok: "স্বাগতম!",
    toast_account_ok: "অ্যাকাউন্ট তৈরি হয়েছে — আপনি লগইন করা আছেন।",
    toast_order_ok: "অর্ডার পর্যালোচনার জন্য জমা হয়েছে।",
    toast_added_cart: "অর্ডারে যোগ হয়েছে।",
    toast_wrong_otp: "কোডটি সঠিক নয়, আবার চেষ্টা করুন।",
    toast_fill_all: "সব ঘর পূরণ করুন।",
  }
};

const FluxLang = (() => {
  const STORAGE_KEY = "fx_lang";
  const BD_TIMEZONES = ["Asia/Dhaka"];

  function detectInitial() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "bn") return saved;
    try {
      const tz = Intl.DateTimeFormat().resolveOptions().timeZone;
      if (BD_TIMEZONES.includes(tz)) return "bn";
    } catch (e) {}
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("bn")) return "bn";
    return "en";
  }

  let current = detectInitial();

  function t(key) {
    return (DICT[current] && DICT[current][key]) || DICT.en[key] || key;
  }

  function set(lang) {
    current = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyToDOM();
  }

  function get() { return current; }

  function applyToDOM() {
    document.documentElement.lang = current;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    document.querySelectorAll(".lang-switch button").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lang === current);
    });
    window.dispatchEvent(new CustomEvent("fx-lang-changed"));
  }

  // Optional: refine with a quick IP-based check (only if user hasn't chosen manually)
  async function refineWithIP() {
    if (localStorage.getItem(STORAGE_KEY)) return; // manual choice already made
    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(2500) });
      const data = await res.json();
      if (data && data.country_code === "BD" && current !== "bn") {
        current = "bn";
        applyToDOM();
      } else if (data && data.country_code && data.country_code !== "BD" && !localStorage.getItem(STORAGE_KEY) && current === "bn") {
        // keep bn only if timezone already said so; otherwise leave as detected
      }
    } catch (e) { /* offline or blocked — fine, timezone guess already applied */ }
  }

  return { t, set, get, applyToDOM, refineWithIP };
})();
