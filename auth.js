const crypto = require('crypto');

const WEEK = 7 * 24 * 3600;

function hmac(body) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET(32자 이상)이 설정되지 않았습니다.');
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + hmac(body);
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(hmac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch (e) { return null; }
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(function (c) {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}

function getSession(req) {
  try { return verify(parseCookies(req).sid); } catch (e) { return null; }
}

function setSessionCookie(res, token, maxAge) {
  res.setHeader('Set-Cookie', 'sid=' + token + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + maxAge);
}

/** 다른 사이트에서 온 요청 차단 (CSRF 보조 방어) */
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

module.exports = { sign, getSession, setSessionCookie, sameOrigin, WEEK };
