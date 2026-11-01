const express = require("express");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const nodemailer = require("nodemailer");

const app = express();
const db = new DatabaseSync(path.join(__dirname, "store.db"));
db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, delivery_address TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, total_cents INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);`);
db.exec(
  `CREATE TABLE IF NOT EXISTS password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT);`,
);
db.exec(
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);`,
);
db.exec(
  `CREATE TABLE IF NOT EXISTS preorders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product_name TEXT NOT NULL, created_at TEXT NOT NULL, notified_at TEXT, UNIQUE(user_id, product_name));`,
);
db.exec(`CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO site_settings VALUES ('site_name', 'Online Hijab Store');
INSERT OR IGNORE INTO site_settings VALUES ('logo_text', 'OH');
INSERT OR IGNORE INTO site_settings VALUES ('logo_image_url', '');
INSERT OR IGNORE INTO site_settings VALUES ('store_announcement', '');
INSERT OR IGNORE INTO site_settings VALUES ('checkout_note', '');`);
db.exec(
  `CREATE TABLE IF NOT EXISTS addresses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, label TEXT NOT NULL, address TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);`,
);
db.exec(
  `CREATE TABLE IF NOT EXISTS carts (user_id TEXT PRIMARY KEY, items TEXT NOT NULL, updated_at TEXT NOT NULL);`,
);
try {
  db.exec("ALTER TABLE orders ADD COLUMN delivery_address TEXT NOT NULL DEFAULT ''");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE orders ADD COLUMN tracking_number TEXT");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE orders ADD COLUMN shipped_at TEXT");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE orders ADD COLUMN packed_at TEXT");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'Accessories'");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT ''");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE products ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE products ADD COLUMN preorder_enabled INTEGER NOT NULL DEFAULT 1");
} catch {
  /* Existing databases already have this column. */
}
db.exec(`CREATE TABLE IF NOT EXISTS products (name TEXT PRIMARY KEY, price_cents INTEGER NOT NULL, stock INTEGER NOT NULL);
INSERT OR IGNORE INTO products (name, price_cents, stock) VALUES ('Essential Tote', 4800, 20);
INSERT OR IGNORE INTO products (name, price_cents, stock) VALUES ('Everyday Journal', 2400, 20);
INSERT OR IGNORE INTO products (name, price_cents, stock) VALUES ('Studio Mug', 3200, 20);
INSERT OR IGNORE INTO products (name, price_cents, stock) VALUES ('Classic Chiffon Hijab', 2800, 20);
INSERT OR IGNORE INTO products (name, price_cents, stock) VALUES ('Everyday Jersey Hijab', 3000, 20);
INSERT OR IGNORE INTO products (name, price_cents, stock) VALUES ('Satin Occasion Hijab', 3500, 20);
INSERT OR IGNORE INTO products (name, price_cents, stock) VALUES ('Magnet Hijab Pins', 1200, 20);
INSERT OR IGNORE INTO products (name, price_cents, stock) VALUES ('Undercap Set', 1800, 20);
INSERT OR IGNORE INTO products (name, price_cents, stock) VALUES ('Hijab Storage Bag', 2200, 20);`);
try {
  db.exec("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'Accessories'");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT ''");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE products ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
} catch {
  /* Existing databases already have this column. */
}
try {
  db.exec("ALTER TABLE products ADD COLUMN preorder_enabled INTEGER NOT NULL DEFAULT 1");
} catch {
  /* Existing databases already have this column. */
}
app.use(express.json({ limit: "3mb" }));
app.use(express.static(path.join(__dirname, "public")));

