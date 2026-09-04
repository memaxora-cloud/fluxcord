/* ==========================================================================
   FLUXCORD — Admin dashboard logic
   ========================================================================== */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

let toastTimer;
function showToast(message, type = "") {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function openModal(innerHtml) {
  $("#modal-root").innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal modal-wide">
        <button class="modal-close" id="modal-close">✕</button>
        ${innerHtml}
      </div>
    </div>`;
  $("#modal-close").onclick = closeModal;
  $("#modal-backdrop").onclick = (e) => { if (e.target.id === "modal-backdrop") closeModal(); };
}
function closeModal() { $("#modal-root").innerHTML = ""; }

/* ---------------- Login gate ---------------- */
function checkAdminAuth() {
  if (FluxStore.admin.isLoggedIn()) {
    $("#login-screen").classList.add("hidden");
    $("#dashboard").classList.remove("hidden");
    renderAll();
  } else {
    $("#login-screen").classList.remove("hidden");
    $("#dashboard").classList.add("hidden");
  }
}
$("#admin-login-form").onsubmit = (e) => {
  e.preventDefault();
  const ok = FluxStore.admin.login($("#admin-pass").value);
  if (ok) { checkAdminAuth(); }
  else { showToast("Wrong password.", "error"); }
};
$("#admin-logout").onclick = () => { FluxStore.admin.logout(); checkAdminAuth(); };

/* ---------------- View switching ---------------- */
$all(".admin-link[data-view]").forEach(link => {
  link.onclick = () => {
    $all(".admin-link[data-view]").forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    $all("main > section").forEach(s => s.classList.add("hidden"));
    $("#view-" + link.dataset.view).classList.remove("hidden");
  };
});

/* ---------------- Overview ---------------- */
function renderOverview() {
  const products = FluxStore.products.all();
  const orders = FluxStore.orders.all();
  const pending = orders.filter(o => o.status === "pending");
  const approved = orders.filter(o => o.status === "approved");
  $("#stat-products").textContent = products.length;
  $("#stat-pending").textContent = pending.length;
  $("#stat-approved").textContent = approved.length;
  $("#stat-revenue").textContent = "৳" + approved.reduce((sum, o) => sum + Number(o.amount), 0);

  const recent = orders.slice(0, 6);
  $("#recent-orders-body").innerHTML = recent.length ? recent.map(orderRow).join("") :
    `<tr><td colspan="5" class="muted">No orders yet.</td></tr>`;
}

function buyerName(userId) {
  const u = FluxStore.users.all().find(u => u.id === userId);
  return u ? u.name : "Unknown";
}

function orderRow(o) {
  return `<tr>
    <td>${buyerName(o.userId)}</td>
    <td>${o.productTitle}</td>
    <td>৳${o.amount}</td>
    <td>${o.method.toUpperCase()}</td>
    <td><span class="status-badge ${o.status}">${o.status}</span></td>
  </tr>`;
}

/* ---------------- Products ---------------- */
function renderProducts() {
  const products = FluxStore.products.all();
  $("#products-body").innerHTML = products.length ? products.map(p => `
    <tr>
      <td><div class="cover-thumb">${(p.initials || p.title.slice(0,2)).toUpperCase()}</div></td>
      <td><b>${p.title}</b><br><span class="muted" style="font-size:12px;">${p.description.slice(0, 50)}${p.description.length > 50 ? "…" : ""}</span></td>
      <td>${p.category}</td>
      <td>৳${p.price}${p.oldPrice ? ` <span class="muted" style="text-decoration:line-through;">৳${p.oldPrice}</span>` : ""}</td>
      <td>
        <div class="table-actions">
          <button class="icon-btn" data-edit="${p.id}" title="Edit">✏️</button>
          <button class="icon-btn" data-del="${p.id}" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`).join("") : `<tr><td colspan="5" class="muted">No products yet — add your first ebook.</td></tr>`;

  $all("[data-edit]").forEach(b => b.onclick = () => openProductForm(FluxStore.products.get(b.dataset.edit)));
  $all("[data-del]").forEach(b => b.onclick = () => {
    if (confirm("Delete this ebook? This cannot be undone.")) {
      FluxStore.products.remove(b.dataset.del);
      renderAll();
      showToast("Ebook deleted.");
    }
  });
}

$("#btn-add-product").onclick = () => openProductForm(null);

function openProductForm(product) {
  const isEdit = !!product;
  openModal(`
    <h2>${isEdit ? "Edit ebook" : "Add a new ebook"}</h2>
    <p class="sub">${isEdit ? "Update the details below." : "Fill in the details — it appears on your store instantly."}</p>
    <form id="product-form">
      <div class="field"><label>Title</label><input type="text" id="pf-title" value="${isEdit ? escapeHtml(product.title) : ""}" required></div>
      <div class="field-row">
        <div class="field"><label>Category</label><input type="text" id="pf-category" value="${isEdit ? escapeHtml(product.category) : ""}" placeholder="e.g. Business" required></div>
        <div class="field"><label>Cover initials (2 letters)</label><input type="text" id="pf-initials" maxlength="3" value="${isEdit ? (product.initials||"") : ""}" placeholder="e.g. FF"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Price (৳)</label><input type="number" id="pf-price" min="0" value="${isEdit ? product.price : ""}" required></div>
        <div class="field"><label>Old price (optional, for a sale badge)</label><input type="number" id="pf-oldprice" min="0" value="${isEdit && product.oldPrice ? product.oldPrice : ""}"></div>
      </div>
      <div class="field"><label>Short description</label><textarea id="pf-desc" rows="3" required>${isEdit ? escapeHtml(product.description) : ""}</textarea></div>
      <div class="field"><label>Download link (given to buyers once you approve their order)</label><input type="url" id="pf-link" placeholder="https://drive.google.com/..." value="${isEdit ? (product.downloadLink||"") : ""}"></div>
      <button class="btn btn-primary btn-block" type="submit">${isEdit ? "Save changes" : "Publish ebook"}</button>
    </form>
  `);
  $("#product-form").onsubmit = (e) => {
    e.preventDefault();
    const data = {
      title: $("#pf-title").value.trim(),
      category: $("#pf-category").value.trim(),
      initials: $("#pf-initials").value.trim().toUpperCase() || $("#pf-title").value.slice(0,2).toUpperCase(),
      price: Number($("#pf-price").value),
      oldPrice: $("#pf-oldprice").value ? Number($("#pf-oldprice").value) : null,
      description: $("#pf-desc").value.trim(),
      downloadLink: $("#pf-link").value.trim(),
    };
    if (isEdit) FluxStore.products.update(product.id, data);
    else FluxStore.products.add(data);
    closeModal();
    renderAll();
    showToast(isEdit ? "Ebook updated." : "Ebook published.", "success");
  };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------- Orders ---------------- */
function renderOrders() {
  const orders = FluxStore.orders.all();
  $("#orders-body").innerHTML = orders.length ? orders.map(o => `
    <tr>
      <td>${buyerName(o.userId)}</td>
      <td>${o.productTitle}</td>
      <td>৳${o.amount}</td>
      <td>${o.method.toUpperCase()}</td>
      <td style="font-family:monospace;font-size:12px;">${o.txid}${o.sender ? `<br><span class="muted">from ${o.sender}</span>` : ""}</td>
      <td><span class="status-badge ${o.status}">${o.status}</span></td>
      <td>
        ${o.status === "pending" ? `
          <div class="table-actions">
            <button class="icon-btn" data-approve="${o.id}" title="Approve">✅</button>
            <button class="icon-btn" data-reject="${o.id}" title="Reject">❌</button>
          </div>` : ""}
      </td>
    </tr>`).join("") : `<tr><td colspan="7" class="muted">No orders yet.</td></tr>`;

  $all("[data-approve]").forEach(b => b.onclick = () => {
    FluxStore.orders.setStatus(b.dataset.approve, "approved");
    renderAll();
    showToast("Order approved — buyer can now see it in their Library.", "success");
  });
  $all("[data-reject]").forEach(b => b.onclick = () => {
    FluxStore.orders.setStatus(b.dataset.reject, "rejected");
    renderAll();
    showToast("Order rejected.");
  });
}

function renderAll() {
  renderOverview();
  renderProducts();
  renderOrders();
}

checkAdminAuth();
