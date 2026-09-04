/* ==========================================================================
   FLUXCORD — Storefront logic
   ========================================================================== */

/* -------- ⚠️ EDIT THIS BLOCK to put in YOUR real payment details -------- */
const PAYMENT_CONFIG = {
  bkash: { number: "01700-000000", type: "Personal / Send Money" },
  nagad: { number: "01700-000000", type: "Personal / Send Money" },
  ltc: { address: "ltc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
  btc: { address: "bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
  usdt: { address: "TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (TRC20)" },
  usd_to_bdt_note: "Prices shown in ৳ (BDT). For crypto, we'll tell you the equivalent amount to send.",
};
/* ------------------------------------------------------------------------ */

let pendingBuyProductId = null;
let selectedPayMethod = "bkash";

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function t(key) { return FluxLang.t(key); }

/* ---------------- Toast ---------------- */
let toastTimer;
function showToast(message, type = "") {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ---------------- Modal shell ---------------- */
function openModal(innerHtml, wide = false) {
  const root = $("#modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal ${wide ? "modal-wide" : ""}">
        <button class="modal-close" id="modal-close" aria-label="Close">✕</button>
        ${innerHtml}
      </div>
    </div>`;
  $("#modal-close").onclick = closeModal;
  $("#modal-backdrop").onclick = (e) => { if (e.target.id === "modal-backdrop") closeModal(); };
}
function closeModal() { $("#modal-root").innerHTML = ""; }

/* ---------------- Rendering: books ---------------- */
function currentCategory() { return window._fxCategory || "all"; }

function renderCategories() {
  const cats = ["all", ...new Set(FluxStore.products.all().map(p => p.category))];
  const wrap = $("#category-filters");
  wrap.innerHTML = cats.map(c => `
    <button class="chip ${c === currentCategory() ? "active" : ""}" data-cat="${c}">
      ${c === "all" ? t("filter_all") : c}
    </button>`).join("");
  $all(".chip", wrap).forEach(btn => btn.onclick = () => {
    window._fxCategory = btn.dataset.cat;
    renderCategories();
    renderBooks();
  });
}

function renderBooks() {
  const grid = $("#book-grid");
  let list = FluxStore.products.all();
  if (currentCategory() !== "all") list = list.filter(p => p.category === currentCategory());
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${t("empty_books")}</div>`;
    return;
  }
  grid.innerHTML = list.map(p => `
    <article class="book-card">
      <div class="book-cover">
        ${p.oldPrice ? `<span class="badge sale">-${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>` : ""}
        <span class="initials">${p.initials || p.title.slice(0, 2).toUpperCase()}</span>
      </div>
      <div class="book-info">
        <span class="cat">${p.category}</span>
        <h3>${p.title}</h3>
        <p class="desc">${p.description}</p>
        <div class="book-price-row">
          <div class="book-price">${p.oldPrice ? `<span class="old">৳${p.oldPrice}</span>` : ""}৳${p.price}</div>
          <button class="btn btn-primary btn-sm" data-buy="${p.id}">${t("buy_now")}</button>
        </div>
      </div>
    </article>`).join("");
  $all("[data-buy]", grid).forEach(btn => btn.onclick = () => handleBuyClick(btn.dataset.buy));
  $("#stat-books").textContent = FluxStore.products.all().length;
}

function renderFeatured() {
  const list = FluxStore.products.all();
  if (!list.length) return;
  const f = list[0];
  $("#featured-title").textContent = f.title;
  $("#featured-desc").textContent = f.description;
}

/* ---------------- Auth area (nav) ---------------- */
function renderAuthArea() {
  const area = $("#auth-area");
  const user = FluxStore.session.currentUser();
  if (user) {
    area.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="btn-library">${t("nav_library")}</button>
      <div class="user-pill">
        <span class="avatar">${user.name.slice(0, 1).toUpperCase()}</span>
        <span style="font-size:13.5px;font-weight:600;">${user.name.split(" ")[0]}</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-logout">${t("nav_logout")}</button>`;
    $("#btn-library").onclick = openLibraryModal;
    $("#btn-logout").onclick = () => {
      FluxStore.session.logout();
      renderAuthArea();
      showToast(t("nav_logout"));
    };
  } else {
    area.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="btn-login">${t("nav_login")}</button>
      <button class="btn btn-primary btn-sm" id="btn-register">${t("nav_register")}</button>`;
    $("#btn-login").onclick = () => openAuthModal("login");
    $("#btn-register").onclick = () => openAuthModal("register");
  }
}

/* ---------------- Buy click ---------------- */
function handleBuyClick(productId) {
  pendingBuyProductId = productId;
  const user = FluxStore.session.currentUser();
  if (!user) {
    openAuthModal("login", true);
    return;
  }
  openCheckoutModal(productId);
}

/* ---------------- Login / Register modal ---------------- */
function openAuthModal(mode, fromBuy = false) {
  if (mode === "login") {
    openModal(`
      <h2>${t("login_title")}</h2>
      <p class="sub">${t("login_sub")}</p>
      <form id="login-form">
        <div class="field"><label>${t("field_email")}</label><input type="email" id="li-email" required></div>
        <div class="field"><label>${t("field_password")}</label><input type="password" id="li-pass" required></div>
        <button class="btn btn-primary btn-block" type="submit">${t("btn_login")}</button>
      </form>
      <p class="form-switch">${t("no_account")} <a href="#" id="to-register">${t("nav_register")}</a></p>
    `);
    $("#to-register").onclick = (e) => { e.preventDefault(); openAuthModal("register", fromBuy); };
    $("#login-form").onsubmit = (e) => {
      e.preventDefault();
      const email = $("#li-email").value.trim();
      const pass = $("#li-pass").value;
      const user = FluxStore.users.byEmail(email);
      if (!user || !FluxStore.users.verifyPassword(user, pass)) {
        showToast(t("toast_wrong_otp") === t("toast_wrong_otp") ? "Invalid email or password." : "", "error");
        return;
      }
      FluxStore.session.login(user.id);
      renderAuthArea();
      showToast(t("toast_login_ok"), "success");
      if (fromBuy && pendingBuyProductId) openCheckoutModal(pendingBuyProductId);
      else closeModal();
    };
  } else {
    openModal(`
      <h2>${t("register_title")}</h2>
      <p class="sub">${t("register_sub")}</p>
      <form id="register-form">
        <div class="field"><label>${t("field_name")}</label><input type="text" id="re-name" required></div>
        <div class="field"><label>${t("field_email")}</label><input type="email" id="re-email" required></div>
        <div class="field"><label>${t("field_phone")}</label><input type="tel" id="re-phone" placeholder="01XXXXXXXXX" required></div>
        <div class="field"><label>${t("field_password")}</label><input type="password" id="re-pass" required minlength="6"></div>
        <button class="btn btn-primary btn-block" type="submit">${t("btn_send_code")}</button>
      </form>
      <p class="form-switch">${t("have_account")} <a href="#" id="to-login">${t("nav_login")}</a></p>
    `);
    $("#to-login").onclick = (e) => { e.preventDefault(); openAuthModal("login", fromBuy); };
    $("#register-form").onsubmit = (e) => {
      e.preventDefault();
      const name = $("#re-name").value.trim();
      const email = $("#re-email").value.trim();
      const phone = $("#re-phone").value.trim();
      const pass = $("#re-pass").value;
      if (!name || !email || !phone || pass.length < 6) { showToast(t("toast_fill_all"), "error"); return; }
      if (FluxStore.users.byEmail(email)) { showToast("An account with that email already exists.", "error"); return; }
      const code = FluxStore.otp.generateAndStore({ mode: "register", name, email, phone, password: pass });
      openOtpModal(email, code, fromBuy);
    };
  }
}

/* ---------------- OTP modal ---------------- */
function openOtpModal(email, demoCode, fromBuy) {
  openModal(`
    <h2>${t("otp_title")}</h2>
    <p class="sub">${t("otp_sub")} <b>${email}</b></p>
    <div class="demo-otp-note">${t("demo_otp_note")} <b>${demoCode}</b></div>
    <form id="otp-form">
      <div class="otp-inputs">
        ${[0,1,2,3,4,5].map(i => `<input maxlength="1" inputmode="numeric" class="otp-digit" data-i="${i}">`).join("")}
      </div>
      <button class="btn btn-primary btn-block" type="submit">${t("btn_verify")}</button>
    </form>
    <p class="form-switch"><a href="#" id="resend">${t("resend_code")}</a></p>
  `);
  const digits = $all(".otp-digit");
  digits[0].focus();
  digits.forEach((inp, i) => {
    inp.addEventListener("input", () => {
      inp.value = inp.value.replace(/[^0-9]/g, "");
      if (inp.value && digits[i + 1]) digits[i + 1].focus();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !inp.value && digits[i - 1]) digits[i - 1].focus();
    });
  });
  $("#resend").onclick = (e) => {
    e.preventDefault();
    const pending = FluxStore.otp.getPending();
    if (pending) {
      const newCode = FluxStore.otp.generateAndStore(pending);
      openOtpModal(email, newCode, fromBuy);
      showToast("New code sent.");
    }
  };
  $("#otp-form").onsubmit = (e) => {
    e.preventDefault();
    const code = digits.map(d => d.value).join("");
    const result = FluxStore.otp.verify(code);
    if (!result.ok) { showToast(t("toast_wrong_otp"), "error"); return; }
    const { name, email: em, phone, password } = result.payload;
    const user = FluxStore.users.create({ name, email: em, phone, password });
    FluxStore.otp.clearPending();
    FluxStore.session.login(user.id);
    renderAuthArea();
    showToast(t("toast_account_ok"), "success");
    if (fromBuy && pendingBuyProductId) openCheckoutModal(pendingBuyProductId);
    else closeModal();
  };
}

/* ---------------- Checkout modal ---------------- */
function openCheckoutModal(productId) {
  const product = FluxStore.products.get(productId);
  if (!product) { closeModal(); return; }
  selectedPayMethod = "bkash";
  renderCheckout(product);
}

function payInstructionsHtml(method, product) {
  if (method === "bkash" || method === "nagad") {
    const cfg = PAYMENT_CONFIG[method];
    return `
      <div class="pay-instructions">
        <p><b>${method === "bkash" ? "bKash" : "Nagad"}</b> — ${cfg.type}</p>
        <div class="copy-row"><span>${cfg.number}</span><button type="button" data-copy="${cfg.number}">COPY</button></div>
        <p>Send exactly <b>৳${product.price}</b>, then enter the Transaction ID (TrxID) from the confirmation SMS below.</p>
      </div>
      <div class="field"><label>${t("field_sender")}</label><input type="tel" id="pay-sender" placeholder="01XXXXXXXXX" required></div>
      <div class="field"><label>${t("field_txid")}</label><input type="text" id="pay-txid" placeholder="e.g. 9CJ2A1XYZQ" required>
        <p class="muted" style="font-size:12px;margin-top:6px;">${t("field_txid_hint")}</p>
      </div>`;
  }
  const cfg = PAYMENT_CONFIG[method];
  const label = method.toUpperCase();
  return `
    <div class="pay-instructions">
      <p><b>${label}</b> wallet address</p>
      <div class="copy-row"><span>${cfg.address}</span><button type="button" data-copy="${cfg.address}">COPY</button></div>
      <p>Send the equivalent of <b>৳${product.price}</b> in ${label}, then paste your transaction hash (TXID) below.</p>
    </div>
    <div class="field"><label>${t("field_txid")}</label><input type="text" id="pay-txid" placeholder="Transaction hash" required>
      <p class="muted" style="font-size:12px;margin-top:6px;">${t("field_txid_hint")}</p>
    </div>`;
}

function renderCheckout(product) {
  openModal(`
    <h2>${t("checkout_title")}</h2>
    <p class="sub">${t("order_summary")}</p>
    <div class="pay-instructions" style="display:flex;justify-content:space-between;align-items:center;">
      <span><b>${product.title}</b></span><span>৳${product.price}</span>
    </div>
    <p class="sub" style="margin-top:18px;">${t("select_method")}</p>
    <div class="pay-methods">
      <button type="button" class="pay-method ${selectedPayMethod === "bkash" ? "active" : ""}" data-method="bkash"><b>bKash</b></button>
      <button type="button" class="pay-method ${selectedPayMethod === "nagad" ? "active" : ""}" data-method="nagad"><b>Nagad</b></button>
      <button type="button" class="pay-method ${selectedPayMethod === "ltc" || selectedPayMethod === "btc" || selectedPayMethod === "usdt" ? "active" : ""}" data-method="crypto"><b>Crypto</b><div class="sub-methods">LTC / BTC / USDT</div></button>
    </div>
    <div id="crypto-sub" class="${["ltc","btc","usdt"].includes(selectedPayMethod) ? "" : "hidden"}" style="margin-bottom:16px;">
      <div class="field-row" style="grid-template-columns:1fr 1fr 1fr;">
        <button type="button" class="chip ${selectedPayMethod === "ltc" ? "active" : ""}" data-crypto="ltc">LTC</button>
        <button type="button" class="chip ${selectedPayMethod === "btc" ? "active" : ""}" data-crypto="btc">BTC</button>
        <button type="button" class="chip ${selectedPayMethod === "usdt" ? "active" : ""}" data-crypto="usdt">USDT</button>
      </div>
    </div>
    <form id="checkout-form">
      <div id="pay-fields">${payInstructionsHtml(selectedPayMethod === "ltc" || selectedPayMethod === "btc" || selectedPayMethod === "usdt" ? selectedPayMethod : selectedPayMethod, product)}</div>
      <div class="order-total"><span>${t("total_due")}</span><span>৳${product.price}</span></div>
      <button class="btn btn-primary btn-block" type="submit">${t("btn_submit_order")}</button>
    </form>
  `, true);

  $all(".pay-method").forEach(btn => btn.onclick = () => {
    const m = btn.dataset.method;
    selectedPayMethod = m === "crypto" ? "ltc" : m;
    renderCheckout(product);
  });
  $all("[data-crypto]").forEach(btn => btn.onclick = () => {
    selectedPayMethod = btn.dataset.crypto;
    renderCheckout(product);
  });
  $all("[data-copy]").forEach(btn => btn.onclick = () => {
    navigator.clipboard?.writeText(btn.dataset.copy);
    showToast("Copied.");
  });

  $("#checkout-form").onsubmit = (e) => {
    e.preventDefault();
    const txid = $("#pay-txid").value.trim();
    const senderEl = $("#pay-sender");
    const sender = senderEl ? senderEl.value.trim() : "";
    if (!txid || (senderEl && !sender)) { showToast(t("toast_fill_all"), "error"); return; }
    const user = FluxStore.session.currentUser();
    FluxStore.orders.add({
      userId: user.id,
      productId: product.id,
      productTitle: product.title,
      amount: product.price,
      method: selectedPayMethod,
      sender: sender || null,
      txid,
    });
    showToast(t("toast_order_ok"), "success");
    openModal(`
      <div style="text-align:center;padding:10px 0 20px;">
        <div style="font-size:44px;margin-bottom:10px;">✅</div>
        <h2>${t("order_placed_title")}</h2>
        <p class="sub">${t("order_placed_sub")}</p>
        <button class="btn btn-primary" id="order-done">${t("btn_close")}</button>
      </div>
    `);
    $("#order-done").onclick = closeModal;
  };
}

/* ---------------- Library modal ---------------- */
function openLibraryModal() {
  const user = FluxStore.session.currentUser();
  if (!user) return;
  const list = FluxStore.orders.byUser(user.id);
  const rows = list.map(o => `
    <div class="library-item">
      <div>
        <b style="display:block;font-size:14.5px;">${o.productTitle}</b>
        <span class="muted" style="font-size:12px;">৳${o.amount} · ${o.method.toUpperCase()} · ${new Date(o.createdAt).toLocaleDateString()}</span>
      </div>
      ${o.status === "approved"
        ? `<a class="btn btn-primary btn-sm" href="#" onclick="alert('This demo has no real file attached yet — upload a download link for this product in the Admin dashboard.'); return false;">${t("download")}</a>`
        : `<span class="status-badge ${o.status}">${t("status_" + o.status)}</span>`}
    </div>`).join("");
  openModal(`
    <h2>${t("my_library_title")}</h2>
    <p class="sub">${t("my_library_sub")}</p>
    ${list.length ? rows : `<div class="empty-state">${t("empty_library")}</div>`}
  `, true);
}

/* ---------------- Language switch wiring ---------------- */
function wireLangSwitch() {
  $all(".lang-switch button").forEach(btn => {
    btn.onclick = () => FluxLang.set(btn.dataset.lang);
  });
}
window.addEventListener("fx-lang-changed", () => {
  renderCategories();
  renderBooks();
  renderAuthArea();
});

/* ---------------- Init ---------------- */
function init() {
  FluxLang.applyToDOM();
  FluxLang.refineWithIP();
  wireLangSwitch();
  renderCategories();
  renderBooks();
  renderFeatured();
  renderAuthArea();
}
document.addEventListener("DOMContentLoaded", init);
