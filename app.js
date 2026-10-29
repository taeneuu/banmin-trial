/* 반민특위 재판정 — 게임 로직 (v2 리디자인)
 * 판정 규칙과 저장 구조는 v1과 같다. 화면과 연출만 새로 만들었다.
 */
(() => {
'use strict';

const KEY = 'banmin-trial-v2';
/* 선생님 제출용 Apps Script 웹 앱 주소 (광복 1945와 같은 스프레드시트, '반민특위 재판정' 시트에 저장). 바꾸려면 이 줄만 고치면 된다. */
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbyh_7Yly5B_uegiPNIdX8DtRPn2vvc4tA7PGyN4wqyhrB1G2-dQVJOlpbMNA_mX6s9d/exec';
const MAX_CHANCES = 4;
const LOCKER_MAX = 6;
const MISSIONS = [
  { n: 1, short: '사건 파일', title: '사건 파일: 수사 개시', desc: '박흥식의 행적을 담은 자료를 열람하고, 혐의를 입증할 증거를 채택하세요.' },
  { n: 2, short: '증거 조합', title: '증거 조합: 연결되는 단서', desc: '증거와 증거, 증거와 법 조항을 이어 붙여 혐의를 세우세요.' },
  { n: 3, short: '기소장 작성', title: '기소장 작성: 법적 책임을 입증하라', desc: '적용 조항·증거·기소 이유를 골라 기소장을 완성하세요.' },
  { n: 4, short: '구형 의견', title: '구형 의견: 어떤 형벌을 제안할까?', desc: '법정에서 법정형 범위 안의 형벌과 그 이유를 밝히세요.' },
  { n: 5, short: '역사의 결말', title: '역사의 결말: 실제 재판과 비교', desc: '1949년의 실제 재판 결과를 확인하고, 생각을 남기세요.' },
];
const REQUIRED_LINKS = [
  { key: 'K1', label: '조선비행기공업은 어떤 회사였나? (회사 기록끼리 연결)' },
  { key: 'K2', label: '핵심 혐의: 회사 기록 + 알맞은 법 조항' },
  { key: 'K3', label: '보조 혐의: 단체 활동 또는 기고문 + 알맞은 법 조항' },
];
const SCREEN_TITLE = {
  dash: ['사건 대시보드', '반민 사건 제1호 · 박흥식'],
  m1: ['MISSION 1', '사건 파일: 수사 개시'], m2: ['MISSION 2', '증거 조합: 연결되는 단서'],
  m3: ['MISSION 3', '기소장 작성'], m4: ['MISSION 4', '구형 의견'],
  m5: ['MISSION 5', '역사의 결말'], end: ['사건 종결', '수사 결과'], fail: ['수사 실패', '보완이 필요해요'],
};

/* ---------- state ---------- */
const fresh = () => ({
  screen: 'title', reached: 0, done: {}, line: 0,
  organ: { matched: {}, sel: null, quiz: null },
  trial: { round: 0, hp: TRIAL_HP, wrong: [], solved: false, picked: null, sorted: {}, lastWhy: null },
  viewed: [], locker: [], current: null, cat: 'all',
  pick: [], tried: [], found: {}, lastVerdict: null, lastPair: null, missStreak: 0,
  chances: MAX_CHANCES, mistakes: [],
  ind: { main: '', extra: [], ev: [], reason: '' },
  sent: { type: '', years: '', conf: '', reason: '' },
  reflection: '', failed: false, name: '', submittedAt: '', flowVer: 2, chaseFails: 0,
});
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const old = JSON.parse(raw);
      const st = Object.assign(fresh(), old);
      if (!old.flowVer) { if (st.reached >= 4) st.reached += 2; st.flowVer = 2; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
      return st;
    }
  } catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const stepIdx = id => FLOW.findIndex(f => f.id === id);
const stepOf = id => FLOW.find(f => f.id === id);
const curId = () => (FLOW[S.reached] || FLOW[FLOW.length - 1]).id;
const chOf = id => CHAPTERS[(stepOf(id) || FLOW[0]).ch - 1];
function advance(id) {
  S.done[id] = true;
  const i = stepIdx(id);
  S.reached = Math.max(S.reached, i + 1);
  S.line = 0; save();
  go(i + 1 < FLOW.length ? FLOW[i + 1].id : 'end');
}

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ev = id => EVIDENCE[id];
const label = id => id.startsWith('L') ? `${LAWS[id].short} ${LAWS[id].name}` : EVIDENCE[id].title;
const stageItems = st => Object.keys(EVIDENCE).filter(id => EVIDENCE[id].stage <= st);
const CAT_NAME = { news: '신문·사진', biz: '기업 기록', doc: '공문서·단체', etc: '기타' };
const ROLE_TAG = { core: ['core', '핵심 증거'], support: ['support', '보조 자료'], issue: ['support', '보조 자료'], noise: ['noise', '참고 자료'] };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200);
}
function flash() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

/* images: lazy, with fallback panel */
function img(key, size = 'small', alt = '', eager = false) {
  const im = IMAGES[key]; if (!im) return '';
  return `<img src="${im[size]}" alt="${esc(alt || im.title)}" loading="${eager ? 'eager' : 'lazy'}" ${eager ? 'fetchpriority="high"' : ''} decoding="async" data-fb="${esc(im.title)}">`;
}
document.addEventListener('error', e => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.dataset.fb !== undefined) {
    const d = document.createElement('div'); d.className = 'img-fail'; d.style.cssText = 'width:100%;height:100%;min-height:80px';
    d.textContent = '이미지를 불러오지 못했어요 · ' + t.dataset.fb;
    t.replaceWith(d);
  }
}, true);
function sceneBg(key, size = 'big') {
  const im = IMAGES[key];
  return `<div class="scene-bg" aria-hidden="true">${img(key, size, '', true)}</div>
    <div class="photo-credit">배경 사진: ${esc(im.title)} (${esc(im.date)}) · ${esc(im.credit)}</div>`;
}

/* illustration thumbnails (clearly not historical records) */
const ILLU = {
  company: '<svg viewBox="0 0 100 70"><path d="M8 62h84" stroke="#6b5530" stroke-width="3"/><path d="M14 62V34l16 9V34l16 9V34l16 9V22h10v40" fill="#c9b48a" stroke="#6b5530" stroke-width="2.5"/><path d="M58 18l26-6 4 3-26 8z M70 10l4 10" fill="#8a2e25" stroke="#5a1d17" stroke-width="2"/></svg>',
  official: '<svg viewBox="0 0 100 80"><rect x="18" y="6" width="64" height="70" rx="3" fill="#fbf4e2" stroke="#6b5530" stroke-width="2.5"/><path d="M28 20h44M28 30h44M28 40h30M28 50h36" stroke="#9a8460" stroke-width="3"/><circle cx="66" cy="60" r="10" fill="none" stroke="#a33a2b" stroke-width="3"/><text x="66" y="64" font-size="10" text-anchor="middle" fill="#a33a2b" font-weight="900">印</text></svg>',
  org: '<svg viewBox="0 0 100 80"><rect x="16" y="10" width="68" height="62" rx="3" fill="#fbf4e2" stroke="#6b5530" stroke-width="2.5"/><path d="M26 22h48" stroke="#2b2620" stroke-width="4"/><g fill="#9a8460"><circle cx="30" cy="36" r="4"/><circle cx="30" cy="48" r="4"/><circle cx="30" cy="60" r="4"/></g><path d="M40 36h32M40 48h28M40 60h30" stroke="#9a8460" stroke-width="3"/></svg>',
  ledger: '<svg viewBox="0 0 100 80"><rect x="14" y="10" width="72" height="60" rx="3" fill="#fbf4e2" stroke="#6b5530" stroke-width="2.5"/><path d="M50 10v60M14 26h72" stroke="#6b5530" stroke-width="2"/><path d="M22 36h20M22 46h20M22 56h20M58 36h20M58 46h20M58 56h20" stroke="#9a8460" stroke-width="3"/><text x="68" y="23" font-size="11" text-anchor="middle" fill="#a33a2b" font-weight="900">圓</text></svg>',
  school: '<svg viewBox="0 0 100 70"><path d="M10 64h80" stroke="#6b5530" stroke-width="3"/><rect x="20" y="30" width="60" height="34" fill="#c9b48a" stroke="#6b5530" stroke-width="2.5"/><path d="M14 32L50 10l36 22z" fill="#8a6a3e" stroke="#6b5530" stroke-width="2.5"/><path d="M30 40h10v10H30zM60 40h10v10H60zM45 46h10v18H45z" fill="#fbf4e2" stroke="#6b5530" stroke-width="2"/></svg>',
  family: '<svg viewBox="0 0 100 80"><rect x="26" y="6" width="48" height="66" rx="4" fill="#efe1bf" stroke="#6b5530" stroke-width="4"/><circle cx="50" cy="32" r="11" fill="#9a8460"/><path d="M32 66c2-14 10-20 18-20s16 6 18 20" fill="#9a8460"/></svg>',
};
function illu(type) {
  return `<div class="illu">${ILLU[type] || ILLU.official}<span class="lbl tag illut">일러스트</span></div>`;
}
function visual(id, size = 'small') {
  const v = EVIDENCE_VISUAL[id] || { illu: 'official' };
  if (v.img) {
    const im = IMAGES[v.img];
    return `${img(v.img, size)}<span class="tag ${im.kind === 'source' ? 'src' : 'refimg'}" style="position:absolute;left:6px;bottom:6px">${im.kind === 'source' ? '사료 사진' : '참고 이미지'}</span>`;
  }
  return illu(v.illu);
}

/* mascot: 수사견 누리 (original character) */
function mascotSVG(mood = 'happy') {
  const eyes = mood === 'sad'
    ? '<path d="M41 47q4-3 8 0M63 47q4-3 8 0" stroke="#2b2620" stroke-width="3" fill="none" stroke-linecap="round"/>'
    : mood === 'wow'
      ? '<circle cx="45" cy="47" r="4.5" fill="#2b2620"/><circle cx="67" cy="47" r="4.5" fill="#2b2620"/><circle cx="46.5" cy="45.5" r="1.4" fill="#fff"/><circle cx="68.5" cy="45.5" r="1.4" fill="#fff"/>'
      : '<path d="M41 48q4-5 8 0M63 48q4-5 8 0" stroke="#2b2620" stroke-width="3" fill="none" stroke-linecap="round"/>';
  const mouth = mood === 'sad' ? '<path d="M50 66q6-4 12 0" stroke="#2b2620" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    : '<path d="M49 62q3 5 7 1q4 4 7-1" stroke="#2b2620" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M53 66q3 6 6 0" fill="#e86a6a"/>';
  return `<svg viewBox="0 0 112 132" role="img" aria-label="수사견 누리">
    <ellipse cx="56" cy="126" rx="34" ry="5" fill="rgba(0,0,0,.18)"/>
    <path d="M30 84q-4 40 26 42q30-2 26-42z" fill="#e0913f"/>
    <path d="M42 92q14 10 28 0q2 22-14 30q-16-8-14-30z" fill="#fbf1de"/>
    <path d="M78 104q20-4 18-24q-4 8-14 10z" fill="#e0913f"/>
    <path d="M22 26l8-22 20 18z M90 26l-8-22-20 18z" fill="#c8732a"/>
    <path d="M27 22l4-12 10 10z M85 22l-4-12-10 10z" fill="#f7c9a4"/>
    <ellipse cx="56" cy="50" rx="36" ry="32" fill="#e0913f"/>
    <path d="M30 56q2 22 26 24q24-2 26-24q-8 6-26 6t-26-6z" fill="#fbf1de"/>
    <ellipse cx="38" cy="58" rx="5" ry="3" fill="#f2a28c" opacity=".7"/><ellipse cx="74" cy="58" rx="5" ry="3" fill="#f2a28c" opacity=".7"/>
    ${eyes}<ellipse cx="56" cy="57" rx="5" ry="3.6" fill="#2b2620"/>${mouth}
    <path d="M30 82q26 12 52 0l2 8q-28 12-56 0z" fill="#2f5d8a"/><path d="M70 86l10 14-14-4z" fill="#27507a"/>
    <path d="M24 22q32-16 64 0l-4 6q-28-12-56 0z" fill="#3a2f26"/><rect x="34" y="12" width="44" height="10" rx="4" fill="#4a3c30"/>
  </svg>`;
}
function mascot(text, mood = 'happy', size = 86, bob = true, center = false) {
  return `<div class="mascot ${bob ? 'bob' : ''}" style="--ms:${size}px${center ? ';justify-content:center' : ''}">${mascotSVG(mood)}${text ? `<div class="bubble">${text}</div>` : ''}</div>`;
}

