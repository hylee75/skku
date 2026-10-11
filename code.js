/**
 * SKKU Growth Log — Apps Script JSON API (Vercel 서버리스 함수에서만 호출)
 * 데이터: 구글 시트 "My_Records" 한 장에 누적 (User_ID 로 사용자 구분)
 * 스크립트 속성: API_TOKEN (Vercel 환경변수 API_TOKEN 과 같은 값)
 */

const SHEET_ID = '1KGN5uCW13aer18I0hsEy704wbAd7ic7G-8RzfDdrCCo';
const SHEET_NAME = 'My_Records';

const HEADERS = [
  'Record_ID', 'Timestamp', 'Semester_ID', 'User_ID', 'Activity_Type', 'Activity_Name',
  'Role_Tags', 'Tool_Tags', 'Method_Tags', 'Trouble_Tags',
  'S_Situation', 'T_Task', 'A_Action', 'R_Result', 'Reflection',
  'In_Score', 'Ui_Score', 'Ye_Score', 'Ji_Score',
  'Primary_Value', 'is_bookmarked', 'parent_record_id'
];

/* ───────── 태그 카탈로그: [칩 이름, 성균 가치, 세부 역량 태그] ───────── */
const TAGS = {
  role: [
    ['PM/팀장', '인', '리더십'], ['자료조사', '지', '논문_문헌분석'], ['기획', '지', '비즈니스모델기획'],
    ['실험/데이터분석', '지', '데이터분석'], ['개발/모델링', '지', '전공지식활용'], ['문서작성', '의', '꼼꼼한문서화'],
    ['발표', '예', '명확한의사전달'], ['디자인/콘텐츠', '예', '창의적표현'], ['운영/실행', '의', '책임감'],
    ['대외협력/소통', '예', '소통']
  ],
  tool: [
    ['Python', '지', '프로그래밍'], ['Excel', '지', '데이터분석'], ['SPSS', '지', '데이터분석'], ['Figma', '예', '시각화툴'],
    ['CAD', '지', '전공지식활용'], ['SEM', '지', '실험_분석'], ['XRD', '지', '실험_분석'], ['Tableau', '지', '시각화툴']
  ],
  method: [
    ['통계분석', '지', '데이터분석'], ['설문설계', '지', '설문설계'], ['수치해석', '지', '전공지식활용'],
    ['시뮬레이션', '지', '전공지식활용'], ['케이스스터디', '지', '논문_문헌분석'], ['시장조사', '지', '비즈니스모델기획'],
    ['데이터시각화', '예', '시각화툴'], ['타전공협업', '예', '협업']
  ],
  trouble: [
    ['오차 원인 규명', '지', '문제해결'], ['갈등 조율', '인', '의견조율'], ['일정 재조정', '의', '책임감'],
    ['접근 방식 피봇', '지', '문제해결'], ['피드백 반영', '의', '피드백수용'], ['우선순위 조정', '의', '책임감'],
    ['대안 도출', '지', '문제해결'], ['일정 준수', '의', '책임감']
  ]
};

/** 조합 규칙 → 성균 가치 자동 추천 */
const COMBOS = [
  { need: ['통계분석', '오차 원인 규명'], v: '지', tags: ['#지_데이터분석', '#지_문제해결'] },
  { need: ['갈등 조율', 'PM/팀장'], v: '인', tags: ['#인_리더십', '#인_의견조율'] },
  { need: ['타전공협업'], v: '예', tags: ['#예_협업', '#예_다양성존중'] },
  { need: ['일정 준수', '피드백 반영'], v: '의', tags: ['#의_책임감', '#의_피드백수용'] }
];

/** 진로별 핵심 가치(목표 120pt) + 동일 진로 학우 평균 스탯(데모용 기본값) */
const CAREERS = {
  '기업 취업': { core: ['지', '의'], peer: { 인: 55, 의: 85, 예: 60, 지: 100 } },
  '학술 연구/대학원': { core: ['지', '의'], peer: { 인: 40, 의: 90, 예: 45, 지: 115 } },
  '기술 창업': { core: ['지', '예'], peer: { 인: 60, 의: 55, 예: 90, 지: 95 } },
  '공공/사회혁신': { core: ['인', '의'], peer: { 인: 100, 의: 90, 예: 70, 지: 55 } }
};

