const adminState = {
  tab: 'dashboard',
  tickets: [],
  selectedTicket: null
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
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

function setLoginError(message = '') {
  $('#loginError').textContent = message;
}

async function checkAdmin() {
  try {
    const result = await api('/api/admin/me');

    $('#loginView').classList.add('hidden');
    $('#dashboardApp').classList.remove('hidden');
    $('#adminEmailLabel').textContent = result.email;

    await loadTab('dashboard');
    return true;
  } catch {
    $('#loginView').classList.remove('hidden');
    $('#dashboardApp').classList.add('hidden');
    return false;
  }
}

function setActiveTab(tab) {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
}

async function loadTab(tab) {
  adminState.tab = tab;
  setActiveTab(tab);

  const titles = {
    dashboard: 'Dashboard',
    products: 'Products',
    orders: 'Orders',
    tickets: 'Support',
    coupons: 'Coupons',
    reviews: 'Reviews',
    settings: 'Website'
  };

  $('#pageTitle').textContent = titles[tab] || 'Dashboard';

  try {
    if (tab === 'dashboard') {
      await dashboard();
    }

    if (tab === 'products') {
      await products();
    }

    if (tab === 'orders') {
      await orders();
    }

    if (tab === 'tickets') {
      await tickets();
    }

    if (tab === 'coupons') {
      await coupons();
    }

    if (tab === 'reviews') {
      await reviews();
    }

    if (tab === 'settings') {
      await settings();
    }
  } catch (error) {
    $('#content').innerHTML = `
      <div class="panel">
        <h2>Something went wrong</h2>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

async function dashboard() {
  const data = await api('/api/admin/overview');
  const maxSales = Math.max(...data.daily.map((row) => row.sales), 1);

  $('#content').innerHTML = `
    <div class="metric-grid">
      <div class="metric-card">
        <span>Revenue</span>
        <strong>${money(data.revenue)}</strong>
      </div>
      <div class="metric-card">
        <span>Orders</span>
        <strong>${data.orders}</strong>
      </div>
      <div class="metric-card">
        <span>Customers</span>
        <strong>${data.customers}</strong>
      </div>
      <div class="metric-card">
        <span>Pending Reviews</span>
        <strong>${data.pending_reviews}</strong>
      </div>
    </div>

    <div class="panel">
      <h2>Sales graph</h2>
      <div class="chart">
        ${data.daily.length
          ? data.daily.map((row) => `
            <div class="bar-column" title="${escapeHtml(row.day)} — ${money(row.sales)}">
              <span class="bar-value">${money(row.sales)}</span>
              <div class="bar" style="height:${Math.max(3, (row.sales / maxSales) * 78)}%"></div>
              <span class="bar-label">${escapeHtml(row.day.slice(5))}</span>
            </div>
          `).join('')
          : '<div class="notice">Sales data will appear after orders are created.</div>'}
      </div>
    </div>

    <div class="two-column">
      <div class="panel">
        <h3>Quick actions</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-quick-tab="products">Add Product</button>
          <button class="btn secondary" data-quick-tab="orders">Manage Orders</button>
          <button class="btn secondary" data-quick-tab="tickets">Open Support</button>
        </div>
      </div>
      <div class="panel">
        <h3>Store architecture</h3>
        <div class="notice">
          Vercel hosts the frontend/API. Supabase stores customers, products, orders, coupons, reviews and tickets.
          Secret keys stay server-side in Vercel Environment Variables.
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-quick-tab]').forEach((button) => {
    button.addEventListener('click', () => loadTab(button.dataset.quickTab));
  });
}

