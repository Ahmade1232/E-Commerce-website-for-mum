const products = {
  "Classic Chiffon Hijab": 2800,
  "Everyday Jersey Hijab": 3000,
  "Satin Occasion Hijab": 3500,
  "Magnet Hijab Pins": 1200,
  "Undercap Set": 1800,
  "Hijab Storage Bag": 2200,
};
const productStock = {};
const manifest = document.createElement("link");
manifest.rel = "manifest";
manifest.href = "site-manifest.webmanifest";
document.head.append(manifest);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("service-worker.js").catch(() => {}),
  );
const productInfo = {
  "Classic Chiffon Hijab": {
    image: "image-one",
    description:
      "A light, flowing chiffon hijab with an elegant drape for everyday and special occasions.",
  },
  "Everyday Jersey Hijab": {
    image: "image-two",
    description:
      "A soft, comfortable jersey hijab designed for easy all-day wear with minimal styling.",
  },
  "Satin Occasion Hijab": {
    image: "image-three",
    description: "A smooth satin hijab that adds a refined finish to your occasion outfit.",
  },
  "Magnet Hijab Pins": {
    image: "image-four",
    description: "Strong, snag-free magnetic pins that help keep your hijab comfortably in place.",
  },
  "Undercap Set": {
    image: "image-five",
    description: "A practical set of soft undercaps for comfort, coverage, and a secure hijab fit.",
  },
  "Hijab Storage Bag": {
    image: "image-six",
    description:
      "A simple storage bag to keep your hijabs organised, protected, and ready to wear.",
  },
};
function showNotice(message) {
  let notice = document.querySelector("#site-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "site-notice";
    notice.setAttribute("role", "status");
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
  clearTimeout(showNotice.timeout);
  showNotice.timeout = setTimeout(() => notice.classList.remove("visible"), 3200);
}
const savedNotice = sessionStorage.getItem("northstar-notice");
if (savedNotice) {
  sessionStorage.removeItem("northstar-notice");
  window.addEventListener("DOMContentLoaded", () => showNotice(savedNotice));
}
let cart = JSON.parse(localStorage.getItem("northstar-cart") || "[]").filter((item) =>
  Object.hasOwn(products, item),
);
let accountCartLoaded = false,
  cartUploadTimer;
function saveCart() {
  localStorage.setItem("northstar-cart", JSON.stringify(cart));
  queueAccountCartSave();
}
function beginButtonLoading(button, label) {
  if (!button || button.dataset.loading === "true") return false;
  button.dataset.loading = "true";
  button.dataset.originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = label;
  return true;
}
function finishButtonLoading(button) {
  if (!button) return;
  button.disabled = false;
  button.textContent = button.dataset.originalLabel || button.textContent;
  delete button.dataset.loading;
  delete button.dataset.originalLabel;
}
function showCookieChoices() {
  document.querySelector("#cookie-panel")?.remove();
  const panel = document.createElement("section");
  panel.id = "cookie-panel";
  panel.innerHTML =
    '<h2>Cookie settings</h2><p><strong>Necessary cookie:</strong> <code>mumstore_session</code> keeps you signed in securely for up to 180 days. It cannot be turned off while using an account.</p><p><strong>Cart storage:</strong> your cart is kept in this browser using local storage, not a cookie, so it stays after refreshes.</p><button id="clear-cart-storage">Clear saved cart</button> <button id="cookie-accept">Save preferences</button>';
  document.body.append(panel);
  document.querySelector("#clear-cart-storage").onclick = () => {
    cart = [];
    saveCart();
    renderCart();
    showNotice("Saved cart cleared.");
  };
  document.querySelector("#cookie-accept").onclick = () => {
    localStorage.setItem("northstar-cookie-notice", "acknowledged");
    panel.remove();
  };
}

function addCookieSettingsLink() {
  const link = document.createElement("button");
  link.className = "cookie-settings-link";
  link.type = "button";
  link.textContent = "Cookie settings";
  link.onclick = showCookieChoices;
  document.body.append(link);
}

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  if (url.startsWith("/api/products") && options.method && options.method !== "GET")
    localStorage.setItem("northstar-catalog-updated", String(Date.now()));
  return data;
};
function queueAccountCartSave() {
  if (!accountCartLoaded) return;
  clearTimeout(cartUploadTimer);
  cartUploadTimer = setTimeout(
    () =>
      api("/api/cart", { method: "PUT", body: JSON.stringify({ items: cart }) }).catch(() => {}),
    350,
  );
}
async function syncAccountCart() {
  try {
    const { items } = await api("/api/cart");
    if (items.length) {
      cart = items;
      localStorage.setItem("northstar-cart", JSON.stringify(cart));
    } else if (cart.length) {
      await api("/api/cart", { method: "PUT", body: JSON.stringify({ items: cart }) });
    }
    accountCartLoaded = true;
    renderCart();
  } catch {
    accountCartLoaded = false;
  }
}
async function applyBranding() {
  try {
    const { settings } = await api("/api/site-settings");
    const name = settings.site_name || "Online Hijab Store";
    document.title = document.title.replace(/Northstar|Online Hijab Store/g, name);
    document
      .querySelectorAll(".brand > span:last-child")
      .forEach((node) => (node.textContent = name));
    document.querySelectorAll(".logo-placeholder").forEach((node) => {
      if (settings.logo_image_url) {
        node.textContent = "";
        node.style.backgroundImage = `url("${settings.logo_image_url}")`;
        node.classList.add("logo-image");
      } else {
        node.style.backgroundImage = "";
        node.classList.remove("logo-image");
        node.textContent = settings.logo_text || "OH";
      }
    });
    if (settings.logo_image_url) {
      let favicon = document.querySelector("link[rel='icon']");
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.append(favicon);
      }
      favicon.href = settings.logo_image_url;
    }
    document
      .querySelectorAll(".site-footer .container")
      .forEach((node) => (node.innerHTML = `© 2026 ${name}`));
  } catch {
    /* Built-in branding remains if the server is unavailable. */
  }
}
applyBranding();
async function applyStoreOptions() {
  try {
    const { settings } = await api("/api/site-settings");
    const announcement = settings.store_announcement?.trim(),
      checkoutNote = settings.checkout_note?.trim();
    if (announcement && !document.querySelector("#store-announcement")) {
      const banner = document.createElement("p");
      banner.id = "store-announcement";
      banner.className = "store-announcement";
      banner.textContent = announcement;
      document.querySelector(".site-header")?.after(banner);
    }
    if (checkoutNote && !document.querySelector("#checkout-note")) {
      const note = document.createElement("p");
      note.id = "checkout-note";
      note.className = "section-copy";
      note.textContent = checkoutNote;
      document.querySelector("#delivery-form")?.before(note);
    }
  } catch {
    /* Store pages still work if settings cannot be loaded. */
  }
}
applyStoreOptions();
async function applyBranding() {
  try {
    const { settings } = await api("/api/site-settings");
    const name = settings.site_name || "Online Hijab Store";
    document
      .querySelectorAll(".brand span:last-child, .product-brand-name")
      .forEach((node) => (node.textContent = name));
    document
      .querySelectorAll(".site-footer .container")
      .forEach((node) => (node.textContent = `© 2026 ${name}`));
    document.querySelectorAll(".logo-placeholder").forEach((node) => {
      node.textContent = settings.logo_text || "OH";
      if (settings.logo_image_url) {
        node.style.backgroundImage = `url(${settings.logo_image_url})`;
        node.style.backgroundSize = "cover";
        node.style.backgroundPosition = "center";
        node.style.fontSize = "0";
      }
    });
    document.title = document.title.replace("Northstar", name);
    if (settings.logo_image_url) {
      let icon = document.querySelector("link[rel='icon']");
      if (!icon) {
        icon = document.createElement("link");
        icon.rel = "icon";
        document.head.append(icon);
      }
      icon.href = settings.logo_image_url;
    }
  } catch {
    /* Default branding is shown if the server is unavailable. */
  }
}
applyBranding();
const money = (cents) => `$${(cents / 100).toFixed(2)}`;
function showNotice(message) {
  let notice = document.querySelector("#site-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "site-notice";
    notice.setAttribute("role", "status");
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => notice.classList.remove("visible"), 2600);
}
function renderCart() {
  document.querySelectorAll(".cart-count").forEach((node) => (node.textContent = cart.length));
  const items = document.querySelector("#cart-items");
  if (items) {
    const quantities = cart.reduce((all, item) => ({ ...all, [item]: (all[item] || 0) + 1 }), {});
    items.innerHTML = cart.length
      ? Object.entries(quantities)
          .map(
            ([item, quantity]) =>
              `<div class="cart-item"><span><strong>${item}</strong><small>${money(products[item])} each</small></span><span class="cart-quantity"><button type="button" class="quantity-change" data-product="${item}" data-change="-1" aria-label="Remove one ${item}">−</button><strong>${quantity}</strong><button type="button" class="quantity-change" data-product="${item}" data-change="1" aria-label="Add one ${item}">+</button><strong>${money(products[item] * quantity)}</strong></span></div>`,
          )
          .join("")
      : "<p>Your cart is empty.</p>";
    items.querySelectorAll(".quantity-change").forEach(
      (button) =>
        (button.onclick = () => {
          const item = button.dataset.product,
            change = Number(button.dataset.change),
            inCart = cart.filter((entry) => entry === item).length,
            stock = productStock[item];
          if (change > 0 && Number.isInteger(stock) && inCart >= stock)
            return showNotice("That quantity is not available in stock.");
          const index = cart.indexOf(item);
          if (change < 0 && index !== -1) cart.splice(index, 1);
          if (change > 0) cart.push(item);
          saveCart();
          renderCart();
        }),
    );
  }
  const total = document.querySelector("#cart-total");
  if (total) total.textContent = money(cart.reduce((sum, item) => sum + products[item], 0));
}
async function syncStock() {
  try {
    const { products: catalog } = await api("/api/products");
    catalog.forEach((product) => {
      products[product.name] = product.price_cents;
      productStock[product.name] = product.stock;
      const button = document.querySelector(`.add-to-cart[data-product="${product.name}"]`);
      if (!button) return;
      button.dataset.stock = product.stock;
      button.disabled = product.stock < 1;
      button.textContent = product.stock < 1 ? "Out of stock" : "Add to cart";
      let label = button.parentElement.querySelector(".stock-label");
      if (!label) {
        label = document.createElement("p");
        label.className = "stock-label";
        button.before(label);
      }
      label.textContent = `${product.stock} in stock`;
    });
  } catch {
    /* The static store can still display if the server is unavailable. */
  }
}
document.querySelectorAll(".add-to-cart").forEach(
  (button) =>
    (button.onclick = () => {
      const inCart = cart.filter((item) => item === button.dataset.product).length;
      if (button.dataset.stock && inCart >= Number(button.dataset.stock)) return;
      if (!beginButtonLoading(button, "Adding…")) return;
      cart.push(button.dataset.product);
      saveCart();
      renderCart();
      showNotice(`${button.dataset.product} added to your cart.`);
      setTimeout(() => finishButtonLoading(button), 500);
    }),
);
document.querySelectorAll(".product-card").forEach((card) => {
  const product = card.querySelector(".add-to-cart")?.dataset.product;
  if (!product) return;
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  const openProduct = (event) => {
    if (event.target.closest("button")) return;
    location.href = `product.html?name=${encodeURIComponent(product)}`;
  };
  card.onclick = openProduct;
  card.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      location.href = `product.html?name=${encodeURIComponent(product)}`;
    }
  };
});
renderCart();
syncStock();
async function addManagedProductsToBrowse() {
  const browse = document.querySelector("main.section.container");
  if (!browse || !location.pathname.endsWith("browse.html")) return;
  try {
    const { products: catalog } = await api("/api/products");
    catalog.forEach((product) => {
      products[product.name] = product.price_cents;
      if (product.description)
        productInfo[product.name] = { image: "image-four", description: product.description };
    });
    const known = new Set(
      [...document.querySelectorAll(".add-to-cart")].map((button) => button.dataset.product),
    );
    const extras = catalog.filter((product) => !known.has(product.name));
    if (!extras.length) return;
    const section = document.createElement("section");
    section.className = "catalog-section";
    section.innerHTML = `<p class="eyebrow">MORE PRODUCTS</p><h2>New arrivals</h2><div class="product-grid">${extras.map((product) => `<article class="product-card"><div class="product-image image-four" ${product.image_url ? `style="background-image:url('${product.image_url}');background-size:cover"` : ""}></div><h3>${product.name}</h3><p>${money(product.price_cents)}</p><p class="stock-label">${product.stock ? "In stock" : "Sold out"}</p><button class="add-to-cart" data-product="${product.name}" data-stock="${product.stock}" ${product.stock ? "" : "disabled"}>${product.stock ? "Add to cart" : "Out of stock"}</button></article>`).join("")}</div>`;
    browse.append(section);
    section.querySelectorAll(".add-to-cart").forEach(
      (button) =>
        (button.onclick = () => {
          const inCart = cart.filter((item) => item === button.dataset.product).length;
          if (inCart >= Number(button.dataset.stock) || !beginButtonLoading(button, "Adding…"))
            return;
          cart.push(button.dataset.product);
          saveCart();
          renderCart();
          showNotice(`${button.dataset.product} added to your cart.`);
          setTimeout(() => finishButtonLoading(button), 500);
        }),
    );
  } catch {}
}
addManagedProductsToBrowse();
window.addEventListener("storage", (event) => {
  if (event.key === "northstar-catalog-updated" && location.pathname.endsWith("browse.html"))
    location.reload();
});
const productDetails = document.querySelector("#product-details");
if (productDetails) {
  const name = new URLSearchParams(location.search).get("name");
  const info = productInfo[name];
  if (!info)
    productDetails.innerHTML =
      '<p>Product not found. <a href="browse.html">Return to browse</a>.</p>';
  else {
    productDetails.innerHTML = `<div class=\"product-image ${info.image}\"></div><div><p class=\"eyebrow\"><span class="product-brand-name">Online Hijab Store</span> COLLECTION</p><h1>${name}</h1><p class=\"product-price\">${money(products[name])}</p><p class=\"product-description\">${info.description}</p><p class=\"stock-label\" id=\"detail-stock\">Checking stock…</p><label class=\"quantity-picker\">Quantity <input id=\"product-quantity\" type=\"number\" min=\"1\" value=\"1\"></label><button class=\"add-to-cart\" data-product=\"${name}\">Add to cart</button></div>`;
    const button = productDetails.querySelector(".add-to-cart"),
      quantityInput = productDetails.querySelector("#product-quantity");
    button.onclick = () => {
      const quantity = Number(quantityInput.value);
      const inCart = cart.filter((item) => item === name).length;
      if (!Number.isInteger(quantity) || quantity < 1)
        return showNotice("Choose a valid quantity.");
      if (button.dataset.stock && inCart + quantity > Number(button.dataset.stock))
        return showNotice("That quantity is not available in stock.");
      if (!beginButtonLoading(button, "Adding…")) return;
      cart.push(...Array(quantity).fill(name));
      saveCart();
      renderCart();
      showNotice(`${quantity} × ${name} added to your cart.`);
      setTimeout(() => finishButtonLoading(button), 500);
    };
    api("/api/products")
      .then(({ products: catalog }) => {
        const item = catalog.find((product) => product.name === name);
        const stock = item?.stock || 0;
        quantityInput.max = stock;
        if (item) showProductAvailability(button, item);
        document.querySelector("#detail-stock").textContent = stock ? "In stock" : "Sold out";
      })
      .catch(() => {
        document.querySelector("#detail-stock").textContent = "Stock information unavailable.";
      });
  }
}
const navigation = document.querySelector(".nav-links");
if (navigation) {
  const menuButton = document.createElement("button");
  menuButton.className = "menu-toggle";
  menuButton.type = "button";
  menuButton.setAttribute("aria-label", "Open navigation menu");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.innerHTML = "<span></span><span></span><span></span>";
  navigation.before(menuButton);
  const mobileCart = document.createElement("a");
  mobileCart.className = "mobile-cart";
  mobileCart.href = "cart.html";
  mobileCart.setAttribute("aria-label", "Open shopping cart");
  mobileCart.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h2l2.1 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 7H6"></path><circle cx="10" cy="20" r="1.2"></circle><circle cx="17" cy="20" r="1.2"></circle></svg><span class="cart-count">0</span>';
  menuButton.before(mobileCart);
  renderCart();
  menuButton.onclick = () => {
    const open = navigation.classList.toggle("open");
    menuButton.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", open);
    menuButton.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
  };
}
if (navigation && !navigation.querySelector(".cookie-tab")) {
  const cookieTab = document.createElement("a");
  cookieTab.className = "cookie-tab";
  cookieTab.href = "cookie-settings.html";
  cookieTab.textContent = "Settings";
  navigation.insertBefore(cookieTab, navigation.querySelector(".nav-login"));
}
async function addAccountTabs() {
  if (!navigation) return;
  try {
    const { user } = await api("/api/me");
    if (!user) return;
    await syncAccountCart();
    const accountButton = navigation.querySelector(".nav-login");
    if (accountButton) {
      accountButton.href = "settings.html";
      accountButton.textContent = "Account";
    }
    if (user.role === "admin" && !navigation.querySelector(".admin-tab")) {
      const adminTab = document.createElement("a");
      adminTab.className = "admin-tab";
      adminTab.href = "admin.html";
      adminTab.textContent = "Admin";
      navigation.append(adminTab);
    }
    if (!navigation.querySelector(".nav-logout")) {
      const logoutButton = document.createElement("button");
      logoutButton.className = "nav-logout";
      logoutButton.type = "button";
      logoutButton.textContent = "Log out";
      logoutButton.onclick = async () => {
        await api("/api/logout", { method: "POST" });
        localStorage.setItem("northstar-logout-notice", "You have been logged out.");
        location.href = "index.html";
      };
      navigation.append(logoutButton);
    }
  } catch {
    /* The regular site navigation remains available. */
  }
}
addAccountTabs();
const login = document.querySelector("#login-form"),
  register = document.querySelector("#register-form");
