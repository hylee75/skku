const { getSession, sameOrigin } = require('../lib/auth');

/** Apps Script 로 그대로 전달하는 동작들 (로그인한 사용자의 uid 가 서버에서 붙음) */
const FORWARD = new Set(['getBootstrap', 'saveRecord', 'setBookmark', 'saveProfile', 'saveRoadmap']);

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

async function callAppsScript(uid, name, action, args) {
  const url = process.env.APPS_SCRIPT_URL, token = process.env.API_TOKEN;
  if (!url || !token) throw new Error('서버 설정(APPS_SCRIPT_URL, API_TOKEN)이 필요해요.');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, uid, name, action, args }),
    redirect: 'follow'
  });
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error('Apps Script 응답을 읽지 못했어요. 웹 앱 배포 설정(액세스: 모든 사용자)을 확인해 주세요.'); }
  if (j.error) throw new Error(j.error === 'unauthorized' ? '서버 토큰이 일치하지 않아요(API_TOKEN).' : j.error);
  return j.data;
}

async function coachStar(d) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY 가 설정되지 않았어요.');
  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const prompt =
    '너는 대학생 포트폴리오 코치다. 아래 STAR+Reflection 초안을 읽고 JSON 으로만 답하라.\n' +
    '형식: {"summary":"한 줄 총평","tips":["보완 팁 3개 이내"],"rewrite_R":"성과(R)를 정량 표현으로 다듬은 한 문장"}\n' +
    '규칙: 없는 사실을 지어내지 말고, 부족한 정보는 팁으로 질문 형태로 제안한다. 한국어로 답한다.\n' +
    '--- 초안 ---\n활동: ' + clip(d.name, 120) +
    '\nS: ' + clip(d.S, 600) + '\nT: ' + clip(d.T, 600) + '\nA: ' + clip(d.A, 600) +
    '\nR: ' + clip(d.R, 600) + '\nReflection: ' + clip(d.F, 600);
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } })
  });
  if (!r.ok) throw new Error('Gemini 호출에 실패했어요(' + r.status + '). 키와 모델명을 확인해 주세요.');
  const j = await r.json();
  const text = j.candidates[0].content.parts[0].text;
  const out = JSON.parse(text.replace(/```json|```/g, '').trim());
  return {
    summary: clip(out.summary, 300),
    tips: (out.tips || []).slice(0, 3).map(t => clip(t, 300)),
    rewrite_R: clip(out.rewrite_R, 400)
  };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' || !sameOrigin(req)) return res.status(403).json({ error: 'forbidden' });
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: '로그인이 필요해요.' });

  const { action, args } = req.body || {};
  const a = Array.isArray(args) ? args : [];
  try {
    if (action === 'coachStar') return res.status(200).json({ data: await coachStar(a[0] || {}) });
    if (!FORWARD.has(action)) return res.status(400).json({ error: 'unknown action' });
    return res.status(200).json({ data: await callAppsScript(s.uid, s.name, action, a) });
  } catch (e) {
    return res.status(400).json({ error: e.message || '요청 처리에 실패했어요.' });
  }
};
