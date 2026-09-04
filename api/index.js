require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const JWT_SECRET = process.env.JWT_SECRET;
const DEMO_OTP = String(process.env.DEMO_OTP || 'false').toLowerCase() === 'true';

if (!JWT_SECRET) {
  console.warn('JWT_SECRET is missing. Add it to Vercel Environment Variables.');
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const defaultSettings = {
  store_name: 'FluxCord',
  tagline: 'Premium digital knowledge, delivered with care.',
  hero_title: 'Learn faster.\nBuild smarter.',
  hero_description: 'Premium e-books for students, creators and digital entrepreneurs.',
  stat_customer_bonus: '10',
  stat_sold_bonus: '20',
  discord: 'https://discord.com/',
  facebook: 'https://facebook.com/',
  email: 'support@fluxcord.store'
};

const paymentMethods = {
  'bKash': process.env.BKASH_NUMBER || '01873735925',
  'Nagad': process.env.NAGAD_NUMBER || '01715735925',
  'LTC': process.env.LTC_ADDRESS || 'LULFfKWEV2bpqgFUUGqQD3uL4g29DJFp4p',
  'BTC': process.env.BTC_ADDRESS || 'bc1qp2v7lwax22attps47g242ztztcjyms7lazn24g',
  'USDT (BEP-20)': process.env.USDT_BEP20_ADDRESS || '0xfc587Abbe701773eCb4711baee534cFec826c83f'
};

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function signSession(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  });
}