if (login) {
  const forgotLink = document.createElement("a");
  forgotLink.className = "text-link";
  forgotLink.href = "forgot-password.html";
  forgotLink.textContent = "Forgot your password?";
  login.querySelector("button").after(forgotLink);
}
const logoutNotice = localStorage.getItem("northstar-logout-notice");
if (logoutNotice) {
  localStorage.removeItem("northstar-logout-notice");
  showNotice(logoutNotice);
}
function showAccount(user) {
  if (!user) return;
  const next = localStorage.getItem("northstar-after-login");
  localStorage.removeItem("northstar-after-login");
  location.href = next || "index.html";
}
if (login) {
  const phone = document.createElement("label");
  phone.innerHTML =
    'Phone number <input name="phone" type="tel" required placeholder="Your phone number">';
  register.querySelector("label").after(phone);
  api("/api/me").then(({ user }) => showAccount(user));
  login.onsubmit = async (event) => {
    event.preventDefault();
    try {
      showAccount(
        (
          await api("/api/login", {
            method: "POST",
            body: JSON.stringify(Object.fromEntries(new FormData(login))),
          })
        ).user,
      );
    } catch (error) {
      document.querySelector("#login-message").textContent = error.message;
    }
  };
  register.onsubmit = async (event) => {
    event.preventDefault();
    try {
      showAccount(
        (
          await api("/api/register", {
            method: "POST",
            body: JSON.stringify(Object.fromEntries(new FormData(register))),
          })
        ).user,
      );
    } catch (error) {
      document.querySelector("#register-message").textContent = error.message;
    }
  };
  document.querySelector("#logout-button").onclick = async () => {
    await api("/api/logout", { method: "POST" });
    location.reload();
  };
}
const forgotPasswordForm = document.querySelector("#forgot-password-form");
if (forgotPasswordForm)
  forgotPasswordForm.onsubmit = async (event) => {
    event.preventDefault();
    const message = document.querySelector("#forgot-password-message");
    try {
      const data = await api("/api/password-reset/request", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(forgotPasswordForm))),
      });
      message.textContent = data.message;
    } catch (error) {
      message.textContent = error.message;
    }
  };
