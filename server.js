const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const USERNAME = process.env.LOGIN_USERNAME || '';
const PASSWORD = process.env.LOGIN_PASSWORD || '';
const COOKIE_SECRET = process.env.SESSION_SECRET || 'dev-only-secret-change-me';
// Empty locally (app mounted at domain root). In Coolify, set to "/brood" —
// Traefik strips that prefix before the container sees the request, so this
// only affects the <base href> tag (fixes relative asset paths when a
// visitor hits the bare "/brood" with no trailing slash). Same pattern as
// 1001 Albums — see the Coolify Hosting Playbook's "relative-asset-path trap".
const BASE_PATH = process.env.BASE_PATH || '';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

if (!USERNAME || !PASSWORD) {
  console.warn('LOGIN_USERNAME / LOGIN_PASSWORD not set — login will always fail.');
}

const PUBLIC_DIR = path.join(__dirname, 'public');

function sendWithBaseHref(res, filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  res.type('html').send(html.replace('<!--BASE_HREF-->', `<base href="${BASE_PATH}/">`));
}

const app = express();
app.use(cookieParser(COOKIE_SECRET));
app.use(express.urlencoded({ extended: false }));

// Assets and routes the login page itself needs, reachable without auth.
app.get('/login', (req, res) => {
  sendWithBaseHref(res, path.join(PUBLIC_DIR, 'login.html'));
});
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'style.css'));
});
app.get('/img/login-banner.png', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'img', 'login-banner.png'));
});
app.get('/img/background.png', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'img', 'background.png'));
});
app.get('/img/brood-favicon.png', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'img', 'brood-favicon.png'));
});

app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body;
  const ok = username.trim().toLowerCase() === USERNAME.toLowerCase() && password === PASSWORD;
  if (!ok) {
    return res.redirect('/login?error=1');
  }
  res.cookie('auth', '1', {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: THIRTY_DAYS_MS,
  });
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  res.clearCookie('auth');
  res.redirect('/login');
});

function requireAuth(req, res, next) {
  if (req.signedCookies.auth === '1') return next();
  res.redirect('/login');
}

app.get('/', requireAuth, (req, res) => {
  sendWithBaseHref(res, path.join(PUBLIC_DIR, 'index.html'));
});

app.use(requireAuth, express.static(PUBLIC_DIR, { index: false }));

app.listen(PORT, () => console.log(`Brood listening on :${PORT}`));
