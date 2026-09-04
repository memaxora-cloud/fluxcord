<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>FluxCord — Admin Dashboard</title>
  <link rel="stylesheet" href="/admin.css">
</head>
<body>
  <section class="admin-login" id="loginView">
    <div class="login-card">
      <img src="/logo.png" alt="FluxCord logo">
      <span class="label">PRIVATE AREA</span>
      <h1>FluxCord Admin</h1>
      <p>Manage products, orders, coupons, reviews, support and website settings.</p>
      <form id="adminLoginForm">
        <label>
          Admin Email
          <input id="adminEmail" type="email" autocomplete="username" required>
        </label>
        <label>
          Password
          <input id="adminPassword" type="password" autocomplete="current-password" required>
        </label>
        <button type="submit">Enter Dashboard</button>
      </form>
      <div class="login-error" id="loginError"></div>
    </div>
  </section>

  <div class="admin-shell hidden" id="dashboardApp">
    <aside class="sidebar">
      <a class="admin-brand" href="/">
        <img src="/logo.png" alt="FluxCord logo">
        <span>FluxCord</span>
      </a>

      <nav class="sidebar-nav">
        <button data-tab="dashboard">Dashboard</button>
        <button data-tab="products">Products</button>
        <button data-tab="orders">Orders</button>
        <button data-tab="tickets">Support</button>
        <button data-tab="coupons">Coupons</button>
        <button data-tab="reviews">Reviews</button>
        <button data-tab="settings">Website</button>
      </nav>

      <div class="sidebar-bottom">
        <a href="/" target="_blank">Open Store ↗</a>
        <button id="logoutButton">Logout</button>
      </div>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar">
        <div>
          <span class="label">FLUXCORD CONTROL CENTER</span>
          <h1 id="pageTitle">Dashboard</h1>
        </div>
        <span class="admin-email" id="adminEmailLabel">Admin</span>
      </header>

      <section id="content"></section>
    </main>
  </div>

  <script src="/admin.js"></script>
</body>
</html>