const resetPasswordForm = document.querySelector("#reset-password-form");
if (resetPasswordForm)
  resetPasswordForm.onsubmit = async (event) => {
    event.preventDefault();
    const message = document.querySelector("#reset-password-message"),
      data = Object.fromEntries(new FormData(resetPasswordForm)),
      token = new URLSearchParams(location.search).get("token");
    if (data.password !== data.confirmPassword)
      return (message.textContent = "The passwords do not match.");
    try {
      const response = await api("/api/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password: data.password }),
      });
      message.textContent = `${response.message} Redirecting to sign in…`;
      setTimeout(() => (location.href = "login.html"), 1500);
    } catch (error) {
      message.textContent = error.message;
    }
  };
const checkoutButton = document.querySelector("#checkout-button");
if (checkoutButton)
  checkoutButton.onclick = async () => {
    if (!cart.length)
      return (document.querySelector("#checkout-message").textContent = "Your cart is empty.");
    if (!beginButtonLoading(checkoutButton, "Checking account…")) return;
    try {
      const { user } = await api("/api/me");
      if (!user) {
        localStorage.setItem("northstar-after-login", "checkout.html");
        location.href = "login.html";
        return;
      }
      location.href = "checkout.html";
    } catch (error) {
      document.querySelector("#checkout-message").textContent = error.message;
      finishButtonLoading(checkoutButton);
    }
  };
