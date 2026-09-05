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
const DEMO_OTP =
  String(process.env.DEMO_OTP || 'false').toLowerCase() === 'true';

if (!JWT_SECRET) {
  console.warn(
    'JWT_SECRET is missing. Add it to Vercel Environment Variables.'
  );
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const defaultSettings = {
  store_name: 'FluxCord',
  tagline: 'Premium digital knowledge, delivered with care.',
  hero_title: '⚡ FluxCord',
  hero_description:
    'Premium e-books for students, creators and digital entrepreneurs.',
  stat_customer_bonus: '10',
  stat_sold_bonus: '20',
  discord: 'https://discord.com/',
  facebook: 'https://facebook.com/',
  email: 'support@fluxcord.store'
};

const paymentMethods = {
  bKash:
    process.env.BKASH_NUMBER ||
    '01873735925',

  Nagad:
    process.env.NAGAD_NUMBER ||
    '01715735925',

  LTC:
    process.env.LTC_ADDRESS ||
    'LULFfKWEV2bpqgFUUGqQD3uL4g29DJFp4p',

  BTC:
    process.env.BTC_ADDRESS ||
    'bc1qp2v7lwax22attps47g242ztztcjyms7lazn24g',

  'USDT (BEP-20)':
    process.env.USDT_BEP20_ADDRESS ||
    '0xfc587Abbe701773eCb4711baee534cFec826c83f'
};

function fail(res, status, message) {
  return res.status(status).json({
    error: message
  });
}

function cleanEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hash(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function hashPassword(password) {
  const salt =
    crypto.randomBytes(16).toString('hex');

  const derived =
    crypto
      .scryptSync(
        String(password),
        salt,
        64
      )
      .toString('hex');

  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, key] =
      String(stored || '').split(':');

    if (!salt || !key) {
      return false;
    }

    const derived =
      crypto
        .scryptSync(
          String(password),
          salt,
          64
        )
        .toString('hex');

    return crypto.timingSafeEqual(
      Buffer.from(derived, 'hex'),
      Buffer.from(key, 'hex')
    );
  } catch {
    return false;
  }
}

function signSession(payload) {
  return jwt.sign(
    payload,
    JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function setSession(res, payload) {
  const token =
    signSession(payload);

  res.cookie(
    'fc_session',
    token,
    {
      httpOnly: true,
      sameSite: 'lax',
      secure:
        process.env.NODE_ENV === 'production',
      maxAge:
        7 *
        24 *
        60 *
        60 *
        1000,
      path: '/'
    }
  );
}

function clearSession(res) {
  res.clearCookie(
    'fc_session',
    {
      httpOnly: true,
      sameSite: 'lax',
      secure:
        process.env.NODE_ENV === 'production',
      path: '/'
    }
  );
}

function auth(req, res, next) {
  const token =
    req.cookies.fc_session;

  if (!token) {
    return fail(
      res,
      401,
      'Login required.'
    );
  }

  try {
    req.user =
      jwt.verify(
        token,
        JWT_SECRET
      );

    return next();
  } catch {
    return fail(
      res,
      401,
      'Session expired.'
    );
  }
}

function adminOnly(req, res, next) {
  if (!req.user?.admin) {
    return fail(
      res,
      403,
      'Admin only.'
    );
  }

  return next();
}

async function getSettings() {
  const {
    data,
    error
  } = await supabase
    .from('settings')
    .select('key,value');

  if (error) {
    throw error;
  }

  const settings = {
    ...defaultSettings
  };

  for (const row of data || []) {
    settings[row.key] =
      row.value;
  }

  return settings;
}

function mailTransporter() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host:
      process.env.SMTP_HOST,

    port:
      Number(
        process.env.SMTP_PORT ||
        587
      ),

    secure:
      Number(
        process.env.SMTP_PORT ||
        587
      ) === 465,

    auth: {
      user:
        process.env.SMTP_USER,

      pass:
        process.env.SMTP_PASS
    }
  });
}

async function sendMail({
  to,
  subject,
  text,
  html
}) {
  const transporter =
    mailTransporter();

  if (!transporter) {
    return false;
  }

  await transporter.sendMail({
    from:
      process.env.SMTP_FROM ||
      `FluxCord <${process.env.SMTP_USER}>`,

    to,
    subject,
    text,
    html
  });

  return true;
}

async function getProductIds(items) {
  return [
    ...new Set(
      (
        Array.isArray(items)
          ? items
          : []
      )
        .map(
          item =>
            Number(item?.id)
        )
        .filter(
          id =>
            Number.isInteger(id) &&
            id > 0
        )
    )
  ];
}

function randomOrderCode() {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let code = '#';

  for (
    let i = 0;
    i < 8;
    i += 1
  ) {
    code +=
      alphabet[
        crypto.randomInt(
          0,
          alphabet.length
        )
      ];
  }

  return code;
}

async function createUniqueOrderCode() {
  for (
    let attempt = 0;
    attempt < 12;
    attempt += 1
  ) {
    const code =
      randomOrderCode();

    const {
      data
    } = await supabase
      .from('orders')
      .select('id')
      .eq(
        'order_code',
        code
      )
      .maybeSingle();

    if (!data) {
      return code;
    }
  }

  throw new Error(
    'Could not generate a unique order ID.'
  );
}

function orderCodeFallback(id) {
  return `#${String(id).padStart(3, '0')}`;
}

function siteUrl() {
  return String(
    process.env.SITE_URL ||
      'https://fluxcord.store'
  ).replace(/\/$/, '');
}

