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
    login: 'Login',
    pill: 'Premium digital products',
    browse: 'Browse E-books →',
    track: 'Track Order',
    shopTitle: 'Explore the collection',
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
  const title = state.settings.hero_title || 'Learn faster.\nBuild smarter.';
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
    { value: 'ALL', label: '✦ ALL' },
    { value: 'FRESH', label: '✦ FRESH' },
    { value: 'HOT', label: '🔥 HOT' },
    { value: 'SPECIAL', label: '★ SPECIAL' }
  ];

  $('#filters').innerHTML = filters
    .map((filter) => `
      <button
        class="filter-button ${state.filter === filter.value ? 'active' : ''}"
        data-filter="${filter.value}"
      >
        ${filter.label}
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
        <span class="product-tag">
          ${product.tag === 'HOT' ? '🔥' : product.tag === 'SPECIAL' ? '★' : '✦'}
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
            <button class="primary-button small-button" data-buy-product="${product.id}">
              Buy Now →
            </button>
            <button class="secondary-button small-button" data-add-product="${product.id}">
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
      state.cart = [{ id: productId, qty: 1 }];
      saveCart();
      await checkout();
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
    return sum + (product ? product.price_bdt * item.qty : 0);
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
          <small>${item.qty} × ${money(product.price_bdt)}</small>
        </span>
        <strong>${money(product.price_bdt * item.qty)}</strong>
        <button class="remove-button" data-remove-product="${product.id}">×</button>
      </div>
    `;
  }).join('');

  const total = cartTotal();

  openModal(`
    <h2>Your Cart</h2>
    <p class="muted">Review your items before checkout.</p>
    <div>${rows || '<div class="empty-state">Your cart is empty.</div>'}</div>
    ${state.cart.length ? `
      <div class="product-bottom">
        <strong>Total</strong>
        <span class="product-price">${money(total)}</span>
      </div>
      <button class="primary-button" id="checkoutButton" style="width:100%;margin-top:15px">
        Continue to checkout
      </button>
    ` : ''}
  `);

  document.querySelectorAll('[data-remove-product]').forEach((button) => {
    button.addEventListener('click', () => {
      state.cart = state.cart.filter((item) => item.id !== Number(button.dataset.removeProduct));
      saveCart();
      renderCart();
    });
  });

  $('#checkoutButton')?.addEventListener('click', checkout);
}

async function loginModal() {
  openModal(`
    <h2>Login / Register</h2>
    <p class="muted">We will send a 6-digit OTP to your email.</p>
    <form class="form" id="otpRequestForm">
      <label>
        Email
        <input id="otpEmail" type="email" autocomplete="email" placeholder="you@example.com" required>
      </label>
      <button class="primary-button" type="submit">Send OTP</button>
    </form>
  `);

  $('#otpRequestForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = $('#otpEmail').value.trim();

    try {
      const result = await api('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      openOtpVerify(email, result.demoOtp);
    } catch (error) {
      toast(error.message);
    }
  });
}

function openOtpVerify(email, demoOtp) {
  openModal(`
    <h2>Verify your email</h2>
    <p class="muted">
      Enter the 6-digit code sent to <strong>${escapeHtml(email)}</strong>.
    </p>
    ${demoOtp ? `
      <div class="info-box">
        Demo OTP: <strong>${escapeHtml(demoOtp)}</strong><br>
        <small class="muted">Disable DEMO_OTP before going live.</small>
      </div>
    ` : ''}
    <form class="form" id="otpVerifyForm">
      <input id="verifyEmail" type="hidden" value="${escapeHtml(email)}">
      <label>
        OTP Code
        <input id="otpCode" inputmode="numeric" maxlength="6" placeholder="123456" required>
      </label>
      <button class="primary-button" type="submit">Verify & continue</button>
    </form>
  `);

  $('#otpVerifyForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await api('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: $('#verifyEmail').value,
          code: $('#otpCode').value
        })
      });

      closeModal();
      await refreshUser();

      if (!state.currentUser?.name?.trim()) {
        await requiredNameModal();
      } else {
        toast('Logged in successfully.');
      }
    } catch (error) {
      toast(error.message);
    }
  });
}

