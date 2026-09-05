const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('fluxcord_cart') || '[]'),
  language: localStorage.getItem('fluxcord_language') || null,
  filter: 'ALL',
  settings: {},
  paymentMethods: {},
  currentUser: null
};

const translations = {
  en: {
    products: 'Products',
    reviews: 'Reviews',
    login: 'Login / Register',
    pill: 'Premium digital products',
    browse: 'Browse Products →',
    track: 'Track Order',
    shopTitle: 'Explore the Shop!',
    reviewTitle: 'What customers say'
  },
  bn: {
    products: 'পণ্য',
    reviews: 'রিভিউ',
    login: 'লগইন',
    pill: 'প্রিমিয়াম ডিজিটাল প্রোডাক্ট',
    browse: 'ই-বুক দেখুন →',
    track: 'অর্ডার ট্র্যাক',
    shopTitle: 'কালেকশন দেখুন',
    reviewTitle: 'কাস্টমাররা কী বলছে'
  }
};

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}

function money(value) {
  return `৳${Number(value || 0).toLocaleString('en-BD')}`;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');

  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => {
    element.classList.remove('show');
  }, 2800);
}

function openModal(content) {
  $('#modalContent').innerHTML = content;
  $('#modal').classList.remove('hidden');
  $('#modal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function saveCart() {
  localStorage.setItem('fluxcord_cart', JSON.stringify(state.cart));
  $('#cartCount').textContent = state.cart.reduce((sum, item) => sum + item.qty, 0);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong.');
  }

  return data;
}

function applyLanguage() {
  if (!state.language) {
    const browserLanguage = (navigator.language || 'en').toLowerCase();
    state.language = browserLanguage.startsWith('bn') ? 'bn' : 'en';
  }

  const translation = translations[state.language];

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;

    if (translation[key]) {
      element.textContent = translation[key];
    }
  });

  $('#languageButton').textContent = state.language === 'bn' ? 'English' : 'বাংলা';
  document.documentElement.lang = state.language === 'bn' ? 'bn' : 'en';
  localStorage.setItem('fluxcord_language', state.language);
}

function renderHero() {
  const title = state.settings.hero_title || '⚡ FluxCord';
  const titleLines = title.split('\n');

  $('#heroTitle').innerHTML = titleLines
    .map((line, index) => index === titleLines.length - 1
      ? `<span>${escapeHtml(line)}</span>`
      : escapeHtml(line))
    .join('<br>');

  $('#heroDescription').textContent = state.settings.hero_description || '';

  $('#discordLink').href = state.settings.discord || '#';
  $('#facebookLink').href = state.settings.facebook || '#';
  $('#emailLink').href = `mailto:${state.settings.email || 'support@fluxcord.store'}`;
}

function renderFilters() {
  const filters = [
    { value: 'ALL', icon: '✦', label: 'ALL', className: 'filter-all' },
    { value: 'FRESH', icon: '✦', label: 'FRESH', className: 'filter-fresh' },
    { value: 'HOT', icon: '🔥', label: 'HOT', className: 'filter-hot' },
    { value: 'SPECIAL', icon: '★', label: 'SPECIAL', className: 'filter-special' }
  ];

  $('#filters').innerHTML = filters
    .map((filter) => `
      <button
        class="filter-button ${filter.className} ${state.filter === filter.value ? 'active' : ''}"
        data-filter="${filter.value}"
      >
        <span class="filter-icon" aria-hidden="true">${filter.icon}</span>
        <span>${filter.label}</span>
      </button>
    `)
    .join('');

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      renderFilters();
      renderProducts();
    });
  });
}

function renderProducts() {
  const products = state.products.filter((product) => (
    state.filter === 'ALL' || product.tag === state.filter
  ));

  if (!products.length) {
    $('#productGrid').innerHTML = `
      <div class="empty-state">
        No products are available in this category yet.
      </div>
    `;
    return;
  }

  $('#productGrid').innerHTML = products.map((product) => `
    <article class="product-card">
      <div class="product-image">
        ${product.image
          ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">`
          : '<div class="product-fallback">📘</div>'}
      </div>

      <div class="product-body">
        <span class="product-tag tag-${String(product.tag || 'FRESH').toLowerCase()}">
          <span class="tag-icon" aria-hidden="true">
            ${product.tag === 'HOT' ? '🔥' : product.tag === 'SPECIAL' ? '★' : '✦'}
          </span>
          ${escapeHtml(product.tag)}
        </span>

        <h3>${escapeHtml(product.name)}</h3>

        <p>${escapeHtml(product.description)}</p>

        <div class="product-meta">
          <span>★ ${Number(product.rating || 0).toFixed(1)}</span>
          <span>•</span>
          <span>${product.review_count || 0} reviews</span>
        </div>

        <div class="product-bottom product-actions">
          <span class="product-price">${money(product.price_bdt)}</span>

          <div class="product-buttons">
            <button
              class="primary-button small-button"
              data-buy-product="${product.id}"
            >
              Buy Now →
            </button>

            <button
              class="secondary-button small-button"
              data-add-product="${product.id}"
            >
              Add to Cart →
            </button>
          </div>
        </div>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('[data-buy-product]').forEach((button) => {
    button.addEventListener('click', async () => {
      const productId = Number(button.dataset.buyProduct);

      state.cart = [{
        id: productId,
        qty: 1
      }];

      saveCart();

      await goToCheckout();
    });
  });

  document.querySelectorAll('[data-add-product]').forEach((button) => {
    button.addEventListener('click', () => {
      addToCart(Number(button.dataset.addProduct));
    });
  });
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  const existing = state.cart.find((item) => item.id === productId);

  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      id: productId,
      qty: 1
    });
  }

  saveCart();

  toast(`${product.name} added to cart.`);
}

