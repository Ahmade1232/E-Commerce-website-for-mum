# Online Web Store

## Run locally

1. Install dependencies: `npm install`
2. Start the server: `npm start`
3. Open `http://localhost:3000` in a browser.

For development with automatic server restarts, use `npm run dev` (Node.js 18+).

## Test from another network

The server listens on `0.0.0.0` by default, so it is ready for a router port-forward. Set `PORT=3000` and `HOST=0.0.0.0` in `.env`, then create a router rule that forwards TCP port 3000 to this PC's local IP address. Allow Node.js through Windows Firewall when prompted.

Set `SITE_URL` to the public URL and port supplied by your router or test domain; password-reset links use this value. Use a temporary test account only: direct port forwarding exposes the site publicly and does not provide HTTPS. For real customers, use HTTPS hosting or a secure tunnel instead.

## Pages

- `server.js` — Express server
- `public/index.html` — landing page
- `public/about.html`, `browse.html`, `cart.html`, and `login.html` — separate customer pages
- `public/admin.html` — protected administrator page

## Accounts, admins, and orders

The first account registered is an administrator. Only administrators can open the admin page, view orders, view users, or promote another user to administrator. The database is created automatically as `store.db` when you start the server. It stores user accounts and submitted orders locally.

## Order notification email

Copy `.env.example` to `.env`, fill in your actual receiving address and SMTP settings, then start the server with:

```powershell
node --env-file=.env server.js
```

The order is always saved to SQLite first. If email configuration is absent or SMTP fails, the order remains available to administrators in `admin.html`.

Never publish your `.env` file or SMTP password. Before placing this site on the public internet, add HTTPS, persistent server-side sessions, rate limits, password reset, and a production database.

## Install on iPhone

After the site is deployed to a public HTTPS address, open it in Safari on your iPhone, tap **Share**, then choose **Add to Home Screen**. This installs Northstar as an app-style shortcut. Admin access still requires an administrator account.

The website must be hosted on an always-on public server for travelling access. A server running on this PC is only available while the PC is on and, by default, only on your local Wi-Fi.

The cart and user management are front-end demos only. Connect them to a database and authentication provider before using them in production.