function reviewUrl(orderCodeValue) {
  return `${siteUrl()}/?review=${encodeURIComponent(
    orderCodeValue
  )}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      character =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        })[character]
    );
}

async function sendDeliveryEmail(orderId) {
  const {
    data: order,
    error: orderLookupError
  } = await supabase
    .from('orders')
    .select(
      'id,order_code,email,total,status,created_at'
    )
    .eq('id', orderId)
    .maybeSingle();

  if (orderLookupError) {
    throw orderLookupError;
  }

  if (
    !order ||
    order.status !== 'DELIVERED'
  ) {
    return false;
  }

  const {
    data: items
  } = await supabase
    .from('order_items')
    .select(
      'name,quantity,product_id,price'
    )
    .eq(
      'order_id',
      orderId
    );

  const productIds =
    (items || [])
      .map(
        item =>
          item.product_id
      )
      .filter(Boolean);

  const {
    data: products
  } = await supabase
    .from('products')
    .select(
      'id,name,file_url'
    )
    .in(
      'id',
      productIds.length
        ? productIds
        : [0]
    );

  const productRows =
    (items || []).map(item => {
      const product =
        (products || []).find(
          p =>
            p.id ===
            item.product_id
        );

      return {
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        fileUrl:
          product?.file_url ||
          ''
      };
    });

  const review =
    reviewUrl(
      order.order_code
    );

  const productText =
    productRows.map(item =>
      `${item.name} × ${item.quantity}${
        item.fileUrl
          ? ` — ${item.fileUrl}`
          : ' — delivery is being handled manually by the FluxCord team.'
      }`
    );

  const text = [
    'Thank you for shopping with FluxCord!',
    `Order: ${order.order_code}`,
    `Total: ৳${Number(
      order.total || 0
    ).toLocaleString('en-BD')}`,
    '',
    'Your payment has been verified and your order is now delivered.',
    '',
    'Download your products:',
    ...productText,
    '',
    `Leave a review: ${review}`,
    '',
    'Need help? Contact FluxCord support.'
  ].join('\n');

  const sent =
    await sendMail({
      to: order.email,

      subject:
        `🎉 Your FluxCord order ${order.order_code} is ready!`,

      text,

      html: `
        <div style="margin:0;background:#f5f3ff;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#17121f">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e9e2f5;border-radius:24px;overflow:hidden;box-shadow:0 14px 40px rgba(65,35,100,.10)">
            
            <div style="padding:34px 32px;background:linear-gradient(135deg,#6d28d9,#9333ea);color:#fff">
              <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.85">
                FLUXCORD
              </div>

              <h1 style="margin:10px 0 6px;font-size:30px;line-height:1.15">
                Your order is ready 🎉
              </h1>

              <p style="margin:0;opacity:.9">
                Thanks for shopping with FluxCord.
              </p>
            </div>

            <div style="padding:32px">

              <div style="background:#faf8ff;border:1px solid #eee7f8;border-radius:16px;padding:18px 20px;margin-bottom:24px">
                <div style="font-size:12px;color:#7a7085;text-transform:uppercase;letter-spacing:1px">
                  Order
                </div>

                <div style="font-size:20px;font-weight:800;margin-top:4px">
                  ${escapeHtml(
                    order.order_code
                  )}
                </div>

                <div style="margin-top:8px;color:#62586d">
                  Total:
                  <strong style="color:#17121f">
                    ৳${Number(
                      order.total || 0
                    ).toLocaleString('en-BD')}
                  </strong>
                </div>
              </div>

              <p style="font-size:16px;line-height:1.6">
                Your payment has been verified and your order is now
                <strong>DELIVERED</strong>.
              </p>

              <h2 style="font-size:18px;margin:26px 0 12px">
                Your downloads
              </h2>

              ${productRows
                .map(
                  item =>
                    item.fileUrl
                      ? `
                        <div style="border:1px solid #eee7f8;border-radius:14px;padding:16px;margin:10px 0">
                          <div style="font-weight:800">
                            ${escapeHtml(
                              item.name
                            )}
                          </div>

                          <div style="color:#746a80;margin:5px 0 12px">
                            Quantity: ${item.quantity}
                          </div>

                          <a href="${escapeHtml(
                            item.fileUrl
                          )}" style="display:inline-block;padding:11px 16px;border-radius:10px;background:#6d28d9;color:#fff;text-decoration:none;font-weight:800">
                            Download product →
                          </a>
                        </div>
                      `
                      : `
                        <div style="border:1px solid #eee7f8;border-radius:14px;padding:16px;margin:10px 0">
                          <div style="font-weight:800">
                            ${escapeHtml(
                              item.name
                            )}
                          </div>

                          <div style="color:#746a80;margin-top:5px">
                            Manual delivery by the FluxCord team.
                          </div>
                        </div>
                      `
                )
                .join('')}

              <div style="margin-top:30px;padding:22px;border-radius:18px;background:#f7f2ff;text-align:center">

                <h2 style="margin:0 0 8px;font-size:20px">
                  Enjoyed your purchase?
                </h2>

                <p style="margin:0 0 16px;color:#655b70">
                  Leave a quick review for the product.
                </p>

                <a href="${escapeHtml(
                  review
                )}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#17121f;color:#fff;text-decoration:none;font-weight:800">
                  Leave a review →
                </a>

              </div>

              <p style="margin-top:28px;color:#746a80;font-size:13px;line-height:1.6">
                If you have any issue with your order, please contact FluxCord support.
              </p>

            </div>
          </div>
        </div>
      `
    });

  return sent;
}

app.get(
  '/api/health',
  async (req, res) => {
    try {
      const {
        error
      } = await supabase
        .from('settings')
        .select('key')
        .limit(1);

      if (error) {
        return fail(
          res,
          500,
          error.message
        );
      }

      return res.json({
        ok: true,
        database: true
      });
    } catch (error) {
      return fail(
        res,
        500,
        error.message
      );
    }
  }
);

app.get(
  '/api/settings',
  async (req, res) => {
    try {
      return res.json(
        await getSettings()
      );
    } catch (error) {
      return fail(
        res,
        500,
        error.message
      );
    }
  }
);

app.get(
  '/api/payment-methods',
  (req, res) => {
    return res.json(
      paymentMethods
    );
  }
);

app.get(
  '/api/products',
  async (req, res) => {
    const {
      data,
      error
    } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order(
        'id',
        {
          ascending: false
        }
      );

    if (error) {
      return fail(
        res,
        500,
        'Could not load products.'
      );
    }

    const productIds =
      (data || []).map(
        product => product.id
      );

    let reviewRows = [];

    if (productIds.length) {
      const {
        data: reviews
      } = await supabase
        .from('reviews')
        .select(
          'product_id,stars'
        )
        .eq(
          'approved',
          true
        )
        .in(
          'product_id',
          productIds
        );

      reviewRows =
        reviews || [];
    }

    const products =
      (data || []).map(
        product => {
          const rows =
            reviewRows.filter(
              review =>
                review.product_id ===
                product.id
            );

          const rating =
            rows.length
              ? rows.reduce(
                  (sum, row) =>
                    sum +
                    Number(
                      row.stars || 0
                    ),
                  0
                ) / rows.length
              : Number(
                  product.rating || 0
                );

          return {
            ...product,
            rating,
            review_count:
              rows.length ||
              Number(
                product.review_count ||
                  0
              )
          };
        }
      );

    return res.json(
      products
    );
  }
);

app.get(
  '/api/reviews',
  async (req, res) => {
    const {
      data,
      error
    } = await supabase
      .from('reviews')
      .select(
        'id,email,stars,comment,created_at,product_id,user_id,order_id,users(name),products(name)'
      )
      .eq(
        'approved',
        true
      )
      .order(
        'id',
        {
          ascending: false
        }
      )
      .limit(60);

    if (error) {
      return fail(
        res,
        500,
        'Could not load reviews.'
      );
    }

    return res.json(
      (data || []).map(
        review => ({
          ...review,
          product_name:
            review.products?.name ||
            'Product',
          name:
            review.users?.name ||
            'Customer'
        })
      )
    );
  }
);

app.post(
  '/api/auth/request-otp',
  async (req, res) => {
    const email =
      cleanEmail(
        req.body.email
      );

    if (!validEmail(email)) {
      return fail(
        res,
        400,
        'Enter a valid email address.'
      );
    }

    try {
      const {
        data: existing
      } = await supabase
        .from('users')
        .select(
          'id,otp_created_at'
        )
        .eq(
          'email',
          email
        )
        .maybeSingle();

      if (
        existing?.otp_created_at
      ) {
        const age =
          Date.now() -
          new Date(
            existing.otp_created_at
          ).getTime();

        if (
          age < 60 * 1000
        ) {
          const seconds =
            Math.ceil(
              (
                60 * 1000 -
                age
              ) / 1000
            );

          return fail(
            res,
            429,
            `Please wait ${seconds} seconds before requesting another OTP.`
          );
        }
      }

      const code =
        String(
          crypto.randomInt(
            100000,
            1000000
          )
        );

      const otpHash =
        hash(code);

      const now =
        new Date().toISOString();

      if (existing) {
        const {
          error
        } = await supabase
          .from('users')
          .update({
            otp_hash:
              otpHash,
            otp_created_at:
              now
          })
          .eq(
            'id',
            existing.id
          );

        if (error) {
          return fail(
            res,
            500,
            error.message
          );
        }
      } else {
        const {
          error
        } = await supabase
          .from('users')
          .insert({
            email,
            otp_hash:
              otpHash,
            otp_created_at:
              now,
            verified:
              false
          });

        if (error) {
          return fail(
            res,
            500,
            error.message
          );
        }
      }

      let emailSent =
        false;

      try {
        emailSent =
          await sendMail({
            to: email,

            subject:
              'Your FluxCord verification code',

            text:
              `Your FluxCord verification code is ${code}. It expires soon.`,

            html: `
              <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px">
                <h1>⚡ FluxCord</h1>

                <p>
                  Use the following code to verify your email:
                </p>

                <div style="font-size:32px;font-weight:800;letter-spacing:8px;padding:20px;background:#f5f3ff;border-radius:16px;text-align:center">
                  ${code}
                </div>

                <p style="color:#777">
                  If you did not request this code, you can ignore this email.
                </p>
              </div>
            `
          });
      } catch (mailError) {
        console.error(
          'OTP email error:',
          mailError
        );
      }

      return res.json({
        ok: true,
        email_sent:
          emailSent,
        demoOtp:
          DEMO_OTP
            ? code
            : undefined
      });

    } catch (error) {
      console.error(
        'OTP request error:',
        error
      );

      return fail(
        res,
        500,
        'Could not send OTP.'
      );
    }
  }
);

app.post(
  '/api/auth/verify-otp',
  async (req, res) => {
    const email =
      cleanEmail(
        req.body.email
      );

    const code =
      String(
        req.body.code || ''
      ).trim();

    const name =
      String(
        req.body.name || ''
      ).trim();

    const phone =
      String(
        req.body.phone || ''
      ).trim();

    const password =
      String(
        req.body.password || ''
      );

    if (!validEmail(email)) {
      return fail(
        res,
        400,
        'Invalid email.'
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return fail(
        res,
        400,
        'OTP must be 6 digits.'
      );
    }

    if (
      password &&
      password.length < 6
    ) {
      return fail(
        res,
        400,
        'Password must be at least 6 characters.'
      );
    }

    const {
      data: user,
      error
    } = await supabase
      .from('users')
      .select('*')
      .eq(
        'email',
        email
      )
      .maybeSingle();

    if (error) {
      return fail(
        res,
        500,
        error.message
      );
    }

    if (!user) {
      return fail(
        res,
        404,
        'Account not found. Request a new OTP.'
      );
    }

    const validOtp =
      DEMO_OTP
        ? code.length === 6
        : (
            user.otp_hash &&
            hash(code) ===
              user.otp_hash
          );

    if (!validOtp) {
      return fail(
        res,
        400,
        'Invalid OTP.'
      );
    }

    if (
      user.otp_created_at &&
      !DEMO_OTP
    ) {
      const age =
        Date.now() -
        new Date(
          user.otp_created_at
        ).getTime();

      if (
        age >
        10 * 60 * 1000
      ) {
        return fail(
          res,
          400,
          'OTP expired. Please request a new one.'
        );
      }
    }

    const updates = {
      verified: true,
      otp_hash: null,
      otp_created_at: null
    };

    if (name) {
      updates.name =
        name.slice(0, 60);
    }

    if (phone) {
      updates.phone =
        phone.slice(0, 40);
    }

    if (password) {
      updates.password_hash =
        hashPassword(
          password
        );
    }

    const {
      data: updatedUser,
      error: updateError
    } = await supabase
      .from('users')
      .update(updates)
      .eq(
        'id',
        user.id
      )
      .select(
        'id,email,name,phone,verified'
      )
      .single();

    if (updateError) {
      return fail(
        res,
        500,
        updateError.message
      );
    }

    setSession(
      res,
      {
        id:
          updatedUser.id,
        email:
          updatedUser.email,
        admin: false
      }
    );

    return res.json({
      ok: true,
      user:
        updatedUser
    });
  }
);

app.post(
  '/api/auth/login',
  async (req, res) => {
    const email =
      cleanEmail(
        req.body.email
      );

    const password =
      String(
        req.body.password || ''
      );

    if (!validEmail(email)) {
      return fail(
        res,
        400,
        'Enter a valid email.'
      );
    }

    if (!password) {
      return fail(
        res,
        400,
        'Password is required.'
      );
    }

    const {
      data: user,
      error
    } = await supabase
      .from('users')
      .select(
        'id,email,name,phone,verified,password_hash'
      )
      .eq(
        'email',
        email
      )
      .maybeSingle();

    if (error) {
      return fail(
        res,
        500,
        error.message
      );
    }

    if (!user) {
      return fail(
        res,
        401,
        'Incorrect email or password.'
      );
    }

    if (
      !user.verified
    ) {
      return fail(
        res,
        403,
        'Please verify your email first.'
      );
    }

    if (
      !user.password_hash ||
      !verifyPassword(
        password,
        user.password_hash
      )
    ) {
      return fail(
        res,
        401,
        'Incorrect email or password.'
      );
    }

    setSession(
      res,
      {
        id:
          user.id,
        email:
          user.email,
        admin: false
      }
    );

    return res.json({
      ok: true,
      user: {
        id:
          user.id,
        email:
          user.email,
        name:
          user.name,
        phone:
          user.phone,
        verified:
          user.verified
      }
    });
  }
);

app.post(
  '/api/auth/logout',
  (req, res) => {
    clearSession(res);

    return res.json({
      ok: true
    });
  }
);

app.get(
  '/api/me',
  async (req, res) => {
    const token =
      req.cookies.fc_session;

    if (!token) {
      return res.json({
        user: null
      });
    }

    try {
      const payload =
        jwt.verify(
          token,
          JWT_SECRET
        );

      const {
        data: user
      } = await supabase
        .from('users')
        .select(
          'id,email,name,phone,verified'
        )
        .eq(
          'id',
          payload.id
        )
        .maybeSingle();

      if (!user) {
        clearSession(res);

        return res.json({
          user: null
        });
      }

      return res.json({
        user: {
          ...user,
          admin:
            Boolean(
              payload.admin
            )
        }
      });

    } catch {
      clearSession(res);

      return res.json({
        user: null
      });
    }
  }
);

app.post(
  '/api/account/name',
  auth,
  async (req, res) => {
    const name =
      String(
        req.body.name || ''
      )
        .trim()
        .slice(0, 60);

    if (name.length < 2) {
      return fail(
        res,
        400,
        'Name must be at least 2 characters.'
      );
    }

    const {
      data,
      error
    } = await supabase
      .from('users')
      .update({
        name
      })
      .eq(
        'id',
        req.user.id
      )
      .select(
        'id,email,name,phone,verified'
      )
      .single();

    if (error) {
      return fail(
        res,
        500,
        error.message
      );
    }

    return res.json({
      ok: true,
      user: data
    });
  }
);

app.post(
  '/api/admin/login',
  (req, res) => {
    const email =
      cleanEmail(
        req.body.email
      );

    const password =
      String(
        req.body.password || ''
      );

    const adminEmail =
      cleanEmail(
        process.env.ADMIN_EMAIL ||
          ''
      );

    const adminPassword =
      String(
        process.env.ADMIN_PASSWORD ||
          ''
      );

    if (
      !adminEmail ||
      !adminPassword
    ) {
      return fail(
        res,
        500,
        'Admin credentials are not configured.'
      );
    }

    if (
      email !== adminEmail ||
      password !==
        adminPassword
    ) {
      return fail(
        res,
        401,
        'Invalid admin credentials.'
      );
    }

    setSession(
      res,
      {
        id: 'admin',
        email,
        admin: true
      }
    );

    return res.json({
      ok: true,
      admin: true
    });
  }
);

app.get(
  '/api/stats',
  async (req, res) => {
    try {
      const [
        usersResult,
        productsResult,
        ordersResult,
        reviewsResult
      ] = await Promise.all([
        supabase
          .from('users')
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          ),

        supabase
          .from('products')
          .select(
            'id',
            {
              count: 'exact',
              head: true
            }
          ),

        supabase
          .from('orders')
          .select(
            'id,status'
          ),

        supabase
          .from('reviews')
          .select(
            'stars'
          )
          .eq(
            'approved',
            true
          )
      ]);

      const orders =
        ordersResult.data ||
        [];

      const delivered =
        orders.filter(
          order =>
            [
              'PAID',
              'DELIVERED'
            ].includes(
              order.status
            )
        ).length;

      const reviews =
        reviewsResult.data ||
        [];

      const rating =
        reviews.length
          ? reviews.reduce(
              (sum, row) =>
                sum +
                Number(
                  row.stars || 0
                ),
              0
            ) /
            reviews.length
          : 5;

      return res.json({
        customers:
          usersResult.count ||
          0,

        sold:
          delivered,

        rating
      });

    } catch (error) {
      return fail(
        res,
        500,
        error.message
      );
    }
  }
);

app.get(
  '/api/leaderboard',
  async (req, res) => {
    const {
      data: users
    } = await supabase
      .from('users')
      .select(
        'id,name'
      );

    const {
      data: orders
    } = await supabase
      .from('orders')
      .select(
        'user_id,total,status'
      )
      .in(
        'status',
        [
          'PAID',
          'DELIVERED'
        ]
      );

    const totals =
      new Map();

    for (
      const order of
        orders || []
    ) {
      if (!order.user_id) {
        continue;
      }

      totals.set(
        order.user_id,
        (
          totals.get(
            order.user_id
          ) || 0
        ) +
          Number(
            order.total || 0
          )
      );
    }

    const leaderboard =
      (users || [])
        .map(user => ({
          name:
            user.name ||
            'Customer',

          spent:
            totals.get(
              user.id
            ) || 0
        }))
        .filter(
          row =>
            row.spent > 0
        )
        .sort(
          (a, b) =>
            b.spent -
            a.spent
        )
        .slice(0, 10)
        .map(
          (row, index) => ({
            rank:
              index + 1,
            ...row
          })
        );

    return res.json(
      leaderboard
    );
  }
);

app.post(
  '/api/coupon/check',
  async (req, res) => {
    const code =
      String(
        req.body.code || ''
      )
        .trim()
        .toUpperCase();

    if (!code) {
      return fail(
        res,
        400,
        'Coupon code is required.'
      );
    }

    const {
      data: coupon,
      error
    } = await supabase
      .from('coupons')
      .select('*')
      .eq(
        'code',
        code
      )
      .eq(
        'active',
        true
      )
      .maybeSingle();

    if (error) {
      return fail(
        res,
        500,
        error.message
      );
    }

    if (!coupon) {
      return fail(
        res,
        404,
        'Invalid or inactive coupon.'
      );
    }

    return res.json({
      ok: true,
      coupon
    });
  }
);

app.post(
  '/api/orders',
  auth,
  async (req, res) => {
    const items =
      Array.isArray(
        req.body.items
      )
        ? req.body.items
        : [];

    if (!items.length) {
      return fail(
        res,
        400,
        'Your cart is empty.'
      );
    }

    const productIds =
      await getProductIds(
        items
      );

    if (!productIds.length) {
      return fail(
        res,
        400,
        'Invalid products.'
      );
    }

    const {
      data: products,
      error: productError
    } = await supabase
      .from('products')
      .select(
        'id,name,price_bdt,active'
      )
      .in(
        'id',
        productIds
      );

    if (productError) {
      return fail(
        res,
        500,
        productError.message
      );
    }

    const normalizedItems =
      [];

    for (
      const item of items
    ) {
      const product =
        (products || []).find(
          row =>
            row.id ===
            Number(
              item.id
            )
        );

      if (
        !product ||
        !product.active
      ) {
        return fail(
          res,
          400,
          'One of your selected products is unavailable.'
        );
      }

      const quantity =
        Math.min(
          Math.max(
            Number(
              item.qty
            ) || 1,
            1
          ),
          20
        );

      normalizedItems.push({
        id:
          product.id,

        name:
          product.name,

        quantity,

        price:
          Number(
            product.price_bdt
          )
      });
    }

    const subtotal =
      normalizedItems.reduce(
        (sum, item) =>
          sum +
          item.price *
            item.quantity,
        0
      );

    let discount = 0;

    const couponCode =
      String(
        req.body.coupon || ''
      )
        .trim()
        .toUpperCase();

    let coupon = null;

    if (couponCode) {
      const {
        data
      } = await supabase
        .from('coupons')
        .select('*')
        .eq(
          'code',
          couponCode
        )
        .eq(
          'active',
          true
        )
        .maybeSingle();

      coupon = data;

      if (!coupon) {
        return fail(
          res,
          400,
          'Invalid or inactive coupon.'
        );
      }

      if (
        coupon.type ===
        'percent'
      ) {
        discount =
          Math.floor(
            subtotal *
              Number(
                coupon.value
              ) /
              100
          );
      } else {
        discount =
          Number(
            coupon.value
          );
      }

      discount =
        Math.min(
          subtotal,
          Math.max(
            0,
            discount
          )
        );
    }

    const total =
      Math.max(
        0,
        subtotal -
          discount
      );

    const paymentMethod =
      String(
        req.body.payment_method ||
          ''
      ).trim();

    if (
      !paymentMethods[
        paymentMethod
      ]
    ) {
      return fail(
        res,
        400,
        'Invalid payment method.'
      );
    }

    const trxid =
      String(
        req.body.trxid || ''
      )
        .trim()
        .slice(0, 120);

    if (!trxid) {
      return fail(
        res,
        400,
        'Transaction ID is required.'
      );
    }

    const contactType =
      String(
        req.body.contact_type ||
          'Phone'
      )
        .trim()
        .slice(0, 30);

    const contactValue =
      String(
        req.body.contact_value ||
          req.body.phone ||
          ''
      )
        .trim()
        .slice(0, 120);

    if (!contactValue) {
      return fail(
        res,
        400,
        'Contact information is required.'
      );
    }

    const senderNumber =
      String(
        req.body.sender_number ||
          ''
      )
        .trim()
        .slice(0, 40);

    if (
      (
        paymentMethod ===
          'bKash' ||
        paymentMethod ===
          'Nagad'
      ) &&
      !senderNumber
    ) {
      return fail(
        res,
        400,
        'Sender number is required for bKash/Nagad.'
      );
    }

    const orderCode =
      await createUniqueOrderCode();

    const {
      data: order,
      error: orderError
    } = await supabase
      .from('orders')
      .insert({
        order_code:
          orderCode,

        user_id:
          req.user.id,

        email:
          req.user.email,

        phone:
          contactValue,

        contact_type:
          contactType,

        contact_value:
          contactValue,

        payment_method:
          paymentMethod,

        trxid,

        sender_number:
          senderNumber,

        subtotal,

        discount,

        total,

        coupon_code:
          couponCode || null,

        status:
          'PENDING'
      })
      .select(
        '*'
      )
      .single();

    if (orderError) {
      return fail(
        res,
        500,
        orderError.message
      );
    }

    const orderItems =
      normalizedItems.map(
        item => ({
          order_id:
            order.id,

          product_id:
            item.id,

          name:
            item.name,

          quantity:
            item.quantity,

          price:
            item.price
        })
      );

    const {
      error: itemsError
    } = await supabase
      .from('order_items')
      .insert(
        orderItems
      );

    if (itemsError) {
      await supabase
        .from('orders')
        .delete()
        .eq(
          'id',
          order.id
        );

      return fail(
        res,
        500,
        itemsError.message
      );
    }

    return res.json({
      ok: true,

      order_id:
        order.id,

      order_code:
        order.order_code,

      status:
        order.status,

      total:
        order.total,

      items:
        normalizedItems
    });
  }
);

app.get(
  '/api/orders',
  auth,
  async (req, res) => {
    const {
      data,
      error
    } = await supabase
      .from('orders')
      .select(
        '*,order_items(*),tickets(id,status,created_at)'
      )
      .eq(
        'user_id',
        req.user.id
      )
      .order(
        'id',
        {
          ascending: false
        }
      );

    if (error) {
      return fail(
        res,
        500,
        error.message
      );
    }

    return res.json(
      data || []
    );
  }
);

app.get(
  '/api/orders/:code',
  async (req, res) => {
    const code =
      String(
        req.params.code || ''
      )
        .trim()
        .toUpperCase();

    const {
      data,
      error
    } = await supabase
      .from('orders')
      .select(
        'id,order_code,email,total,status,payment_method,created_at'
      )
      .eq(
        'order_code',
        code
      )
      .maybeSingle();

    if (error) {
      return fail(
        res,
        500,
        error.message
      );
    }

    if (!data) {
      return fail(
        res,
        404,
        'Order not found.'
      );
    }

    return res.json({
      order:
        data
    });
  }
);

app.post(
  '/api/reviews',
  auth,
  async (req, res) => {
    const orderCode =
      String(
        req.body.order_code ||
          ''
      )
        .trim()
        .toUpperCase();

    const productId =
      Number(
        req.body.product_id
      );

    const stars =
      Number(
        req.body.stars
      );

    const comment =
      String(
        req.body.comment || ''
      )
        .trim()
        .slice(0, 500);

    if (
      !orderCode ||
      !Number.isInteger(
        productId
      )
    ) {
      return fail(
        res,
        400,
        'Order and product are required.'
      );
    }

    if (
      !Number.isInteger(
        stars
      ) ||
      stars < 1 ||
      stars > 5
    ) {
      return fail(
        res,
        400,
        'Stars must be between 1 and 5.'
      );
    }

    if (!comment) {
      return fail(
        res,
        400,
        'Review text cannot be empty.'
      );
    }

    const {
      data: order,
      error: orderError
    } = await supabase
      .from('orders')
      .select(
        'id,user_id,status'
      )
      .eq(
        'order_code',
        orderCode
      )
      .maybeSingle();

    if (orderError) {
      return fail(
        res,
        500,
        orderError.message
      );
    }

    if (!order) {
      return fail(
        res,
        404,
        'Order not found.'
      );
    }

    if (
      order.user_id !==
      req.user.id
    ) {
      return fail(
        res,
        403,
        'This order does not belong to your account.'
      );
    }

    if (
      order.status !==
      'DELIVERED'
    ) {
      return fail(
        res,
        400,
        'You can review a product after the order is delivered.'
      );
    }

    const {
      data: orderItem
    } = await supabase
      .from('order_items')
      .select(
        'id,product_id'
      )
      .eq(
        'order_id',
        order.id
      )
      .eq(
        'product_id',
        productId
      )
      .maybeSingle();

    if (!orderItem) {
      return fail(
        res,
        400,
        'That product was not part of this order.'
      );
    }

    const {
      data: existingReview
    } = await supabase
      .from('reviews')
      .select(
        'id'
      )
      .eq(
        'order_id',
        order.id
      )
      .eq(
        'product_id',
        productId
      )
      .maybeSingle();

    if (existingReview) {
      return fail(
        res,
        409,
        'You already reviewed this product for this order.'
      );
    }

    const {
      data: user
    } = await supabase
      .from('users')
      .select(
        'email,name'
      )
      .eq(
        'id',
        req.user.id
      )
      .maybeSingle();

    const {
      error
    } = await supabase
      .from('reviews')
      .insert({
        email:
          user?.email ||
          req.user.email,

        user_id:
          req.user.id,

        order_id:
          order.id,

        product_id:
          productId,

        stars,

        comment,

        approved:
          false
      });

    if (error) {
      return fail(
        res,
        400,
        error.message
      );
    }

    return res.json({
      ok: true
    });
  }
);

app.get(
  '/api/tickets/:id/messages',
  auth,
  async (req, res) => {
    const ticketId =
      Number(
        req.params.id
      );

    const {
      data: ticket,
      error: ticketError
    } = await supabase
      .from('tickets')
      .select(
        'id,user_id,order_id'
      )
      .eq(
        'id',
        ticketId
      )
      .maybeSingle();

    if (ticketError) {
      return fail(
        res,
        500,
        ticketError.message
      );
    }

    if (!ticket) {
      return fail(
        res,
        404,
        'Ticket not found.'
      );
    }

    if (
      !req.user.admin &&
      ticket.user_id !==
        req.user.id
    ) {
      return fail(
        res,
        403,
        'You cannot view this ticket.'
      );
    }

    const {
      data: messages,
      error
    } = await supabase
      .from('ticket_messages')
      .select(
        'id,ticket_id,sender,message,created_at'
      )
      .eq(
        'ticket_id',
        ticketId
      )
      .order(
        'id',
        {
          ascending: true
        }
      );

    if (error) {
      return fail(
        res,
        500,
        error.message
      );
    }

    return res.json({
      messages:
        messages || []
    });
  }
);

app.post(
  '/api/tickets/:id/messages',
  auth,
  async (req, res) => {
    const ticketId =
      Number(
        req.params.id
      );

    const message =
      String(
        req.body.message ||
          ''
      )
        .trim()
        .slice(0, 2000);

    if (!message) {
      return fail(
        res,
        400,
        'Message cannot be empty.'
      );
    }

    const {
      data: ticket
    } = await supabase
      .from('tickets')
      .select(
        'id,user_id,status'
      )
      .eq(
        'id',
        ticketId
      )
      .maybeSingle();

    if (!ticket) {
      return fail(
        res,
        404,
        'Ticket not found.'
      );
    }

    if (
      !req.user.admin &&
      ticket.user_id !==
        req.user.id
    ) {
      return fail(
        res,
        403,
        'You cannot reply to this ticket.'
      );
    }

    const {
      error
    } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id:
          ticketId,

        sender:
          req.user.admin
            ? 'ADMIN'
            : 'USER',

        message
      });

    if (error) {
      return fail(
        res,
        500,
        error.message
      );
    }

    if (
      ticket.status ===
        'CLOSED' &&
      !req.user.admin
    ) {
      await supabase
        .from('tickets')
        .update({
          status:
            'OPEN'
        })
        .eq(
          'id',
          ticketId
        );
    }

    return res.json({
      ok: true
    });
  }
);

app.get(
  '/api/admin/overview',
  auth,
  adminOnly,
  async (req, res) => {
    const [
      usersResult,
      productsResult,
      ordersResult,
      reviewsResult
    ] = await Promise.all([
      supabase
        .from('users')
        .select(
          'id'
        ),

      supabase
        .from('products')
        .select(
          'id'
        ),

      supabase
        .from('orders')
        .select(
          'id,total,status,created_at'
        ),

      supabase
        .from('reviews')
        .select(
          'id'
        )
        .eq(
          'approved',
          false
        )
    ]);

    const orders =
      ordersResult.data ||
      [];

    const revenue =
      orders
        .filter(
          order =>
            [
              'PAID',
              'DELIVERED'
            ].includes(
              order.status
            )
        )
        .reduce(
          (sum, order) =>
            sum +
            Number(
              order.total || 0
            ),
          0
        );

    const dailyMap =
      new Map();

    for (
      const order of orders
    ) {
      const day =
        String(
          order.created_at
        ).slice(
          0,
          10
        );

      const current =
        dailyMap.get(
          day
        ) || {
          day,
          sales: 0,
          orders: 0
        };

      current.orders += 1;

      if (
        [
          'PAID',
          'DELIVERED'
        ].includes(
          order.status
        )
      ) {
        current.sales +=
          Number(
            order.total || 0
          );
      }

      dailyMap.set(
        day,
        current
      );
    }

    const daily =
      [
        ...dailyMap.values()
      ]
        .sort(
          (a, b) =>
            a.day.localeCompare(
              b.day
            )
        )
        .slice(-14);

    return res.json({
      revenue,

      orders:
        orders.length,

      customers:
        (
          usersResult.data ||
          []
        ).length,

      products:
        (
          productsResult.data ||
          []
        ).length,

      pending_reviews:
        (
          reviewsResult.data ||
          []
        ).length,

      daily
    });
  }
);

app.get(
  '/api/admin/products',
  auth,
  adminOnly,
  async (req, res) => {
    const {
      data,
      error
    } = await supabase
      .from('products')
      .select('*')
      .order(
        'id',
        {
          ascending: false
        }
      );

    if (error) {
      return fail(
        res,
        500,
        'Could not load products.'
      );
    }

    return res.json(
      data || []
    );
  }
);

app.post(
  '/api/admin/products',
  auth,
  adminOnly,
  async (req, res) => {
    const payload = {
      name:
        String(
          req.body.name || ''
        ).trim(),

      description:
        String(
          req.body.description ||
            ''
        ).trim(),

      price_bdt:
        Number(
          req.body.price_bdt ||
            0
        ),

      image:
        String(
          req.body.image || ''
        ).trim(),

      tag:
        String(
          req.body.tag ||
            'FRESH'
        ).toUpperCase(),

      delivery:
        String(
          req.body.delivery ||
            'Email delivery'
        ).trim(),

      file_url:
        String(
          req.body.file_url ||
            ''
        ).trim(),

      active:
        req.body.active !==
        false
    };

    if (
      !payload.name ||
      ![
        'FRESH',
        'HOT',
        'SPECIAL'
      ].includes(
        payload.tag
      )
    ) {
      return fail(
        res,
        400,
        'Product name and valid tag are required.'
      );
    }

    const {
      data,
      error
    } = await supabase
      .from('products')
      .insert(
        payload
      )
      .select('*')
      .single();

    if (error) {
      return fail(
        res,
        400,
        error.message
      );
    }

    return res.json({
      ok: true,
      product:
        data
    });
  }
);

app.put(
  '/api/admin/products/:id',
  auth,
  adminOnly,
  async (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const payload = {
      name:
        String(
          req.body.name || ''
        ).trim(),

      description:
        String(
          req.body.description ||
            ''
        ).trim(),

      price_bdt:
        Number(
          req.body.price_bdt ||
            0
        ),

      image:
        String(
          req.body.image || ''
        ).trim(),

      tag:
        String(
          req.body.tag ||
            'FRESH'
        ).toUpperCase(),

      delivery:
        String(
          req.body.delivery ||
            'Email delivery'
        ).trim(),

      file_url:
        String(
          req.body.file_url ||
            ''
        ).trim(),

      active:
        Boolean(
          req.body.active
        )
    };

    const {
      error
    } = await supabase
      .from('products')
      .update(
        payload
      )
      .eq(
        'id',
        id
      );

    if (error) {
      return fail(
        res,
        400,
        error.message
      );
    }

    return res.json({
      ok: true
    });
  }
);

app.delete(
  '/api/admin/products/:id',
  auth,
  adminOnly,
  async (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const {
      error
    } = await supabase
      .from('products')
      .delete()
      .eq(
        'id',
        id
      );

    if (error) {
      return fail(
        res,
        400,
        error.message
      );
    }

    return res.json({
      ok: true
    });
  }
);

app.get(
  '/api/admin/orders',
  auth,
  adminOnly,
  async (req, res) => {
    const {
      data,
      error
    } = await supabase
      .from('orders')
      .select(
        '*,order_items(*),tickets(id,status,created_at)'
      )
      .order(
        'id',
        {
          ascending: false
        }
      );

    if (error) {
      return fail(
        res,
        500,
        'Could not load orders.'
      );
    }

    return res.json(
      data || []
    );
  }
);

app.patch(
  '/api/admin/orders/:id',
  auth,
  adminOnly,
  async (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const status =
      String(
        req.body.status ||
          'PENDING'
      ).toUpperCase();

    const allowed = [
      'PENDING',
      'PAID',
      'DELIVERED',
      'CANCELLED'
    ];

    if (
      !allowed.includes(
        status
      )
    ) {
      return fail(
        res,
        400,
        'Invalid order status.'
      );
    }

    const {
      data: before
    } = await supabase
      .from('orders')
      .select(
        'status'
      )
      .eq(
        'id',
        id
      )
      .maybeSingle();

    const {
      error
    } = await supabase
      .from('orders')
      .update({
        status
      })
      .eq(
        'id',
        id
      );

    if (error) {
      return fail(
        res,
        400,
        error.message
      );
    }

    let emailSent =
      null;

    if (
      status ===
        'DELIVERED' &&
      before?.status !==
        'DELIVERED'
    ) {
      try {
        emailSent =
          await sendDeliveryEmail(
            id
          );
      } catch (mailError) {
        console.error(
          'Delivery email error:',
          mailError
        );

        emailSent =
          false;
      }
    }

    return res.json({
      ok: true,
      email_sent:
        emailSent
    });
  }
);

app.post(
  '/api/admin/orders/:id/resend-email',
  auth,
  adminOnly,
  async (req, res) => {
    const id =
      Number(
        req.params.id
      );

    if (
      !Number.isInteger(
        id
      ) ||
      id <= 0
    ) {
      return fail(
        res,
        400,
        'Invalid order.'
      );
    }

    try {
      const sent =
        await sendDeliveryEmail(
          id
        );

      if (!sent) {
        return fail(
          res,
          400,
          'Email could not be sent. Check SMTP environment variables in Vercel.'
        );
      }

      return res.json({
        ok: true,
        email_sent:
          true
      });

    } catch (error) {
      console.error(
        'Resend delivery email error:',
        error
      );

      return fail(
        res,
        500,
        `Email delivery failed: ${error.message}`
      );
    }
  }
);

app.get(
  '/api/admin/coupons',
  auth,
  adminOnly,
  async (req, res) => {
    const {
      data,
      error
    } = await supabase
      .from('coupons')
      .select('*')
      .order(
        'id',
        {
          ascending: false
        }
      );

    if (error) {
      return fail(
        res,
        500,
        'Could not load coupons.'
      );
    }

    return res.json(
      data || []
    );
  }
);

app.post(
  '/api/admin/coupons',
  auth,
  adminOnly,
  async (req, res) => {
    const code =
      String(
        req.body.code || ''
      )
        .trim()
        .toUpperCase();

    const type =
      req.body.type ===
      'fixed'
        ? 'fixed'
        : 'percent';

    const value =
      Number(
        req.body.value || 0
      );

    if (
      !code ||
      value <= 0
    ) {
      return fail(
        res,
        400,
        'Coupon code and value are required.'
      );
    }

    if (
      type ===
        'percent' &&
      value > 100
    ) {
      return fail(
        res,
        400,
        'Percent discount cannot exceed 100.'
      );
    }

    const {
      error
    } = await supabase
      .from('coupons')
      .insert({
        code,
        type,
        value,
        active:
          true
      });

    if (error) {
      return fail(
        res,
        400,
        'Coupon code already exists or is invalid.'
      );
    }

    return res.json({
      ok: true
    });
  }
);

app.patch(
  '/api/admin/coupons/:id',
  auth,
  adminOnly,
  async (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const active =
      Boolean(
        req.body.active
      );

    const {
      error
    } = await supabase
      .from('coupons')
      .update({
        active
      })
      .eq(
        'id',
        id
      );

    if (error) {
      return fail(
        res,
        400,
        error.message
      );
    }

    return res.json({
      ok: true
    });
  }
);

app.delete(
  '/api/admin/coupons/:id',
  auth,
  adminOnly,
  async (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const {
      error
    } = await supabase
      .from('coupons')
      .delete()
      .eq(
        'id',
        id
      );

    if (error) {
      return fail(
        res,
        400,
        error.message
      );
    }

    return res.json({
      ok: true
    });
  }
);

app.get(
  '/api/admin/reviews',
  auth,
  adminOnly,
  async (req, res) => {
    const {
      data,
      error
    } = await supabase
      .from('reviews')
      .select(
        'id,email,stars,comment,approved,created_at,user_id,order_id,users(name),products(name)'
      )
      .order(
        'id',
        {
          ascending: false
        }
      );

    if (error) {
      return fail(
        res,
        500,
        'Could not load reviews.'
      );
    }

    return res.json(
      (data || []).map(
        review => ({
          ...review,

          product_name:
            review.products?.name ||
            'Product',

          name:
            review.users?.name ||
            'Customer'
        })
      )
    );
  }
);

app.patch(
  '/api/admin/reviews/:id',
  auth,
  adminOnly,
  async (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const updates = {};

    if (
      typeof req.body
        .approved !==
      'undefined'
    ) {
      updates.approved =
        Boolean(
          req.body.approved
        );
    }

    if (
      typeof req.body
        .stars !==
      'undefined'
    ) {
      const stars =
        Number(
          req.body.stars
        );

      if (
        !Number.isInteger(
          stars
        ) ||
        stars < 1 ||
        stars > 5
      ) {
        return fail(
          res,
          400,
          'Stars must be between 1 and 5.'
        );
      }

      updates.stars =
        stars;
    }

    if (
      typeof req.body
        .comment !==
      'undefined'
    ) {
      const comment =
        String(
          req.body.comment ||
            ''
        )
          .trim()
          .slice(0, 500);

      if (!comment) {
        return fail(
          res,
          400,
          'Review text cannot be empty.'
        );
      }

      updates.comment =
        comment;
    }

    if (
      !Object.keys(
        updates
      ).length
    ) {
      return fail(
        res,
        400,
        'No review changes supplied.'
      );
    }

    const {
      error
    } = await supabase
      .from('reviews')
      .update(
        updates
      )
      .eq(
        'id',
        id
      );

    if (error) {
      return fail(
        res,
        400,
        error.message
      );
    }

    return res.json({
      ok: true
    });
  }
);

app.delete(
  '/api/admin/reviews/:id',
  auth,
  adminOnly,
  async (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const {
      error
    } = await supabase
      .from('reviews')
      .delete()
      .eq(
        'id',
        id
      );

    if (error) {
      return fail(
        res,
        400,
        error.message
      );
    }

    return res.json({
      ok: true
    });
  }
);

app.get(
  '/api/admin/tickets',
  auth,
  adminOnly,
  async (req, res) => {
    const {
      data,
      error
    } = await supabase
      .from('tickets')
      .select(
        '*,orders(order_code,total,status,payment_method,trxid)'
      )
      .order(
        'id',
        {
          ascending: false
        }
      );

    if (error) {
      return fail(
        res,
        500,
        'Could not load support tickets.'
      );
    }

    return res.json(
      data || []
    );
  }
);

app.patch(
  '/api/admin/tickets/:id',
  auth,
  adminOnly,
  async (req, res) => {
    const id =
      Number(
        req.params.id
      );

    const status =
      String(
        req.body.status ||
          'OPEN'
      ).toUpperCase();

    if (
      ![
        'OPEN',
        'CLOSED'
      ].includes(
        status
      )
    ) {
      return fail(
        res,
        400,
        'Invalid ticket status.'
      );
    }

    const {
      error
    } = await supabase
      .from('tickets')
      .update({
        status
      })
      .eq(
        'id',
        id
      );

    if (error) {
      return fail(
        res,
        400,
        error.message
      );
    }

    return res.json({
      ok: true
    });
  }
);

app.put(
  '/api/admin/settings',
  auth,
  adminOnly,
  async (req, res) => {
    const allowed =
      Object.keys(
        defaultSettings
      );

    const rows = [];

    for (
      const key of allowed
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body || {},
          key
        )
      ) {
        rows.push({
          key,

          value:
            String(
              req.body[key] ??
                ''
            )
        });
      }
    }

    if (rows.length) {
      const {
        error
      } = await supabase
        .from('settings')
        .upsert(
          rows,
          {
            onConflict:
              'key'
          }
        );

      if (error) {
        return fail(
          res,
          400,
          error.message
        );
      }
    }

    return res.json({
      ok: true
    });
  }
);

app.get(
  '/api/admin/me',
  auth,
  adminOnly,
  (req, res) => {
    return res.json({
      admin: true,
      email:
        req.user.email
    });
  }
);

module.exports = app;