async function requiredNameModal() {
  openModal(`
    <div class="centered">
      <h2>Choose your name</h2>
      <p class="muted">Please set a name for your FluxCord account. This name will be shown on your account and the Top Spenders leaderboard.</p>
      <form class="form" id="requiredNameForm">
        <label>
          Name
          <input id="requiredName" type="text" maxlength="60" autocomplete="name" placeholder="Your name" required>
        </label>
        <button class="primary-button" type="submit">Save Name</button>
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
      const result = await api('/api/account/name', {
        method: 'POST',
        body: JSON.stringify({ name })
      });

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

async function checkout() {
  try {
    await refreshUser();
  } catch {
    state.currentUser = null;
  }

  if (!state.currentUser) {
    closeModal();
    await loginModal();
    toast('Please login before checkout.');
    return;
  }

  if (!state.cart.length) {
    toast('Your cart is empty.');
    return;
  }

  const total = cartTotal();
  const paymentLines = Object.entries(state.paymentMethods)
    .map(([method, address]) => `
      <div class="payment-line">
        <span>${escapeHtml(method)}</span>
        <code>${escapeHtml(address)}</code>
      </div>
    `)
    .join('');

  openModal(`
    <h2>Checkout</h2>
    <p class="muted">
      After payment, submit your transaction ID. A support ticket will be created automatically.
    </p>

    <div class="payment-box">
      ${paymentLines}
    </div>

    <form class="form" id="checkoutForm">
      <label>
        Delivery Email
        <input id="checkoutEmail" type="email" value="${escapeHtml(state.currentUser.email)}" required>
      </label>
      <label>
        Phone Number
        <input id="checkoutPhone" placeholder="01XXXXXXXXX">
      </label>
      <label>
        Payment Method
        <select id="paymentMethod">
          ${Object.keys(state.paymentMethods)
            .map((method) => `<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`)
            .join('')}
        </select>
      </label>
      <label>
        Transaction ID / Reference
        <input id="trxid" placeholder="Paste your transaction ID" required>
      </label>
      <label>
        Coupon Code
        <input id="couponCode" placeholder="FLUX10">
      </label>

      <div class="info-box" id="couponStatus">
        <strong>Order total:</strong> ${money(total)}
      </div>

      <button class="primary-button" type="submit">
        Submit Order
      </button>
    </form>
  `);

  $('#checkoutEmail').addEventListener('blur', () => {
    const email = $('#checkoutEmail').value.trim();

    if (email) {
      const confirmed = window.confirm(
        `Please confirm this is your correct delivery email:\n\n${email}`
      );

      if (!confirmed) {
        $('#checkoutEmail').focus();
      }
    }
  });

  $('#couponCode').addEventListener('blur', async () => {
    const code = $('#couponCode').value.trim();

    if (!code) {
      return;
    }

    try {
      const result = await api('/api/coupon/check', {
        method: 'POST',
        body: JSON.stringify({ code })
      });

      const coupon = result.coupon;
      const discount = coupon.type === 'percent'
        ? Math.floor(total * coupon.value / 100)
        : Math.min(total, coupon.value);

      $('#couponStatus').innerHTML = `
        <strong>Coupon applied:</strong> ${escapeHtml(coupon.code)}<br>
        Discount: ${money(discount)}<br>
        Final total: <strong>${money(Math.max(0, total - discount))}</strong>
      `;
    } catch (error) {
      $('#couponStatus').textContent = error.message;
    }
  });

  $('#checkoutForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const result = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: state.cart,
          email: $('#checkoutEmail').value.trim(),
          phone: $('#checkoutPhone').value.trim(),
          payment_method: $('#paymentMethod').value,
          trxid: $('#trxid').value.trim(),
          coupon: $('#couponCode').value.trim()
        })
      });

      state.cart = [];
      saveCart();

      openModal(`
        <div class="centered">
          <div class="success-mark">✓</div>
          <h2>Order submitted!</h2>
          <p class="muted">
            Your order <strong>${escapeHtml(result.order_code)}</strong> has been created.
            You will receive your item via Email after payment verification and delivery.
          </p>
          <div class="modal-actions">
            <button class="primary-button" id="viewOrdersButton">
              View my orders →
            </button>
            <button class="secondary-button" id="continueShoppingButton">
              Continue Shopping →
            </button>
          </div>
        </div>
      `);

      $('#viewOrdersButton').addEventListener('click', accountModal);
      $('#continueShoppingButton').addEventListener('click', () => {
        closeModal();
        document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth' });
      });
    } catch (error) {
      toast(error.message);
    }
  });
}

async function accountModal() {
  try {
    const orders = await api('/api/orders');

    openModal(`
      <h2>My Account</h2>
      <div class="info-box account-profile">
        <strong>${escapeHtml(state.currentUser?.name || 'Your name')}</strong><br>
        <small class="muted">${escapeHtml(state.currentUser?.email || '')}</small>
        <button class="secondary-button small-button" id="editNameButton" style="margin-top:12px">Edit Name</button>
      </div>
      <h3>My Orders</h3>
      <p class="muted">Track your orders and open support tickets.</p>
      <div>
        ${orders.length
          ? orders.map((order) => `
            <div class="cart-row">
              <span>
                <strong>${escapeHtml(order.order_code || orderCodeFallback(order.id))}</strong><br>
                <small>${escapeHtml(order.payment_method)} · ${escapeHtml(order.status)}</small>
              </span>
              <strong>${money(order.total)}</strong>
              <button class="secondary-button small-button" data-view-order="${order.id}">
                View
              </button>
              ${order.status === 'DELIVERED' ? (order.order_items || []).map((item) => `
                <button class="secondary-button small-button" data-review-order="${order.id}" data-review-product="${item.product_id}">
                  ⭐ Review
                </button>
              `).join('') : ''}
            </div>
          `).join('')
          : '<div class="empty-state">No orders yet.</div>'}
      </div>
      <button class="outline-button" id="logoutButton" style="margin-top:15px;width:100%">
        Logout
      </button>
    `);

    $('#editNameButton').addEventListener('click', async () => {
      await requiredNameModal();
    });

    document.querySelectorAll('[data-view-order]').forEach((button) => {
      button.addEventListener('click', () => {
        const order = orders.find((row) => row.id === Number(button.dataset.viewOrder));
        if (order) {
          orderDetailModal(order);
        }
      });
    });

    document.querySelectorAll('[data-review-order]').forEach((button) => {
      button.addEventListener('click', () => {
        const order = orders.find((row) => row.id === Number(button.dataset.reviewOrder));
        const item = order?.order_items?.find((row) => row.product_id === Number(button.dataset.reviewProduct));
        if (order && item) {
          reviewModal(order, item);
        }
      });
    });

    $('#logoutButton').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    });
  } catch (error) {
    toast(error.message);
  }
}

function orderCodeFallback(id) {
  return `#${String(id).padStart(3, '0')}`;
}

function reviewModal(order, item) {
  let selectedStars = 5;

  openModal(`
    <h2>⭐ Leave a Review</h2>
    <p class="muted">${escapeHtml(item.name)} · ${escapeHtml(order.order_code || orderCodeFallback(order.id))}</p>
    <form class="form" id="reviewForm">
      <input type="hidden" id="reviewProductId" value="${item.product_id}">
      <div>
        <label>Rating</label>
        <div class="review-rating-picker" id="reviewStars">
          ${[1,2,3,4,5].map((star) => `<button type="button" class="star-button ${star <= 5 ? 'active' : ''}" data-star="${star}">★</button>`).join('')}
        </div>
      </div>
      <div>
        <label for="reviewComment">Your review</label>
        <textarea id="reviewComment" maxlength="500" placeholder="Tell us what you thought about this product..." required></textarea>
      </div>
      <button class="primary-button" type="submit">Submit Review →</button>
    </form>
  `);

  const updateStars = () => {
    document.querySelectorAll('[data-star]').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.star) <= selectedStars);
    });
  };

  document.querySelectorAll('[data-star]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedStars = Number(button.dataset.star);
      updateStars();
    });
  });

  $('#reviewForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          order_code: order.order_code || orderCodeFallback(order.id),
          product_id: Number($('#reviewProductId').value),
          stars: selectedStars,
          comment: $('#reviewComment').value.trim()
        })
      });
      closeModal();
      toast('Review submitted! It will appear after admin approval.');
      await renderReviews();
    } catch (error) {
      toast(error.message);
    }
  });

  updateStars();
}