const ACTIVITY_TYPES = {
  '수업/과제': { rec: ['#지_전공지식활용', '#의_책임감'], names: ['창의적융합디자인 프로젝트', '전공 캡스톤', '팀 프로젝트 과제'] },
  '비교과': { rec: ['#예_소통', '#인_멘토링'], names: ['글로벌 버디', 'HUSS 국외탐방', '챌린지스퀘어 멘토링'] },
  'URP/연구실': { rec: ['#지_오차원인규명', '#의_책임감'], names: ['모빌리티 융합 URP', '랩실 인턴십'] },
  '동아리/학회': { rec: ['#지_전공지식활용', '#지_문제해결'], names: ['소비자 분석 학회', '학술제 운영위원회'] }
};

/* ───────── API 진입점 ───────── */
let CURRENT_UID = '';
let CURRENT_NAME = '';

function doGet() { return json_({ ok: true }); }

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    const secret = props_().getProperty('API_TOKEN');
    if (!secret || b.token !== secret) return json_({ error: 'unauthorized' });
    CURRENT_UID = String(b.uid || '').toLowerCase().slice(0, 120);
    CURRENT_NAME = String(b.name || '').slice(0, 20);
    if (!CURRENT_UID) return json_({ error: 'uid required' });
    const a = b.args || [];
    let data;
    switch (b.action) {
      case 'getBootstrap': data = getBootstrap(); break;
      case 'saveRecord': data = saveRecord(a[0]); break;
      case 'setBookmark': data = setBookmark(a[0], a[1]); break;
      case 'saveProfile': data = saveProfile(a[0]); break;
      case 'saveRoadmap': data = saveRoadmap(a[0]); break;
      default: return json_({ error: 'unknown action' });
    }
    return json_({ data: data });
  } catch (err) {
    return json_({ error: String(err.message || err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ───────── 공통 유틸 ───────── */
function uid_() { return CURRENT_UID; }
function props_() { return PropertiesService.getScriptProperties(); }

function sheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0B4A3A').setFontColor('#ffffff');
  }
  return sh;
}

function str_(v, max) { return String(v == null ? '' : v).slice(0, max || 2000); }

function readRecords_(uid) {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const out = [];
  rows.forEach(function (row) {
    const o = {};
    HEADERS.forEach(function (h, i) {
      let v = row[i];
      if (v instanceof Date) v = Utilities.formatDate(v, 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ss");
      o[h] = v;
    });
    if (o.User_ID !== uid) return;
    ['In_Score', 'Ui_Score', 'Ye_Score', 'Ji_Score'].forEach(function (k) { o[k] = Number(o[k]) || 0; });
    o.is_bookmarked = String(o.is_bookmarked).toUpperCase() === 'TRUE';
    out.push(o);
  });
  return out;
}

function semesters_() {
  const out = [];
  for (let y = 2024; y <= 2027; y++) { out.push(y + '-1'); out.push(y + '-2'); }
  return out;
}

/* ───────── 부트스트랩: 화면 최초 로드 데이터 ───────── */
function getBootstrap() {
  const uid = uid_();
  const p = props_();
  const profile = JSON.parse(p.getProperty('profile:' + uid) ||
    JSON.stringify({ name: CURRENT_NAME || '학생', career: '기업 취업', grade: 3, goalTags: ['글로벌', '데이터분석'] }));
  const roadmap = JSON.parse(p.getProperty('roadmap:' + uid) || JSON.stringify({ career: profile.career, nodes: [], links: [] }));
  return {
    uid: uid,
    config: { tags: TAGS, combos: COMBOS, careers: CAREERS, types: ACTIVITY_TYPES, semesters: semesters_() },
    profile: profile,
    roadmap: roadmap,
    records: readRecords_(uid),
    notices: noticesDb_(),
    seniors: seniorsDb_()
  };
}

/* ───────── 기록 저장 / 북마크 ───────── */
function saveRecord(rec) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!rec || !str_(rec.Activity_Name).trim()) throw new Error('활동명을 입력해 주세요.');
    const join = function (a) { return Array.isArray(a) ? a.map(function (x) { return str_(x, 60); }).join(', ') : str_(a, 500); };
    const sc = function (k) { return Math.max(0, Math.min(200, Number(rec[k]) || 0)); };
    const row = {
      Record_ID: 'R' + Utilities.getUuid().replace(/-/g, '').slice(0, 8),
      Timestamp: Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ss"),
      Semester_ID: str_(rec.Semester_ID, 12),
      User_ID: uid_(),
      Activity_Type: str_(rec.Activity_Type, 30),
      Activity_Name: str_(rec.Activity_Name, 120),
      Role_Tags: join(rec.Role_Tags), Tool_Tags: join(rec.Tool_Tags),
      Method_Tags: join(rec.Method_Tags), Trouble_Tags: join(rec.Trouble_Tags),
      S_Situation: str_(rec.S_Situation), T_Task: str_(rec.T_Task), A_Action: str_(rec.A_Action),
      R_Result: str_(rec.R_Result), Reflection: str_(rec.Reflection),
      In_Score: sc('In_Score'), Ui_Score: sc('Ui_Score'), Ye_Score: sc('Ye_Score'), Ji_Score: sc('Ji_Score'),
      Primary_Value: str_(rec.Primary_Value, 4),
      is_bookmarked: 'FALSE',
      parent_record_id: str_(rec.parent_record_id, 20)
    };
    const sh = sheet_();
    const r = sh.getLastRow() + 1;
    const range = sh.getRange(r, 1, 1, HEADERS.length);
    range.setNumberFormat('@'); // '2026-1' 이 날짜로 자동 변환되는 것 방지
    range.setValues([HEADERS.map(function (h) { return String(row[h]); })]);
    row.is_bookmarked = false;
    return row;
  } finally {
    lock.releaseLock();
  }
}