const deliveryForm = document.querySelector("#delivery-form");
function escapeAddressHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
// Keep address records compatible with the existing API while presenting a
// structured form in checkout and account settings.
function formatAddress(form) {
  const data = new FormData(form);
  const street = String(data.get("street") || "").trim();
  const unit = String(data.get("unit") || "").trim();
  const suburb = String(data.get("suburb") || "").trim();
  const postcode = String(data.get("postcode") || "").trim();
  const state = String(data.get("state") || "").trim();
  const country = String(data.get("country") || "Australia").trim();
  const fullName = String(data.get("fullName") || "").trim();
  const phone = String(data.get("contactPhone") || "").trim();
  const notes = String(data.get("instructions") || "").trim();
  if (!/^[0-9]{4}$/.test(postcode)) throw new Error("Enter a valid four-digit Australian postcode.");
  const lines = [street, unit, `${suburb} ${state} ${postcode}`, country];
  if (fullName) lines.push(`Recipient: ${fullName}`);
  if (phone) lines.push(`Phone: ${phone}`);
  if (notes) lines.push(`Instructions: ${notes.replace(/\s+/g, " ")}`);
  return lines.filter(Boolean).join("\n");
}
function populateAddress(form, raw) {
  form.reset();
  const lines = String(raw || "").split("\n").map((part) => part.trim()).filter(Boolean);
  const set = (name, value) => { if (form.elements[name]) form.elements[name].value = value || ""; };
  const contacts = lines.filter((line) => /^(Recipient|Phone|Instructions):/i.test(line));
  set("fullName", contacts.find((s) => /^Recipient:/i.test(s))?.replace(/^Recipient:\s*/i, ""));
  set("contactPhone", contacts.find((s) => /^Phone:/i.test(s))?.replace(/^Phone:\s*/i, ""));
  set("instructions", contacts.find((s) => /^Instructions:/i.test(s))?.replace(/^Instructions:\s*/i, ""));
  const main = lines.filter((line) => !/^(Recipient|Phone|Instructions):/i.test(line));
  const localityIndex = main.findIndex((line) => /\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+\d{4}\b/i.test(line));
  if (localityIndex >= 0) {
    set("street", main[0]);
    if (localityIndex > 1) set("unit", main.slice(1, localityIndex).join(", "));
    const match = main[localityIndex].match(/^(.*?)\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})$/i);
    if (match) { set("suburb", match[1]); set("state", match[2].toUpperCase()); set("postcode", match[3]); }
  } else {
    // Old saved addresses were free-form. Never silently discard their text.
    set("street", main[0] || "");
    set("unit", main.slice(1).filter((line) => line !== "Australia").join(", "));
  }
}
if (deliveryForm)
  api("/api/me")
    .then(async ({ user }) => {
      if (!user) {
        localStorage.setItem("northstar-after-login", "checkout.html");
        location.href = "login.html";
        return;
      }
      if (!cart.length) {
        location.href = "cart.html";
        return;
      }
      document.querySelector("#checkout-user").textContent =
        `Ordering as ${user.name} (${user.email})`;
      if (!deliveryForm.elements.fullName.value) deliveryForm.elements.fullName.value = user.name || "";
      if (!deliveryForm.elements.contactPhone.value) deliveryForm.elements.contactPhone.value = user.phone || "";
      const summary = Object.entries(
        cart.reduce((items, item) => ({ ...items, [item]: (items[item] || 0) + 1 }), {}),
      );
      document.querySelector("#checkout-items").innerHTML = summary
        .map(
          ([name, quantity]) =>
            `<div class="cart-item"><span>${quantity} × ${name}</span><span>${money(products[name] * quantity)}</span></div>`,
        )
        .join("");
      document.querySelector("#checkout-total").textContent = money(
        cart.reduce((sum, item) => sum + products[item], 0),
      );
    })
    .catch(() => (location.href = "login.html"));
if (deliveryForm)
  deliveryForm.onsubmit = async (event) => {
    event.preventDefault();
    const message = document.querySelector("#delivery-message"),
      submit = deliveryForm.querySelector("button[type=submit], button");
    if (!beginButtonLoading(submit, "Placing order…")) return;
    const summary = Object.entries(
      cart.reduce((items, item) => ({ ...items, [item]: (items[item] || 0) + 1 }), {}),
    ).map(([name, quantity]) => ({ name, quantity }));
    try {
      await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          deliveryAddress: formatAddress(deliveryForm),
          items: summary,
        }),
      });
      cart = [];
      saveCart();
      message.textContent =
        "Thank you—your order is confirmed. A confirmation email has been sent.";
      deliveryForm.reset();
    } catch (error) {
      message.textContent = error.message;
      finishButtonLoading(submit);
    }
  };