async function products() {
  const rows = await api('/api/admin/products');

  $('#content').innerHTML = `
    <div class="panel">
      <h2>Add / Edit Product</h2>
      <form id="productForm" class="form-grid product-form-grid">
        <input type="hidden" id="productId">
        <label>
          Product Name
          <input id="productName" required>
        </label>
        <label>
          Price (BDT)
          <input id="productPrice" type="number" min="0" required>
        </label>
        <label class="full">
          Description
          <textarea id="productDescription"></textarea>
        </label>
        <label>
          Image URL / Imgur URL
          <input id="productImage" placeholder="https://i.imgur.com/...">
        </label>
        <label>
          Product File URL
          <input id="productFile" placeholder="https://.../ebook.pdf">
        </label>
        <label>
          Tag
          <select id="productTag">
            <option value="FRESH">✦ FRESH</option>
            <option value="HOT">🔥 HOT</option>
            <option value="SPECIAL">★ SPECIAL</option>
          </select>
        </label>
        <label>
          Delivery
          <input id="productDelivery" value="Email delivery">
        </label>
        <label class="checkbox-line">
          <input id="productActive" type="checkbox" checked>
          Active product
        </label>
        <div class="full" style="display:flex;gap:8px">
          <button class="btn" type="submit">Save Product</button>
          <button class="btn secondary" type="button" id="resetProduct">Clear</button>
        </div>
      </form>
    </div>

    <div class="panel">
      <h2>Product Library</h2>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Product</th>
              <th>Price</th>
              <th>Tag</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>#${row.id}</td>
                <td>
                  <strong>${escapeHtml(row.name)}</strong><br>
                  <small>${escapeHtml(row.description)}</small>
                </td>
                <td>${money(row.price_bdt)}</td>
                <td>${escapeHtml(row.tag)}</td>
                <td>${row.active ? 'ACTIVE' : 'HIDDEN'}</td>
                <td>
                  <button class="btn secondary" data-edit-product="${row.id}">Edit</button>
                  <button class="btn danger" data-delete-product="${row.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#productForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = $('#productId').value;
    const payload = {
      name: $('#productName').value.trim(),
      description: $('#productDescription').value.trim(),
      price_bdt: Number($('#productPrice').value),
      image: $('#productImage').value.trim(),
      file_url: $('#productFile').value.trim(),
      tag: $('#productTag').value,
      delivery: $('#productDelivery').value.trim(),
      active: $('#productActive').checked
    };

    try {
      await api(id ? `/api/admin/products/${id}` : '/api/admin/products', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });

      await products();
    } catch (error) {
      alert(error.message);
    }
  });

  $('#resetProduct').addEventListener('click', resetProductForm);

  document.querySelectorAll('[data-edit-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = rows.find((item) => item.id === Number(button.dataset.editProduct));

      if (!row) {
        return;
      }

      $('#productId').value = row.id;
      $('#productName').value = row.name;
      $('#productDescription').value = row.description;
      $('#productPrice').value = row.price_bdt;
      $('#productImage').value = row.image;
      $('#productFile').value = row.file_url;
      $('#productTag').value = row.tag;
      $('#productDelivery').value = row.delivery;
      $('#productActive').checked = row.active;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-delete-product]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this product?')) {
        return;
      }

      await api(`/api/admin/products/${button.dataset.deleteProduct}`, {
        method: 'DELETE'
      });

      await products();
    });
  });
}

function resetProductForm() {
  $('#productId').value = '';
  $('#productName').value = '';
  $('#productDescription').value = '';
  $('#productPrice').value = '';
  $('#productImage').value = '';
  $('#productFile').value = '';
  $('#productTag').value = 'FRESH';
  $('#productDelivery').value = 'Email delivery';
  $('#productActive').checked = true;
}

async function orders() {
  const rows = await api('/api/admin/orders');

  $('#content').innerHTML = `
    <div class="panel">
      <h2>Order Management</h2>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Payment</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td><strong>${escapeHtml(row.order_code || `#${String(row.id).padStart(3, '0')}`)}</strong><br><small>${escapeHtml(new Date(row.created_at).toLocaleString())}</small></td>
                <td>${escapeHtml(row.email)}<br><small>${escapeHtml(row.phone)}</small></td>
                <td>${escapeHtml(row.payment_method)}<br><code>${escapeHtml(row.trxid)}</code></td>
                <td>${(row.order_items || []).map((item) => `${escapeHtml(item.name)} × ${item.quantity}`).join('<br>')}</td>
                <td>${money(row.total)}</td>
                <td>${escapeHtml(row.status)}</td>
                <td>
                  <select data-order-status="${row.id}">
                    ${['PENDING', 'PAID', 'DELIVERED', 'CANCELLED'].map((status) => `
                      <option value="${status}" ${row.status === status ? 'selected' : ''}>${status}</option>
                    `).join('')}
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-order-status]').forEach((select) => {
    select.addEventListener('change', async () => {
      try {
        await api(`/api/admin/orders/${select.dataset.orderStatus}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: select.value })
        });
        await orders();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

async function tickets() {
  adminState.tickets = await api('/api/admin/tickets');

  $('#content').innerHTML = `
    <div class="panel">
      <h2>Support Tickets</h2>
      <div class="ticket-chat">
        <div class="ticket-list" id="ticketList">
          ${adminState.tickets.length
            ? adminState.tickets.map((ticket) => `
              <button class="ticket-button ${adminState.selectedTicket === ticket.id ? 'active' : ''}" data-ticket-id="${ticket.id}">
                <strong>#T${ticket.id} · ${escapeHtml(ticket.orders?.order_code || '')}</strong>
                <small>${escapeHtml(ticket.email)} · ${escapeHtml(ticket.status)}</small>
              </button>
            `).join('')
            : '<div class="notice">No tickets yet.</div>'}
        </div>
        <div id="ticketPanel">
          <div class="notice">Select a ticket to open the customer chat.</div>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-ticket-id]').forEach((button) => {
    button.addEventListener('click', () => openAdminTicket(Number(button.dataset.ticketId)));
  });

  if (adminState.selectedTicket) {
    await openAdminTicket(adminState.selectedTicket);
  }
}