function cartTotal() {
  return state.cart.reduce((sum, item) => {
    const product = state.products.find((row) => row.id === item.id);

    return sum + (
      product
        ? product.price_bdt * item.qty
        : 0
    );
  }, 0);
}

function renderCart() {
  const rows = state.cart.map((item) => {
    const product = state.products.find((row) => row.id === item.id);

    if (!product) {
      return '';
    }

    return `
      <div class="cart-row">
        <span>
          <strong>${escapeHtml(product.name)}</strong><br>
          <small>
            ${item.qty} × ${money(product.price_bdt)}
          </small>
        </span>

        <strong>
          ${money(product.price_bdt * item.qty)}
        </strong>

        <button
          class="remove-button"
          data-remove-product="${product.id}"
        >
          ×
        </button>
      </div>
    `;
  }).join('');

  const total = cartTotal();

  openModal(`
    <h2>Your Cart</h2>

    <p class="muted">
      Review your items before checkout.
    </p>

    <div>
      ${rows || '<div class="empty-state">Your cart is empty.</div>'}
    </div>

    ${state.cart.length ? `
      <div class="product-bottom">
        <strong>Total</strong>

        <span class="product-price">
          ${money(total)}
        </span>
      </div>

      <button
        class="primary-button"
        id="checkoutButton"
        style="width:100%;margin-top:15px"
      >
        Continue to checkout
      </button>
    ` : ''}
  `);

  document.querySelectorAll('[data-remove-product]').forEach((button) => {
    button.addEventListener('click', () => {
      state.cart = state.cart.filter(
        (item) => item.id !== Number(button.dataset.removeProduct)
      );

      saveCart();
      renderCart();
    });
  });

  $('#checkoutButton')?.addEventListener('click', goToCheckout);
}

async function loginModal(mode = 'login') {
  const isRegister = mode === 'register';

  openModal(`
    <div class="auth-switch">
      <button
        class="auth-tab ${!isRegister ? 'active' : ''}"
        id="loginTab"
      >
        Login
      </button>

      <button
        class="auth-tab ${isRegister ? 'active' : ''}"
        id="registerTab"
      >
        Register
      </button>
    </div>

    ${isRegister ? `
      <h2>Create your account</h2>

      <p class="muted">
        Verify your email once, then use your password for future logins.
      </p>

      <form class="form" id="registerRequestForm">

        <label>
          Name *
          <input
            id="regName"
            maxlength="60"
            autocomplete="name"
            required
          >
        </label>

        <label>
          Email *
          <input
            id="regEmail"
            type="email"
            autocomplete="email"
            required
          >
        </label>

        <p class="form-note">
          Please check your inbox as well as spam folder.
        </p>

        <label>
          Password *
          <input
            id="regPassword"
            type="password"
            minlength="6"
            autocomplete="new-password"
            required
          >
        </label>

        <label>
          Number
          <input
            id="regPhone"
            inputmode="tel"
            autocomplete="tel"
            placeholder="01XXXXXXXXX"
          >
        </label>

        <button
          class="primary-button"
          type="submit"
        >
          Send OTP →
        </button>

        <button
          class="secondary-button"
          type="button"
          id="cancelAuth"
        >
          ← Cancel
        </button>
      </form>

    ` : `

      <h2>Welcome back</h2>

      <p class="muted">
        Login with your email and password.
      </p>

      <form class="form" id="loginForm">

        <label>
          Email *
          <input
            id="loginEmail"
            type="email"
            autocomplete="email"
            required
          >
        </label>

        <label>
          Password *
          <input
            id="loginPassword"
            type="password"
            autocomplete="current-password"
            required
          >
        </label>

        <button
          class="primary-button"
          type="submit"
        >
          Login →
        </button>

        <button
          class="secondary-button"
          type="button"
          id="cancelAuth"
        >
          ← Cancel
        </button>

      </form>
    `}
  `);

  $('#loginTab').onclick = () => loginModal('login');
  $('#registerTab').onclick = () => loginModal('register');
  $('#cancelAuth').onclick = closeModal;

  if (isRegister) {
    $('#registerRequestForm').addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        const email = $('#regEmail').value.trim();

        const result = await api(
          '/api/auth/request-otp',
          {
            method: 'POST',
            body: JSON.stringify({ email })
          }
        );

        openOtpVerify(
          email,
          result.demoOtp,
          {
            name: $('#regName').value.trim(),
            password: $('#regPassword').value,
            phone: $('#regPhone').value.trim()
          }
        );

      } catch (error) {
        toast(error.message);
      }
    });

  } else {

    $('#loginForm').addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        const result = await api(
          '/api/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({
              email: $('#loginEmail').value.trim(),
              password: $('#loginPassword').value
            })
          }
        );

        state.currentUser = result.user;

        closeModal();

        await refreshUser();

        toast('Logged in successfully.');

        await continueAfterAuth();

      } catch (error) {
        toast(error.message);
      }
    });
  }
}