function hash(password, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
function valid(password, stored) {
  const [salt, expected] = stored.split(":");
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}
function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
}
function current(req) {
  const token = req.headers.cookie?.match(/mumstore_session=([^;]+)/)?.[1];
  if (!token) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return db
    .prepare(
      "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
    )
    .get(hash, new Date().toISOString());
}
function createSession(res, user) {
  const sessionDays = 180;
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000).toISOString();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(tokenHash, user.id, expiresAt);
  res.setHeader(
    "Set-Cookie",
    `mumstore_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionDays * 24 * 60 * 60}; Expires=${new Date(expiresAt).toUTCString()}`,
  );
}
function adminOnly(req, res) {
  const user = current(req);
  if (user?.role !== "admin") {
    res.status(403).json({ error: "Administrator access required." });
    return null;
  }
  return user;
}
function siteSettings() {
  return Object.fromEntries(
    db
      .prepare("SELECT key, value FROM site_settings")
      .all()
      .map((item) => [item.key, item.value]),
  );
}
function storeName() {
  return siteSettings().site_name || "Online Hijab Store";
}
function orderNumberOf(order) {
  return `NS-${order.id.slice(0, 8).toUpperCase()}`;
}
function orderItemsText(order) {
  return JSON.parse(order.items)
    .map((item) => `${item.quantity} × ${item.name}`)
    .join("\n");
}
// Sends one email. Returns "sent", "failed", or "not_configured" so the admin page can report honestly.
async function sendCustomerEmail(to, subject, text) {
  if (!process.env.SMTP_HOST) return "not_configured";
  try {
    const mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return "sent";
  } catch (error) {
    console.error(`Email "${subject}" failed:`, error.message);
    return "failed";
  }
}
async function notifyPreorders(productName) {
  if (!process.env.SMTP_HOST) return;
  const requests = db
    .prepare(
      "SELECT preorders.id, users.name, users.email FROM preorders JOIN users ON users.id = preorders.user_id WHERE preorders.product_name = ? AND preorders.notified_at IS NULL",
    )
    .all(productName);
  if (!requests.length) return;
  const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  for (const request of requests) {
    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: request.email,
        subject: `${productName} is back in stock — ${storeName()}`,
        text: `Hi ${request.name},\n\n${productName} is back in stock and can now be purchased at ${storeName()}.\n\nVisit the store to place your order.`,
      });
      db.prepare("UPDATE preorders SET notified_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        request.id,
      );
    } catch (error) {
      console.error("Pre-order notification email failed:", error.message);
    }
  }
}
async function validateDeliveryAddress(value) {
  const address = value?.trim()?.split("\n").filter((line) => !/^(Recipient|Phone|Instructions):/i.test(line.trim())).join(", ");
  if (!address || address.length < 12 || !/\d/.test(address) || !/[a-z]/i.test(address))
    return { valid: false };
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(address)}`,
      {
        headers: { "User-Agent": `${storeName()} address validation`, "Accept-Language": "en" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return { valid: false, unavailable: true };
    const matches = await response.json();
    const place = matches[0]?.address;
    const hasLocality =
      place?.city || place?.town || place?.village || place?.suburb || place?.county;
    return {
      valid: Boolean(
        place &&
        hasLocality &&
        (place.road || place.pedestrian || place.residential || place.house_number),
      ),
    };
  } catch {
    return { valid: false, unavailable: true };
  }
}

app.post("/api/register", (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password || password.length < 8 || !phone || phone.trim().length < 7)
    return res
      .status(400)
      .json({ error: "Enter a name, phone number, email, and password of at least 8 characters." });
  const normalizedEmail = email.trim().toLowerCase();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail))
    return res.status(409).json({ error: "That email already has an account." });
  const firstAccount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count === 0;
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    password_hash: hash(password),
    role: firstAccount ? "admin" : "customer",
    created_at: new Date().toISOString(),
    phone: phone.trim(),
  };
  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, role, created_at, phone) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(user.id, user.name, user.email, user.password_hash, user.role, user.created_at, user.phone);
  createSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});
app.post("/api/login", (req, res) => {
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(req.body.email?.trim().toLowerCase());
  if (!user || !req.body.password || !valid(req.body.password, user.password_hash))
    return res.status(401).json({ error: "Incorrect email or password." });
  createSession(res, user);
  res.json({ user: publicUser(user) });
});
app.post("/api/password-reset/request", async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const user = email && db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (user && process.env.SMTP_HOST) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare("INSERT INTO password_resets VALUES (?, ?, ?, NULL)").run(
      tokenHash,
      user.id,
      expiresAt,
    );
    try {
      const mailer = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const siteUrl = process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: `Reset your ${storeName()} password`,
        text: `We received a request to reset your password. Use this link within one hour:\n\n${siteUrl}/reset-password.html?token=${rawToken}\n\nIf you did not request this, you can ignore this email.`,
      });
    } catch (error) {
      console.error("Password reset email failed:", error.message);
    }
  }
  res.json({ message: "If an account exists for that email, a reset link has been sent." });
});
app.post("/api/password-reset/confirm", (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8)
    return res
      .status(400)
      .json({ error: "Use a valid link and a password of at least 8 characters." });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const reset = db
    .prepare(
      "SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
    )
    .get(tokenHash, new Date().toISOString());
  if (!reset) return res.status(400).json({ error: "This reset link is invalid or has expired." });
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash(password), reset.user_id);
  db.prepare("UPDATE password_resets SET used_at = ? WHERE token_hash = ?").run(
    new Date().toISOString(),
    tokenHash,
  );
  res.json({ message: "Your password has been reset. You can now sign in." });
});
app.post("/api/logout", (req, res) => {
  const token = req.headers.cookie?.match(/mumstore_session=([^;]+)/)?.[1];
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      crypto.createHash("sha256").update(token).digest("hex"),
    );
  res.setHeader("Set-Cookie", "mumstore_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.status(204).end();
});
app.get("/api/me", (req, res) => {
  const user = current(req);
  res.json({ user: user && publicUser(user) });
});
app.get("/api/site-settings", (_req, res) => res.json({ settings: siteSettings() }));
app.patch("/api/site-settings", (req, res) => {
  if (!adminOnly(req, res)) return;
  const name = req.body.siteName?.trim();
  const logoText = req.body.logoText?.trim();
  const logoImageUrl = req.body.logoImageUrl?.trim() || "";
  if (!name || !logoText || name.length > 80 || logoText.length > 6)
    return res.status(400).json({ error: "Enter a store name and 1–6 logo characters." });
  if (logoImageUrl && !(/^https?:\/\//i.test(logoImageUrl) || logoImageUrl.startsWith("/uploads/")))
    return res.status(400).json({ error: "Logo image must be a full URL or an uploaded logo." });
  const save = db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)");
  save.run("site_name", name);
  save.run("logo_text", logoText);
  save.run("logo_image_url", logoImageUrl);
  res.json({ settings: siteSettings() });
});
app.patch("/api/store-options", (req, res) => {
  if (!adminOnly(req, res)) return;
  const announcement = req.body.announcement?.trim() || "",
    checkoutNote = req.body.checkoutNote?.trim() || "";
  if (announcement.length > 240 || checkoutNote.length > 240)
    return res.status(400).json({ error: "Keep each setting under 240 characters." });
  const save = db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)");
  save.run("store_announcement", announcement);
  save.run("checkout_note", checkoutNote);
  res.json({ settings: siteSettings() });
});
app.post("/api/site-settings/logo-upload", (req, res) => {
  if (!adminOnly(req, res)) return;
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(
    req.body.imageData || "",
  );
  if (!match) return res.status(400).json({ error: "Choose a PNG, JPG, WebP, or GIF image." });
  const extension = { png: "png", jpeg: "jpg", webp: "webp", gif: "gif" }[match[1]];
  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > 2 * 1024 * 1024)
    return res.status(400).json({ error: "Logo image must be 2 MB or smaller." });
  const uploadDir = path.join(__dirname, "public", "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `logo-${Date.now()}.${extension}`;
  fs.writeFileSync(path.join(uploadDir, filename), data);
  db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('logo_image_url', ?)").run(
    `/uploads/${filename}`,
  );
  res.status(201).json({ logoImageUrl: `/uploads/${filename}` });
});
app.get("/site-manifest.webmanifest", (_req, res) => {
  const settings = siteSettings();
  res
    .type("application/manifest+json")
    .json({
      name: settings.site_name || "Online Hijab Store",
      short_name: settings.logo_text || "OH",
      start_url: "/index.html",
      display: "standalone",
      background_color: "#fcfbf8",
      theme_color: "#172033",
      icons: [
        {
          src: settings.logo_image_url || "/icon.svg",
          sizes: "any",
          type: settings.logo_image_url ? "image/png" : "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    });
});
app.patch("/api/me", (req, res) => {
  const user = current(req);
  if (!user) return res.status(401).json({ error: "Please sign in first." });
  const name = req.body.name?.trim();
  const phone = req.body.phone?.trim();
  if (!name || !phone || phone.length < 7)
    return res.status(400).json({ error: "Enter a name and valid phone number." });
  db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, phone, user.id);
  res.json({ user: publicUser({ ...user, name, phone }) });
});
app.delete("/api/me", (req, res) => {
  const user = current(req);
  if (!user) return res.status(401).json({ error: "Please sign in first." });
  if (!req.body.password || !valid(req.body.password, user.password_hash))
    return res.status(401).json({ error: "Enter your current password to delete your account." });
  if (
    user.role === "admin" &&
    db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count === 1
  )
    return res
      .status(400)
      .json({ error: "Create another administrator before deleting the only admin account." });
  db.prepare("DELETE FROM addresses WHERE user_id = ?").run(user.id);
  db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  res.setHeader("Set-Cookie", "mumstore_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.status(204).end();
});
app.get("/api/addresses", (req, res) => {
  const user = current(req);
  if (!user) return res.status(401).json({ error: "Please sign in first." });
  res.json({
    addresses: db
      .prepare(
        "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC",
      )
      .all(user.id),
  });
});
app.post("/api/addresses", (req, res) => {
  const user = current(req);
  if (!user) return res.status(401).json({ error: "Please sign in first." });
  const label = req.body.label?.trim();
  const address = req.body.address?.trim();
  if (!label || !address)
    return res.status(400).json({ error: "Enter an address label and address." });
  const hasDefault = db
    .prepare("SELECT id FROM addresses WHERE user_id = ? AND is_default = 1")
    .get(user.id);
  const isDefault = req.body.isDefault || !hasDefault ? 1 : 0;
  if (isDefault) db.prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").run(user.id);
  const item = {
    id: crypto.randomUUID(),
    user_id: user.id,
    label,
    address,
    is_default: isDefault,
    created_at: new Date().toISOString(),
  };
  db.prepare("INSERT INTO addresses VALUES (?, ?, ?, ?, ?, ?)").run(
    item.id,
    item.user_id,
    item.label,
    item.address,
    item.is_default,
    item.created_at,
  );
  res.status(201).json({ address: item });
});
app.delete("/api/addresses/:id", (req, res) => {
  const user = current(req);
  if (!user) return res.status(401).json({ error: "Please sign in first." });
  db.prepare("DELETE FROM addresses WHERE id = ? AND user_id = ?").run(req.params.id, user.id);
  res.status(204).end();
});
app.get("/api/cart", (req, res) => {
  const user = current(req);
  if (!user) return res.status(401).json({ error: "Please sign in first." });
  const cart = db.prepare("SELECT items FROM carts WHERE user_id = ?").get(user.id);
  res.json({ items: cart ? JSON.parse(cart.items) : [] });
});
app.put("/api/cart", (req, res) => {
  const user = current(req);
  if (!user) return res.status(401).json({ error: "Please sign in first." });
  const items = req.body.items;
  if (
    !Array.isArray(items) ||
    items.length > 100 ||
    items.some((item) => typeof item !== "string" || item.length > 100)
  )
    return res.status(400).json({ error: "Invalid cart." });
  const available = new Set(
    db
      .prepare("SELECT name FROM products")
      .all()
      .map((product) => product.name),
  );
  const validItems = items.filter((item) => available.has(item));
  db.prepare("INSERT OR REPLACE INTO carts (user_id, items, updated_at) VALUES (?, ?, ?)").run(
    user.id,
    JSON.stringify(validItems),
    new Date().toISOString(),
  );
  res.json({ items: validItems });
});
app.get("/api/products", (_req, res) => {
  res.json({
    products: db
      .prepare(
        "SELECT name, price_cents, stock, category, description, image_url, preorder_enabled FROM products ORDER BY category, name",
      )
      .all(),
  });
});
app.post("/api/products", (req, res) => {
  if (!adminOnly(req, res)) return;
  const name = req.body.name?.trim(),
    price = Number(req.body.priceCents),
    stock = Number(req.body.stock),
    category = req.body.category?.trim() || "Accessories",
    description = req.body.description?.trim() || "",
    imageUrl = req.body.imageUrl?.trim() || "",
    preorderEnabled = req.body.preorderEnabled !== false ? 1 : 0;
  if (
    !name ||
    !Number.isInteger(price) ||
    price < 0 ||
    !Number.isInteger(stock) ||
    stock < 0 ||
    name.length > 100
  )
    return res
      .status(400)
      .json({ error: "Enter a product name, price, and whole-number stock amount." });
  try {
    db.prepare(
      "INSERT INTO products (name, price_cents, stock, category, description, image_url, preorder_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(name, price, stock, category, description, imageUrl, preorderEnabled);
    res
      .status(201)
      .json({
        product: {
          name,
          price_cents: price,
          stock,
          category,
          description,
          image_url: imageUrl,
          preorder_enabled: preorderEnabled,
        },
      });
  } catch {
    res.status(409).json({ error: "A product with that name already exists." });
  }
});
app.post("/api/products/:name/preorder", (req, res) => {
  const user = current(req);
  if (!user) return res.status(401).json({ error: "Please sign in to pre-order an item." });
  const product = db
    .prepare("SELECT stock, preorder_enabled FROM products WHERE name = ?")
    .get(req.params.name);
  if (!product) return res.status(404).json({ error: "Product not found." });
  if (!product.preorder_enabled)
    return res.status(403).json({ error: "Pre-orders are not available for this product." });
  if (product.stock > 0)
    return res
      .status(409)
      .json({ error: "This product is already in stock and can be purchased now." });
  const result = db
    .prepare(
      "INSERT OR IGNORE INTO preorders (id, user_id, product_name, created_at, notified_at) VALUES (?, ?, ?, ?, NULL)",
    )
    .run(crypto.randomUUID(), user.id, req.params.name, new Date().toISOString());
  res
    .status(result.changes ? 201 : 200)
    .json({
      message: result.changes
        ? "Pre-order saved. We will email you when it is back in stock."
        : "You are already on the pre-order list for this item.",
    });
});
app.get("/api/preorders/demand", (req, res) => {
  if (!adminOnly(req, res)) return;
  res.json({
    demand: db
      .prepare(
        "SELECT product_name, COUNT(*) AS requests FROM preorders WHERE notified_at IS NULL GROUP BY product_name ORDER BY requests DESC, product_name",
      )
      .all(),
  });
});
app.patch("/api/products/:name", (req, res) => {
  if (!adminOnly(req, res)) return;
  const oldName = req.params.name;
  const name = req.body.name?.trim(),
    price = Number(req.body.priceCents),
    stock = Number(req.body.stock),
    category = req.body.category?.trim() || "Accessories",
    description = req.body.description?.trim() || "",
    imageUrl = req.body.imageUrl?.trim() || "",
    preorderEnabled = req.body.preorderEnabled !== false ? 1 : 0;
  if (!name || !Number.isInteger(price) || price < 0 || !Number.isInteger(stock) || stock < 0)
    return res
      .status(400)
      .json({ error: "Enter a product name, price, and whole-number stock amount." });
  try {
    const result = db
      .prepare(
        "UPDATE products SET name = ?, price_cents = ?, stock = ?, category = ?, description = ?, image_url = ?, preorder_enabled = ? WHERE name = ?",
      )
      .run(name, price, stock, category, description, imageUrl, preorderEnabled, oldName);
    if (!result.changes) return res.status(404).json({ error: "Product not found." });
    if (stock > 0) notifyPreorders(name);
    res.status(204).end();
  } catch {
    res.status(409).json({ error: "A product with that name already exists." });
  }
});
app.delete("/api/products/:name", (req, res) => {
  if (!adminOnly(req, res)) return;
  const result = db.prepare("DELETE FROM products WHERE name = ?").run(req.params.name);
  if (!result.changes) return res.status(404).json({ error: "Product not found." });
  res.status(204).end();
});
app.patch("/api/products/:name/stock", async (req, res) => {
  if (!adminOnly(req, res)) return;
  const stock = Number(req.body.stock);
  if (!Number.isInteger(stock) || stock < 0)
    return res.status(400).json({ error: "Stock must be a whole number of zero or more." });
  const result = db
    .prepare("UPDATE products SET stock = ? WHERE name = ?")
    .run(stock, req.params.name);
  if (!result.changes) return res.status(404).json({ error: "Product not found." });
  if (stock > 0) notifyPreorders(req.params.name);
  res.status(204).end();
});
app.get("/api/users", (req, res) => {
  if (!adminOnly(req, res)) return;
  res.json({
    users: db
      .prepare("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC")
      .all(),
  });
});
app.patch("/api/users/:id/role", (req, res) => {
  const admin = adminOnly(req, res);
  if (!admin) return;
  if (!["admin", "customer"].includes(req.body.role))
    return res.status(400).json({ error: "Invalid role." });
  if (admin.id === req.params.id && req.body.role !== "admin")
    return res.status(400).json({ error: "You cannot remove your own admin access." });
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(req.body.role, req.params.id);
  res.status(204).end();
});
app.get("/api/orders", (req, res) => {
  if (!adminOnly(req, res)) return;
  res.json({
    orders: db
      .prepare("SELECT * FROM orders ORDER BY created_at DESC")
      .all()
      .map((order) => ({ ...order, items: JSON.parse(order.items) })),
  });
});
app.patch("/api/orders/:id/pack", async (req, res) => {
  if (!adminOnly(req, res)) return;
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.status === "sent")
    return res.status(400).json({ error: "This order has already been sent." });
  if (order.status === "packed")
    return res.status(400).json({ error: "This order is already marked as packed." });
  db.prepare("UPDATE orders SET status = 'packed', packed_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    order.id,
  );
  const email = await sendCustomerEmail(
    order.customer_email,
    `Your ${storeName()} order has been packed`,
    `Hi ${order.customer_name},\n\nGood news — your order ${orderNumberOf(order)} has been packed and is now awaiting delivery.\n\nItems:\n${orderItemsText(order)}\n\nDelivery address:\n${order.delivery_address}\n\nWe'll email you again with your tracking number as soon as it has been sent.\n\nThank you for shopping with ${storeName()}.`,
  );
  res.json({ email });
});
app.patch("/api/orders/:id/ship", async (req, res) => {
  if (!adminOnly(req, res)) return;
  const trackingNumber = req.body.trackingNumber?.trim();
  if (!trackingNumber)
    return res
      .status(400)
      .json({ error: "A tracking number is required before sending an order." });
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.status === "sent")
    return res.status(400).json({ error: "This order has already been sent." });
  const shippedAt = new Date().toISOString();
  db.prepare(
    "UPDATE orders SET status = 'sent', tracking_number = ?, shipped_at = ? WHERE id = ?",
  ).run(trackingNumber, shippedAt, order.id);
  const email = await sendCustomerEmail(
    order.customer_email,
    `Your ${storeName()} order has been sent`,
    `Hi ${order.customer_name},\n\nYour order ${orderNumberOf(order)} has been sent and is on its way.\n\nTracking number: ${trackingNumber}\n\nItems:\n${orderItemsText(order)}\n\nDelivery address:\n${order.delivery_address}\n\nThank you for shopping with ${storeName()}.`,
  );
  res.json({ email });
});
app.delete("/api/orders/:id", (req, res) => {
  if (!adminOnly(req, res)) return;
  const order = db.prepare("SELECT status FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.status !== "sent")
    return res.status(400).json({ error: "Only archived (sent) orders can be removed." });
  db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
app.post("/api/orders", async (req, res) => {
  const user = current(req);
  if (!user) return res.status(401).json({ error: "Please sign in before placing an order." });
  const { deliveryAddress, items } = req.body;
  if (
    !deliveryAddress ||
    !Array.isArray(items) ||
    !items.length ||
    items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)
  )
    return res.status(400).json({ error: "Provide a delivery address and valid cart items." });
  const addressCheck = await validateDeliveryAddress(deliveryAddress);
  if (!addressCheck.valid)
    return res
      .status(400)
      .json({
        error: addressCheck.unavailable
          ? "We could not verify the delivery address right now. Please try again shortly."
          : "Enter a complete real-world delivery address, including the street number, street, suburb/city, and postcode.",
      });
  const catalog = new Map(
    db
      .prepare("SELECT name, price_cents, stock FROM products")
      .all()
      .map((product) => [product.name, product]),
  );
  if (items.some((item) => !catalog.has(item.name) || item.quantity > catalog.get(item.name).stock))
    return res.status(400).json({ error: "One or more items no longer have enough stock." });
  const totalCents = items.reduce(
    (total, item) => total + catalog.get(item.name).price_cents * item.quantity,
    0,
  );
  const order = {
    id: crypto.randomUUID(),
    user_id: user.id,
    customer_name: user.name,
    customer_email: user.email,
    delivery_address: deliveryAddress.trim(),
    items,
    total_cents: totalCents,
    created_at: new Date().toISOString(),
  };
  const orderNumber = `NS-${order.id.slice(0, 8).toUpperCase()}`;
  db.prepare(
    "INSERT INTO orders (id, user_id, customer_name, customer_email, delivery_address, items, total_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)",
  ).run(
    order.id,
    order.user_id,
    order.customer_name,
    order.customer_email,
    order.delivery_address,
    JSON.stringify(order.items),
    order.total_cents,
    order.created_at,
  );
  for (const item of items)
    db.prepare("UPDATE products SET stock = stock - ? WHERE name = ?").run(
      item.quantity,
      item.name,
    );
  try {
    if (process.env.ORDER_NOTIFICATION_EMAIL && process.env.SMTP_HOST) {
      const mailer = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const itemText = items.map((item) => `${item.quantity} × ${item.name}`).join("\n");
      const total = `$${(totalCents / 100).toFixed(2)}`;
      await Promise.all([
        mailer.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: process.env.ORDER_NOTIFICATION_EMAIL,
          subject: `New order ${orderNumber}`,
          text: `Order number: ${orderNumber}\nCustomer: ${user.name} <${user.email}>\nPhone: ${user.phone}\nDeliver to:\n${order.delivery_address}\n\nItems:\n${itemText}\n\nTotal: ${total}`,
        }),
        mailer.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email,
          subject: `Your ${storeName()} order confirmation — ${orderNumber}`,
          text: `Thanks for your order, ${user.name}!\n\nOrder number: ${orderNumber}\n\nDelivering to:\n${order.delivery_address}\n\nItems:\n${itemText}\n\nTotal: ${total}`,
        }),
      ]);
    }
  } catch (error) {
    console.error("Order saved but email failed:", error.message);
  }
  res.status(201).json({ orderId: order.id, orderNumber });
});
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () =>
  console.log(`Website ready at http://localhost:${port} (listening on ${host})`),
);