/* modal */
function modal(html, buttons = [{ text: '확인' }], opts = {}) {
  const m = $('#modal'), box = $('.modal-box', m), body = $('#modalBody');
  box.classList.toggle('narrow', !!opts.narrow);
  body.innerHTML = html + (buttons.length ? `<div class="row" style="margin-top:20px;justify-content:flex-end">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-mi="${i}">${b.text}</button>`).join('')}</div>` : '');
  m.hidden = false; box.scrollTop = 0;
  body.querySelectorAll('[data-mi]').forEach(btn => btn.addEventListener('click', () => { closeModal(); const b = buttons[+btn.dataset.mi]; if (b.fn) b.fn(); }));
  if (opts.bind) opts.bind(body);
  const first = body.querySelector('[data-mi]') || $('#modalX'); first.focus();
}
function closeModal() { $('#modal').hidden = true; }
$('#modalX').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

let animateNext = true;
function go(screen, fx = true, keepLine = false) {
  const i = stepIdx(screen);
  if (i > S.reached) screen = curId();
  if (screen === 'end' && !S.done.m5) screen = 'dash';
  if (!keepLine && stepOf(screen) && stepOf(screen).type === 'scene' && S.screen !== screen) S.line = 0;
  S.screen = screen; save(); animateNext = true;
  if (fx) flash();
  render();
  window.scrollTo({ top: 0 }); app.focus({ preventScroll: true });
}

function spend(mission, issues) {
  mission = typeof mission === 'number' ? ({ 1: 'm1', 3: 'm3', 4: 'm4' })[mission] : mission;
  S.chances -= 1;
  S.mistakes.push({ mission, issues: issues.map(i => ({ text: i.text, recheck: i.recheck || [] })) });
  if (S.chances <= 0) { S.failed = true; S.screen = 'fail'; }
  save();
}
const chancesLeftText = () => S.chances > 0 ? `남은 보완 조사 기회: ${S.chances}번` : '보완 조사 기회를 모두 썼어요.';

/* ---------- HUD ---------- */
function renderHud() {
  const scr = S.failed ? 'fail' : S.screen;
  $('#hud').hidden = scr === 'title';
  const st = stepOf(scr);
  let t;
  if (st) { const ch = CHAPTERS[st.ch - 1]; t = [`${ch.n}장 · ${ch.title}`, st.title, ch.role]; }
  else t = ({ dash: ['사건 대시보드', '반민 사건 제1호 · 박흥식'], end: ['사건 종결', '수사 결과'], fail: ['수사 실패', '보완이 필요해요'] })[scr] || ['', ''];
  $('#hudTitle').innerHTML = `<small>${esc(t[0])}</small>${esc(t[1])}${t[2] ? `<span class="rolebadge">${esc(t[2])}</span>` : ''}`;
  $('#hudChances').innerHTML = Array.from({ length: MAX_CHANCES }, (_, i) => `<span class="mg ${i < S.chances ? '' : 'used'}">🔍</span>`).join('');
  $('#hudChances').title = chancesLeftText();
  $('#hudCount').textContent = `${S.locker.length}/${LOCKER_MAX}`;
  const onDash = scr === 'dash';
  $('#hudLocker').classList.toggle('on', onDash);
  $('#hudLockerTxt').textContent = onDash ? '← 돌아가기' : '대시보드 · 증거';
  $('#hudLocker').setAttribute('aria-label', onDash ? '하던 곳으로 돌아가기' : '사건 대시보드와 증거 보관함 열기');
}
let returnTo = null, returnLine = null;
$('#hudLocker').addEventListener('click', () => {
  if (S.screen === 'dash' && !S.failed) {
    const back = returnTo && returnTo !== 'dash' ? returnTo : (S.done.m5 ? 'end' : curId());
    go(back, true, back === returnTo && returnLine !== null);
    if (back === returnTo && returnLine !== null && stepOf(back) && stepOf(back).type === 'scene') { S.line = returnLine; save(); render(); }
    return;
  }
  returnTo = S.failed ? null : S.screen;
  returnLine = stepOf(S.screen) && stepOf(S.screen).type === 'scene' ? S.line : null;
  go('dash');
});

function render() {
  stopRoundTimers();
  renderHud();
  const scr = S.failed ? 'fail' : S.screen;
  const st = stepOf(scr);
  const v = st ? ({ scene: () => vScene(scr), chase: vChase, organs: vOrgans, trial: vTrial, m1: vM1, m2: vM2, m3: vM3, m4: vM4, m5: vM5 })[st.type]
    : ({ title: vTitle, dash: vDash, end: vEnd, fail: vFail }[scr] || vDash);
  app.innerHTML = v();
  if (!animateNext) $$('.enter', app).forEach(el => el.classList.remove('enter'));
  animateNext = false;
  document.body.dataset.screen = scr;
  bind();
  if (scr === 'm2') requestAnimationFrame(drawStrings);
  if (st && st.type === 'scene') startTyping();
  if (scr === 'trial') startRoundTimers();
  if (scr === 'chase') bindChase();
}

/* ---------- TITLE ---------- */
function vTitle() {
  const started = S.reached > 0 || S.line > 0;
  return `<section class="scene title-scene">${sceneBg('hwashin')}
  <div class="wrap title-wrap enter">
    <div>
      <div class="game-tag"><i></i>역사 추리 게임<i></i></div>
      <h1 class="logo"><span>1949</span>반민특위 재판정</h1>
      <p class="tagline">1949년, 친일 청산의 증거를 찾아라.</p>
      <div class="row" style="justify-content:inherit">
        <button class="btn orange big" data-act="start">${started ? '수사 이어서 하기' : '수사 시작'} →</button>
        ${started ? '<button class="btn ghost" data-act="reset">처음부터</button>' : ''}
      </div>
      <div class="casechips">
        <div>사건 기록<b>반민특위 검거 제1호</b></div>
        <div>조사 대상<b>박흥식</b></div>
        <div>사건 상태<b>${S.done.m5 ? '종결' : (started ? '수사 중' : '수사 개시 전')}</b></div>
      </div>
    </div>
    <div class="title-right">
      <div class="casefile" id="casefile">
        <div class="inner"><b style="font-size:15px;color:var(--ink)">수사 개시 보고</b>
          <div class="line"></div><div class="line" style="width:80%"></div><div class="line"></div><div class="line" style="width:60%"></div>
          <p style="margin-top:14px">피의자: 박흥식<br>담당: 특별검찰관(당신)</p></div>
        <div class="cover"><div class="no">反民 事件 第1號</div><h3>사건파일</h3><div class="stmp">특별검찰부</div></div>
      </div>
      ${mascot('안녕하세요, 검찰관님! 저는 수사견 <b>누리</b>예요.<br>함께 증거를 찾아봐요!', 'happy', 92)}
    </div>
  </div></section>`;
}

/* ---------- DASHBOARD ---------- */
function vDash() {
  const cur = FLOW[S.reached] || FLOW[FLOW.length - 1];
  const curCh = CHAPTERS[cur.ch - 1];
  const doneSteps = FLOW.filter(f => S.done[f.id]).length;
  return `<section class="scene dash-scene">${sceneBg('seoul1945')}
  <div class="wrap dash enter">
    <div>
      <div class="paper mission-card pin">
        <span class="kicker">지금 할 일 · ${curCh.n}장</span>
        <h2>${esc(curCh.title)}</h2>
        <p class="sub">${esc(curCh.desc)}</p>
        <div class="track chtrack"><div class="bar" style="width:calc((100% - 44px) * ${S.done.m5 ? 1 : (cur.ch - 1) / 3})"></div>
          ${CHAPTERS.map(c => { const steps = FLOW.filter(f => f.ch === c.n); const all = steps.every(f => S.done[f.id]);
            return `<div class="st ${all ? 'done' : (cur.ch === c.n ? 'now' : '')}"><i>${all ? '✓' : c.n}</i>${esc(c.title)}</div>`; }).join('')}
        </div>
        <ol class="steplist">${FLOW.filter(f => f.ch === cur.ch).map(f => {
          const i = stepIdx(f.id), st = S.done[f.id] ? 'done' : (i === S.reached ? 'now' : (i > S.reached ? 'lock' : ''));
          return `<li class="${st}"><button ${i > S.reached ? 'disabled' : `data-go="${f.id}"`}><span>${S.done[f.id] ? '✓' : (f.type === 'scene' ? '💬' : '🎯')}</span>${esc(f.title)}${f.type === 'scene' ? '<small>대화</small>' : '<small>미션</small>'}</button></li>`;
        }).join('')}</ol>
        <div class="row" style="margin-top:18px">
          ${S.done.m5 ? '<button class="btn orange" data-go="end">수사 결과 보기 →</button>'
            : `<button class="btn orange" data-go="${cur.id}">${S.reached === 0 && !S.line ? '1장 시작하기' : `이어서: ${esc(cur.title)}`} →</button>`}
          ${S.done.m1 ? '<button class="btn ghost" data-go="m1">조사 기록 다시 보기</button>' : ''}
        </div>
      </div>
    <div class="paper pad evbox tape">
      <div class="evbox-head"><h3>🗂 증거 보관함 <b>${S.locker.length}/${LOCKER_MAX}</b></h3>
        <span class="muted">카드를 누르면 자료를 자세히 볼 수 있어요.</span></div>
      ${S.locker.length ? `<div class="bcards">${S.locker.map(id => `<button class="bcard" data-view="${id}"><div class="thumb" style="position:relative">${visual(id)}</div><div class="t">${esc(ev(id).title)}</div><div class="d">${esc(ev(id).period)}</div></button>`).join('')}</div>`
        : `<p class="sub">아직 채택한 증거가 없어요. ${S.reached >= stepIdx('m1') ? '2장 ‘조사 기록 수집’에서 자료를 열고 ‘증거로 채택’을 눌러 보세요.' : '2장에서 자료를 모으게 돼요.'}</p>`}
      ${S.done.m1 ? `<h4 class="evbox-sub">추가 수사 자료</h4><div class="bcards">${['E3', 'E4', 'E5'].filter(id => !S.locker.includes(id)).map(id => `<button class="bcard" data-view="${id}"><div class="thumb" style="position:relative">${visual(id)}</div><div class="t">${esc(ev(id).title)}</div><div class="d">${esc(ev(id).period)}</div></button>`).join('')}</div>` : ''}
    </div>
      <div class="paper suspect tape">
        <div class="mug">${AV.park()}<span>1940.7.7 매일신보</span></div>
        <div>
          <h3>박흥식 <span style="font:500 15px var(--sans);color:var(--ink3)">朴興植 · 1903~1994</span></h3>
          <dl class="kv">
            <dt>출생</dt><dd>평안남도 용강</dd>
            <dt>직업</dt><dd>화신백화점·조선비행기공업㈜ 사장</dd>
            <dt>체포</dt><dd>1949.1.8 화신 사장실 (반민특위 검거 제1호)</dd>
          </dl>
          <p class="muted">출처: ${esc(SOURCES.enc)}</p>
        </div>
        <span class="stmp">조사 대상</span>
      </div>
    </div>
    <div class="side">
      <div class="note">
        <h3>진행 상황</h3>
        <div class="stat-line">지금 나의 역할 <b style="font-size:17px">${esc(curCh.role)}</b></div>
        <div class="stat-line">채택한 증거 <b>${S.locker.length}/${LOCKER_MAX}</b></div>
        <div class="stat-line">완료한 단계 <b>${doneSteps}/${FLOW.length}</b></div>
        <div class="stat-line" style="border:0">보완 조사 기회 <b>${S.chances}</b></div>
      </div>
      <div class="paper pad orgchart">
        <h3>반민특위의 세 기관</h3>
        <div class="org ${cur.ch === 2 ? 'on' : ''}"><b>🔍 특별조사위원회</b>조사 → 조사보고서</div>
        <div class="org ${cur.ch === 3 ? 'on' : ''}"><b>📜 특별검찰부</b>기소 → 기소장</div>
        <div class="org ${cur.ch === 4 ? 'on' : ''}"><b>⚖ 특별재판부</b>공판 → 판결</div>
      </div>
      ${mascot(dashHint(), 'happy', 80)}
    </div>
  </div>
  </div></section>`;
}
function dashHint() {
  const t = (FLOW[S.reached] || {}).type;
  return ({
    scene: '대화를 따라가며 이야기를 확인해요. 말풍선을 누르면 다음 대사로 넘어가요.',
    organs: '세 기관이 각각 무슨 일을 했는지 짝을 맞춰 봐요.',
    chase: '화면을 빠르게 연타해서 박흥식을 쫓아요! 늦으면 처음부터 다시예요.',
    m1: '자료를 하나씩 읽어 봐요. 혐의와 <b>관계없는 자료</b>도 섞여 있어요!',
    m2: '수사 보드에서 두 장씩 <b>연결</b>해 혐의를 세워요.',
    m3: '<b>조문의 문구</b>와 피의자의 행위가 딱 맞는지 확인해요.',
    trial: '피고 측 반박에 <b>증거로</b> 맞서요. 근거 없는 말은 설득력을 깎아요.',
    m4: '형벌은 <b>법에 정해진 범위</b> 안에서만!',
    m5: '1949년의 실제 재판은 어떻게 끝났을까요?',
  })[t] || '수사를 마쳤어요. 기록을 다시 볼 수 있어요.';
}
function suspectSVG() {
  return '<svg viewBox="0 0 90 120"><rect width="90" height="120" fill="#cbbd9f"/><g stroke="#b3a585" stroke-width="1">' +
    Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${20 + i * 18}" x2="90" y2="${20 + i * 18}"/>`).join('') +
    '</g><circle cx="45" cy="48" r="20" fill="#5e5446"/><path d="M8 120c3-30 18-44 37-44s34 14 37 44z" fill="#5e5446"/><text x="45" y="54" font-size="20" fill="#cbbd9f" text-anchor="middle" font-weight="900">?</text></svg>';
}