async function continueAfterAuth() {
  if (!state.currentUser?.name?.trim()) {
    await requiredNameModal();
  }

  const pending = localStorage.getItem(
    'fluxcord_pending_checkout'
  );

  if (pending) {
    localStorage.removeItem(
      'fluxcord_pending_checkout'
    );

    await goToCheckout(pending);
  }

  await openReviewFromUrl();
}

function openOtpVerify(email, demoOtp, registration = {}) {
  openModal(`
    <h2>Verify your email</h2>

    <p class="muted">
      Enter the 6-digit code sent to
      <strong>${escapeHtml(email)}</strong>.
    </p>

    ${demoOtp ? `
      <div class="info-box">
        Demo OTP:
        <strong>${escapeHtml(demoOtp)}</strong>

        <br>

        <small class="muted">
          Disable DEMO_OTP before going live.
        </small>
      </div>
    ` : ''}

    <form class="form" id="otpVerifyForm">

      <input
        id="verifyEmail"
        type="hidden"
        value="${escapeHtml(email)}"
      >

      <label>
        OTP Code

        <input
          id="otpCode"
          inputmode="numeric"
          maxlength="6"
          placeholder="123456"
          required
        >
      </label>

      <button
        class="primary-button"
        type="submit"
      >
        Verify & continue
      </button>

    </form>
  `);

  $('#otpVerifyForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await api(
        '/api/auth/verify-otp',
        {
          method: 'POST',
          body: JSON.stringify({
            email: $('#verifyEmail').value,
            code: $('#otpCode').value,
            name: registration.name || '',
            password: registration.password || '',
            phone: registration.phone || ''
          })
        }
      );

      closeModal();

      await refreshUser();

      if (!state.currentUser?.name?.trim()) {
        await requiredNameModal();
      }

      toast('Account verified successfully.');

      await continueAfterAuth();

    } catch (error) {
      toast(error.message);
    }
  });
}

async function requiredNameModal() {
  openModal(`
    <div class="centered">

      <h2>Choose your name</h2>

      <p class="muted">
        Please set a name for your FluxCord account.
        This name will be shown on your account and
        the Top Spenders leaderboard.
      </p>

      <form class="form" id="requiredNameForm">

        <label>
          Name

          <input
            id="requiredName"
            type="text"
            maxlength="60"
            autocomplete="name"
            placeholder="Your name"
            required
          >
        </label>

        <button
          class="primary-button"
          type="submit"
        >
          Save Name
        </button>

      </form>
    </div>
  `);

  $('#requiredNameForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = $('#requiredName').value.trim();

    if (name.length < 2) {
      toast('Please enter at least 2 characters.');
      return;
    }

    try {
      const result = await api(
        '/api/account/name',
        {
          method: 'POST',
          body: JSON.stringify({ name })
        }
      );

      state.currentUser = result.user;

      closeModal();

      toast('Name saved successfully.');

    } catch (error) {
      toast(error.message);
    }
  });
}

async function refreshUser() {
  const result = await api('/api/me');

  state.currentUser = result.user;

  if (state.currentUser) {
    $('#loginButton').classList.add('hidden');
    $('#accountButton').classList.remove('hidden');
  } else {
    $('#loginButton').classList.remove('hidden');
    $('#accountButton').classList.add('hidden');
  }
}

function checkoutId() {
  const match = window.location.pathname.match(
    /^\/checkout\/([^/]+)\/?$/i
  );

  return match
    ? decodeURIComponent(match[1])
    : '';
}

function generateCheckoutId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let id = '';

  for (let i = 0; i < 10; i++) {
    id += chars[
      Math.floor(Math.random() * chars.length)
    ];
  }

  return id;
}

async function goToCheckout(existingId = '') {
  if (!state.currentUser) {
    const id = existingId || generateCheckoutId();

    localStorage.setItem(
      'fluxcord_pending_checkout',
      id
    );

    await loginModal('login');

    toast(
      'Please login or register to continue checkout.'
    );

    return;
  }

  if (!state.cart.length) {
    toast('Your cart is empty.');
    return;
  }

  const id =
    existingId ||
    checkoutId() ||
    generateCheckoutId();

  window.history.pushState(
    {},
    '',
    `/checkout/${encodeURIComponent(id)}`
  );

  await renderCheckoutPortal();
}