if (deliveryForm)
  api("/api/addresses")
    .then(({ addresses }) => {
      if (!addresses.length) return;
      const picker = document.createElement("label");
      picker.innerHTML =
        'Use a saved address <select id="address-picker"><option value="">Enter a new address</option>' +
        addresses
          .map(
            (address) =>
              `<option value=\"${address.id}\" ${address.is_default ? "selected" : ""}>${escapeAddressHTML(address.label)}${address.is_default ? " (default)" : ""}</option>`,
          )
          .join("") +
        "</select>";
      deliveryForm.prepend(picker);
      const chooseAddress = () => {
        const chosen = addresses.find((address) => String(address.id) === picker.querySelector("select").value);
        if (chosen) populateAddress(deliveryForm, chosen.address);
        else deliveryForm.reset();
      };
      picker.querySelector("select").onchange = chooseAddress;
      chooseAddress();
    })
    .catch(() => {});
const settingsContent = document.querySelector("#settings-content");
if (settingsContent)
  api("/api/me")
    .then(async ({ user }) => {
      if (!user) {
        location.href = "login.html";
        return;
      }
      settingsContent.hidden = false;
      const profileForm = document.querySelector("#profile-form");
      profileForm.elements.name.value = user.name;
      profileForm.elements.email.value = user.email;
      profileForm.elements.phone.value = user.phone || "";
      const addressEntry = document.querySelector("#address-form");
      addressEntry.elements.fullName.value = user.name || "";
      addressEntry.elements.contactPhone.value = user.phone || "";
      profileForm.onsubmit = async (event) => {
        event.preventDefault();
        try {
          await api("/api/me", {
            method: "PATCH",
            body: JSON.stringify({
              name: profileForm.elements.name.value,
              phone: profileForm.elements.phone.value,
            }),
          });
          document.querySelector("#settings-message").textContent = "Profile saved.";
          showNotice("Profile settings saved.");
        } catch (error) {
          document.querySelector("#settings-message").textContent = error.message;
        }
      };
      const addressForm = document.querySelector("#address-form");
      async function renderAddresses() {
        const { addresses } = await api("/api/addresses");
        document.querySelector("#saved-addresses").innerHTML = addresses.length
          ? addresses
              .map(
                (address) =>
                  `<div class=\"cart-item\"><span><strong>${escapeAddressHTML(address.label)}${address.is_default ? " (default)" : ""}</strong><small>${escapeAddressHTML(address.address).replace(/\n/g, "<br>")}</small></span><button class=\"remove-address\" data-id=\"${address.id}\">Remove</button></div>`,
              )
              .join("")
          : "<p>No saved addresses yet.</p>";
        document.querySelectorAll(".remove-address").forEach(
          (button) =>
            (button.onclick = async () => {
              if (!confirm("Remove this saved address?")) return;
              await api(`/api/addresses/${button.dataset.id}`, { method: "DELETE" });
              renderAddresses();
              showNotice("Saved address removed.");
            }),
        );
      }
      addressForm.onsubmit = async (event) => {
        event.preventDefault();
        try {
          await api("/api/addresses", {
            method: "POST",
            body: JSON.stringify({
              label: addressForm.elements.label.value,
              address: formatAddress(addressForm),
              isDefault: addressForm.elements.isDefault.checked,
            }),
          });
          addressForm.reset();
          addressForm.elements.fullName.value = profileForm.elements.name.value;
          addressForm.elements.contactPhone.value = profileForm.elements.phone.value;
          document.querySelector("#address-message").textContent = "Address saved.";
          renderAddresses();
          showNotice("Saved address added.");
        } catch (error) {
          document.querySelector("#address-message").textContent = error.message;
        }
      };
      renderAddresses();
    })
    .catch(() => (location.href = "login.html"));
const adminMessage = document.querySelector("#admin-message");
const brandingControls = document.querySelector("#admin-content");
if (brandingControls)
  api("/api/me")
    .then(async ({ user }) => {
      if (user?.role !== "admin") return;
      const { settings } = await api("/api/site-settings");
      const section = document.createElement("section");
      section.className = "branding-controls";
      section.id = "store-branding";
      section.innerHTML = `<h2>Store branding</h2><p class="section-copy">Change the website name, logo initials, or use a public image URL for the logo and app icon.</p><form id="branding-form" class="form-card"><label>Website name <input name="siteName" maxlength="80" required value="${settings.site_name || "Online Hijab Store"}"></label><label>Logo initials / text <input name="logoText" maxlength="6" required value="${settings.logo_text || "OH"}"></label><label>Logo image URL (optional) <input name="logoImageUrl" type="url" placeholder="https://example.com/logo.png" value="${settings.logo_image_url || ""}"></label><button class="button">Save branding</button><p id="branding-message" class="form-message"></p></form>`;
      brandingControls.prepend(section);
      const form = section.querySelector("form");
      form.onsubmit = async (event) => {
        event.preventDefault();
        try {
          await api("/api/site-settings", {
            method: "PATCH",
            body: JSON.stringify(Object.fromEntries(new FormData(form))),
          });
          document.querySelector("#branding-message").textContent = "Branding saved.";
          showNotice("Website branding saved.");
          await applyBranding();
        } catch (error) {
          document.querySelector("#branding-message").textContent = error.message;
        }
      };
    })
    .catch(() => {});
const deleteAccountForm = document.querySelector("#delete-account-form");
if (deleteAccountForm)
  deleteAccountForm.onsubmit = async (event) => {
    event.preventDefault();
    const message = document.querySelector("#delete-account-message");
    if (!confirm("Delete your account permanently? This cannot be undone.")) return;
    try {
      await api("/api/me", {
        method: "DELETE",
        body: JSON.stringify({ password: new FormData(deleteAccountForm).get("password") }),
      });
      localStorage.setItem("northstar-logout-notice", "Your account has been deleted.");
      location.href = "index.html";
    } catch (error) {
      message.textContent = error.message;
    }
  };