function setBookmark(recordId, flag) {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return false;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  const col = HEADERS.indexOf('is_bookmarked') + 1;
  const uidCol = HEADERS.indexOf('User_ID') + 1;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === recordId && sh.getRange(i + 2, uidCol).getValue() === uid_()) {
      sh.getRange(i + 2, col).setNumberFormat('@').setValue(flag ? 'TRUE' : 'FALSE');
      return true;
    }
  }
  return false;
}

/* ───────── 프로필 / 로드맵 저장 (시트 1장 원칙 → 사용자 속성에 JSON) ───────── */
function saveProfile(profile) {
  const clean = {
    name: str_(profile.name, 20) || '학생',
    career: CAREERS[profile.career] ? profile.career : '기업 취업',
    grade: Math.max(1, Math.min(4, Number(profile.grade) || 1)),
    goalTags: (profile.goalTags || []).slice(0, 6).map(function (t) { return str_(t, 20); })
  };
  props_().setProperty('profile:' + uid_(), JSON.stringify(clean));
  return clean;
}

function saveRoadmap(json) {
  const data = JSON.parse(json);
  const clean = {
    career: CAREERS[data.career] ? data.career : '기업 취업',
    nodes: (data.nodes || []).slice(0, 80),
    links: (data.links || []).slice(0, 120)
  };
  const s = JSON.stringify(clean);
  if (s.length > 8500) throw new Error('로드맵이 너무 커서 저장할 수 없습니다. 일부 노드를 정리해 주세요.');
  props_().setProperty('roadmap:' + uid_(), s);
  return true;
}

/* ───────── Activities DB (공지) / 선배 벤치마크 — 샘플 시드 ─────────
 * 운영 시에는 별도 탭/외부 크롤링으로 교체하세요. deadline 은 오늘 기준 +N일 */