function closeCheckout() {
  window.history.pushState({}, '', '/');

  document.body.classList.remove(
    'checkout-mode'
  );

  $('#checkoutPortal').classList.add('hidden');

  $('main').classList.remove('hidden');

  $('.footer').classList.remove('hidden');

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function selectedPaymentAmount(total, method) {
  return method === 'bKash' ||
    method === 'Nagad'
    ? money(total)
    : `৳${Number(total || 0).toLocaleString('en-BD')} value`;
}

async function renderCheckoutPortal() {
  document.body.classList.add(
    'checkout-mode'
  );

  $('main').classList.add('hidden');

  $('.footer').classList.add('hidden');

  const portal = $('#checkoutPortal');

  portal.classList.remove('hidden');

  const products = state.cart
    .map(item => ({
      ...item,
      product: state.products.find(
        p => p.id === item.id
      )
    }))
    .filter(x => x.product);

  const total = cartTotal();

  const paymentOptions =
    Object.keys(state.paymentMethods)
      .map(method => `
        <option value="${escapeHtml(method)}">
          ${escapeHtml(method)}
        </option>
      `)
      .join('');

  portal.innerHTML = `
    <div class="checkout-shell container">

      <div class="checkout-top">

        <button
          class="secondary-button"
          id="checkoutBack"
        >
          ← Back
        </button>

        <span class="checkout-brand">
          ⚡ FluxCord Checkout
        </span>

        <span class="checkout-id">
          #${escapeHtml(checkoutId())}
        </span>

      </div>

      <div class="checkout-layout">

        <div class="checkout-main-card">

          <div class="checkout-heading">

            <span class="section-label">
              SECURE CHECKOUT
            </span>

            <h1>
              New Payment Request
              <span>🔥</span>
            </h1>

            <p>
              Complete your details, choose a payment
              method and submit the transaction ID.
            </p>

          </div>

          <form
            class="form checkout-form"
            id="checkoutPortalForm"
          >

            <label>
              Name *

              <input
                value="${escapeHtml(
                  state.currentUser.name || ''
                )}"
                readonly
              >
            </label>

            <label>
              Email *

              <input
                value="${escapeHtml(
                  state.currentUser.email || ''
                )}"
                readonly
              >
            </label>

            <label>
              Social media or Phone Number *

              <span class="field-help">
                Please choose a contact method in case
                we need to contact you.
              </span>

              <div class="contact-grid">

                <select id="contactType">
                  <option value="Discord">
                    Discord
                  </option>

                  <option value="Instagram">
                    Instagram
                  </option>

                  <option value="Facebook">
                    Facebook
                  </option>

                  <option value="Phone">
                    Phone
                  </option>
                </select>

                <input
                  id="contactValue"
                  placeholder="Your username or number"
                  required
                >

              </div>
            </label>

            <label>
              Payment Method *

              <select id="paymentMethod">
                ${paymentOptions}
              </select>
            </label>

            <div
              class="payment-request-box"
              id="paymentRequestBox"
            ></div>

            <label>
              Transaction ID *

              <input
                id="trxid"
                maxlength="120"
                placeholder="Paste your transaction ID"
                required
              >
            </label>

            <div
              id="bdtNumberWrap"
              class="hidden"
            >
              <label>
                bKash/Nagad Number *

                <input
                  id="senderNumber"
                  inputmode="tel"
                  placeholder="01XXXXXXXXX"
                >
              </label>
            </div>

            <label>
              Coupon Code

              <input
                id="couponCode"
                placeholder="Optional"
              >
            </label>

            <div
              id="checkoutCoupon"
              class="info-box"
            >
              Total:
              <strong>${money(total)}</strong>
            </div>

            <div class="checkout-actions">

              <button
                class="secondary-button"
                type="button"
                id="checkoutBackBottom"
              >
                ← Back
              </button>

              <button
                class="primary-button"
                type="submit"
              >
                Submit →
              </button>

            </div>

          </form>

        </div>

        <aside class="checkout-summary">

          <span class="section-label">
            YOUR PRODUCTS
          </span>

          <div class="checkout-products">

            ${products.map(x => `
              <div class="checkout-product">

                <span>
                  ${escapeHtml(x.product.name)}
                  <small>× ${x.qty}</small>
                </span>

                <strong>
                  ${money(
                    x.product.price_bdt * x.qty
                  )}
                </strong>

              </div>
            `).join('')}

          </div>

          <div class="checkout-total">

            <span>Total</span>

            <strong>
              ${money(total)}
            </strong>

          </div>

          <p>
            After verification, your product will
            appear here and be delivered to
            <strong>
              ${escapeHtml(
                state.currentUser.email
              )}
            </strong>.
          </p>

        </aside>

      </div>
    </div>
  `;

  const updatePayment = () => {
    const method = $('#paymentMethod').value;

    const address =
      state.paymentMethods[method];

    $('#paymentRequestBox').innerHTML = `
      <div>
        <strong>
          Send ${selectedPaymentAmount(
            total,
            method
          )}
        </strong>

        <small>
          ${escapeHtml(method)} destination
        </small>
      </div>

      <code>
        ${escapeHtml(address || '')}
      </code>
    `;

    const isBDT =
      method === 'bKash' ||
      method === 'Nagad';

    $('#bdtNumberWrap')
      .classList
      .toggle('hidden', !isBDT);

    $('#senderNumber').required = isBDT;
  };

  $('#paymentMethod')
    .addEventListener(
      'change',
      updatePayment
    );

  updatePayment();

  $('#checkoutBack').onclick =
    closeCheckout;

  $('#checkoutBackBottom').onclick =
    closeCheckout;

  $('#couponCode').addEventListener(
    'blur',
    async () => {
      const code =
        $('#couponCode').value.trim();

      if (!code) {
        return;
      }

      try {
        const r = await api(
          '/api/coupon/check',
          {
            method: 'POST',
            body: JSON.stringify({ code })
          }
        );

        const d =
          r.coupon.type === 'percent'
            ? Math.floor(
                total *
                r.coupon.value /
                100
              )
            : Math.min(
                total,
                r.coupon.value
              );

        $('#checkoutCoupon').innerHTML = `
          Coupon applied:
          <strong>
            ${escapeHtml(r.coupon.code)}
          </strong>

          · Final total:

          <strong>
            ${money(
              Math.max(0, total - d)
            )}
          </strong>
        `;

      } catch (e) {
        $('#checkoutCoupon').textContent =
          e.message;
      }
    }
  );

  $('#checkoutPortalForm').addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      const submit =
        event.submitter;

      submit.disabled = true;

      submit.innerHTML =
        '<span class="button-loader"></span> Processing...';

      try {
        const result = await api(
          '/api/orders',
          {
            method: 'POST',
            body: JSON.stringify({
              items: state.cart,

              email:
                state.currentUser.email,

              phone:
                $('#contactValue')
                  .value
                  .trim(),

              contact_type:
                $('#contactType').value,

              contact_value:
                $('#contactValue')
                  .value
                  .trim(),

              payment_method:
                $('#paymentMethod').value,

              trxid:
                $('#trxid')
                  .value
                  .trim(),

              sender_number:
                $('#senderNumber')
                  .value
                  .trim(),

              coupon:
                $('#couponCode')
                  .value
                  .trim()
            })
          }
        );

        state.cart = [];

        saveCart();

        renderCheckoutSuccess(
          result
        );

      } catch (error) {
        toast(error.message);

        submit.disabled = false;

        submit.innerHTML =
          'Submit →';
      }
    }
  );
}