function setSession(res, payload) {
  const token = signSession(payload);

  res.cookie('fc_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

function clearSession(res) {
  res.clearCookie('fc_session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}

function auth(req, res, next) {
  const token = req.cookies.fc_session;

  if (!token) {
    return fail(res, 401, 'Login required.');
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return fail(res, 401, 'Session expired.');
  }
}

function adminOnly(req, res, next) {
  if (!req.user?.admin) {
    return fail(res, 403, 'Admin only.');
  }

  return next();
}

async function getSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('key,value');

  if (error) {
    throw error;
  }

  const settings = { ...defaultSettings };

  for (const row of data || []) {
    settings[row.key] = row.value;
  }

  return settings;
}

function mailTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendMail({ to, subject, text, html }) {
  const transporter = mailTransporter();

  if (!transporter) {
    return false;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `FluxCord <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html
  });

  return true;
}

async function getProductIds(items) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => Number(item?.id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

function orderCode(id) {
  return `#${String(id).padStart(3, '0')}`;
}

async function sendDeliveryEmail(orderId) {
  const { data: order } = await supabase
    .from('orders')
    .select('id,order_code,email,total,status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return;
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('name,quantity,product_id')
    .eq('order_id', orderId);

  const productIds = (items || [])
    .map((item) => item.product_id)
    .filter(Boolean);

  const { data: products } = await supabase
    .from('products')
    .select('id,name,file_url')
    .in('id', productIds.length ? productIds : [0]);

  const links = (items || []).map((item) => {
    const product = (products || []).find((p) => p.id === item.product_id);

    if (!product?.file_url) {
      return `${item.name} — delivery is being handled manually by the FluxCord team.`;
    }

    return `${item.name} — ${product.file_url}`;
  });

  const text = [
    `Thank you for your FluxCord order ${order.order_code}.`,
    '',
    'Your order has been marked as delivered.',
    '',
    ...links,
    '',
    'If you have any problem, reply to this email or contact FluxCord support.'
  ].join('\n');

  await sendMail({
    to: order.email,
    subject: `FluxCord delivery — ${order.order_code}`,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>FluxCord — Your order is ready</h2>
        <p>Order <strong>${order.order_code}</strong> has been marked as delivered.</p>
        <ul>
          ${links.map((link) => `<li>${link}</li>`).join('')}
        </ul>
        <p>If you need help, contact FluxCord support.</p>
      </div>
    `
  });
}

app.get('/api/health', async (req, res) => {
  const { error } = await supabase
    .from('settings')
    .select('key')
    .limit(1);

  if (error) {
    return fail(res, 500, 'Database connection failed.');
  }

  return res.json({ ok: true });
});

app.get('/api/settings', async (req, res) => {
  try {
    return res.json(await getSettings());
  } catch (error) {
    console.error(error);
    return fail(res, 500, 'Could not load store settings.');
  }
});

app.get('/api/payment-methods', (req, res) => {
  return res.json(paymentMethods);
});

app.get('/api/products', async (req, res) => {
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('id', { ascending: false });

  if (error) {
    console.error(error);
    return fail(res, 500, 'Could not load products.');
  }

  const ids = (products || []).map((product) => product.id);

  const { data: reviews } = await supabase
    .from('reviews')
    .select('product_id,stars')
    .eq('approved', true)
    .in('product_id', ids.length ? ids : [0]);

  const result = (products || []).map((product) => {
    const productReviews = (reviews || []).filter(
      (review) => review.product_id === product.id
    );

    const rating = productReviews.length
      ? productReviews.reduce((sum, review) => sum + review.stars, 0) / productReviews.length
      : 0;

    return {
      ...product,
      rating: Number(rating.toFixed(1)),
      review_count: productReviews.length
    };
  });

  return res.json(result);
});

app.get('/api/reviews', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,email,stars,comment,created_at,products(name)')
    .eq('approved', true)
    .order('id', { ascending: false })
    .limit(30);

  if (error) {
    console.error(error);
    return fail(res, 500, 'Could not load reviews.');
  }

  return res.json(
    (data || []).map((review) => ({
      ...review,
      product_name: review.products?.name || 'Product'
    }))
  );
});

app.post('/api/auth/request-otp', async (req, res) => {
  const email = cleanEmail(req.body.email);

  if (!validEmail(email)) {
    return fail(res, 400, 'Enter a valid email address.');
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hash(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('otps')
    .upsert({
      email,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0
    });

  if (error) {
    console.error(error);
    return fail(res, 500, 'Could not create OTP.');
  }

  const sent = await sendMail({
    to: email,
    subject: 'Your FluxCord verification code',
    text: `Your FluxCord OTP is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;text-align:center;padding:30px">
        <h2>FluxCord verification</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:8px">${code}</div>
        <p>This code expires in 10 minutes.</p>
      </div>
    `
  });

  return res.json({
    ok: true,
    sent,
    demoOtp: DEMO_OTP ? code : undefined
  });
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const email = cleanEmail(req.body.email);
  const code = String(req.body.code || '').trim();

  const { data: otp, error: otpError } = await supabase
    .from('otps')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (otpError || !otp) {
    return fail(res, 400, 'Invalid or expired OTP.');
  }

  if (new Date(otp.expires_at).getTime() < Date.now()) {
    await supabase.from('otps').delete().eq('email', email);
    return fail(res, 400, 'OTP has expired.');
  }

  if (otp.attempts >= 5) {
    return fail(res, 429, 'Too many attempts. Request a new OTP.');
  }

  if (hash(code) !== otp.code_hash) {
    await supabase
      .from('otps')
      .update({ attempts: otp.attempts + 1 })
      .eq('email', email);

    return fail(res, 400, 'Invalid OTP.');
  }

  await supabase.from('otps').delete().eq('email', email);

  let { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (!user) {
    const result = await supabase
      .from('users')
      .insert({
        email,
        verified: true
      })
      .select('*')
      .single();

    if (result.error) {
      return fail(res, 500, 'Could not create account.');
    }

    user = result.data;
  } else {
    await supabase
      .from('users')
      .update({ verified: true })
      .eq('id', user.id);
  }

  if (!user.name || !String(user.name).trim()) {
    user.name = '';
  }

  setSession(res, {
    id: user.id,
    email: user.email,
    name: user.name,
    admin: false
  });

  return res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  clearSession(res);
  return res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  const token = req.cookies.fc_session;

  if (!token) {
    return res.json({ user: null });
  }

  try {
    const sessionUser = jwt.verify(token, JWT_SECRET);

    if (sessionUser.admin) {
      return res.json({ user: sessionUser });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id,email,name')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (error || !user) {
      return res.json({ user: null });
    }

    return res.json({ user: { ...user, admin: false } });
  } catch {
    return res.json({ user: null });
  }
});

app.post('/api/account/name', auth, async (req, res) => {
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');

  if (name.length < 2 || name.length > 60) {
    return fail(res, 400, 'Name must be between 2 and 60 characters.');
  }

  const { data: user, error } = await supabase
    .from('users')
    .update({ name })
    .eq('id', req.user.id)
    .select('id,email,name')
    .single();

  if (error || !user) {
    console.error(error);
    return fail(res, 500, 'Could not save your name.');
  }

  setSession(res, {
    id: user.id,
    email: user.email,
    name: user.name,
    admin: false
  });

  return res.json({ ok: true, user: { ...user, admin: false } });
});

app.post('/api/admin/login', (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  const configuredEmail = cleanEmail(process.env.ADMIN_EMAIL);
  const configuredPassword = String(process.env.ADMIN_PASSWORD || '');

  if (
    !configuredEmail ||
    !configuredPassword ||
    email !== configuredEmail ||
    password !== configuredPassword
  ) {
    return fail(res, 401, 'Invalid admin credentials.');
  }

  setSession(res, {
    id: 0,
    email,
    admin: true
  });

  return res.json({ ok: true });
});

app.get('/api/stats', async (req, res) => {
  try {
    const settings = await getSettings();

    const [{ data: users }, { data: soldRows }, { data: reviews }] = await Promise.all([
      supabase.from('users').select('id'),
      supabase.from('order_items').select('quantity,orders(status)'),
      supabase.from('reviews').select('stars').eq('approved', true)
    ]);

    const customers = (users || []).length + Number(settings.stat_customer_bonus || 10);
    const sold = (soldRows || [])
      .filter((row) => ['PAID', 'DELIVERED'].includes(row.orders?.status))
      .reduce((sum, row) => sum + Number(row.quantity || 1), 0) + Number(settings.stat_sold_bonus || 20);
    const rating = reviews?.length
      ? reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length
      : 0;

    return res.json({
      customers,
      sold,
      rating: Number(rating.toFixed(1))
    });
  } catch (error) {
    console.error(error);
    return fail(res, 500, 'Could not load statistics.');
  }
});

app.get('/api/leaderboard', async (req, res) => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('email,total,status,users(name)')
    .in('status', ['PAID', 'DELIVERED']);

  if (error) {
    return fail(res, 500, 'Could not load leaderboard.');
  }

  const map = new Map();

  for (const order of orders || []) {
    const name = String(order.users?.name || '').trim();
    const key = name || order.email;
    const existing = map.get(key) || { name: name || 'Customer', spent: 0 };
    existing.spent += Number(order.total || 0);
    map.set(key, existing);
  }

  const leaderboard = [...map.values()]
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 10)
    .map((row, index) => ({
      rank: index + 1,
      name: row.name,
      spent: row.spent
    }));

  return res.json(leaderboard);
});

app.post('/api/coupon/check', async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();

  if (!code) {
    return fail(res, 400, 'Enter a coupon code.');
  }

  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code)
    .eq('active', true)
    .maybeSingle();

  if (!coupon) {
    return fail(res, 404, 'Coupon not found or inactive.');
  }

  return res.json({
    ok: true,
    coupon: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value
    }
  });
});

app.post('/api/orders', auth, async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const email = cleanEmail(req.body.email);
  const phone = String(req.body.phone || '').trim().slice(0, 40);
  const paymentMethod = String(req.body.payment_method || '').trim();
  const trxid = String(req.body.trxid || '').trim().slice(0, 120);
  const couponCode = String(req.body.coupon || '').trim().toUpperCase();

  if (!items.length) {
    return fail(res, 400, 'Your cart is empty.');
  }

  if (!validEmail(email)) {
    return fail(res, 400, 'Enter a valid delivery email.');
  }

  if (!paymentMethods[paymentMethod]) {
    return fail(res, 400, 'Choose a valid payment method.');
  }

  if (!trxid) {
    return fail(res, 400, 'Transaction ID is required.');
  }

  const productIds = await getProductIds(items);

  if (!productIds.length) {
    return fail(res, 400, 'Your cart contains invalid products.');
  }

  const { data: products, error: productError } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds)
    .eq('active', true);

  if (productError || !products || products.length !== productIds.length) {
    return fail(res, 400, 'One or more products are unavailable.');
  }

  let subtotal = 0;
  const normalizedItems = [];

  for (const item of items) {
    const product = products.find((row) => row.id === Number(item.id));

    if (!product) {
      continue;
    }

    const quantity = Math.max(1, Math.min(20, Number(item.qty || 1)));
    subtotal += product.price_bdt * quantity;

    normalizedItems.push({
      product_id: product.id,
      name: product.name,
      price: product.price_bdt,
      quantity
    });
  }

  let discount = 0;
  let coupon = null;

  if (couponCode) {
    const result = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode)
      .eq('active', true)
      .maybeSingle();

    coupon = result.data;

    if (coupon) {
      discount = coupon.type === 'percent'
        ? Math.floor(subtotal * Number(coupon.value) / 100)
        : Math.min(subtotal, Number(coupon.value));
    }
  }

  const total = Math.max(0, subtotal - discount);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: req.user.id,
      email,
      phone,
      payment_method: paymentMethod,
      trxid,
      subtotal,
      discount,
      total,
      status: 'PENDING'
    })
    .select('*')
    .single();

  if (orderError) {
    console.error(orderError);
    return fail(res, 500, 'Could not create order.');
  }

  const code = orderCode(order.id);

  const { error: codeError } = await supabase
    .from('orders')
    .update({ order_code: code })
    .eq('id', order.id);

  if (codeError) {
    console.error(codeError);
    return fail(res, 500, 'Could not assign order ID.');
  }

  const itemRows = normalizedItems.map((item) => ({
    ...item,
    order_id: order.id
  }));

  const { error: itemError } = await supabase
    .from('order_items')
    .insert(itemRows);

  if (itemError) {
    console.error(itemError);
    return fail(res, 500, 'Could not save order items.');
  }

  const { error: ticketError } = await supabase
    .from('tickets')
    .insert({
      order_id: order.id,
      email,
      status: 'OPEN'
    });

  if (ticketError) {
    console.error(ticketError);
    return fail(res, 500, 'Order created but support ticket could not be opened.');
  }

  if (coupon) {
    await supabase
      .from('coupons')
      .update({ uses: Number(coupon.uses || 0) + 1 })
      .eq('id', coupon.id);
  }

  const settings = await getSettings();

  await sendMail({
    to: email,
    subject: `FluxCord order received — ${code}`,
    text: `Your FluxCord order ${code} has been received. You will receive your item via email after payment verification and delivery.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>${settings.store_name}</h2>
        <p>Order <strong>${code}</strong> has been received.</p>
        <p>You will receive your item via email after payment verification and delivery.</p>
        <p><strong>Total:</strong> ৳${total.toLocaleString('en-BD')}</p>
      </div>
    `
  });

  return res.json({
    ok: true,
    order_id: order.id,
    order_code: code,
    total
  });
});

app.get('/api/orders', auth, async (req, res) => {
  let query = supabase
    .from('orders')
    .select('*,order_items(*)')
    .order('id', { ascending: false });

  if (!req.user.admin) {
    query = query.eq('user_id', req.user.id);
  }

  const { data, error } = await query;

  if (error) {
    return fail(res, 500, 'Could not load orders.');
  }

  return res.json(data || []);
});

app.get('/api/orders/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();

  const { data: order, error } = await supabase
    .from('orders')
    .select('*,order_items(*),tickets(id,status)')
    .eq('order_code', code)
    .maybeSingle();

  if (error || !order) {
    return fail(res, 404, 'Order not found.');
  }

  return res.json({ order });
});

app.post('/api/reviews', auth, async (req, res) => {
  const productId = Number(req.body.product_id);
  const stars = Math.max(1, Math.min(5, Number(req.body.stars || 5)));
  const comment = String(req.body.comment || '').trim().slice(0, 500);

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .maybeSingle();

  if (!product) {
    return fail(res, 404, 'Product not found.');
  }

  const { error } = await supabase
    .from('reviews')
    .insert({
      product_id: productId,
      email: req.user.email,
      stars,
      comment,
      approved: false
    });

  if (error) {
    return fail(res, 500, 'Could not submit review.');
  }

  return res.json({
    ok: true,
    message: 'Review submitted for admin approval.'
  });
});

app.get('/api/tickets/:id/messages', auth, async (req, res) => {
  const ticketId = Number(req.params.id);

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id,email,order_id,status')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) {
    return fail(res, 404, 'Ticket not found.');
  }

  if (!req.user.admin && ticket.email !== req.user.email) {
    return fail(res, 403, 'You cannot access this ticket.');
  }

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('id', { ascending: true });

  if (error) {
    return fail(res, 500, 'Could not load ticket messages.');
  }

  return res.json({ ticket, messages: messages || [] });
});

app.post('/api/tickets/:id/messages', auth, async (req, res) => {
  const ticketId = Number(req.params.id);
  const message = String(req.body.message || '').trim().slice(0, 1500);

  if (!message) {
    return fail(res, 400, 'Message cannot be empty.');
  }

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id,email,status')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) {
    return fail(res, 404, 'Ticket not found.');
  }

  if (!req.user.admin && ticket.email !== req.user.email) {
    return fail(res, 403, 'You cannot reply to this ticket.');
  }

  if (ticket.status === 'CLOSED') {
    return fail(res, 400, 'This ticket is closed.');
  }

  const { error } = await supabase
    .from('messages')
    .insert({
      ticket_id: ticketId,
      sender: req.user.admin ? 'ADMIN' : 'USER',
      message
    });

  if (error) {
    return fail(res, 500, 'Could not send message.');
  }

  return res.json({ ok: true });
});

app.get('/api/admin/overview', auth, adminOnly, async (req, res) => {
  const [ordersResult, usersResult, productsResult, reviewsResult] = await Promise.all([
    supabase.from('orders').select('id,total,status,created_at'),
    supabase.from('users').select('id'),
    supabase.from('products').select('id'),
    supabase.from('reviews').select('id').eq('approved', false)
  ]);

  const orders = ordersResult.data || [];
  const revenue = orders
    .filter((order) => ['PAID', 'DELIVERED'].includes(order.status))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  const dailyMap = new Map();

  for (const order of orders) {
    const day = String(order.created_at).slice(0, 10);
    const current = dailyMap.get(day) || { day, sales: 0, orders: 0 };

    current.orders += 1;

    if (['PAID', 'DELIVERED'].includes(order.status)) {
      current.sales += Number(order.total || 0);
    }

    dailyMap.set(day, current);
  }

  const daily = [...dailyMap.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-14);

  return res.json({
    revenue,
    orders: orders.length,
    customers: (usersResult.data || []).length,
    products: (productsResult.data || []).length,
    pending_reviews: (reviewsResult.data || []).length,
    daily
  });
});

app.get('/api/admin/products', auth, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    return fail(res, 500, 'Could not load products.');
  }

  return res.json(data || []);
});

app.post('/api/admin/products', auth, adminOnly, async (req, res) => {
  const payload = {
    name: String(req.body.name || '').trim(),
    description: String(req.body.description || '').trim(),
    price_bdt: Number(req.body.price_bdt || 0),
    image: String(req.body.image || '').trim(),
    tag: String(req.body.tag || 'FRESH').toUpperCase(),
    delivery: String(req.body.delivery || 'Email delivery').trim(),
    file_url: String(req.body.file_url || '').trim(),
    active: req.body.active !== false
  };

  if (!payload.name || !['FRESH', 'HOT', 'SPECIAL'].includes(payload.tag)) {
    return fail(res, 400, 'Product name and valid tag are required.');
  }

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return fail(res, 400, error.message);
  }

  return res.json({ ok: true, product: data });
});

app.put('/api/admin/products/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const payload = {
    name: String(req.body.name || '').trim(),
    description: String(req.body.description || '').trim(),
    price_bdt: Number(req.body.price_bdt || 0),
    image: String(req.body.image || '').trim(),
    tag: String(req.body.tag || 'FRESH').toUpperCase(),
    delivery: String(req.body.delivery || 'Email delivery').trim(),
    file_url: String(req.body.file_url || '').trim(),
    active: Boolean(req.body.active)
  };

  const { error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id);

  if (error) {
    return fail(res, 400, error.message);
  }

  return res.json({ ok: true });
});

app.delete('/api/admin/products/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    return fail(res, 400, error.message);
  }

  return res.json({ ok: true });
});

app.get('/api/admin/orders', auth, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*,order_items(*),tickets(id,status)')
    .order('id', { ascending: false });

  if (error) {
    return fail(res, 500, 'Could not load orders.');
  }

  return res.json(data || []);
});

app.patch('/api/admin/orders/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || 'PENDING').toUpperCase();
  const allowed = ['PENDING', 'PAID', 'DELIVERED', 'CANCELLED'];

  if (!allowed.includes(status)) {
    return fail(res, 400, 'Invalid order status.');
  }

  const { data: before } = await supabase
    .from('orders')
    .select('status')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id);

  if (error) {
    return fail(res, 400, error.message);
  }

  if (status === 'DELIVERED' && before?.status !== 'DELIVERED') {
    try {
      await sendDeliveryEmail(id);
    } catch (mailError) {
      console.error('Delivery email error:', mailError);
    }
  }

  return res.json({ ok: true });
});

app.get('/api/admin/coupons', auth, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    return fail(res, 500, 'Could not load coupons.');
  }

  return res.json(data || []);
});

app.post('/api/admin/coupons', auth, adminOnly, async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const type = req.body.type === 'fixed' ? 'fixed' : 'percent';
  const value = Number(req.body.value || 0);

  if (!code || value <= 0) {
    return fail(res, 400, 'Coupon code and value are required.');
  }

  if (type === 'percent' && value > 100) {
    return fail(res, 400, 'Percent discount cannot exceed 100.');
  }

  const { error } = await supabase
    .from('coupons')
    .insert({
      code,
      type,
      value,
      active: true
    });

  if (error) {
    return fail(res, 400, 'Coupon code already exists or is invalid.');
  }

  return res.json({ ok: true });
});

app.patch('/api/admin/coupons/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const active = Boolean(req.body.active);

  const { error } = await supabase
    .from('coupons')
    .update({ active })
    .eq('id', id);

  if (error) {
    return fail(res, 400, error.message);
  }

  return res.json({ ok: true });
});

app.delete('/api/admin/coupons/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);

  const { error } = await supabase
    .from('coupons')
    .delete()
    .eq('id', id);

  if (error) {
    return fail(res, 400, error.message);
  }

  return res.json({ ok: true });
});

app.get('/api/admin/reviews', auth, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,email,stars,comment,approved,created_at,products(name)')
    .order('id', { ascending: false });

  if (error) {
    return fail(res, 500, 'Could not load reviews.');
  }

  return res.json(
    (data || []).map((review) => ({
      ...review,
      product_name: review.products?.name || 'Product'
    }))
  );
});

app.patch('/api/admin/reviews/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const approved = Boolean(req.body.approved);

  const { error } = await supabase
    .from('reviews')
    .update({ approved })
    .eq('id', id);

  if (error) {
    return fail(res, 400, error.message);
  }

  return res.json({ ok: true });
});

app.delete('/api/admin/reviews/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id);

  if (error) {
    return fail(res, 400, error.message);
  }

  return res.json({ ok: true });
});

app.get('/api/admin/tickets', auth, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('tickets')
    .select('*,orders(order_code,total,status,payment_method,trxid)')
    .order('id', { ascending: false });

  if (error) {
    return fail(res, 500, 'Could not load support tickets.');
  }

  return res.json(data || []);
});

app.patch('/api/admin/tickets/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || 'OPEN').toUpperCase();

  if (!['OPEN', 'CLOSED'].includes(status)) {
    return fail(res, 400, 'Invalid ticket status.');
  }

  const { error } = await supabase
    .from('tickets')
    .update({ status })
    .eq('id', id);

  if (error) {
    return fail(res, 400, error.message);
  }

  return res.json({ ok: true });
});

app.put('/api/admin/settings', auth, adminOnly, async (req, res) => {
  const allowed = Object.keys(defaultSettings);
  const rows = [];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      rows.push({
        key,
        value: String(req.body[key] ?? '')
      });
    }
  }

  if (rows.length) {
    const { error } = await supabase
      .from('settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) {
      return fail(res, 400, error.message);
    }
  }

  return res.json({ ok: true });
});

app.get('/api/admin/me', auth, adminOnly, (req, res) => {
  return res.json({
    admin: true,
    email: req.user.email
  });
});

module.exports = app;