function dday_(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
}

function noticesDb_() {
  return [
    { id: 'N1', source: '학교/학부대학', title: '글로벌 버디 3기 모집', grades: [1, 2, 3, 4], deadline: dday_(5), tags: ['#예_소통', '#예_협업', '#글로벌'], url: '#', type: '비교과' },
    { id: 'N2', source: '챌린지스퀘어', title: '후배 멘토링 프로그램', grades: [2, 3, 4], deadline: dday_(9), tags: ['#인_멘토링', '#인_팀원케어', '#경청_수용'], url: '#', type: '멘토링' },
    { id: 'N3', source: '성균융합원/랩실', title: '2학기 URP 학부연구생 모집', grades: [2, 3, 4], deadline: dday_(3), tags: ['#지_오차원인규명', '#지_논문_문헌분석', '#의_책임감'], url: '#', type: 'URP' },
    { id: 'N4', source: '교외 플랫폼', title: '오픈데이터 분석 공모전', grades: [1, 2, 3, 4], deadline: dday_(21), tags: ['#지_프로그래밍', '#데이터분석', '#지_시각화툴'], url: '#', type: '공모전' },
    { id: 'N5', source: '소속 학과', title: '전공 학술동아리 신규 팀원 모집', grades: [1, 2], deadline: dday_(12), tags: ['#지_전공지식활용', '#예_타전공협업'], url: '#', type: '학회' },
    { id: 'N6', source: '학교/학부대학', title: 'HUSS 국외탐방 참가자 모집', grades: [2, 3, 4], deadline: dday_(30), tags: ['#글로벌', '#문제의식', '#예_다양성존중'], url: '#', type: '비교과' },
    { id: 'N7', source: '교외 플랫폼', title: 'AI 부트캠프 (Python 입문)', grades: [1, 2, 3, 4], deadline: dday_(16), tags: ['#지_프로그래밍', '#지_비즈니스모델기획'], url: '#', type: '부트캠프' },
    { id: 'N8', source: '챌린지스퀘어', title: '지역사회 봉사 리더 양성', grades: [1, 2, 3, 4], deadline: dday_(7), tags: ['#인_리더십', '#인_공감', '#의_책임감'], url: '#', type: '봉사' }
  ];
}

function seniorsDb_() {
  return [
    {
      id: 'S1', title: '비전공에서 출발해 AI 개발자로 진출한 3년 로드맵',
      sub: '공학계열 · 소프트웨어 전공 / 4학년 선배', mix: { 지: 70, 의: 30 }, url: '#',
      steps: [
        { y: '1학년', items: ['프로그래밍 기초 수업 이수', '학생성공센터 자기주도 학습 동아리'] },
        { y: '2학년', items: ['교내 AI 해커톤 출전', '오픈데이터 분석 공모전 입상'] },
        { y: '3학년', items: ['모빌리티 융합 URP 학부연구생 참여'] }
      ]
    },
    {
      id: 'S2', title: '교환학생에서 국제기구 인턴까지, 글로벌 스토리',
      sub: '인문계열 · 미디어 전공 / 4학년 선배', mix: { 인: 40, 예: 60 }, url: '#',
      steps: [
        { y: '1학년', items: ['글로벌 버디 활동', '영어 토론 동아리'] },
        { y: '2학년', items: ['교환학생(영국)', '청년시청자위원회'] },
        { y: '3학년', items: ['국제하계학기 TA', 'HUSS 국외탐방'] }
      ]
    },
    {
      id: 'S3', title: '학부연구생 2년, 대학원 진학 준비 기록',
      sub: '자연계열 · 신소재 전공 / 4학년 선배', mix: { 지: 60, 의: 40 }, url: '#',
      steps: [
        { y: '2학년', items: ['전공실습 우수 조 선정', 'XRD/SEM 교육 이수'] },
        { y: '3학년', items: ['URP 학부연구생', '학회 포스터 발표'] }
      ]
    }
  ];
}