async function openAdminTicket(ticketId) {
  const ticket = adminState.tickets.find((row) => row.id === ticketId);

  if (!ticket) {
    return;
  }

  adminState.selectedTicket = ticketId;

  document.querySelectorAll('[data-ticket-id]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.ticketId) === ticketId);
  });

  $('#ticketPanel').innerHTML = `
    <div class="panel" style="margin:0">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
        <div>
          <h3>#T${ticket.id} · ${escapeHtml(ticket.orders?.order_code || '')}</h3>
          <div class="notice">
            ${escapeHtml(ticket.email)} · ${escapeHtml(ticket.orders?.payment_method || '')}<br>
            TrxID: <code>${escapeHtml(ticket.orders?.trxid || '')}</code>
          </div>
        </div>
        <button class="btn ${ticket.status === 'OPEN' ? 'danger' : 'success'}" id="toggleTicketButton">
          ${ticket.status === 'OPEN' ? 'Close Ticket' : 'Reopen Ticket'}
        </button>
      </div>
      <div class="chat-box" id="adminChat" style="margin-top:15px"></div>
      <form id="adminMessageForm" class="form-grid" style="margin-top:10px">
        <textarea id="adminMessage" placeholder="Reply to customer..."></textarea>
        <button class="btn" type="submit">Send Reply</button>
      </form>
    </div>
  `;

  await loadAdminMessages(ticketId);

  $('#toggleTicketButton').addEventListener('click', async () => {
    const nextStatus = ticket.status === 'OPEN' ? 'CLOSED' : 'OPEN';

    await api(`/api/admin/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus })
    });

    await tickets();
  });

  $('#adminMessageForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const message = $('#adminMessage').value.trim();

    if (!message) {
      return;
    }

    try {
      await api(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message })
      });

      $('#adminMessage').value = '';
      await loadAdminMessages(ticketId);
    } catch (error) {
      alert(error.message);
    }
  });
}

async function loadAdminMessages(ticketId) {
  const result = await api(`/api/tickets/${ticketId}/messages`);

  $('#adminChat').innerHTML = result.messages.length
    ? result.messages.map((message) => `
      <div class="message ${message.sender === 'ADMIN' ? 'admin' : ''}">
        <small>${message.sender === 'ADMIN' ? 'You / Admin' : 'Customer'}</small>
        ${escapeHtml(message.message)}
      </div>
    `).join('')
    : '<div class="notice">No messages yet.</div>';

  $('#adminChat').scrollTop = $('#adminChat').scrollHeight;
}

async function coupons() {
  const rows = await api('/api/admin/coupons');

  $('#content').innerHTML = `
    <div class="two-column">
      <div class="panel">
        <h2>Create Coupon</h2>
        <form id="couponForm" class="form-grid">
          <label>
            Code
            <input id="couponCode" placeholder="FLUX10" required>
          </label>
          <label>
            Type
            <select id="couponType">
              <option value="percent">Percent</option>
              <option value="fixed">Fixed BDT</option>
            </select>
          </label>
          <label>
            Value
            <input id="couponValue" type="number" min="1" required>
          </label>
          <button class="btn" type="submit">Create Coupon</button>
        </form>
      </div>
      <div class="panel">
        <h2>Coupon Tips</h2>
        <div class="notice">
          Percent coupons are capped at 100%. Fixed coupons cannot discount more than the order total.
        </div>
      </div>
    </div>

    <div class="panel">
      <h2>Coupon Library</h2>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Value</th>
              <th>Uses</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td><strong>${escapeHtml(row.code)}</strong></td>
                <td>${row.type === 'percent' ? `${row.value}%` : money(row.value)}</td>
                <td>${row.uses}</td>
                <td>${row.active ? 'ACTIVE' : 'OFF'}</td>
                <td>
                  <button class="btn secondary" data-toggle-coupon="${row.id}" data-next-active="${!row.active}">
                    ${row.active ? 'Disable' : 'Enable'}
                  </button>
                  <button class="btn danger" data-delete-coupon="${row.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#couponForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    await api('/api/admin/coupons', {
      method: 'POST',
      body: JSON.stringify({
        code: $('#couponCode').value,
        type: $('#couponType').value,
        value: Number($('#couponValue').value)
      })
    });

    await coupons();
  });

  document.querySelectorAll('[data-toggle-coupon]').forEach((button) => {
    button.addEventListener('click', async () => {
      await api(`/api/admin/coupons/${button.dataset.toggleCoupon}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: button.dataset.nextActive === 'true' })
      });
      await coupons();
    });
  });

  document.querySelectorAll('[data-delete-coupon]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this coupon?')) {
        return;
      }

      await api(`/api/admin/coupons/${button.dataset.deleteCoupon}`, {
        method: 'DELETE'
      });
      await coupons();
    });
  });
}

async function reviews() {
  const rows = await api('/api/admin/reviews');

  $('#content').innerHTML = `
    <div class="panel">
      <h2>Review Moderation</h2>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Customer</th>
              <th>Stars</th>
              <th>Comment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.product_name)}</td>
                <td>${escapeHtml(row.email)}</td>
                <td>${'★'.repeat(row.stars)}${'☆'.repeat(5 - row.stars)}</td>
                <td>${escapeHtml(row.comment)}</td>
                <td>${row.approved ? 'APPROVED' : 'PENDING'}</td>
                <td>
                  <button class="btn" data-review-approve="${row.id}" data-next-approved="${!row.approved}">
                    ${row.approved ? 'Unapprove' : 'Approve'}
                  </button>
                  <button class="btn danger" data-review-delete="${row.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-review-approve]').forEach((button) => {
    button.addEventListener('click', async () => {
      await api(`/api/admin/reviews/${button.dataset.reviewApprove}`, {
        method: 'PATCH',
        body: JSON.stringify({ approved: button.dataset.nextApproved === 'true' })
      });
      await reviews();
    });
  });

  document.querySelectorAll('[data-review-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this review?')) {
        return;
      }

      await api(`/api/admin/reviews/${button.dataset.reviewDelete}`, {
        method: 'DELETE'
      });
      await reviews();
    });
  });
}