function renderCheckoutSuccess(order) {
  const portal =
    $('#checkoutPortal');

  portal.innerHTML = `
    <div
      class="checkout-shell container checkout-success-shell"
    >

      <div class="payment-success-card">

        <div class="success-orb">
          ✓
        </div>

        <span class="section-label">
          PAYMENT UNDER REQUEST
        </span>

        <h1>
          Payment Under Request!
        </h1>

        <p>
          Please wait till our mod team checks
          the payment and delivers your product.
          You will receive your product via your
          mail
          <strong>
            ${escapeHtml(
              state.currentUser.email
            )}
          </strong>.
        </p>

        <div class="order-status-pill">
          Order
          ${escapeHtml(order.order_code)}
          · PENDING
        </div>

        <div class="checkout-product-list">

          <strong>
            Your Products
          </strong>

          ${
            order.items?.map(item => `
              <div>
                ${escapeHtml(item.name)}
                × ${item.quantity}
              </div>
            `).join('') ||
            `
              <div>
                Your purchased products are
                linked to this order.
              </div>
            `
          }

        </div>

        <button
          class="primary-button"
          id="successAccount"
        >
          View My Orders →
        </button>

      </div>
    </div>
  `;

  $('#successAccount').onclick =
    accountModal;
}

async function accountModal() {
  try {
    const orders =
      await api('/api/orders');

    openModal(`
      <h2>
        My Account
      </h2>

      <div class="info-box account-profile">

        <strong>
          ${escapeHtml(
            state.currentUser?.name ||
            'Your name'
          )}
        </strong>

        <br>

        <small class="muted">
          ${escapeHtml(
            state.currentUser?.email ||
            ''
          )}
        </small>

        <button
          class="secondary-button small-button"
          id="editNameButton"
          style="margin-top:12px"
        >
          Edit Name
        </button>

      </div>

      <h3>
        My Orders
      </h3>

      <p class="muted">
        Track your orders and open support tickets.
      </p>

      ${
        orders.some(
          order =>
            ticketForOrder(order)?.status ===
            'OPEN'
        )
          ? `
            <div class="ticket-live-panel">

              <div class="ticket-live-icon">
                ✦
              </div>

              <div>

                <strong>
                  Support ticket is open
                </strong>

                <span>
                  FluxCord support is ready.
                  Open your order to continue
                  the chat.
                </span>

              </div>

            </div>
          `
          : ''
      }

      <div>

        ${
          orders.length
            ? orders.map(order => `
              <div class="cart-row">

                <span>

                  <strong>
                    ${escapeHtml(
                      order.order_code ||
                      orderCodeFallback(
                        order.id
                      )
                    )}
                  </strong>

                  <br>

                  <small>
                    ${escapeHtml(
                      order.payment_method
                    )}
                    ·
                    ${escapeHtml(
                      order.status
                    )}
                  </small>

                </span>

                <strong>
                  ${money(order.total)}
                </strong>

                <button
                  class="secondary-button small-button"
                  data-view-order="${order.id}"
                >
                  View
                </button>

                ${
                  ticketForOrder(order)?.status ===
                  'OPEN'
                    ? `
                      <button
                        class="ticket-alert-box"
                        data-view-order="${order.id}"
                      >
                        <span
                          class="ticket-glow-dot"
                        ></span>

                        Support ticket open —
                        View chat →
                      </button>
                    `
                    : ''
                }

                ${
                  order.status === 'DELIVERED'
                    ? (
                        order.order_items ||
                        []
                      ).map(item => `
                        <button
                          class="secondary-button small-button"
                          data-review-order="${order.id}"
                          data-review-product="${item.product_id}"
                        >
                          ⭐ Review
                        </button>
                      `).join('')
                    : ''
                }

              </div>
            `).join('')
            : `
              <div class="empty-state">
                No orders yet.
              </div>
            `
        }

      </div>

      <button
        class="outline-button"
        id="logoutButton"
        style="margin-top:15px;width:100%"
      >
        Logout
      </button>
    `);

    $('#editNameButton')
      .addEventListener(
        'click',
        async () => {
          await requiredNameModal();
        }
      );

    document
      .querySelectorAll('[data-view-order]')
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            const order =
              orders.find(
                row =>
                  row.id ===
                  Number(
                    button.dataset.viewOrder
                  )
              );

            if (order) {
              orderDetailModal(order);
            }
          }
        );
      });

    document
      .querySelectorAll('[data-review-order]')
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            const order =
              orders.find(
                row =>
                  row.id ===
                  Number(
                    button.dataset.reviewOrder
                  )
              );

            const item =
              order?.order_items?.find(
                row =>
                  row.product_id ===
                  Number(
                    button.dataset.reviewProduct
                  )
              );

            if (order && item) {
              reviewModal(
                order,
                item
              );
            }
          }
        );
      });

    $('#logoutButton')
      .addEventListener(
        'click',
        async () => {
          await api(
            '/api/auth/logout',
            {
              method: 'POST'
            }
          );

          window.location.reload();
        }
      );

  } catch (error) {
    toast(error.message);
  }
}