if (adminMessage)
  api("/api/me")
    .then(async ({ user }) => {
      if (user?.role !== "admin") {
        adminMessage.textContent = "You must sign in as an administrator to access this page.";
        return;
      }
      document.querySelector("#admin-content").hidden = false;
      const { users } = await api("/api/users");
      document.querySelector("#user-list").innerHTML = users
        .map(
          (item) =>
            `<li><span><strong>${item.name}</strong><small>${item.email} · ${item.role}</small></span>${item.id === user.id ? "" : `<button class="role-button" data-id="${item.id}" data-role="${item.role === "admin" ? "customer" : "admin"}">${item.role === "admin" ? "Remove admin" : "Make admin"}</button>`}</li>`,
        )
        .join("");
      document.querySelectorAll(".role-button").forEach(
        (button) =>
          (button.onclick = async () => {
            await api(`/api/users/${button.dataset.id}/role`, {
              method: "PATCH",
              body: JSON.stringify({ role: button.dataset.role }),
            });
            location.reload();
          }),
      );
      const esc = (value) =>
        String(value ?? "").replace(
          /[&<>"']/g,
          (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
        );
      const orderNumber = (order) => `NS-${order.id.slice(0, 8).toUpperCase()}`;
      const orderDate = (iso) =>
        iso
          ? new Date(iso).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "";
      const emailNote = (email) =>
        email === "sent"
          ? "Customer emailed."
          : email === "failed"
            ? "The customer email FAILED — check your email settings."
            : "Email isn't set up, so no customer email was sent.";
      const orderCard = (order) => {
        const sent = order.status === "sent",
          packed = order.status === "packed",
          label = sent ? "Sent" : packed ? "Packed" : "New";
        const products = order.items
          .map(
            (item) =>
              `<li><span>${esc(item.name)}</span><strong>× ${esc(item.quantity)}</strong></li>`,
          )
          .join("");
        const actions = sent
          ? `<p class="order-meta">Tracking number: <strong>${esc(order.tracking_number)}</strong><br>Sent ${orderDate(order.shipped_at)}</p><button type="button" class="remove-archive" data-id="${esc(order.id)}">Delete archive</button>`
          : packed
            ? `<p class="order-meta">Packed ${orderDate(order.packed_at)} · awaiting delivery</p><div class="shipping-controls"><input data-tracking="${esc(order.id)}" placeholder="Tracking number" required><button class="ship-order" data-id="${esc(order.id)}">Mark sent & archive</button></div>`
            : `<button type="button" class="pack-order" data-id="${esc(order.id)}">Order has been packed</button>`;
        return `<details class="order-card" data-id="${esc(order.id)}"><summary><span class="order-name">${esc(order.customer_name)}</span><span class="order-summary-meta">${orderNumber(order)} · ${orderDate(order.created_at)}</span><span class="order-badge order-badge-${label.toLowerCase()}">${label}</span></summary><div class="order-body"><p class="order-meta">${esc(order.customer_email)}<br>${esc(order.delivery_address)}</p><h3>Products to pack</h3><ul class="order-products">${products}</ul><p class="order-total">Total <strong>${money(order.total_cents)}</strong></p>${actions}</div></details>`;
      };
      async function renderOrders(openId, closeId) {
        const wasOpen = new Set(
          [...document.querySelectorAll("details.order-card[open]")].map((card) => card.dataset.id),
        );
        if (openId) wasOpen.add(openId);
        if (closeId) wasOpen.delete(closeId);
        const { orders } = await api("/api/orders");
        const active = orders.filter((order) => order.status !== "sent"),
          archived = orders.filter((order) => order.status === "sent");
        document.querySelector("#order-list").innerHTML = active.length
          ? active.map(orderCard).join("")
          : "<p>No active orders.</p>";
        document.querySelector("#archive-list").innerHTML = archived.length
          ? archived.map(orderCard).join("")
          : "<p>No archived orders.</p>";
        document.querySelectorAll("details.order-card").forEach((card) => {
          if (wasOpen.has(card.dataset.id)) card.open = true;
        });
        document.querySelectorAll(".pack-order").forEach(
          (button) =>
            (button.onclick = async () => {
              if (!beginButtonLoading(button, "Packing…")) return;
              try {
                const { email } = await api(`/api/orders/${button.dataset.id}/pack`, {
                  method: "PATCH",
                });
                adminMessage.textContent = `Order marked as packed. ${emailNote(email)}`;
                await renderOrders(button.dataset.id);
              } catch (error) {
                adminMessage.textContent = error.message;
                finishButtonLoading(button);
              }
            }),
        );
        document.querySelectorAll(".ship-order").forEach(
          (button) =>
            (button.onclick = async () => {
              const input = document.querySelector(`[data-tracking="${button.dataset.id}"]`);
              if (!input.value.trim()) {
                adminMessage.textContent =
                  "Enter a tracking number before marking an order as sent.";
                input.focus();
                return;
              }
              try {
                const { email } = await api(`/api/orders/${button.dataset.id}/ship`, {
                  method: "PATCH",
                  body: JSON.stringify({ trackingNumber: input.value }),
                });
                adminMessage.textContent = `Order marked as sent and archived. ${emailNote(email)}`;
                await renderOrders(null, button.dataset.id);
              } catch (error) {
                adminMessage.textContent = error.message;
                finishButtonLoading(button);
              }
            }),
        );
        document.querySelectorAll(".remove-archive").forEach(
          (button) =>
            (button.onclick = async () => {
              if (!confirm("Permanently delete this archived order? This cannot be undone."))
                return;
              try {
                await api(`/api/orders/${button.dataset.id}`, { method: "DELETE" });
                showNotice("Archived order permanently deleted.");
                await renderOrders();
              } catch (error) {
                showNotice(error.message);
              }
            }),
        );
      }
      await renderOrders();
    })
    .catch(() => (adminMessage.textContent = "Unable to load admin controls."));
if (adminMessage)
  api("/api/me")
    .then(async ({ user }) => {
      if (user?.role !== "admin") return;
      const inventory = document.createElement("section");
      inventory.id = "inventory-controls";
      inventory.innerHTML =
        '<h2>Inventory</h2><p class="section-copy">Set the number available for each product. Zero automatically displays as Out of stock.</p><div id="inventory-list" class="cart-items"></div>';
      document.querySelector("#user-list").after(inventory);
      async function renderInventory() {
        const { products: catalog } = await api("/api/products");
        document.querySelector("#inventory-list").innerHTML = catalog
          .map(
            (product) =>
              `<div class=\"cart-item\"><span><strong>${product.name}</strong><small>${money(product.price_cents)}</small></span><span class=\"shipping-controls\"><input class=\"stock-input\" data-name=\"${product.name}\" type=\"number\" min=\"0\" value=\"${product.stock}\"><button class=\"save-stock\" data-name=\"${product.name}\">Save stock</button></span></div>`,
          )
          .join("");
        document.querySelectorAll(".save-stock").forEach(
          (button) =>
            (button.onclick = async () => {
              const input = document.querySelector(
                `.stock-input[data-name=\"${button.dataset.name}\"]`,
              );
              try {
                await api(`/api/products/${encodeURIComponent(button.dataset.name)}/stock`, {
                  method: "PATCH",
                  body: JSON.stringify({ stock: Number(input.value) }),
                });
                adminMessage.textContent = `${button.dataset.name} stock updated.`;
                renderInventory();
              } catch (error) {
                adminMessage.textContent = error.message;
              }
            }),
        );
      }
      await renderInventory();
    })
    .catch(() => {});

const brandingUploadTimer = setInterval(() => {
  const form = document.querySelector("#branding-form");
  if (!form || form.querySelector("#logo-file")) return;
  clearInterval(brandingUploadTimer);
  const label = document.createElement("label");
  label.innerHTML =
    'Upload logo image from device (PNG, JPG, WebP, or GIF; max 2 MB) <input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif">';
  form.querySelector("button").before(label);
  label.querySelector("input").onchange = (event) => {
    const file = event.target.files[0];
    const message = document.querySelector("#branding-message");
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      message.textContent = "Logo image must be 2 MB or smaller.";
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { logoImageUrl } = await api("/api/site-settings/logo-upload", {
          method: "POST",
          body: JSON.stringify({ imageData: reader.result }),
        });
        form.elements.logoImageUrl.value = logoImageUrl;
        message.textContent = "Image uploaded. Select Save branding to apply it.";
      } catch (error) {
        message.textContent = error.message;
      }
    };
    reader.readAsDataURL(file);
  };
}, 200);
setTimeout(() => clearInterval(brandingUploadTimer), 6000);