async function orderDetailModal(order) {
  const ticket = Array.isArray(order.tickets) ? order.tickets[0] : null;

  openModal(`
    <h2>${escapeHtml(order.order_code || orderCodeFallback(order.id))}</h2>
    <div class="info-box">
      <strong>Status:</strong> ${escapeHtml(order.status)}<br>
      <strong>Total:</strong> ${money(order.total)}<br>
      <strong>Payment:</strong> ${escapeHtml(order.payment_method)}<br>
      <strong>Transaction:</strong> ${escapeHtml(order.trxid)}
    </div>
    ${ticket ? `
      <h3 style="margin-top:25px">Support</h3>
      <div class="chat-box" id="userChat"></div>
      <form class="form" id="userMessageForm">
        <textarea id="userMessage" placeholder="Write a message to FluxCord support..."></textarea>
        <button class="primary-button" type="submit">Send message</button>
      </form>
    ` : ''}
  `);

  if (!ticket) {
    return;
  }

  await loadTicketMessages(ticket.id, '#userChat');

  $('#userMessageForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const message = $('#userMessage').value.trim();

    if (!message) {
      return;
    }

    try {
      await api(`/api/tickets/${ticket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message })
      });

      $('#userMessage').value = '';
      await loadTicketMessages(ticket.id, '#userChat');
    } catch (error) {
      toast(error.message);
    }
  });
}

async function loadTicketMessages(ticketId, selector) {
  const result = await api(`/api/tickets/${ticketId}/messages`);

  $(selector).innerHTML = result.messages.length
    ? result.messages.map((message) => `
      <div class="chat-message ${message.sender === 'ADMIN' ? 'admin' : ''}">
        <small>${message.sender === 'ADMIN' ? 'FluxCord Support' : 'You'}</small>
        ${escapeHtml(message.message)}
      </div>
    `).join('')
    : '<div class="muted">No messages yet. Support will reply here.</div>';

  $(selector).scrollTop = $(selector).scrollHeight;
}

async function trackOrderModal(prefilledCode = '') {
  openModal(`
    <h2>Track an Order</h2>
    <p class="muted">Enter an order ID such as #001.</p>
    <form class="form" id="trackForm">
      <input id="trackCode" placeholder="#001" value="${escapeHtml(prefilledCode)}" required>
      <button class="primary-button" type="submit">Track Order</button>
    </form>
    <div id="trackResult"></div>
  `);

  $('#trackForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const result = await api(
        `/api/orders/${encodeURIComponent($('#trackCode').value.trim().toUpperCase())}`
      );

      const order = result.order;

      $('#trackResult').innerHTML = `
        <div class="info-box">
          <strong>${escapeHtml(order.order_code)}</strong><br>
          Status: <strong>${escapeHtml(order.status)}</strong><br>
          Total: ${money(order.total)}<br>
          Payment: ${escapeHtml(order.payment_method)}<br>
          Created: ${escapeHtml(new Date(order.created_at).toLocaleString())}
        </div>
      `;
    } catch (error) {
      toast(error.message);
    }
  });
}

async function renderStats() {
  const stats = await api('/api/stats');

  $('#statCustomers').textContent = Number(stats.customers).toLocaleString('en-BD');
  $('#statSold').textContent = Number(stats.sold).toLocaleString('en-BD');
  $('#statRating').textContent = Number(stats.rating).toFixed(1);
}

async function renderReviews() {
  const reviews = await api('/api/reviews');

  $('#reviewList').innerHTML = reviews.length
    ? reviews.slice(0, 8).map((review) => `
      <article class="review-card">
        <div class="review-stars">${'★'.repeat(review.stars)}${'☆'.repeat(5 - review.stars)}</div>
        <p>${escapeHtml(review.comment || 'Great product.')}</p>
        <span class="review-author">
          ${escapeHtml(review.name || 'Customer')} · ${escapeHtml(review.product_name)}
        </span>
      </article>
    `).join('')
    : '<div class="empty-state">No reviews yet. Be the first customer to leave one.</div>';
}

async function renderLeaderboard() {
  const rows = await api('/api/leaderboard');

  $('#leaderboardList').innerHTML = rows.length
    ? rows.map((row) => `
      <div class="leader-row">
        <span class="leader-rank">#${row.rank}</span>
        <span class="leader-name">${escapeHtml(row.name)}</span>
        <strong class="leader-spent">${money(row.spent)}</strong>
      </div>
    `).join('')
    : '<div class="empty-state">Leaderboard will appear after the first verified paid orders.</div>';
}

async function init() {
  try {
    const [settings, products, paymentMethods] = await Promise.all([
      api('/api/settings'),
      api('/api/products'),
      api('/api/payment-methods')
    ]);

    state.settings = settings;
    state.products = products;
    state.paymentMethods = paymentMethods;

    renderHero();
    renderFilters();
    renderProducts();
    saveCart();
    applyLanguage();

    await Promise.all([
      renderStats(),
      renderReviews(),
      renderLeaderboard(),
      refreshUser()
    ]);

    if (state.currentUser && !state.currentUser.name?.trim()) {
      await requiredNameModal();
    }

    const reviewCode = new URLSearchParams(window.location.search).get('review');
    if (reviewCode && state.currentUser) {
      try {
        const orders = await api('/api/orders');
        const order = orders.find((row) => (row.order_code || '').toUpperCase() === reviewCode.toUpperCase());
        if (order?.status === 'DELIVERED' && order.order_items?.length) {
          reviewModal(order, order.order_items[0]);
        }
      } catch (error) {
        console.error('Review link error:', error);
      }
    }
  } catch (error) {
    console.error(error);
    toast('Store could not load. Check your Vercel/Supabase setup.');
  }
}

$('#languageButton').addEventListener('click', () => {
  state.language = state.language === 'bn' ? 'en' : 'bn';
  applyLanguage();
});

$('#cartButton').addEventListener('click', renderCart);
$('#loginButton').addEventListener('click', loginModal);
$('#accountButton').addEventListener('click', accountModal);
$('#trackButton').addEventListener('click', () => trackOrderModal());
$('#modalClose').addEventListener('click', closeModal);

$('[data-close-modal]').addEventListener('click', closeModal);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
  }
});

init();