/* ---------- MISSION 1 : desk ---------- */
function vM1() {
  const items = stageItems(S.done.m1 ? 2 : 1);
  const counts = { all: items.length };
  items.forEach(id => { const c = EVIDENCE_VISUAL[id].cat; counts[c] = (counts[c] || 0) + 1; });
  const shown = items.filter(id => S.cat === 'all' || EVIDENCE_VISUAL[id].cat === S.cat);
  const first = !S.viewed.length && !S.done.m1;
  return `<section class="scene desk-scene">${sceneBg('office1943')}
  <div class="wrap enter">
    <div class="mhead">
      <div><span class="kicker">2장 · 특별조사위원회</span><h2>조사 기록 수집</h2>
        <p>특위 조사관이 되어 자료 카드를 읽고, 혐의를 입증할 자료만 <b style="color:var(--gold)">증거로 채택</b>하세요. 다 모으면 조사보고서를 송치해요.</p></div>
      ${mascot(first ? '박흥식이 일제강점기에 무엇을 했는지 기록으로 확인해요. 관계없는 자료도 섞여 있어요!'
        : (S.done.m1 ? '이미 송치한 조사 기록이에요. 추가 자료 3건도 함께 있어요.' : '관련 없는 자료를 넣으면 조사보고서가 반려돼요. 신중하게!'), 'happy', 70)}
    </div>
    <div class="tabs">${CATS.filter(c => counts[c.id]).map(c => `<button class="${S.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.name}<span>${counts[c.id]}</span></button>`).join('')}</div>
    <div class="evgrid">
      ${shown.map(id => {
        const e = ev(id), v = EVIDENCE_VISUAL[id];
        return `<button class="ecard ${S.locker.includes(id) ? 'adopted' : ''} ${S.viewed.includes(id) ? 'seen' : ''}" data-open="${id}" id="card-${id}">
          ${e.stage === 2 && !S.viewed.includes(id) ? '<span class="newmark">NEW</span>' : ''}
          <div class="thumb">${visual(id)}</div>
          <div class="tags"><span class="tag ${v.cat}">${CAT_NAME[v.cat]}</span></div>
          <div class="t">${esc(e.title)}</div><div class="d">${esc(e.period)}</div><span class="bm"></span>
        </button>`;
      }).join('')}
    </div>
  </div></section>
  <div class="tray"><div class="tray-in">
    <h4>증거 보관함 ${S.locker.length}/${LOCKER_MAX}<small>${S.done.m1 ? '조사보고서 송치 완료' : '카드를 열어 채택하세요'}</small></h4>
    <div class="slots">
      ${S.locker.map(id => `<div class="slot full" title="${esc(ev(id).title)}"><div class="mini">${miniVisual(id)}</div><div class="cap">${esc(ev(id).title)}</div>${S.done.m1 ? '' : `<button class="x" data-remove="${id}" aria-label="빼기">×</button>`}</div>`).join('')}
      ${Array.from({ length: Math.max(0, LOCKER_MAX - S.locker.length) }, () => '<div class="slot"></div>').join('')}
    </div>
    ${S.done.m1 ? `<button class="btn orange" data-go="${curId()}">이어서 하기 →</button>`
      : `<button class="btn orange" data-act="m1submit" ${S.locker.length ? '' : 'disabled'}>조사보고서 송치</button>`}
  </div></div>`;
}
function miniVisual(id) {
  const v = EVIDENCE_VISUAL[id];
  return v.img ? img(v.img, 'small') : `<div class="illu">${ILLU[v.illu]}</div>`;
}

function openViewer(id) {
  if (!S.viewed.includes(id)) { S.viewed.push(id); save(); }
  const e = ev(id), v = EVIDENCE_VISUAL[id], inL = S.locker.includes(id);
  const im = v.img ? IMAGES[v.img] : null;
  const cap = im ? `<div class="vcap"><span class="tag ${im.kind === 'source' ? 'src' : 'refimg'}">${im.kind === 'source' ? '사료 사진' : '참고 이미지'}</span> ${esc(im.title)} (${esc(im.date)})<br>${im.note ? esc(im.note) + '<br>' : ''}<span style="opacity:.75">${esc(im.credit)}</span></div>`
    : '<div class="vcap"><span class="tag illut">일러스트</span> 자료 유형을 나타낸 그림이에요. 실제 자료 사진이 아니에요.</div>';
  const canAdd = !S.done.m1 && S.screen === 'm1';
  const btns = [];
  if (canAdd) btns.push(inL ? { text: '보관함에서 빼기', cls: 'ghost', fn: () => { S.locker = S.locker.filter(x => x !== id); save(); render(); } }
    : { text: '📌 증거로 채택', cls: 'orange', fn: () => adopt(id) });
  btns.push({ text: '닫기', cls: canAdd ? 'ghost' : '', fn: () => { if (S.screen === 'm1') render(); } });
  modal(`<div class="viewer">
      <div><div class="vimg">${v.img ? img(v.img, 'big') : illu(v.illu)}</div>${cap}</div>
      <div>
        <div class="row" style="gap:6px"><span class="tag ${v.cat}">${CAT_NAME[v.cat]}</span><span class="tag etc">${esc(e.kind)}</span>${S.done.m1 ? `<span class="tag ${ROLE_TAG[e.role][0]}">${ROLE_TAG[e.role][1]}</span>` : ''}</div>
        <h2>${esc(e.title)}</h2>
        <div class="meta">작성 시기: ${esc(e.period)}</div>
        <div class="vfield key"><div class="lb">핵심 내용</div>${esc(e.content)}</div>
        <div class="vfield prove"><div class="lb">이 자료로 입증할 수 있는 사실</div>${esc(e.proves)}</div>
        <div class="vfield warn"><div class="lb">주의할 점</div>${esc(e.caution)}</div>
        <div class="vsrc">원문 발췌: 미수록 (원문 자료 확보 필요) — 위 내용은 연구·사전 자료를 요약한 것이에요.<br>출처: ${e.source.map(esc).join(' / ')}</div>
        ${inL ? '<p style="margin-top:10px;font-weight:700;color:var(--orange2)">📌 보관함에 채택된 증거예요.</p>' : ''}
      </div></div>`, btns);
}

function adopt(id) {
  if (S.locker.length >= LOCKER_MAX) { toast(`보관함은 ${LOCKER_MAX}칸이에요. 필요 없는 증거를 빼 주세요.`); return; }
  const src = $(`#card-${id} .thumb`);
  const dst = $('#hudLocker');
  S.locker.push(id); save();
  if (src && dst && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const r = src.getBoundingClientRect(), d = dst.getBoundingClientRect();
    const f = src.cloneNode(true); f.className = 'flyer';
    Object.assign(f.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(f);
    requestAnimationFrame(() => {
      const dx = d.left + d.width / 2 - (r.left + r.width / 2), dy = d.top + d.height / 2 - (r.top + r.height / 2);
      f.style.transform = `translate(${dx}px,${dy}px) scale(.15) rotate(-12deg)`; f.style.opacity = '.4';
    });
    setTimeout(() => { f.remove(); render(); const h = $('#hudLocker'); h.classList.remove('bump'); void h.offsetWidth; h.classList.add('bump'); toast('증거로 채택했어요!'); }, 560);
  } else { render(); toast('증거로 채택했어요!'); }
}

function showLocker() {
  const L = S.locker;
  modal(`<h2 class="mt">증거 보관함 ${L.length}/${LOCKER_MAX}</h2>
    ${L.length ? `<div class="bcards" style="margin-top:12px">${L.map(id => `<button class="bcard" data-view="${id}"><div class="thumb" style="position:relative">${visual(id)}</div><div class="t">${esc(ev(id).title)}</div><div class="d">${esc(ev(id).period)}</div></button>`).join('')}</div>`
      : '<p class="sub">아직 채택한 증거가 없어요. 사건 파일에서 자료를 열고 ‘증거로 채택’을 눌러 보세요.</p>'}`,
    [{ text: '닫기' }], { bind: b => b.querySelectorAll('[data-view]').forEach(x => x.addEventListener('click', () => openViewer(x.dataset.view))) });
}

function fixList(issues) {
  return issues.map((i, n) => `<div class="fix"><i>${n + 1}</i><div>${esc(i.text)}${(i.recheck || []).filter(r => EVIDENCE[r]).length ? `<span class="go">다시 볼 자료: ${(i.recheck || []).filter(r => EVIDENCE[r]).map(r => esc(ev(r).title)).join(', ')}</span>` : ''}</div></div>`).join('');
}
function failModal(kind, title, issues, buttons) {
  modal(`<div class="modal-hero">${mascot('', 'sad', 100, false)}<div><span class="res ${kind}">${kind === 'bad' ? '보완 조사 필요' : '일부 근거 부족'}</span><h2 class="mt">${title}</h2>
    <p class="sub">무엇을 고치면 되는지 정리했어요. ${chancesLeftText()}</p></div></div>${fixList(issues)}`, buttons);
}
function winModal(stamp, title, body, next) {
  modal(`<div class="celebrate">${mascot('', 'wow', 110, false, true)}
    <div class="bigstamp">${stamp}</div><h2 class="mt">${title}</h2>${body}</div>`,
    [{ text: next[0], cls: 'orange', fn: next[1] }], { narrow: true });
}

function submitM1() {
  const L = S.locker; const issues = [];
  if (!L.includes('E1')) issues.push({ text: '피의자가 경영한 군수 회사에 대한 기록이 빠졌어요. 박흥식이 어떤 회사를 세우고 무슨 자리에 있었는지 확인해요.', recheck: ['E1'] });
  if (!L.includes('E2')) issues.push({ text: '그 회사가 ‘군수’ 회사였다는 근거가 없어요. 회사의 성격을 보여 주는 문서를 찾아봐요.', recheck: ['E2'] });
  if (!L.includes('E6') && !L.includes('E7')) issues.push({ text: '전쟁 협력을 보여 주는 다른 행적(단체 활동이나 기고문)이 하나도 없어요.', recheck: ['E6', 'E7'] });
  L.filter(id => ev(id).role === 'noise').forEach(id => issues.push({ text: `‘${ev(id).title}’은(는) 혐의 입증과 관련이 낮아요. ${ev(id).caution}`, recheck: [id] }));
  if (!issues.length) {
    save();
    winModal('송치 승인', '조사보고서 완성!', '<p class="sub">핵심 증거가 모였어요. 조사 과정에서 찾은 <b>추가 자료 3건</b>(비행기공업학교, 생산 실적, 군수 보상금)도 함께 특별검찰부로 넘어가요.</p>', ['다음 →', () => advance('m1')]);
    return;
  }
  spend(1, issues);
  if (S.failed) { render(); return; }
  $('.tray') && $('.tray').classList.add('shake');
  failModal('bad', '조사보고서가 반려됐어요', issues, [{ text: '다시 조사하기', fn: render }]);
}

/* ---------- MISSION 2 : investigation board ---------- */
function m2Pool() {
  return { evs: [...S.locker, ...['E3', 'E4', 'E5'].filter(id => !S.locker.includes(id))], laws: Object.keys(LAWS) };
}
function vM2() {
  const { evs, laws } = m2Pool();
  const allFound = REQUIRED_LINKS.every(r => S.found[r.key]);
  const pk = S.pick, lv = S.lastVerdict;
  return `<section class="scene board-scene">${sceneBg('jongno1936')}
  <div class="wrap enter">
    <div class="mhead"><div><span class="kicker">3장 · 특별검찰부</span><h2>증거 조합: 연결되는 단서</h2>
      <p>보드의 카드 두 장을 골라 <b style="color:var(--gold)">연결 추론</b>을 눌러요. 👁 버튼으로 자료를 다시 볼 수 있어요.</p></div></div>
    <div class="board-layout">
      <div class="cork" id="cork">
        <svg class="strings" id="strings"></svg>
        <h4>📎 수집한 증거</h4>
        <div class="bcards">${evs.map(id => {
          const e = ev(id);
          return `<div class="bcard ${pk.includes(id) ? 'sel' : ''}" data-pick="${id}" id="b-${id}" role="button" tabindex="0">
            <div class="thumb" style="position:relative">${visual(id)}</div>
            <div class="row" style="gap:4px"><span class="tag ${ROLE_TAG[e.role][0]}">${ROLE_TAG[e.role][1]}</span>${e.stage === 2 ? '<span class="tag issue">추가</span>' : ''}</div>
            <div class="t">${esc(e.title)}</div><div class="d">${esc(e.period)}</div>
            <button class="eye" data-view="${id}" aria-label="다시 보기">👁</button></div>`;
        }).join('')}</div>
        <h4>⚖ 반민족행위처벌법 (1948)</h4>
        <div class="bcards">${laws.map(id => {
          const l = LAWS[id];
          return `<div class="bcard lawc ${pk.includes(id) ? 'sel' : ''}" data-pick="${id}" id="b-${id}" role="button" tabindex="0">
            <span class="tag law">${esc(l.short)}</span><div class="t">${esc(l.name)}</div><div class="d">${esc(l.easy)}</div>
            <button class="eye" data-law="${id}" aria-label="조문 보기">§</button></div>`;
        }).join('')}</div>
      </div>
      <div class="paper analysis pin">
        <h4>사건 분석</h4>
        <div class="pair">
          <div class="pslot ${pk[0] ? 'on' : ''}">${pk[0] ? esc(label(pk[0])) : '카드 1'}</div><span class="plus">+</span>
          <div class="pslot ${pk[1] ? 'on' : ''}">${pk[1] ? esc(label(pk[1])) : '카드 2'}</div>
        </div>
        <div class="row"><button class="btn orange" style="flex:1" data-act="combine" ${pk.length === 2 ? '' : 'disabled'}>🔗 연결 추론</button>
          <button class="btn ghost small" data-act="clearpick" ${pk.length ? '' : 'disabled'}>비우기</button></div>
        ${lv ? verdictView(lv) : ''}
        <ul class="checklist">${REQUIRED_LINKS.map(r => `<li class="${S.found[r.key] ? 'ok' : ''}"><span class="ck">${S.found[r.key] ? '✓' : ''}</span><span>${esc(r.label)}${S.found[r.key] ? `<br><span class="muted">${esc(S.found[r.key])}</span>` : ''}</span></li>`).join('')}
          <li class="iss ${S.found.ISSUE ? 'ok' : ''}"><span class="ck">${S.found.ISSUE ? '!' : ''}</span><span>(선택) 재판에서 쟁점이 될 약점 찾기${S.found.ISSUE ? '<br><span class="muted">쟁점 발견: 생산 실적</span>' : ''}</span></li>
        </ul>
        ${S.missStreak >= 3 && !allFound ? `<div style="margin-top:12px">${mascot('<b>힌트!</b> ' + esc(m2Hint()), 'happy', 60, false)}</div>` : ''}
        <button class="btn ${allFound ? 'teal' : ''}" style="width:100%;margin-top:14px" data-act="m2submit" ${allFound ? '' : 'disabled'}>수사 결론 보고 → 기소장 작성</button>
      </div>
    </div>
  </div></section>`;
}
function verdictView(v) {
  const names = { valid: '타당한 연결', plus: '보강 증거', issue: '쟁점 발견', weak: '근거 부족', wrong: '조항 오적용', noise: '관련성 낮음' };
  return `<div class="result r-${v.v}"><div class="rt">${esc(v.title)}<span class="verdict-stamp">${names[v.v]}</span></div><p>${esc(v.text)}</p></div>`;
}
function drawStrings() {
  const svg = $('#strings'), cork = $('#cork'); if (!svg || !cork) return;
  const pair = S.pick.length === 2 ? S.pick : (S.lastPair || []);
  if (pair.length !== 2) { svg.innerHTML = ''; return; }
  const a = $('#b-' + pair[0]), b = $('#b-' + pair[1]); if (!a || !b) return;
  const c = cork.getBoundingClientRect();
  const p = el => { const r = el.getBoundingClientRect(); return [r.left - c.left + r.width / 2, r.top - c.top + 2]; };
  const [x1, y1] = p(a), [x2, y2] = p(b);
  svg.setAttribute('viewBox', `0 0 ${c.width} ${c.height}`); svg.setAttribute('width', c.width); svg.setAttribute('height', c.height);
  const ok = S.pick.length !== 2 && S.lastVerdict && ['valid', 'plus', 'issue'].includes(S.lastVerdict.v);
  svg.innerHTML = `<line class="${ok ? 'ok' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
}
window.addEventListener('resize', () => { if (S.screen === 'm2') drawStrings(); });
function m2Hint() {
  if (!S.found.K1) return '회사 설립 기록과 일본 육군의 지정 문서를 함께 놓아 봐요.';
  if (!S.found.K2) return '‘비행기·병기·탄약 등 군수공업’이라는 말이 들어간 조항을 찾아 회사 기록과 연결해요.';
  return '단체 간부 활동은 ‘국책 단체 수뇌간부’ 조항과, 기고문은 ‘언론·저작’ 조항과 맞는지 확인해요.';
}
function judgeCombo(a, b) {
  const k = [a, b].sort().join('+');
  if (COMBOS[k]) return COMBOS[k];
  const d = [a, b].find(id => id.startsWith('D'));
  if (d) return { v: 'noise', title: '관련성 낮음', text: NOISE_TEXT[d] };
  if (a.startsWith('L') && b.startsWith('L')) return { v: 'weak', title: '조항끼리는 연결할 수 없음', text: '법 조항은 그것을 뒷받침하는 증거와 짝지어야 해요.' };
  const law = [a, b].find(id => id.startsWith('L'));
  const e = [a, b].find(id => id.startsWith('E'));
  if (law === 'L47' && (e === 'E3' || e === 'E5')) return { v: 'plus', title: '보강: 7호 혐의 보강', text: `‘${ev(e).title}’은(는) 회사 경영이 실제로 이루어졌음을 보강해요. 다만 사장이었다는 기록이 먼저 있어야 해요.` };
  if (law === 'L42') return { v: 'wrong', title: '조항 오적용', text: '이 조항은 중추원 부의장·고문·참의를 지낸 사람에게 해당해요. 확인한 자료에는 박흥식의 중추원 경력이 없어요.' };
  if (law === 'L2' || law === 'L3') return { v: 'wrong', title: '조항 오적용', text: `${LAWS[law].short}는 ${LAWS[law].easy}에게 적용돼요. 이 자료와는 맞지 않아요.` };
  if (law) return { v: 'weak', title: '근거 부족', text: `‘${ev(e).title}’만으로는 ${LAWS[law].short}의 요건을 입증하기 어려워요.` };
  return { v: 'weak', title: '근거 부족', text: '두 자료를 함께 놓아도 바로 이끌어 낼 결론이 뚜렷하지 않아요. 다른 짝을 찾아봐요.' };
}
function doCombine() {
  const [a, b] = S.pick; if (!a || !b) return;
  const r = judgeCombo(a, b);
  S.lastVerdict = r; S.lastPair = [a, b];
  const k = [a, b].sort().join('+');
  if (!S.tried.includes(k)) S.tried.push(k);
  if (r.key && !S.found[r.key]) { S.found[r.key] = `${label(a)} + ${label(b)}`; toast(r.key === 'ISSUE' ? '숨은 쟁점을 찾았어요!' : '핵심 연결 발견!'); }
  S.missStreak = ['valid', 'plus', 'issue'].includes(r.v) ? 0 : S.missStreak + 1;
  S.pick = []; save(); render();
  const res = $('.result'); if (res && !['valid', 'plus', 'issue'].includes(r.v)) res.classList.add('shake');
}
function submitM2() {
  save();
  winModal('혐의 정리', '기소할 준비가 됐어요!', `<p class="sub">핵심 혐의와 보조 혐의를 뒷받침할 연결을 찾았어요.</p>
    ${S.found.ISSUE ? '<div class="notice"><b>기억할 쟁점</b> 생산 실적이 연습기 1기뿐이라는 점은 변호인이 반박 근거로 쓸 거예요.</div>' : '<div class="notice"><b>놓친 쟁점</b> 추가 자료 중 피고 측에 유리한 자료가 있어요. 결말에서 확인해 봐요.</div>'}`,
    ['기소장 쓰러 가기 →', () => advance('m2')]);
}

/* ---------- MISSION 3 : typewriter indictment ---------- */
function vM3() {
  const { evs } = m2Pool(); const I = S.ind;
  const mainOpts = ['L47', 'L410', 'L411', 'L42', 'L2', 'L3'];
  const st = [!!I.main, I.ev.length > 0, !!I.reason];
  return `<section class="scene type-scene">${sceneBg('typewriter')}
  <div class="wrap enter">
    <div class="mhead"><div><span class="kicker">3장 · 특별검찰부</span><h2>기소장 작성: 법적 책임을 입증하라</h2>
      <p>선택한 내용이 기소장에 바로 타이핑돼요. 다 고르면 <b style="color:var(--gold)">기소장 제출</b>!</p></div></div>
    <div class="ind-layout">
      <ol class="steps-v">
        ${['법 조항 선택', '증거 선택', '기소 이유'].map((t, i) => `<li class="${st[i] ? 'ok' : ''}" id="stp${i}"><i>${i + 1}</i>${t}<span class="ck">${st[i] ? '✓' : ''}</span></li>`).join('')}
        <li class="tw">${img('typewriter', 'small', '1940년대 타자기')}</li>
      </ol>
      <div class="paper indict" id="indict">
        <div class="head">
          <h2>起訴狀</h2>
          <table><tr><td>사건</td><td>박흥식 반민족행위 사건</td></tr><tr><td>피고인</td><td>박흥식 (화신 사장)</td></tr><tr><td>작성</td><td>특별검찰관</td></tr></table>
        </div>
        <div class="isec"><h3><i>1</i>적용할 핵심 조항</h3>
          <div class="chips">${mainOpts.map(id => `<label class="chip radio"><input type="radio" name="main" value="${id}" ${I.main === id ? 'checked' : ''}><span class="bx"></span><span><b>${esc(LAWS[id].short)}</b> ${esc(LAWS[id].name)}<small>${esc(LAWS[id].easy)}</small></span></label>`).join('')}</div>
          <div class="isec" style="margin:14px 0 0"><h3 style="font-size:14px">＋ 함께 적용할 보조 조항 <span class="muted">(선택)</span></h3>
            <div class="chips">${['L410', 'L411', 'L42', 'L3'].map(id => `<label class="chip"><input type="checkbox" name="extra" value="${id}" ${I.extra.includes(id) ? 'checked' : ''} ${I.main === id ? 'disabled' : ''}><span class="bx"></span><span><b>${esc(LAWS[id].short)}</b> ${esc(LAWS[id].name)}</span></label>`).join('')}</div></div>
          <div class="typed" id="tyLaw"></div>
        </div>
        <div class="isec"><h3><i>2</i>혐의를 뒷받침하는 증거 <span class="muted">(여러 개)</span></h3>
          <div class="chips">${evs.map(id => `<label class="chip"><input type="checkbox" name="ev" value="${id}" ${I.ev.includes(id) ? 'checked' : ''}><span class="bx"></span><span>${esc(ev(id).title)}<small>${esc(ev(id).period)}</small></span></label>`).join('')}</div>
          <div class="typed" id="tyEv"></div>
        </div>
        <div class="isec"><h3><i>3</i>기소 이유</h3>
          <div class="chips">${REASONS.map(r => `<label class="chip radio wide"><input type="radio" name="reason" value="${r.id}" ${I.reason === r.id ? 'checked' : ''}><span class="bx"></span><span>${esc(r.text)}</span></label>`).join('')}</div>
          <div class="typed" id="tyReason"></div>
        </div>
        <div class="row" style="justify-content:space-between;margin-top:18px;font-family:var(--sans)">
          <span class="muted">${chancesLeftText()}</span>
          <button class="btn red big" data-act="m3submit">🖋 기소장 제출</button>
        </div>
        <div class="big-stamp" id="bigStamp">起訴</div>
      </div>
    </div>
  </div></section>`;
}
function readM3() {
  S.ind.main = ($('input[name=main]:checked', app) || {}).value || '';
  S.ind.extra = $$('input[name=extra]:checked', app).map(i => i.value).filter(v => v !== S.ind.main);
  S.ind.ev = $$('input[name=ev]:checked', app).map(i => i.value);
  S.ind.reason = ($('input[name=reason]:checked', app) || {}).value || '';
  save();
}
function typeM3() {
  const I = S.ind;
  const set = (id, txt, ph) => { const el = $('#' + id); if (el) el.innerHTML = txt ? esc(txt) + '<span class="caret"></span>' : `<span class="ph">${ph}</span>`; };
  set('tyLaw', [I.main, ...I.extra].filter(Boolean).length ? '적용 법조: 반민족행위처벌법 ' + [I.main, ...I.extra].filter(Boolean).map(id => LAWS[id].short).join(', ') : '', '적용 법조가 여기에 타이핑돼요.');
  set('tyEv', I.ev.length ? '증거: ' + I.ev.map((id, i) => `(${i + 1}) ${ev(id).title}`).join('  ') : '', '증거 목록이 여기에 타이핑돼요.');
  set('tyReason', I.reason ? (REASONS.find(r => r.id === I.reason) || {}).text : '', '기소 이유가 여기에 타이핑돼요.');
  [!!I.main, I.ev.length > 0, !!I.reason].forEach((ok, i) => { const li = $('#stp' + i); if (li) { li.classList.toggle('ok', ok); $('.ck', li).textContent = ok ? '✓' : ''; } });
}
function submitM3() {
  readM3(); const I = S.ind;
  if (!I.main || !I.ev.length || !I.reason) { toast('1·2·3번을 모두 골라야 제출할 수 있어요.'); return; }
  const issues = [];
  if (I.main === 'L410' || I.main === 'L411') issues.push({ text: `${LAWS[I.main].short}는 보조 혐의로는 검토할 수 있지만 이 사건의 핵심이 아니에요. 이 조항은 ‘악질적’이었다는 점까지 입증해야 해요. 회사 경영 기록에 딱 맞는 조항은 따로 있어요.`, recheck: ['E1', 'E2'] });
  if (I.main === 'L42' || I.extra.includes('L42')) issues.push({ text: '제4조 2호(중추원 직책)는 확인되지 않은 경력을 근거로 해요. 확인한 자료에는 박흥식의 중추원 경력이 없어요.', recheck: ['E1'] });
  if (I.main === 'L2') issues.push({ text: '제2조는 작위를 받았거나 일본 제국의회 의원이 된 사람에게 적용돼요. 박흥식은 해당하지 않아요.', recheck: [] });
  if (I.main === 'L3' || I.extra.includes('L3')) issues.push({ text: '제3조(독립운동가 살상·박해)를 뒷받침할 증거가 없어요. 증거 없는 혐의는 기소할 수 없어요.', recheck: [] });
  if (I.extra.includes('L410') && !I.ev.includes('E6')) issues.push({ text: '제4조 10호를 함께 적용했다면 단체 간부 활동 자료를 증거로 내야 해요.', recheck: ['E6'] });
  if (I.extra.includes('L411') && !I.ev.includes('E7')) issues.push({ text: '제4조 11호를 함께 적용했다면 기고문 자료를 증거로 내야 해요.', recheck: ['E7'] });
  if (!I.ev.includes('E1')) issues.push({ text: '핵심 증거인 ‘조선비행기공업㈜ 설립과 사장 취임’ 기록이 빠졌어요. 책임경영을 입증하려면 꼭 필요해요.', recheck: ['E1'] });
  if (!I.ev.includes('E2')) issues.push({ text: '회사가 군수회사였다는 근거(일본 육군의 지정)가 빠졌어요.', recheck: ['E2'] });
  I.ev.filter(id => ev(id).role === 'noise').forEach(id => issues.push({ text: `‘${ev(id).title}’은(는) 혐의와 관련이 낮은 자료예요.`, recheck: [id] }));
  const r = REASONS.find(x => x.id === I.reason);
  if (r && !r.ok) issues.push({ text: `기소 이유: ${r.why}`, recheck: [] });

  if (!issues.length) {
    save();
    $('#bigStamp').classList.add('in');
    setTimeout(() => winModal('기소 수리', '타당한 기소!', `<p class="sub">증거와 조항이 논리적으로 연결됐어요. 특별재판부가 기소장을 받아들였어요.</p>
      ${I.ev.includes('E4') ? '<div class="notice"><b>참고</b> 생산 실적 자료도 증거로 냈어요. 이 자료는 오히려 변호인이 쓰기 좋은 자료예요.</div>' : ''}`,
      ['다음 →', () => advance('m3')]), 650);
    return;
  }
  const lawErr = issues.some(i => /조항|제2조|제3조|중추원/.test(i.text));
  spend(3, issues);
  if (S.failed) { render(); return; }
  $('#indict').classList.add('shake');
  failModal(lawErr ? 'bad' : 'part', lawErr ? '법 조항을 다시 살펴봐요' : '근거가 조금 부족해요', issues,
    [{ text: '사건 파일 다시 보기', cls: 'ghost', fn: () => go('m1') }, { text: '기소장 고치기', cls: 'orange', fn: render }]);
}

/* ---------- MISSION 4 : courtroom ---------- */
function vM4() {
  const T = S.sent, I = S.ind;
  const types = [
    { v: 'death', t: '사형' }, { v: 'life', t: '무기징역' },
    { v: 'prison', t: '징역', rng: 'N년' }, { v: 'civil', t: '공민권 정지', rng: 'N년', s: '선거권·피선거권, 공무원이 될 권리 등을 멈춤' },
  ];
  const need = T.type === 'prison' || T.type === 'civil';
  return `<section class="scene court-scene">${sceneBg('courthouse')}
  <div class="wrap enter">
    <div class="mhead"><div><span class="kicker">4장 · 특별재판부</span><h2>구형 의견: 어떤 형벌을 제안할까?</h2>
      <p>검찰관이 재판부에 요청하는 형벌이 <b style="color:var(--gold)">구형</b>이에요. 최종 판결은 재판부가 따로 내려요.</p></div></div>
    <div class="court-top">
      <div class="speech"><div class="who">재판장 <span class="tag illut">교육용 재구성</span></div>
        양측의 주장을 모두 들었습니다. 특별검찰관은 확인된 혐의에 따라 구형 의견을 진술하십시오.</div>
      <figure class="court-photo" style="margin:0">${img('trial1949', 'small', '1949년 반민특위 재판 광경')}<figcaption>사료 사진: 1949년 반민특위 재판 광경 · 퍼블릭 도메인</figcaption></figure>
    </div>
    <div class="court-panel">
      <div class="paper">
        <h3>사건 요약</h3>
        <dl class="kv"><dt>피고인</dt><dd>박흥식</dd>
          <dt>인정된 혐의</dt><dd>${[I.main, ...I.extra].filter(Boolean).map(id => esc(LAWS[id].short + ' ' + LAWS[id].name)).join('<br>')}</dd>
          <dt>핵심 증거</dt><dd>${I.ev.map(id => esc(ev(id).title)).join('<br>')}</dd></dl>
        <div class="lawbox"><b>제4조 법정형</b><br>${esc(LAW4_HEAD)}</div>
        <p class="muted">여러 호가 함께 적용되어도 이 게임에서는 제4조에 정한 범위 안에서 구형해요(교육용 단순화).</p>
        <div class="notice">⚖ <span><b>구형 ≠ 판결</b> 구형은 검찰관의 의견일 뿐이에요. 재판부는 구형보다 무겁게도, 가볍게도, 무죄로도 판결할 수 있어요.</span></div>
      </div>
      <div class="paper">
        <h3>① 형벌 종류</h3>
        <div class="pen">${types.map(o => `<label class="chip radio"><input type="radio" name="type" value="${o.v}" ${T.type === o.v ? 'checked' : ''}><span class="bx"></span><span><b>${o.t}</b>${o.s ? `<small>${o.s}</small>` : ''}</span>${o.rng ? `<span class="rng">기간 입력</span>` : ''}</label>`).join('')}</div>
        <div id="yearsStep" class="${need ? '' : 'hidden'}"><h3 style="margin-top:16px">② 기간</h3>
          <div class="stepper"><button type="button" data-step="-1" aria-label="1년 줄이기">−</button><input type="number" name="years" min="1" max="30" inputmode="numeric" value="${esc(T.years || 1)}" aria-label="기간(년)"><b>년</b><button type="button" data-step="1" aria-label="1년 늘리기">＋</button></div></div>
        <h3 style="margin-top:16px">③ 재산 몰수</h3>
        <div class="chips">${[['none', '몰수하지 않음'], ['part', '재산 일부 몰수'], ['all', '재산 전부 몰수']].map(([v, t]) => `<label class="chip radio"><input type="radio" name="conf" value="${v}" ${T.conf === v ? 'checked' : ''}><span class="bx"></span>${t}</label>`).join('')}</div>
        <p class="muted">제4조는 재산 몰수를 ‘할 수 있다’고 정했어요. 몰수하지 않는 것도 범위 안이에요.</p>
        <h3 style="margin-top:16px">④ 구형 이유</h3>
        <div class="pen">${SENT_REASONS.map(r => `<label class="chip radio"><input type="radio" name="sreason" value="${r.id}" ${T.reason === r.id ? 'checked' : ''}><span class="bx"></span><span>${esc(r.text)}</span></label>`).join('')}</div>
        <div class="row" style="justify-content:space-between;margin-top:18px">
          <span class="muted">${chancesLeftText()}</span>
          <button class="btn red big" data-act="m4submit">⚖ 구형 의견 진술</button>
        </div>
      </div>
    </div>
  </div></section>`;
}
function readM4() {
  S.sent.type = ($('input[name=type]:checked', app) || {}).value || '';
  const y = $('input[name=years]', app); S.sent.years = y && (S.sent.type === 'prison' || S.sent.type === 'civil') ? y.value : '';
  S.sent.conf = ($('input[name=conf]:checked', app) || {}).value || '';
  S.sent.reason = ($('input[name=sreason]:checked', app) || {}).value || '';
  save();
}
function sentenceText(t = S.sent) {
  const conf = { none: '재산 몰수 없음', part: '재산 일부 몰수', all: '재산 전부 몰수' }[t.conf] || '';
  const main = { death: '사형', life: '무기징역', prison: `징역 ${t.years}년`, civil: `공민권 정지 ${t.years}년` }[t.type] || '';
  return [main, conf].filter(Boolean).join(', ');
}
function submitM4() {
  readM4(); const T = S.sent;
  if (!T.type || !T.conf || !T.reason) { toast('형벌 종류, 재산 몰수, 구형 이유를 모두 골라 주세요.'); return; }
  const y = Number(T.years);
  if ((T.type === 'prison' || T.type === 'civil') && (!Number.isInteger(y) || y < 1)) { toast('기간을 1 이상의 정수로 입력해 주세요.'); return; }
  const issues = [];
  if (T.type === 'death' || T.type === 'life') issues.push({ text: `${T.type === 'death' ? '사형' : '무기징역'}은 제4조의 법정형에 없어요. 제4조는 ‘10년 이하의 징역’ 또는 ‘15년 이하의 공민권 정지’를 정했어요. (사형·무기는 제1조~제3조에 있어요.)` });
  if (T.type === 'prison' && y > 10) issues.push({ text: `징역 ${y}년은 법정형 범위를 벗어나요. 제4조의 징역은 10년 이하예요.` });
  if (T.type === 'civil' && y > 15) issues.push({ text: `공민권 정지 ${y}년은 법정형 범위를 벗어나요. 제4조의 공민권 정지는 15년 이하예요.` });
  const r = SENT_REASONS.find(x => x.id === T.reason);
  if (r && !r.ok) issues.push({ text: `구형 이유: ${r.why}` });
  if (!issues.length) {
    save();
    winModal('구형 완료', '법정형 범위 안의 구형', `<p class="sub">당신의 구형: <b>${esc(sentenceText())}</b></p>
      <div class="notice"><b>잠깐!</b> 구형은 검찰관의 의견일 뿐이에요. 1949년 실제 재판은 어떻게 끝났을까요?</div>`, ['그 후의 역사 →', () => advance('m4')]);
    return;
  }
  spend(4, issues);
  if (S.failed) { render(); return; }
  failModal('bad', '재판장이 구형을 받아들이지 않았어요', issues, [{ text: '구형 고치기', cls: 'orange', fn: render }]);
}

/* ---------- MISSION 5 : history ---------- */
const TL_PHOTO = { '1948.10': 'ballotbox1948', '1949.1.8': 'news1949', '1949.3.28': 'trial1949' };
function vM5() {
  const I = S.ind; const hl = ['1949.1.8', '1949.9.26', '1951.2.14'];
  return `<section class="scene end-scene">${sceneBg('street1946')}
  <div class="wrap enter">
    <div class="mhead"><div><span class="kicker">4장 · 에필로그</span><h2>역사의 결말: 실제 재판과 비교</h2>
      <p>게임 속 기소는 교육용 시나리오예요. 1949년에는 실제로 무슨 일이 있었을까요?</p></div></div>
    <article class="extra">
      <div class="mast"><h2>역사 기록</h2><div><span>교육용으로 다시 꾸민 지면</span><span>1949년 9월 26일 공판</span><span>출처는 기사 아래</span></div></div>
      <div class="headline">반민 피고 박흥식, 공판에서 무죄 선고</div>
      <div class="cols">
        <figure>${img('trial1949', 'small', '1949년 반민특위 재판 광경')}<figcaption>사료 사진: 1949년 반민특위 재판 광경 (박흥식 공판 사진인지는 확인되지 않음) · 퍼블릭 도메인</figcaption></figure>
        <div style="font-size:15px;line-height:1.8">
          <p>1949년 9월 26일, 특별재판부는 박흥식에게 <b>무죄</b>를 선고했다. 새로 사건을 맡은 정광호 검찰관은 공민권 정지 2년을 구형하면서도 무죄 취지로 발언했다.</p>
          <p style="font-weight:700;margin-top:10px">신문이 전한 무죄 이유 (요지)</p>
          <ul style="padding-left:18px;margin:4px 0">
            <li>비행기 공장은 도중에 멈춰 실질적인 일을 하지 않았고 피동적이었다.</li>
            <li>조선임전보국단 등의 간부였지만 실질적 활동은 없었다.</li>
            <li>신문에 쓴 글은 남이 시켜서 쓴 피동적인 것이었다.</li>
            <li>판결 이유에는 안창호를 많이 도왔다는 내용도 있었다.</li>
          </ul>
          <p class="muted">출처: ${esc(SOURCES.busan49)}; ${esc(SOURCES.ohmy)}. 판결문 원문은 싣지 않았어요.</p>
        </div>
      </div>
    </article>

    <div class="vs">
      <div class="side-a"><h3>🔍 나의 수사</h3><dl>
        <dt>조항</dt><dd>${esc([I.main, ...I.extra].filter(Boolean).map(id => LAWS[id].short).join(', '))}</dd>
        <dt>증거</dt><dd>${I.ev.length}건</dd>
        <dt>구형</dt><dd>${esc(sentenceText())}</dd>
        <dt>쟁점</dt><dd>${S.found.ISSUE ? '생산 실적 약점을 미리 찾음' : '생산 실적 쟁점을 놓침'}</dd></dl></div>
      <div class="mid">VS</div>
      <div class="side-b"><h3>📜 1949년 실제</h3><dl>
        <dt>혐의</dt><dd>제4조 7호 (군수공업 책임경영)</dd>
        <dt>보석</dt><dd>1949.4.21 병보석 석방</dd>
        <dt>구형</dt><dd>공민권 정지 2년</dd>
        <dt>판결</dt><dd><span class="verdict">무죄</span> 1949.9.26</dd></dl></div>
    </div>
    <div class="notice" style="background:#fff3c9">💡 <span>게임에서 확인한 증거(군수회사 사장, 전쟁 협력 단체 간부, 학병 독려 글)는 실제 재판에서도 알려져 있던 사실이에요. <b>그런데도 결과는 무죄였어요.</b></span></div>

    <h3 class="sect-title">반민특위는 어떻게 무너졌나</h3>
    <ol class="tl">${TIMELINE.map(x => {
      const ph = TL_PHOTO[x.d];
      return `<li class="${hl.includes(x.d) ? 'hl' : ''}"><div class="d">${esc(x.d)}</div><div><div class="t">${esc(x.t)}</div><div class="s">출처: ${esc(x.s)}${ph ? ` · 사진: ${esc(IMAGES[ph].title)}` : ''}</div></div>${ph ? `<div class="ph">${img(ph, 'small')}</div>` : '<div></div>'}</li>`;
    }).join('')}</ol>

    <h3 class="sect-title">숫자로 본 반민특위</h3>
    <div class="stats">
      <div><b>682</b><span>처리한 사건</span></div><div><b>408</b><span>영장 발부</span></div><div><b>221</b><span>기소</span></div>
      <div><b>38</b><span>재판 종결</span></div><div><b>12</b><span>실형 선고</span></div>
    </div>
    <p style="color:#d8ccb4;font-size:13px;margin-top:10px">출처: ${esc(SOURCES.seoul98)}; ${esc(SOURCES.nocut)}. 실형을 받은 사람들도 보석·형 집행정지 등으로 곧 풀려났어요. 연구·보도에 따라 수치가 조금씩 달라요.<br>
    2009년 정부 기구인 친일반민족행위진상규명위원회는 박흥식을 친일반민족행위자로 결정했어요(출처: ${esc(SOURCES.enc)}).</p>

    <h3 class="sect-title">마지막 질문</h3>
    <div class="paper reflect tape">
      <p class="q">친일 행위를 입증할 증거와 처벌할 법이 있었는데도, 친일 청산은 왜 충분히 이루어지지 못했을까?</p>
      <textarea id="reflect" placeholder="위 연표에서 찾은 근거를 들어 2~3문장으로 써 보세요. (20자 이상)">${esc(S.reflection)}</textarea>
      <div class="row" style="justify-content:flex-end;margin-top:6px"><span class="muted" id="rcount">${S.reflection.trim().length}자</span></div>
      <div class="submitbox">
        <label for="stuName"><b>📮 선생님께 제출하기</b><span class="muted">학번과 이름을 쓰면 답이 선생님의 기록지에 저장돼요.</span></label>
        <div class="subrow"><input id="stuName" maxlength="20" autocomplete="off" placeholder="학번 이름 (예: 10305 김하늘)" value="${esc(S.name || '')}"></div>
        <div class="submsg" id="submsg"></div>
      </div>
      <div class="row" style="justify-content:space-between;margin-top:12px">
        <button class="btn ghost" data-act="records">역사 기록 열람</button>
        <button class="btn orange" data-act="m5submit" id="m5btn">${S.submittedAt ? '사건 종결 화면으로 →' : '답변 제출하고 사건 종결'}</button>
      </div>
    </div>
  </div></section>`;
}
function finishCase() { S.done.m5 = true; S.reached = FLOW.length - 1; save(); go('end'); }
function submitData() {
  const I = S.ind;
  return {
    app: 'banmin', name: S.name,
    laws: [I.main, ...I.extra].filter(Boolean).map(id => LAWS[id].short + ' ' + LAWS[id].name).join(', '),
    evidence: I.ev.map(id => ev(id).title).join(', '),
    reason: (REASONS.find(r => r.id === I.reason) || {}).text || '',
    sentence: sentenceText(),
    issue: S.found.ISSUE ? '예' : '아니오',
    chances: `${MAX_CHANCES - S.chances}번`,
    reflection: S.reflection,
    all: summaryText(),
  };
}
function sendSubmission(onOk, onFail) {
  const ctl = window.AbortController ? new AbortController() : null;
  const to = setTimeout(() => ctl && ctl.abort(), 15000);
  fetch(SUBMIT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(submitData()), signal: ctl ? ctl.signal : undefined })
    .then(() => { clearTimeout(to); const d = new Date(); S.submittedAt = `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}시 ${String(d.getMinutes()).padStart(2, '0')}분`; save(); onOk(); })
    .catch(() => { clearTimeout(to); onFail(); });
}
function submitM5() {
  if (S.submittedAt) { finishCase(); return; }
  const t = ($('#reflect').value || '').trim();
  const nm = ($('#stuName').value || '').trim();
  S.reflection = t; S.name = nm; save();
  const msg = $('#submsg'), btn = $('#m5btn');
  if (t.length < 20) { toast('20자 이상 써야 제출할 수 있어요.'); $('#reflect').classList.add('shake'); return; }
  if (nm.length < 2 || !/\d/.test(nm)) { msg.className = 'submsg no'; msg.textContent = '학번과 이름을 함께 써 주세요. (예: 10305 김하늘)'; $('#stuName').focus(); $('#stuName').classList.add('shake'); return; }
  btn.disabled = true; btn.textContent = '보내는 중…'; msg.className = 'submsg'; msg.textContent = '잠시만 기다려 주세요.';
  sendSubmission(() => { toast('선생님께 제출했어요!'); finishCase(); }, () => {
    btn.disabled = false; btn.textContent = '다시 제출하기';
    msg.className = 'submsg no';
    msg.innerHTML = '제출하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. <button class="linkbtn" data-act="skipsubmit" style="color:var(--red2)">제출하지 않고 사건 종결하기</button>';
    $('[data-act=skipsubmit]', msg).addEventListener('click', finishCase);
  });
}
function summaryText() {
  const I = S.ind;
  return ['[반민특위 재판정] 수사 결과',
    `적용 조항: ${[I.main, ...I.extra].filter(Boolean).map(id => LAWS[id].short + ' ' + LAWS[id].name).join(', ')}`,
    `증거: ${I.ev.map(id => ev(id).title).join(', ')}`,
    `구형: ${sentenceText()}`,
    `학번 이름: ${S.name || '(미입력)'}`,
    `쟁점 발견: ${S.found.ISSUE ? '예' : '아니오'} / 사용한 보완 조사: ${MAX_CHANCES - S.chances}번`,
    `성찰: ${S.reflection}`].join('\n');
}

/* ---------- END / FAIL ---------- */
function vEnd() {
  const I = S.ind;
  return `<section class="scene end-scene">${sceneBg('street1946')}
  <div class="wrap enter" style="max-width:900px">
    <div class="paper pad pin" style="text-align:center">
      ${mascot('수고하셨어요, 검찰관님! 이 사건의 기록은 여기까지예요.', 'wow', 96, true, true)}
      <div class="celebrate"><div class="bigstamp" style="border-color:var(--red);color:var(--red)">수사 종결</div></div>
      <p class="sub">당신은 교육용 시나리오 안에서 기소 논리를 완성했어요. 실제 역사에서 박흥식은 <b>무죄</b> 판결을 받았어요.</p>
      <div class="substatus ${S.submittedAt ? 'ok' : 'no'}">${S.submittedAt
        ? `✅ ${esc(S.name)} · ${esc(S.submittedAt)}에 선생님께 제출했어요.`
        : `아직 선생님께 제출하지 않았어요. <button class="btn small orange" data-act="resubmit">지금 제출하기</button>`}</div>
    </div>
    <div class="paper indict" style="margin-top:24px">
      <div class="head"><h2>起訴狀</h2><table><tr><td>피고인</td><td>박흥식</td></tr><tr><td>작성</td><td>특별검찰관(당신)</td></tr></table></div>
      <dl class="kv" style="font-family:var(--serif)">
        <dt>적용 법조</dt><dd>${esc([I.main, ...I.extra].filter(Boolean).map(id => LAWS[id].short + ' ' + LAWS[id].name).join(', '))}</dd>
        <dt>증거</dt><dd>${I.ev.map(id => esc(ev(id).title)).join('<br>')}</dd>
        <dt>기소 이유</dt><dd>${esc((REASONS.find(r => r.id === I.reason) || {}).text || '')}</dd>
        <dt>구형</dt><dd>${esc(sentenceText())}</dd>
        <dt>장별 결과</dt><dd>${CHAPTERS.map(c => `${c.n}장 ${c.title} ${FLOW.filter(f => f.ch === c.n).every(f => S.done[f.id]) ? '✓' : '—'}`).join('<br>')}${S.mistakes.length ? `<br><span class="muted">보완 조사 ${S.mistakes.length}번 사용</span>` : ''}</dd>
        <dt>나의 답변</dt><dd style="white-space:pre-wrap">${esc(S.reflection)}</dd>
      </dl>
      <div class="big-stamp in" style="bottom:30px">起訴</div>
    </div>
    <div class="row" style="justify-content:center;margin-top:24px">
      <button class="btn orange" data-act="copy">📋 결과 복사하기</button>
      <button class="btn ghost" data-act="records">역사 기록 열람</button>
      <button class="btn" data-act="reset">처음부터 다시 수사</button>
    </div>
  </div></section>`;
}
function vFail() {
  const rechecks = [...new Set(S.mistakes.flatMap(m => m.issues.flatMap(i => i.recheck)))].filter(id => EVIDENCE[id]);
  return `<section class="scene desk-scene">${sceneBg('office1943')}
  <div class="wrap enter" style="max-width:900px">
    <div class="paper pad pin">
      <div class="modal-hero">${mascot('', 'sad', 110, false)}<div><span class="res bad">수사 실패</span>
        <h2 class="mt">보완 조사 기회를 모두 썼어요</h2><p class="sub">핵심 혐의를 입증하지 못해 사건이 종결됐어요. 무엇이 부족했는지 보고 다시 도전해요!</p></div></div>
      ${[...new Set(S.mistakes.map(m => m.mission))].map(n => {
        const texts = [...new Set(S.mistakes.filter(m => m.mission === n).flatMap(m => m.issues.map(i => i.text)))];
        return `<h3 style="margin-top:16px;font:400 20px var(--display);color:var(--navy)">‘${esc((stepOf(n) || { title: n }).title)}’에서 부족했던 점</h3>${fixList(texts.map(t => ({ text: t })))}`;
      }).join('')}
      ${rechecks.length ? `<h3 style="margin-top:18px;font:400 20px var(--display);color:var(--navy)">다시 확인할 자료</h3>
        <div class="bcards" style="margin-top:10px">${rechecks.map(id => `<div class="bcard"><div class="thumb" style="position:relative">${visual(id)}</div><div class="t">${esc(ev(id).title)}</div><div class="d">${esc(ev(id).period)}</div></div>`).join('')}</div>` : ''}
      <p class="muted" style="margin-top:12px">조항을 고를 때는 ‘피의자가 실제로 한 일’과 ‘조문의 문구’가 정확히 맞는지 확인해요.</p>
      <div class="row" style="margin-top:14px"><button class="btn orange big" data-act="reset-now">처음부터 다시 수사</button></div>
    </div>
  </div></section>`;
}

/* ---------- modals: law, records ---------- */
function showLaw(id) {
  const list = id ? [id] : Object.keys(LAWS);
  modal(`<h2 class="mt">반민족행위처벌법 (1948.9.22 공포)</h2>
    ${list.map(k => `<div class="lawbox"><b>${esc(LAWS[k].short)}</b> ${esc(LAWS[k].text)}</div>`).join('')}
    ${list.some(k => k.startsWith('L4')) ? `<div class="lawbox"><b>제4조 본문</b> ${esc(LAW4_HEAD)}</div>` : ''}
    <p class="muted">출처: ${esc(SOURCES.law)} (위키문헌·국사편찬위원회 『사료로 본 한국사』 수록본)</p>`, [{ text: '닫기' }], { narrow: true });
}
function showRecords() {
  modal(`<h2 class="mt">역사 기록 · 자료 출처</h2>
    <p class="sub">이 게임의 사실 정보는 아래 자료에서 확인한 내용만 썼어요. 신문 기사·문서의 원문 발췌는 확보하지 못해 싣지 않았어요. 사건 도입부와 재판장 대사는 ‘교육용 재구성’이에요. 일러스트는 실제 자료가 아니에요.</p>
    <h3 style="margin-top:16px">문헌 자료</h3>
    <ul style="padding-left:20px;font-size:14px">${Object.values(SOURCES).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <h3 style="margin-top:16px">이미지 (Wikimedia Commons)</h3>
    <p class="muted">사료 사진 = 실제 역사 사진 · 참고 이미지 = 사건과 직접 관련 없는 비교용 사진 · 분위기 = 배경용</p>
    <div class="credits">${Object.values(IMAGES).map(im => `<a href="${im.page}" target="_blank" rel="noopener">${img(Object.keys(IMAGES).find(k => IMAGES[k] === im), 'small')}<span><b>${esc(im.title)}</b>${esc(im.date)} · ${{ source: '사료 사진', ref: '참고 이미지', mood: '분위기' }[im.kind]}<br>${esc(im.credit)}</span></a>`).join('')}</div>
    <p class="muted" style="margin-top:12px">플레이어가 맡는 특별검찰관은 가상의 인물이에요. 실제 박흥식 사건은 노일환, 이후 정광호 특별검찰관이 맡았어요.</p>`, [{ text: '닫기' }]);
}

/* ---------- portraits ---------- */
function bust(o) {
  const face = `<circle cx="50" cy="42" r="20" fill="${o.skin || '#f0c9a0'}"/>`;
  const hair = o.hair ? `<path d="${o.hair}" fill="${o.hairc || '#2b2620'}"/>` : '';
  const hat = o.hat ? `<path d="M24 32h52l-6-4H30z" fill="${o.hat}"/><path d="M32 30q2-16 18-16t18 16z" fill="${o.hat}"/><rect x="32" y="26" width="36" height="4" fill="#00000033"/>` : '';
  const eyes = o.glasses ? '<circle cx="42" cy="43" r="5" fill="none" stroke="#2b2620" stroke-width="2"/><circle cx="58" cy="43" r="5" fill="none" stroke="#2b2620" stroke-width="2"/><path d="M47 43h6" stroke="#2b2620" stroke-width="2"/><circle cx="42" cy="43" r="1.6" fill="#2b2620"/><circle cx="58" cy="43" r="1.6" fill="#2b2620"/>'
    : '<circle cx="42" cy="43" r="2.2" fill="#2b2620"/><circle cx="58" cy="43" r="2.2" fill="#2b2620"/>';
  const mouth = '<path d="M44 52q6 3 12 0" stroke="#7a4a33" stroke-width="2" fill="none" stroke-linecap="round"/>';
  const body = `<path d="M14 100q4-30 36-32q32 2 36 32z" fill="${o.suit}"/><path d="M42 68l8 12 8-12" fill="#fff"/><path d="M48 70h4l2 18h-8z" fill="${o.tie || '#8a2e25'}"/>`;
  return `<svg viewBox="0 0 100 100">${body}${o.armband ? '<rect x="18" y="80" width="16" height="8" rx="2" fill="#c9a227"/><text x="26" y="87" font-size="7" text-anchor="middle" font-weight="900" fill="#3a2610">特</text>' : ''}${face}${hair}${hat}${eyes}${mouth}</svg>`;
}
const AV = {
  me: () => bust({ suit: '#27395a', hair: 'M30 38q0-20 20-20t20 20q-4-10-20-10t-20 10z', tie: '#e8742a' }),
  senior: () => bust({ suit: '#4a4036', hair: 'M30 38q0-20 20-20t20 20q-6-12-20-12t-20 12z', hairc: '#8a8378', glasses: true, tie: '#2e7d76' }),
  inv: () => bust({ suit: '#5b4a33', hat: '#3a2f26', armband: true, tie: '#3a2f26' }),
  judge: () => bust({ suit: '#1e1e22', hair: 'M30 38q0-20 20-20t20 20q-6-12-20-12t-20 12z', hairc: '#d9d4cb', tie: '#1e1e22' }),
  lawyer: () => bust({ suit: '#6b6f78', hair: 'M30 36q2-18 20-18t20 18q-8-6-20-6t-20 6z', glasses: true, tie: '#5d7f9d' }),
  park: () => `<img class="realphoto" src="${IMAGES.park1940.small}" alt="박흥식 (1940년 매일신보 사진)" loading="eager" decoding="async" data-fb="박흥식 사진">`,
  nar: () => '<svg viewBox="0 0 100 100"><rect x="22" y="18" width="56" height="66" rx="4" fill="#f3e6c6" stroke="#6b5530" stroke-width="3"/><path d="M32 34h36M32 46h36M32 58h24" stroke="#9a8460" stroke-width="4"/><path d="M70 62l12-26 6 3-12 26-8 4z" fill="#a33a2b"/></svg>',
  nuri: mood => mascotSVG(mood || 'happy'),
};

/* ---------- dialogue scenes ---------- */
function lineText(l) {
  if (l.t !== '@REASON') return l.t;
  const r = (REASONS.find(x => x.id === S.ind.reason) || REASONS[0]).text;
  const laws = [S.ind.main, ...S.ind.extra].filter(Boolean).map(id => LAWS[id].short).join(', ') || '제4조 7호';
  return `${r.replace(/^피의자는/, '피고인 박흥식은')} 이에 반민족행위처벌법 ${laws} 위반으로 기소합니다.`;
}
function vScene(id) {
  const sc = SCENES[id], st = stepOf(id), ch = CHAPTERS[st.ch - 1];
  const i = Math.min(S.line, sc.lines.length - 1), l = sc.lines[i], c = CHARS[l.c];
  const last = i >= sc.lines.length - 1;
  const photo = [...sc.lines.slice(0, i + 1)].reverse().find(x => x.photo);
  const isNar = l.c === 'nar';
  return `<section class="scene vn-scene">${sceneBg(sc.bg)}
  <div class="wrap vn enter">
    <div class="vn-top">
      <div class="chapter-card"><span>${ch.n}장</span><b>${esc(ch.title)}</b><em>${esc(st.title)}</em></div>
      <span class="tag illut">교육용 재구성 · 대사는 기록을 바탕으로 다시 꾸몄어요</span>
    </div>
    ${photo ? `<figure class="vn-photo">${img(photo.photo, 'small', '', true)}<figcaption>${IMAGES[photo.photo].kind === 'source' ? '사료 사진' : '사진'}: ${esc(photo.photoNote || IMAGES[photo.photo].title + ' (' + IMAGES[photo.photo].date + ')')}</figcaption></figure>` : ''}
    <div class="vn-cast">${!isNar ? `<div class="vn-av ${l.c}">${AV[c.av](l.mood)}</div>${l.c === 'park' ? '<div class="avcap">사료 사진: 1940년 7월 7일자 매일신보에 실린 박흥식<br>(장면 당시인 1949년 모습은 아님)</div>' : ''}` : ''}</div>
    <div class="vn-box ${isNar ? 'nar' : ''}" id="vnBox" role="button" tabindex="0" aria-label="다음 대사">
      ${!isNar ? `<div class="vn-name">${esc(c.name)}${c.tag ? `<small>${esc(c.tag)}</small>` : ''}</div>` : ''}
      <p class="vn-text" id="vnText" data-full="${esc(lineText(l))}"></p>
      ${l.src ? `<div class="vn-src">기록 근거: ${esc(l.src)}</div>` : (!isNar && l.c !== 'nuri' ? '<div class="vn-src">게임 진행을 위해 만든 대사예요.</div>' : '')}
      <div class="vn-ctrl">
        <span class="muted">${i + 1} / ${sc.lines.length}</span>
        <div class="row">
          ${i > 0 ? '<button class="btn ghost small" data-act="vnprev">◀ 이전</button>' : ''}
          ${!last ? '<button class="btn ghost small" data-act="vnskip">건너뛰기</button>' : ''}
          <button class="btn ${last ? 'orange' : ''} small" data-act="vnnext">${last ? (S.done[id] ? '닫기' : '계속 →') : '다음 ▶'}</button>
        </div>
      </div>
    </div>
  </div></section>`;
}
let typer = null;
function startTyping() {
  const el = $('#vnText'); if (!el) return;
  const full = el.dataset.full; clearInterval(typer);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = full; return; }
  let n = 0; el.textContent = '';
  typer = setInterval(() => { n += 2; el.textContent = full.slice(0, n); if (n >= full.length) { clearInterval(typer); typer = null; } }, 18);
}
function vnNext() {
  const el = $('#vnText');
  if (typer && el) { clearInterval(typer); typer = null; el.textContent = el.dataset.full; return; }
  const id = S.screen, sc = SCENES[id];
  if (S.line < sc.lines.length - 1) { S.line++; save(); render(); return; }
  if (S.done[id]) { go('dash'); return; }
  advance(id);
}

/* ---------- chapter 1 game: three organs ---------- */
function vOrgans() {
  const O = S.organ, allMatched = ORGANS.every(o => O.matched[o.id]);
  return `<section class="scene dash-scene">${sceneBg('ballotbox1948', 'small')}
  <div class="wrap enter">
    <div class="mhead"><div><span class="kicker">1장 · 반민특위의 탄생</span><h2>세 기관의 역할 맞추기</h2>
      <p><span class="only-wide">왼쪽</span><span class="only-narrow">위쪽</span> 기관 카드를 누른 다음, 그 기관이 하는 일을 <span class="only-wide">오른쪽</span><span class="only-narrow">아래쪽</span>에서 고르세요. 틀려도 괜찮아요!</p></div>
      ${mascot(allMatched ? '모두 맞췄어요! 마지막으로 한 문제만 더!' : '조사 → 기소 → 재판, 순서를 떠올려 봐요.', 'happy', 70)}</div>
    <div class="organs">
      <div class="ocol">${ORGANS.map(o => `<button class="ocard ${O.sel === o.id ? 'sel' : ''} ${O.matched[o.id] ? 'ok' : ''}" data-organ="${o.id}" ${O.matched[o.id] ? 'disabled' : ''}>
        <span class="oi">${o.icon}</span><b>${esc(o.name)}</b>${O.matched[o.id] ? `<small>✓ ${esc(ORGAN_ROLES.find(r => r.id === o.role).text)}</small>` : ''}</button>`).join('')}</div>
      <div class="ocol roles"><div class="ohint">${S.organ.sel ? `‘${esc(ORGANS.find(o => o.id === S.organ.sel).name)}’이(가) 하는 일은?` : '기관을 먼저 고르세요'}</div>${ORGAN_ROLES.map(r => { const used = Object.values(O.matched).includes(r.id);
        return `<button class="rcard ${used ? 'ok' : ''}" data-role="${r.id}" ${used ? 'disabled' : ''}>${esc(r.text)}<small>근거: ${esc(r.src)}</small></button>`; }).join('')}</div>
    </div>
    ${allMatched ? `<div class="paper pad quiz enter">
      <h3>${esc(ORGAN_QUIZ.q)}</h3>
      <div class="pen" style="margin-top:12px">${ORGAN_QUIZ.opts.map((q, i) => `<button class="chip ${O.quiz === i ? (q.ok ? 'right' : 'wrongc') : ''}" data-quiz="${i}">${esc(q.t)}</button>`).join('')}</div>
      ${O.quiz !== null && O.quiz !== undefined ? `<div class="result ${ORGAN_QUIZ.opts[O.quiz].ok ? 'r-valid' : 'r-wrong'}"><p>${esc(ORGAN_QUIZ.opts[O.quiz].why)}</p></div>` : ''}
      <p class="muted" style="margin-top:8px">근거: ${esc(ORGAN_QUIZ.src)}</p>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn orange" data-act="organdone" ${O.quiz !== null && O.quiz !== undefined && ORGAN_QUIZ.opts[O.quiz].ok ? '' : 'disabled'}>다음 →</button></div>
    </div>` : ''}
  </div></section>`;
}
function pickOrgan(id) {
  S.organ.sel = id; save(); render();
  if (matchMedia('(max-width: 980px)').matches) { const r = $('.ocol.roles'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
function pickRole(rid) {
  const O = S.organ;
  if (!O.sel) { toast(matchMedia('(max-width: 980px)').matches ? '먼저 위쪽에서 기관을 골라 주세요.' : '먼저 왼쪽에서 기관을 골라 주세요.'); return; }
  const o = ORGANS.find(x => x.id === O.sel);
  if (o.role === rid) { O.matched[o.id] = rid; O.sel = null; save(); toast('정답!'); render(); }
  else { const b = $(`[data-role="${rid}"]`); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); } toast('다시 생각해 봐요. 이 기관이 맡은 단계는?'); }
}

/* ---------- chapter 4: trial ---------- */
let roundTimer = null, tIdx = 0, timeLeft = null, timerRound = -1;
function stopRoundTimers() { clearInterval(roundTimer); roundTimer = null; stopChase(); }
const ORDERS = [[1, 0, 2], [2, 1, 0], [0, 2, 1], [1, 2, 0], [2, 0, 1]];
function solvedLine(R) { return R.line || R.opts.find(o => o.ok).t; }
function solvedReact(R) { return R.react || R.opts.find(o => o.ok).react; }
function vTrial() {
  const T = S.trial, R = TRIAL[Math.min(T.round, TRIAL.length - 1)], c = CHARS[R.who];
  if (timerRound !== T.round) { timerRound = T.round; tIdx = 0; timeLeft = null; }
  const typeName = { choice: '반박 선택', evidence: '증거 제시', testimony: '증언 흔들기', timed: '제한 시간', sort: '사실·주장 가리기' }[R.type];
  const react = solvedReact(R);
  let body = '';
  if (T.solved) {
    body = `<div class="objection enter"><div class="obj-stamp">반박 성공!</div>
      <div class="react me"><div class="vn-av sm">${AV.me()}</div><div><b>나 (특별검찰관)</b><p>${esc(solvedLine(R))}</p></div></div>
      <div class="react"><div class="vn-av sm">${AV[CHARS[react.c].av]()}</div><div><b>${esc(CHARS[react.c].name)}</b><p>${esc(react.t)}</p></div></div>
      <div class="row" style="justify-content:flex-end"><button class="btn orange" data-act="trialnext">${T.round >= TRIAL.length - 1 ? '구형 의견으로 →' : '다음 반박 듣기 →'}</button></div></div>`;
  } else if (R.type === 'choice' || R.type === 'timed') {
    body = `<h3 class="sect-title tq">${esc(R.ask)}</h3>
      ${R.type === 'timed' ? `<div class="timer"><div class="tfill" id="tfill"></div><span id="tsec">${R.seconds}초</span></div>` : ''}
      <div class="rebuts">${ORDERS[T.round % 5].map(i => [R.opts[i], i]).map(([o, i]) => { const w = T.wrong.includes(i);
        return `<button class="rebut ${w ? 'wrong' : ''}" data-rebut="${i}" ${w ? 'disabled' : ''}>
          <p>${esc(o.t)}</p>${evChips(o.ev)}${w ? `<div class="why">✗ ${esc(o.why)}</div>` : ''}</button>`; }).join('')}</div>`;
  } else if (R.type === 'evidence') {
    const { evs } = m2Pool();
    body = `<h3 class="sect-title tq">${esc(R.ask)}</h3>
      ${T.lastWhy ? `<div class="tfeed shake">✗ ${esc(T.lastWhy)}</div>` : ''}
      <div class="evpick">${evs.map(id => { const w = T.wrong.includes(id);
        return `<button class="bcard ${T.picked === id ? 'sel' : ''} ${w ? 'used' : ''}" data-evpick="${id}" ${w ? 'disabled' : ''}>
          <div class="thumb" style="position:relative">${visual(id)}</div><div class="t">${esc(ev(id).title)}</div><div class="d">${esc(ev(id).period)}</div></button>`; }).join('')}</div>
      <div class="row present"><span class="muted">${T.picked ? '고른 증거: <b>' + esc(ev(T.picked).title) + '</b>' : '증거 카드를 하나 고르세요.'}</span>
        <button class="btn red big" data-act="present" ${T.picked ? '' : 'disabled'}>📌 증거 제시!</button></div>`;
  } else if (R.type === 'testimony') {
    body = `<div class="testi">
      <div class="testi-head"><b>증언</b><span>${R.statements.map((_, i) => `<i data-dot="${i}"></i>`).join('')}</span></div>
      <p class="testi-line" id="testiLine"></p>
      <div class="testi-bar"><div id="testiFill"></div></div>
    </div>
    ${T.lastWhy ? `<div class="tfeed shake">✗ ${esc(T.lastWhy)}</div>` : ''}
    <div class="row present"><span class="muted">문장이 차례로 지나가요. 논리가 틀린 문장일 때 누르세요!</span>
      <button class="btn red big objbtn" data-act="object">이의 있음!</button></div>`;
  } else if (R.type === 'sort') {
    body = `<h3 class="sect-title tq">${esc(R.ask)}</h3>
      ${T.lastWhy ? `<div class="tfeed shake">✗ ${esc(T.lastWhy)}</div>` : ''}
      <div class="sorts">${R.items.map((it, i) => { const done = T.sorted && T.sorted[i];
        return `<div class="sortrow ${done ? 'ok' : ''}"><p>${esc(it.t)}</p>
          ${done ? `<span class="tag ${it.fact ? 'biz' : 'issue'}">${it.fact ? '확인된 사실' : '확인되지 않은 주장'}</span>`
            : `<div class="row"><button class="btn teal small" data-sort="${i}:1">확인된 사실</button><button class="btn small" data-sort="${i}:0">확인되지 않은 주장</button></div>`}</div>`; }).join('')}</div>`;
  }
  return `<section class="scene court-scene">${sceneBg('courthouse')}
  <div class="wrap enter">
    <div class="mhead"><div><span class="kicker">4장 · 특별재판부</span><h2>공판: 반박과 재반박</h2>
      <p>피고 측 주장을 듣고, <b style="color:var(--gold)">증거에 근거해</b> 다시 반박하세요.</p></div>
      <div class="trialbar"><div class="tb-round">반박 <b>${Math.min(T.round + 1, TRIAL.length)}</b>/${TRIAL.length} <span class="ttype">${typeName}</span></div>
        <div class="tb-hp" title="설득력">설득력 ${Array.from({ length: TRIAL_HP }, (_, i) => `<span class="${i < T.hp ? 'on' : ''}">⚖</span>`).join('')}</div></div>
    </div>
    <div class="bench">
      <div class="seat def ${!T.solved && R.who === 'lawyer' ? 'talk' : ''}"><div class="vn-av">${AV.lawyer()}</div><span>변호인</span></div>
      <div class="seat def ${!T.solved && R.who === 'park' ? 'talk' : ''}"><div class="vn-av">${AV.park()}</div><span>피고인 박흥식<small class="seatcap">사진: 1940년 매일신보</small></span></div>
      <div class="seat judge ${T.solved && react.c === 'judge' ? 'talk' : ''}"><div class="vn-av">${AV.judge()}</div><span>재판장</span></div>
      <div class="seat pros ${T.solved ? 'talk' : ''}"><div class="vn-av">${AV.me()}</div><span>검찰관 (나)</span></div>
    </div>
    ${R.type !== 'testimony' || T.solved ? `<div class="claim ${T.solved ? 'dim' : ''}">
      <div class="vn-name">${esc(c.name)}<small>${R.who === 'park' ? '피고인 · 실존 인물' : '피고 측'}</small></div>
      <p>${R.type === 'testimony' ? esc(R.statements.map(x => x.t).join(' ')) : '“' + esc(R.claim) + '”'}</p>
      <div class="vn-src">기록 근거: ${esc(R.src)}</div></div>`
    : `<div class="claim"><div class="vn-name">${esc(c.name)}<small>피고 측</small></div><p style="font-size:16px">${esc(R.claim)}</p><div class="vn-src">기록 근거: ${esc(R.src)}</div></div>`}
    ${body}
  </div></section>`;
}
function evChips(evs) {
  return evs.length ? `<div class="evchips">${evs.map(e => `<span class="evchip"><span class="th">${miniVisual(e)}</span>${esc(ev(e).title)}</span>`).join('')}</div>`
    : '<div class="evchips"><span class="evchip none">제시할 증거 없음</span></div>';
}
function startRoundTimers() {
  stopRoundTimers();
  const T = S.trial, R = TRIAL[T.round];
  if (!R || T.solved || S.screen !== 'trial') return;
  const slow = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1.5 : 1;
  if (R.type === 'timed') {
    const total = R.seconds * slow;
    if (timeLeft === null) timeLeft = total;
    const paint = () => { const f = $('#tfill'), sec = $('#tsec'); if (f) f.style.width = (timeLeft / total * 100) + '%'; if (sec) sec.textContent = Math.ceil(timeLeft) + '초'; if (f) f.classList.toggle('low', timeLeft < 5); };
    paint();
    roundTimer = setInterval(() => {
      if (!$('#modal').hidden) return;
      timeLeft -= 0.1; paint();
      if (timeLeft <= 0) { stopRoundTimers(); timeLeft = null; loseHp('시간 초과! 재판장이 답변을 재촉했어요. 반박을 빠르게 떠올려 봐요.', '제한 시간 안에 반박하지 못했어요.'); }
    }, 100);
  } else if (R.type === 'testimony') {
    const speed = R.speed * slow;
    let t0 = performance.now();
    const show = () => {
      const line = $('#testiLine'); if (!line) return;
      line.textContent = R.statements[tIdx].t; line.classList.remove('pop'); void line.offsetWidth; line.classList.add('pop');
      $$('[data-dot]').forEach(d => d.classList.toggle('on', +d.dataset.dot === tIdx));
    };
    show();
    roundTimer = setInterval(() => {
      if (!$('#modal').hidden) { t0 = performance.now(); return; }
      const el = performance.now() - t0, fill = $('#testiFill');
      if (fill) fill.style.width = Math.min(100, el / speed * 100) + '%';
      if (el >= speed) { tIdx = (tIdx + 1) % R.statements.length; t0 = performance.now(); show(); }
    }, 50);
  }
}
function loseHp(why, issueText) {
  const T = S.trial;
  T.hp -= 1; T.lastWhy = why; save();
  if (T.hp > 0) { render(); const c = $('.tfeed') || $('.rebut.wrong:last-of-type'); if (c) c.classList.add('shake'); return; }
  const R = TRIAL[T.round];
  const issues = [{ text: `반박 ${T.round + 1}(${R.type === 'testimony' ? '증언 흔들기' : R.claim.slice(0, 24) + '…'}): ${issueText || why}` }];
  spend('trial', issues);
  S.trial = { round: 0, hp: TRIAL_HP, wrong: [], solved: false }; timerRound = -1; save();
  if (S.failed) { render(); return; }
  failModal('bad', '재판부가 공판을 연기했어요', [{ text: '설득력을 모두 잃었어요. 첫 번째 반박부터 다시 시작해요.' }, ...issues],
    [{ text: '조사 기록 다시 보기', cls: 'ghost', fn: () => go('m1') }, { text: '공판 다시 시작', cls: 'orange', fn: render }]);
}
function solveRound() { const T = S.trial; T.solved = true; T.lastWhy = null; stopRoundTimers(); save(); flash(); render(); }
function pickRebut(i) {
  const T = S.trial, R = TRIAL[T.round], o = R.opts[i];
  if (o.ok) { solveRound(); return; }
  T.wrong.push(i);
  if (R.type === 'timed') timeLeft = null;
  loseHp(o.why);
}
function presentEvidence() {
  const T = S.trial, R = TRIAL[T.round], id = T.picked;
  if (!id) return;
  if (id === R.answer) { solveRound(); return; }
  T.wrong.push(id); T.picked = null;
  loseHp((R.whyEv[id] || R.whyDefault), `‘${ev(id).title}’을(를) 제시했어요. ${R.whyEv[id] || R.whyDefault}`);
}
function objectNow() {
  const T = S.trial, R = TRIAL[T.round], st = R.statements[tIdx];
  if (st.target) { solveRound(); return; }
  loseHp(R.whyStatement[tIdx], `“${st.t}”에 이의를 제기했어요. ${R.whyStatement[tIdx]}`);
}
function sortItem(i, fact) {
  const T = S.trial, R = TRIAL[T.round], it = R.items[i];
  if (!T.sorted) T.sorted = {};
  if (it.fact === fact) {
    T.sorted[i] = true; T.lastWhy = null; save();
    if (R.items.every((_, k) => T.sorted[k])) { solveRound(); return; }
    render(); return;
  }
  loseHp(it.why, `“${it.t}”를 잘못 분류했어요. ${it.why}`);
}
function trialNext() {
  const T = S.trial;
  if (T.round >= TRIAL.length - 1) { advance('trial'); return; }
  T.round += 1; T.solved = false; T.wrong = []; T.picked = null; T.sorted = {}; T.lastWhy = null; save(); render();
}


/* ---------- chapter 2: chase (tap mini-game) ---------- */
const CHASE = { tap: 4, decay: 4, time: 3.5 };
let CH = null;
function chaseTime() { return CHASE.time; }
function stopChase() { if (CH && CH.timer) { clearInterval(CH.timer); CH.timer = null; } }
function vChase() {
  return `<section class="scene chase-scene">${sceneBg('hwashin')}
  <div class="wrap enter">
    <div class="mhead"><div><span class="kicker">2장 · 특별조사위원회</span><h2>사장실 추격!</h2>
      <p>박흥식이 비밀문으로 빠져나가 어딘가에 연락하려 해요. <b style="color:var(--gold)">화면을 빠르게 연타</b>해서 전화가 연결되기 전에 따라잡으세요!</p></div>
      <span class="tag illut">교육용 재구성 · 미니게임</span></div>
    <div class="chase" id="chase">
      <div class="ch-hud">
        <div class="ch-call"><span>☎ 전화 연결까지</span><div class="ch-bar"><div id="chCall"></div></div><b id="chSec">${chaseTime().toFixed(1)}초</b></div>
        <div class="ch-tries">${S.chaseFails ? `실패 ${S.chaseFails}번` : '첫 도전'}</div>
      </div>
      <div class="ch-track">
        <div class="ch-floor"></div>
        <div class="ch-door" aria-hidden="true"><div class="ch-park">${AV.park()}</div><div class="ch-phone" id="chPhone">☎</div><small>비밀문 너머</small></div>
        <div class="ch-runner" id="chRunner" aria-hidden="true">${AV.inv()}<div class="ch-dust"></div></div>
        <div class="ch-pct" id="chPct">0%</div>
      </div>
      <div class="ch-over" id="chOver"></div>
      <button class="ch-tap" id="chTap" type="button" aria-label="달리기 (연타)">
        <span class="big">🏃 다다다닥!</span><span class="sm" id="chTapSm">눌러서 시작</span>
      </button>
      <p class="muted ch-help">컴퓨터에서는 스페이스바를 연타해도 돼요. 실패해도 보완 조사 기회는 줄지 않아요.</p>
    </div>
  </div></section>`;
}
function bindChase() {
  stopChase();
  CH = { phase: 'ready', pos: 0, left: chaseTime(), timer: null, last: 0, taps: 0 };
  const tapBtn = $('#chTap'); if (!tapBtn) return;
  const onTap = e => { if (e) e.preventDefault(); chaseTap(); };
  tapBtn.addEventListener('pointerdown', onTap);
  tapBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) onTap(e); else if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
  tapBtn.focus({ preventScroll: true });
  paintChase();
}
document.addEventListener('keydown', e => {
  if (S.screen !== 'chase' || e.key !== ' ' || e.repeat || !$('#modal').hidden) return;
  if (document.activeElement && document.activeElement.id === 'chTap') return;
  e.preventDefault(); chaseTap();
});
function chaseTap() {
  if (!CH) return;
  if (CH.phase === 'ready') { startChaseCount(); return; }
  if (CH.phase !== 'run') return;
  CH.pos = Math.min(100, CH.pos + CHASE.tap); CH.taps++;
  const r = $('#chRunner'); if (r) { r.classList.remove('step'); void r.offsetWidth; r.classList.add('step'); }
  if (CH.pos >= 100) chaseEnd(true); else paintChase();
}
function startChaseCount() {
  CH.phase = 'count';
  const ov = $('#chOver'), sm = $('#chTapSm');
  let n = 3;
  const show = () => { ov.className = 'ch-over count'; ov.innerHTML = `<b>${n}</b>`; if (sm) sm.textContent = '준비…'; };
  show();
  CH.timer = setInterval(() => {
    n--;
    if (n > 0) { show(); return; }
    clearInterval(CH.timer); CH.timer = null;
    ov.className = 'ch-over go'; ov.innerHTML = '<b>달려라!</b>';
    setTimeout(() => { if (ov.classList.contains('go')) { ov.className = 'ch-over'; ov.innerHTML = ''; } }, 600);
    if (sm) sm.textContent = '계속 연타!';
    CH.phase = 'run'; CH.last = performance.now();
    CH.timer = setInterval(chaseTick, 50);
  }, 650);
}
function chaseTick() {
  if (!$('#modal').hidden) { CH.last = performance.now(); return; }
  const now = performance.now(), dt = (now - CH.last) / 1000; CH.last = now;
  CH.left -= dt; CH.pos = Math.max(0, CH.pos - CHASE.decay * dt);
  if (CH.left <= 0) { CH.left = 0; chaseEnd(false); return; }
  paintChase();
}
function paintChase() {
  const total = chaseTime();
  const r = $('#chRunner'), c = $('#chCall'), sec = $('#chSec'), pct = $('#chPct'), ph = $('#chPhone');
  if (r) r.style.left = `calc(${CH.pos} * (100% - ${innerWidth <= 640 ? 186 : 266}px) / 100 + 8px)`;
  if (c) { c.style.width = (100 - CH.left / total * 100) + '%'; c.classList.toggle('low', CH.left < 2.5); }
  if (sec) sec.textContent = CH.left.toFixed(1) + '초';
  if (pct) pct.textContent = Math.round(CH.pos) + '%';
  if (ph) ph.classList.toggle('ring', CH.phase === 'run' && CH.left < 3);
}
function chaseEnd(win) {
  stopChase(); CH.phase = win ? 'win' : 'fail'; paintChase();
  const ov = $('#chOver'), tap = $('#chTap');
  if (tap) tap.disabled = true;
  if (win) {
    flash();
    ov.className = 'ch-over win';
    ov.innerHTML = `<div class="ch-res"><div class="obj-stamp">따라잡았다!</div>
      <p>연타 ${CH.taps}번으로 박흥식을 따라잡았어요.</p>
      <button class="btn orange" id="chNext">계속 →</button></div>`;
    $('#chNext').addEventListener('click', () => { S.chaseFails = 0; save(); advance('chase'); });
    $('#chNext').focus();
  } else {
    S.chaseFails = (S.chaseFails || 0) + 1; save();
    ov.className = 'ch-over fail';
    ov.innerHTML = `<div class="ch-res"><div class="obj-stamp fail">놓쳤다!</div>
      <p>전화가 연결되고 말았어요. 처음부터 다시 쫓아가요!</p>
      <button class="btn orange" id="chRetry">다시 도전</button></div>`;
    $('#chRetry').addEventListener('click', () => render());
    $('#chRetry').focus();
  }
}
/* ---------- events ---------- */
function bind() {
  $$('[data-go]', app).forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  $$('[data-open]', app).forEach(b => b.addEventListener('click', () => openViewer(b.dataset.open)));
  $$('[data-cat]', app).forEach(b => b.addEventListener('click', () => { S.cat = b.dataset.cat; save(); render(); }));
  $$('[data-remove]', app).forEach(b => b.addEventListener('click', () => { if (S.done.m1) return; S.locker = S.locker.filter(x => x !== b.dataset.remove); save(); render(); }));
  $$('[data-view]', app).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openViewer(b.dataset.view); }));
  $$('[data-law]', app).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); showLaw(b.dataset.law); }));
  $$('[data-pick]', app).forEach(b => {
    const f = () => { const id = b.dataset.pick; if (S.pick.includes(id)) S.pick = S.pick.filter(x => x !== id); else S.pick = [...S.pick, id].slice(-2); S.lastPair = null; save(); render(); };
    b.addEventListener('click', f);
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } });
  });
  if (S.screen === 'm3' && !S.failed) {
    typeM3();
    $$('input[name=main]', app).forEach(r => r.addEventListener('change', () => { readM3(); render(); }));
    $$('input[name=extra],input[name=ev],input[name=reason]', app).forEach(r => r.addEventListener('change', () => { readM3(); typeM3(); }));
  }
  if (S.screen === 'm4' && !S.failed) {
    $$('input[name=type]', app).forEach(r => r.addEventListener('change', () => { $('#yearsStep').classList.toggle('hidden', !(r.value === 'prison' || r.value === 'civil')); readM4(); }));
    $$('input[name=conf],input[name=sreason],input[name=years]', app).forEach(r => r.addEventListener('change', readM4));
    $$('[data-step]', app).forEach(b => b.addEventListener('click', () => { const i = $('input[name=years]', app); i.value = Math.max(1, (parseInt(i.value, 10) || 1) + +b.dataset.step); readM4(); }));
  }
  $$('[data-organ]', app).forEach(b => b.addEventListener('click', () => pickOrgan(b.dataset.organ)));
  $$('[data-role]', app).forEach(b => b.addEventListener('click', () => pickRole(b.dataset.role)));
  $$('[data-quiz]', app).forEach(b => b.addEventListener('click', () => { S.organ.quiz = +b.dataset.quiz; save(); render(); }));
  $$('[data-rebut]', app).forEach(b => b.addEventListener('click', () => pickRebut(+b.dataset.rebut)));
  $$('[data-evpick]', app).forEach(b => b.addEventListener('click', () => { S.trial.picked = b.dataset.evpick; save(); render(); }));
  $$('[data-sort]', app).forEach(b => b.addEventListener('click', () => { const [i, f] = b.dataset.sort.split(':'); sortItem(+i, f === '1'); }));
  const vb = $('#vnBox');
  if (vb) {
    vb.addEventListener('click', e => { if (!e.target.closest('button')) vnNext(); });
    vb.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) { e.preventDefault(); vnNext(); } });
  }
  const sn = $('#stuName');
  if (sn) { sn.addEventListener('input', () => { S.name = sn.value.trim(); save(); }); sn.addEventListener('keydown', e => { if (e.key === 'Enter') submitM5(); }); }
  const ta = $('#reflect');
  if (ta) ta.addEventListener('input', () => { S.reflection = ta.value; $('#rcount').textContent = ta.value.trim().length + '자'; save(); });

  $$('[data-act]', app).forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'start') startGame();
    else if (a === 'reset') confirmReset();
    else if (a === 'reset-now') { S = fresh(); save(); go('title'); }
    else if (a === 'm1submit') submitM1();
    else if (a === 'combine') doCombine();
    else if (a === 'clearpick') { S.pick = []; save(); render(); }
    else if (a === 'm2submit') submitM2();
    else if (a === 'm3submit') submitM3();
    else if (a === 'm4submit') submitM4();
    else if (a === 'm5submit') submitM5();
    else if (a === 'records') showRecords();
    else if (a === 'copy') copyResult();
    else if (a === 'resubmit') {
      if (!S.name || S.name.length < 2) { go('m5'); toast('학번과 이름을 입력하고 제출해 주세요.'); return; }
      b.disabled = true; b.textContent = '보내는 중…';
      sendSubmission(() => { toast('선생님께 제출했어요!'); render(); }, () => { b.disabled = false; b.textContent = '다시 시도'; toast('제출하지 못했어요. 인터넷 연결을 확인해 주세요.'); });
    }
    else if (a === 'vnnext') vnNext();
    else if (a === 'vnprev') { clearInterval(typer); typer = null; S.line = Math.max(0, S.line - 1); save(); render(); }
    else if (a === 'vnskip') { clearInterval(typer); typer = null; S.line = SCENES[S.screen].lines.length - 1; save(); render(); }
    else if (a === 'organdone') advance('c1g');
    else if (a === 'trialnext') trialNext();
    else if (a === 'present') presentEvidence();
    else if (a === 'object') objectNow();
  }));
}
function startGame() {
  const cf = $('#casefile'); const target = (S.reached > 0 || S.line > 0) ? 'dash' : 'c1a';
  if (cf && getComputedStyle(cf.parentElement).display !== 'none' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cf.classList.add('open'); setTimeout(() => go(target), 650);
  } else go(target);
}
function copyResult() {
  const t = summaryText(); const done = () => toast('결과를 복사했어요. 과제 제출란에 붙여 넣으세요.');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
  else fallbackCopy(t, done);
}
function fallbackCopy(t, cb) {
  const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); cb(); } catch (e) { toast('복사하지 못했어요. 직접 선택해 복사해 주세요.'); }
  ta.remove();
}
function confirmReset() {
  modal(`<div class="modal-hero">${mascot('', 'sad', 90, false)}<div><h2 class="mt">처음부터 다시 할까요?</h2><p class="sub">지금까지의 진행 상황이 모두 지워져요.</p></div></div>`,
    [{ text: '취소', cls: 'ghost' }, { text: '초기화', cls: 'red', fn: () => { S = fresh(); save(); go('title'); } }], { narrow: true });
}
$('#btnSources').addEventListener('click', showRecords);
$('#btnReset').addEventListener('click', confirmReset);

if (S.screen === 'end' && !S.done.m5) S.screen = 'dash';
render();
})();