const productAdminTimer = setInterval(() => {
  const admin = document.querySelector("#admin-content");
  if (!admin) return;
  const users = document.querySelector("#user-list");
  if (!users || document.querySelector("#product-management")) return;
  const section = document.createElement("section");
  section.id = "product-management";
  section.className = "product-management";
  section.innerHTML = `<h2>Product management</h2><p class="section-copy">Add new products or edit existing products. Prices are in dollars.</p><form id="new-product-form" class="form-card"><h3>Add a product</h3><label>Name <input name="name" required></label><label>Category <select name="category"><option>Hijabs</option><option>Accessories</option></select></label><label>Price ($) <input name="price" type="number" min="0" step="0.01" required></label><label>Stock <input name="stock" type="number" min="0" step="1" required></label><label>Description <textarea name="description" rows="3"></textarea></label><label>Image URL (optional) <input name="imageUrl" type="url"></label><button class="button">Add product</button><p id="product-management-message" class="form-message"></p></form><div id="product-editor-list" class="cart-items"></div>`;
  users.after(section);
  const message = document.querySelector("#product-management-message");
  const form = document.querySelector("#new-product-form");
  async function renderProductEditors() {
    const { products: catalog } = await api("/api/products");
    document.querySelector("#product-editor-list").innerHTML = catalog
      .map(
        (item) =>
          `<details class="product-editor"><summary>${item.name} — ${money(item.price_cents)} — ${item.stock} in stock</summary><form class="edit-product-form" data-old-name="${item.name}" data-preorder-enabled="${item.preorder_enabled}"><label>Name <input name="name" required value="${item.name}"></label><label>Category <select name="category"><option ${item.category === "Hijabs" ? "selected" : ""}>Hijabs</option><option ${item.category === "Accessories" ? "selected" : ""}>Accessories</option></select></label><label>Price ($) <input name="price" type="number" min="0" step="0.01" required value="${(item.price_cents / 100).toFixed(2)}"></label><label>Stock <input name="stock" type="number" min="0" step="1" required value="${item.stock}"></label><label>Description <textarea name="description" rows="3">${item.description || ""}</textarea></label><label>Image URL <input name="imageUrl" type="url" value="${item.image_url || ""}"></label><button class="button">Save product</button></form></details>`,
      )
      .join("");
    document.querySelectorAll(".edit-product-form").forEach(
      (editForm) =>
        (editForm.onsubmit = async (event) => {
          event.preventDefault();
          try {
            const data = Object.fromEntries(new FormData(editForm));
            await api(`/api/products/${encodeURIComponent(editForm.dataset.oldName)}`, {
              method: "PATCH",
              body: JSON.stringify({
                name: data.name,
                category: data.category,
                priceCents: Math.round(Number(data.price) * 100),
                stock: Number(data.stock),
                description: data.description,
                imageUrl: data.imageUrl,
                preorderEnabled: data.preorderEnabled === "on",
              }),
            });
            message.textContent = "Product saved.";
            showNotice("Product updated.");
            renderProductEditors();
          } catch (error) {
            message.textContent = error.message;
          }
        }),
    );
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(form));
      await api("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          category: data.category,
          priceCents: Math.round(Number(data.price) * 100),
          stock: Number(data.stock),
          description: data.description,
          imageUrl: data.imageUrl,
          preorderEnabled: data.preorderEnabled === "on",
        }),
      });
      form.reset();
      message.textContent = "Product added.";
      showNotice("New product added.");
      renderProductEditors();
    } catch (error) {
      message.textContent = error.message;
    }
  };
  renderProductEditors();
}, 250);
setTimeout(() => clearInterval(productAdminTimer), 7000);

let removalControlsTries = 0;
const removalControlsTimer = setInterval(async () => {
  const productForms = [...document.querySelectorAll(".edit-product-form")];
  const archive = document.querySelector("#archive-list");
  if (!productForms.length && !archive) {
    if (++removalControlsTries > 35) clearInterval(removalControlsTimer);
    return;
  }
  productForms.forEach((form) => {
    if (form.querySelector(".remove-product")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "remove-product";
    button.textContent = "Remove product from store";
    button.onclick = async () => {
      const name = form.dataset.oldName;
      if (!confirm(`Remove “${name}” from sale? Past orders will remain unchanged.`)) return;
      try {
        await api(`/api/products/${encodeURIComponent(name)}`, { method: "DELETE" });
        showNotice("Product removed from the store.");
        form.closest("details").remove();
      } catch (error) {
        showNotice(error.message);
      }
    };
    form.append(button);
  });
}, 300);
setTimeout(() => clearInterval(removalControlsTimer), 12000);

// Stops a second tap from re-sending a shipping email while the first request is running.
document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest(".ship-order");
    if (!button) return;
    if (button.dataset.loading === "true") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const tracking = document.querySelector(`[data-tracking="${button.dataset.id}"]`);
    if (!tracking?.value.trim()) return;
    beginButtonLoading(button, "Sending…");
    setTimeout(() => {
      if (button.isConnected && button.dataset.loading === "true") finishButtonLoading(button);
    }, 15000);
  },
  true,
);