function orderCodeFallback(id) {
  return `#${String(id).padStart(3, '0')}`;
}

function ticketForOrder(order) {
  return Array.isArray(order?.tickets)
    ? order.tickets.find(
        ticket =>
          ticket.status === 'OPEN'
      ) ||
      order.tickets[0]
    : null;
}

function reviewModal(order, item) {
  let selectedStars = 5;

  openModal(`
    <h2>
      ⭐ Leave a Review
    </h2>

    <p class="muted">
      ${escapeHtml(item.name)}
      ·
      ${escapeHtml(
        order.order_code ||
        orderCodeFallback(order.id)
      )}
    </p>

    <form
      class="form"
      id="reviewForm"
    >

      <input
        type="hidden"
        id="reviewProductId"
        value="${item.product_id}"
      >

      <div>

        <label>
          Rating
        </label>

        <div
          class="review-rating-picker"
          id="reviewStars"
        >
          ${
            [1, 2, 3, 4, 5]
              .map(
                star => `
                  <button
                    type="button"
                    class="star-button ${
                      star <= 5
                        ? 'active'
                        : ''
                    }"
                    data-star="${star}"
                  >
                    ★
                  </button>
                `
              )
              .join('')
          }
        </div>

      </div>

      <div>

        <label for="reviewComment">
          Your review
        </label>

        <textarea
          id="reviewComment"
          maxlength="500"
          placeholder="Tell us what you thought about this product..."
          required
        ></textarea>

      </div>

      <button
        class="primary-button"
        type="submit"
      >
        Submit Review →
      </button>

    </form>
  `);

  const updateStars = () => {
    document
      .querySelectorAll('[data-star]')
      .forEach(button => {
        button.classList.toggle(
          'active',
          Number(button.dataset.star) <=
            selectedStars
        );
      });
  };

  document
    .querySelectorAll('[data-star]')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          selectedStars =
            Number(
              button.dataset.star
            );

          updateStars();
        }
      );
    });

  $('#reviewForm')
    .addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        try {
          await api(
            '/api/reviews',
            {
              method: 'POST',
              body: JSON.stringify({
                order_code:
                  order.order_code ||
                  orderCodeFallback(
                    order.id
                  ),

                product_id:
                  Number(
                    $('#reviewProductId')
                      .value
                  ),

                stars:
                  selectedStars,

                comment:
                  $('#reviewComment')
                    .value
                    .trim()
              })
            }
          );

          closeModal();

          toast(
            'Review submitted! It will appear after admin approval.'
          );

          await renderReviews();

        } catch (error) {
          toast(error.message);
        }
      }
    );

  updateStars();
}

