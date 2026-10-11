const { sign, getSession, setSessionCookie, sameOrigin, WEEK } = require('../lib/auth');

/**
 * GET  /api/auth                      → { authed, name, clientId }
 * POST /api/auth {action:'login'}     → Google ID 토큰 검증 후 세션 쿠키 발급
 * POST /api/auth {action:'logout'}    → 세션 쿠키 삭제
 */
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const clientId = process.env.GOOGLE_CLIENT_ID || '';

  if (req.method === 'GET') {
    const s = getSession(req);
    return res.status(200).json({ authed: !!s, name: s ? s.name : null, clientId });
  }
  if (req.method !== 'POST' || !sameOrigin(req)) return res.status(403).json({ error: 'forbidden' });

  const { action, credential } = req.body || {};
  if (action === 'logout') {
    setSessionCookie(res, '', 0);
    return res.status(200).json({ ok: true });
  }
  if (action !== 'login' || typeof credential !== 'string' || credential.length > 4000) {
    return res.status(400).json({ error: 'bad request' });
  }

  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!r.ok) return res.status(401).json({ error: '구글 로그인 확인에 실패했어요. 다시 시도해 주세요.' });
    const t = await r.json();

    const okIssuer = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
    if (!clientId || t.aud !== clientId || !okIssuer || String(t.email_verified) !== 'true' || !t.email) {
      return res.status(401).json({ error: '유효하지 않은 로그인 정보예요.' });
    }
    const email = String(t.email).toLowerCase();
    const domain = (process.env.ALLOWED_DOMAIN || '').trim().toLowerCase();
    if (domain && !email.endsWith('@' + domain)) {
      return res.status(403).json({ error: '@' + domain + ' 계정으로 로그인해 주세요.' });
    }

    const name = String(t.name || t.given_name || '학생').slice(0, 20);
    const token = sign({ uid: email, name: name, exp: Math.floor(Date.now() / 1000) + WEEK });
    setSessionCookie(res, token, WEEK);
    return res.status(200).json({ ok: true, name: name });
  } catch (e) {
    return res.status(500).json({ error: '로그인 처리 중 오류가 발생했어요.' });
  }
};