async function settings() {
  const current = await api('/api/settings');

  const keys = [
    'store_name',
    'tagline',
    'hero_title',
    'hero_description',
    'stat_customer_bonus',
    'stat_sold_bonus',
    'discord',
    'facebook',
    'email'
  ];

  $('#content').innerHTML = `
    <div class="panel">
      <h2>Website Customization</h2>
      <div class="notice" style="margin-bottom:15px">
        Edit the store content here without touching the code. Use a line break in Hero Title to create two lines.
      </div>
      <form id="settingsForm" class="setting-grid">
        ${keys.map((key) => `
          <label>
            ${escapeHtml(key)}
            ${key.includes('description') || key === 'hero_title'
              ? `<textarea name="${key}">${escapeHtml(current[key] || '')}</textarea>`
              : `<input name="${key}" value="${escapeHtml(current[key] || '')}">`}
          </label>
        `).join('')}
        <button class="btn" type="submit">Save Website Settings</button>
      </form>
    </div>

    <div class="panel">
      <h2>Payment Details</h2>
      <div class="notice">
        Payment numbers and crypto addresses are intentionally stored in the server API configuration, not editable from the public frontend.
        Change them in <code>api/index.js</code> before deployment if needed.
      </div>
    </div>
  `;

  $('#settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(event.target));

    await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    });

    alert('Website settings saved.');
  });
}

document.querySelectorAll('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => loadTab(button.dataset.tab));
});

$('#adminLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoginError('');

  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        email: $('#adminEmail').value.trim(),
        password: $('#adminPassword').value
      })
    });

    await checkAdmin();
  } catch (error) {
    setLoginError(error.message);
  }
});

$('#logoutButton').addEventListener('click', async () => {
  await api('/api/auth/logout', {
    method: 'POST'
  });

  window.location.reload();
});

checkAdmin();