async function orderDetailModal(order) {
  const ticket =
    Array.isArray(order.tickets)
      ? order.tickets[0]
      : null;

  openModal(`
    <h2>
      ${escapeHtml(
        order.order_code ||
        orderCodeFallback(order.id)
      )}
    </h2>

    <div class="info-box">

      <strong>
        Status:
      </strong>

      ${escapeHtml(order.status)}

      <br>

      <strong>
        Total:
      </strong>

      ${money(order.total)}

      <br>

      <strong>
        Payment:
      </strong>

      ${escapeHtml(
        order.payment_method
      )}

      <br>

      <strong>
        Transaction:
      </strong>

      ${escapeHtml(order.trxid)}

    </div>

    ${
      ticket
        ? `
          <h3 style="margin-top:25px">
            Support
          </h3>

          <div
            class="chat-box"
            id="userChat"
          ></div>

          <form
            class="form"
            id="userMessageForm"
          >

            <textarea
              id="userMessage"
              placeholder="Write a message to FluxCord support..."
            ></textarea>

            <button
              class="primary-button"
              type="submit"
            >
              Send message
            </button>

          </form>
        `
        : ''
    }
  `);

  if (!ticket) {
    return;
  }

  await loadTicketMessages(
    ticket.id,
    '#userChat'
  );

  $('#userMessageForm')
    .addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        const message =
          $('#userMessage')
            .value
            .trim();

        if (!message) {
          return;
        }

        try {
          await api(
            `/api/tickets/${ticket.id}/messages`,
            {
              method: 'POST',
              body: JSON.stringify({
                message
              })
            }
          );

          $('#userMessage').value = '';

          await loadTicketMessages(
            ticket.id,
            '#userChat'
          );

        } catch (error) {
          toast(error.message);
        }
      }
    );
}

async function loadTicketMessages(
  ticketId,
  selector
) {
  const result =
    await api(
      `/api/tickets/${ticketId}/messages`
    );

  $(selector).innerHTML =
    result.messages.length
      ? result.messages
          .map(message => `
            <div
              class="chat-message ${
                message.sender === 'ADMIN'
                  ? 'admin'
                  : ''
              }"
            >

              <small>
                ${
                  message.sender === 'ADMIN'
                    ? 'FluxCord Support'
                    : 'You'
                }
              </small>

              ${escapeHtml(
                message.message
              )}

            </div>
          `)
          .join('')
      : `
        <div class="muted">
          No messages yet.
          Support will reply here.
        </div>
      `;

  $(selector).scrollTop =
    $(selector).scrollHeight;
}

async function trackOrderModal(
  prefilledCode = ''
) {
  openModal(`
    <h2>
      Track an Order
    </h2>

    <p class="muted">
      Enter an order ID such as #90IW1212.
    </p>

    <form
      class="form"
      id="trackForm"
    >

      <input
        id="trackCode"
        placeholder="#90IW1212"
        value="${escapeHtml(
          prefilledCode
        )}"
        required
      >

      <button
        class="primary-button"
        type="submit"
      >
        Track Order
      </button>

    </form>

    <div id="trackResult"></div>
  `);

  $('#trackForm')
    .addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        try {
          const result =
            await api(
              `/api/orders/${encodeURIComponent(
                $('#trackCode')
                  .value
                  .trim()
                  .toUpperCase()
              )}`
            );

          const order =
            result.order;

          $('#trackResult').innerHTML = `
            <div class="info-box">

              <strong>
                ${escapeHtml(
                  order.order_code
                )}
              </strong>

              <br>

              Status:
              <strong>
                ${escapeHtml(
                  order.status
                )}
              </strong>

              <br>

              Total:
              ${money(order.total)}

              <br>

              Payment:
              ${escapeHtml(
                order.payment_method
              )}

              <br>

              Created:
              ${escapeHtml(
                new Date(
                  order.created_at
                ).toLocaleString()
              )}

            </div>
          `;

        } catch (error) {
          toast(error.message);
        }
      }
    );
}

function animateNumber(
  element,
  target,
  duration = 1000,
  decimals = 0
) {
  const end =
    Number(target || 0);

  const startTime =
    performance.now();

  const tick = now => {
    const progress =
      Math.min(
        (now - startTime) /
          duration,
        1
      );

    const eased =
      1 -
      Math.pow(
        1 - progress,
        3
      );

    const value =
      end * eased;

    element.textContent =
      decimals
        ? value.toFixed(decimals)
        : Math.round(value)
            .toLocaleString(
              'en-BD'
            );

    if (progress < 1) {
      requestAnimationFrame(
        tick
      );
    }
  };

  element.textContent =
    decimals
      ? '0.0'
      : '0';

  requestAnimationFrame(tick);
}

async function renderStats() {
  const stats =
    await api('/api/stats');

  animateNumber(
    $('#statCustomers'),
    stats.customers,
    1000,
    0
  );

  animateNumber(
    $('#statSold'),
    stats.sold,
    1000,
    0
  );

  animateNumber(
    $('#statRating'),
    stats.rating,
    1000,
    1
  );
}