async function requestPreorder(button) {
  if (!beginButtonLoading(button, "Saving pre-order…")) return;
  try {
    const data = await api(`/api/products/${encodeURIComponent(button.dataset.product)}/preorder`, {
      method: "POST",
    });
    showNotice(data.message);
    button.textContent = "Pre-order saved";
  } catch (error) {
    if (/sign in/i.test(error.message)) {
      localStorage.setItem("northstar-after-login", location.pathname + location.search);
      location.href = "login.html";
      return;
    }
    showNotice(error.message);
    finishButtonLoading(button);
  }
}
function showProductAvailability(button, product) {
  const host = button.parentElement;
  button.dataset.stock = product.stock;
  productStock[product.name] = product.stock;
  let label = host.querySelector(".stock-label");
  if (!label) {
    label = document.createElement("p");
    label.className = "stock-label";
    button.before(label);
  }
  label.textContent = product.stock > 0 ? "In stock" : "Sold out";
  const quantity = host.querySelector(".quantity-picker");
  if (quantity) quantity.hidden = product.stock < 1;
  let preorder = host.querySelector(".preorder-product");
  if (product.stock > 0) {
    button.disabled = false;
    button.textContent = "Add to cart";
    preorder?.remove();
    return;
  }
  button.disabled = true;
  button.textContent = "Sold out";
  if (!product.preorder_enabled) {
    preorder?.remove();
    return;
  }
  if (!preorder) {
    preorder = document.createElement("button");
    preorder.type = "button";
    preorder.className = "preorder-product";
    preorder.dataset.product = product.name;
    preorder.textContent = "Pre-order";
    button.after(preorder);
  }
  preorder.onclick = () => requestPreorder(preorder);
}
async function syncStock() {
  try {
    const { products: catalog } = await api("/api/products");
    catalog.forEach((product) => {
      products[product.name] = product.price_cents;
      productStock[product.name] = product.stock;
      const button = document.querySelector(`.add-to-cart[data-product="${product.name}"]`);
      if (button) showProductAvailability(button, product);
    });
  } catch {
    /* Store pages remain usable if stock cannot be refreshed. */
  }
}
setTimeout(syncStock, 700);

const preorderAdminTimer = setInterval(() => {
  const newProduct = document.querySelector("#new-product-form");
  const editForms = document.querySelectorAll(".edit-product-form");
  if (!newProduct && !editForms.length) return;
  const addToggle = (form, enabled = true) => {
    if (form.querySelector("[name=preorderEnabled]")) return;
    const label = document.createElement("label");
    label.className = "checkbox-label";
    label.innerHTML = `<input name="preorderEnabled" type="checkbox" ${enabled ? "checked" : ""}> Show a Pre-order button when this product is sold out`;
    const description = form.querySelector("textarea[name=description]")?.closest("label");
    (description || form.querySelector("button")).before(label);
  };
  if (newProduct) addToggle(newProduct);
  editForms.forEach((form) => addToggle(form, form.dataset.preorderEnabled !== "0"));
  clearInterval(preorderAdminTimer);
}, 250);
setTimeout(() => clearInterval(preorderAdminTimer), 8000);

const preorderChartTimer = setInterval(async () => {
  const admin = document.querySelector("#admin-content");
  const inventory = document.querySelector("#inventory-controls");
  if (!admin || !inventory || document.querySelector("#preorder-demand")) return;
  try {
    const { demand } = await api("/api/preorders/demand");
    const section = document.createElement("section");
    section.id = "preorder-demand";
    section.className = "preorder-demand";
    section.innerHTML = `<h2>Pre-order demand</h2><p class="section-copy">Customer requests for sold-out products that have not yet been restocked.</p><div class="demand-chart">${demand.length ? demand.map((item) => `<div class="demand-row"><span>${item.product_name}</span><div class="demand-track"><i style="width:${Math.max(8, (item.requests / demand[0].requests) * 100)}%"></i></div><strong>${item.requests}</strong></div>`).join("") : "<p>No active pre-orders yet.</p>"}</div>`;
    inventory.after(section);
  } catch {}
}, 350);
setTimeout(() => clearInterval(preorderChartTimer), 8000);

if (document.body.classList.contains("admin-page-settings"))
  api("/api/me")
    .then(async ({ user }) => {
      if (user?.role !== "admin") return;
      const { settings } = await api("/api/site-settings");
      const content = document.querySelector("#admin-content");
      const section = document.createElement("section");
      section.id = "store-settings";
      section.className = "store-settings";
      section.innerHTML = `<h2>Store settings</h2><p class="section-copy">Control customer-facing messages and privacy choices.</p><form id="store-options-form" class="form-card"><label>Store announcement <textarea name="announcement" rows="3" maxlength="240" placeholder="Optional message shown across the store">${settings.store_announcement || ""}</textarea></label><label>Checkout delivery note <textarea name="checkoutNote" rows="3" maxlength="240" placeholder="Optional delivery information shown at checkout">${settings.checkout_note || ""}</textarea></label><button class="button">Save store settings</button><button id="open-cookie-settings" type="button">Cookie preferences</button><p id="store-settings-message" class="form-message"></p></form>`;
      content.prepend(section);
      const form = section.querySelector("form");
      form.onsubmit = async (event) => {
        event.preventDefault();
        try {
          await api("/api/store-options", {
            method: "PATCH",
            body: JSON.stringify(Object.fromEntries(new FormData(form))),
          });
          document.querySelector("#store-settings-message").textContent = "Store settings saved.";
          showNotice("Store settings saved.");
        } catch (error) {
          document.querySelector("#store-settings-message").textContent = error.message;
        }
      };
      section.querySelector("#open-cookie-settings").onclick = () =>
        (location.href = "cookie-settings.html");
    })
    .catch(() => {});

const cookieSettingsContent = document.querySelector("#cookie-settings-content");
if (cookieSettingsContent) {
  cookieSettingsContent.innerHTML = `<section class="form-card"><h2>Cookie and cart preferences</h2><p><strong>Necessary sign-in cookie:</strong> <code>mumstore_session</code> keeps you signed in securely for up to 180 days. It is required while you use an account.</p><p><strong>Saved cart:</strong> products in your cart are saved only in this browser using local storage.</p><button id="clear-cart-storage">Clear saved cart</button><button id="save-cookie-preferences" class="button">Save preferences</button><p id="cookie-settings-message" class="form-message"></p></section>`;
  cookieSettingsContent.querySelector("#clear-cart-storage").onclick = () => {
    cart = [];
    saveCart();
    renderCart();
    cookieSettingsContent.querySelector("#cookie-settings-message").textContent =
      "Saved cart cleared.";
  };
  cookieSettingsContent.querySelector("#save-cookie-preferences").onclick = () => {
    localStorage.setItem("northstar-cookie-notice", "acknowledged");
    cookieSettingsContent.querySelector("#cookie-settings-message").textContent =
      "Preferences saved.";
  };
}