async function renderReviews() {
  try {
    const reviews =
      await api('/api/reviews');

    if (!reviews.length) {
      $('#reviewList').innerHTML =
        `
          <div class="empty-state">
            No reviews yet.
            Be the first customer to leave one.
          </div>
        `;

      return;
    }

    const source =
      reviews.slice(0, 12);

    const rows =
      [0, 1].map(rowIndex => {
        const rowReviews =
          source.filter(
            (_, index) =>
              index % 2 ===
              rowIndex
          );

        const filled =
          rowReviews.length
            ? rowReviews
            : source;

        const cards = [
          ...filled,
          ...filled
        ];

        return `
          <div
            class="review-marquee-row ${
              rowIndex % 2
                ? 'reverse'
                : ''
            }"
          >

            <div
              class="review-marquee-track"
            >

              ${cards.map(review => `
                <article
                  class="review-card"
                >

                  <div
                    class="review-stars"
                  >
                    ${
                      '★'.repeat(
                        Number(
                          review.stars ||
                          0
                        )
                      )
                    }${
                      '☆'.repeat(
                        5 -
                        Number(
                          review.stars ||
                          0
                        )
                      )
                    }
                  </div>

                  <p>
                    ${escapeHtml(
                      review.comment ||
                      'Great product.'
                    )}
                  </p>

                  <span
                    class="review-author"
                  >
                    ${escapeHtml(
                      review.name ||
                      'Customer'
                    )}
                    ·
                    ${escapeHtml(
                      review.product_name
                    )}
                  </span>

                </article>
              `).join('')}

            </div>
          </div>
        `;
      });

    $('#reviewList').innerHTML =
      `
        <div class="review-marquee">
          ${rows.join('')}
        </div>
      `;

  } catch (error) {
    console.error(
      'Could not load reviews:',
      error
    );

    $('#reviewList').innerHTML =
      `
        <div class="empty-state">
          Reviews are temporarily unavailable.
          Please check back soon.
        </div>
      `;
  }
}

async function renderLeaderboard() {
  const rows =
    await api('/api/leaderboard');

  $('#leaderboardList').innerHTML =
    rows.length
      ? rows.map(row => `
          <div class="leader-row">

            <span class="leader-rank">
              #${row.rank}
            </span>

            <span class="leader-name">
              ${escapeHtml(row.name)}
            </span>

            <strong class="leader-spent">
              ${money(row.spent)}
            </strong>

          </div>
        `).join('')
      : `
          <div class="empty-state">
            Leaderboard will appear after
            the first verified paid orders.
          </div>
        `;
}

async function openReviewFromUrl() {
  const reviewCode =
    new URLSearchParams(
      window.location.search
    ).get('review');

  if (
    !reviewCode ||
    !state.currentUser
  ) {
    return;
  }

  try {
    const orders =
      await api('/api/orders');

    const order =
      orders.find(
        row =>
          (
            row.order_code ||
            ''
          ).toUpperCase() ===
          reviewCode.toUpperCase()
      );

    if (
      order?.status === 'DELIVERED' &&
      order.order_items?.length
    ) {
      reviewModal(
        order,
        order.order_items[0]
      );
    }

  } catch (error) {
    console.error(
      'Review link error:',
      error
    );
  }
}

async function init() {
  try {
    const [
      settings,
      products,
      paymentMethods
    ] = await Promise.all([
      api('/api/settings'),
      api('/api/products'),
      api('/api/payment-methods')
    ]);

    state.settings =
      settings;

    state.products =
      products;

    state.paymentMethods =
      paymentMethods;

    renderHero();

    renderFilters();

    renderProducts();

    saveCart();

    applyLanguage();

    await Promise.allSettled([
      renderStats(),
      renderReviews(),
      renderLeaderboard(),
      refreshUser()
    ]);

    if (
      state.currentUser &&
      !state.currentUser.name?.trim()
    ) {
      await requiredNameModal();
    }

    await openReviewFromUrl();

  } catch (error) {
    console.error(error);

    toast(
      'Store could not load. Check your Vercel/Supabase setup.'
    );
  }
}

$('#languageButton')
  .addEventListener(
    'click',
    () => {
      state.language =
        state.language === 'bn'
          ? 'en'
          : 'bn';

      applyLanguage();
    }
  );

$('#cartButton')
  .addEventListener(
    'click',
    renderCart
  );

$('#loginButton')
  .addEventListener(
    'click',
    () => loginModal('login')
  );

$('#accountButton')
  .addEventListener(
    'click',
    accountModal
  );

$('#trackButton')
  .addEventListener(
    'click',
    () => trackOrderModal()
  );

$('#modalClose')
  .addEventListener(
    'click',
    closeModal
  );

$('[data-close-modal]')
  .addEventListener(
    'click',
    closeModal
  );

window.addEventListener(
  'keydown',
  event => {
    if (event.key === 'Escape') {
      closeModal();
    }
  }
);

init().then(
  async () => {
    if (
      checkoutId() &&
      state.currentUser
    ) {
      await renderCheckoutPortal();
    } else if (
      checkoutId()
    ) {
      await goToCheckout(
        checkoutId()
      );
    }
  }
);

window.addEventListener(
  'popstate',
  () => {
    if (checkoutId()) {
      renderCheckoutPortal();
    } else {
      closeCheckout();
    }
  }
);
