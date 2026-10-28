/* 반민특위 재판정 — 게임 로직 */
(() => {
'use strict';

const KEY = 'banmin-trial-v1';
const MAX_CHANCES = 4;
const LOCKER_MAX = 6;
const MISSIONS = [
  { n: 1, short: '사건 파일', title: '사건 파일: 수사 개시', desc: '자료를 읽고 핵심 증거를 보관함에 담는다' },
  { n: 2, short: '증거 조합', title: '증거 조합: 연결되는 단서', desc: '증거와 법 조항을 짝지어 혐의를 세운다' },
  { n: 3, short: '기소장', title: '기소장 작성: 법적 책임을 입증하라', desc: '조항·증거·기소 이유를 골라 기소장을 낸다' },
  { n: 4, short: '구형', title: '구형 의견: 어떤 형벌을 제안할까?', desc: '법정형 범위 안에서 형벌과 이유를 정한다' },
  { n: 5, short: '역사의 결말', title: '역사의 결말: 실제 재판과 비교', desc: '1949년 실제 재판 결과를 확인하고 생각을 적는다' },
];
const REQUIRED_LINKS = [
  { key: 'K1', label: '조선비행기공업은 어떤 회사였나? (회사 기록끼리 연결)' },
  { key: 'K2', label: '핵심 혐의: 회사 기록 + 알맞은 법 조항' },
  { key: 'K3', label: '보조 혐의: 단체 활동 또는 기고문 + 알맞은 법 조항' },
];

/* ---------- state ---------- */
const fresh = () => ({
  screen: 'title', mission: 1, done: {},
  viewed: [], locker: [], current: null,
  pick: [], tried: [], found: {}, lastVerdict: null, missStreak: 0,
  chances: MAX_CHANCES, mistakes: [],
  ind: { main: '', extra: [], ev: [], reason: '' },
  sent: { type: '', years: '', conf: '', reason: '' },
  reflection: '', failed: false,
});
let S = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(fresh(), JSON.parse(raw));
  } catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ev = id => EVIDENCE[id];
const label = id => id.startsWith('L') ? `${LAWS[id].short} ${LAWS[id].name}` : EVIDENCE[id].title;
const stageItems = st => Object.keys(EVIDENCE).filter(id => EVIDENCE[id].stage <= st);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200);
}

function modal(html, buttons = [{ text: '확인', cls: 'btn' }]) {
  const m = $('#modal'), body = $('#modalBody');
  body.innerHTML = html + `<div class="row" style="margin-top:18px;justify-content:flex-end">${buttons.map((b, i) => `<button class="${b.cls || 'btn'}" data-mi="${i}">${esc(b.text)}</button>`).join('')}</div>`;
  m.hidden = false;
  body.querySelectorAll('[data-mi]').forEach(btn => btn.addEventListener('click', () => {
    m.hidden = true; const b = buttons[+btn.dataset.mi]; if (b.fn) b.fn();
  }));
  const first = body.querySelector('[data-mi]'); if (first) first.focus();
}

function go(screen) {
  S.screen = screen; save(); render();
  window.scrollTo({ top: 0 }); app.focus({ preventScroll: true });
}

function spend(mission, issues) {
  S.chances -= 1;
  S.mistakes.push({ mission, issues: issues.map(i => ({ text: i.text, recheck: i.recheck || [] })) });
  if (S.chances <= 0) { S.failed = true; S.screen = 'fail'; }
  save();
}

function chancesLeftText() {
  return S.chances > 0 ? `남은 보완 조사 기회: ${S.chances}번` : '보완 조사 기회를 모두 썼습니다.';
}

/* ---------- chrome ---------- */
function renderChrome() {
  const bar = $('#topbar');
  bar.hidden = S.screen === 'title';
  $('#steps').innerHTML = MISSIONS.map(m => {
    const cls = S.done[m.n] ? 'done' : (S.mission === m.n ? 'now' : '');
    return `<li class="${cls}">${m.n}. ${m.short}</li>`;
  }).join('');
  $('#chances').innerHTML = '<span>기회</span>' + Array.from({ length: MAX_CHANCES }, (_, i) => `<i class="${i < S.chances ? '' : 'used'}"></i>`).join('');
  $('#chances').title = chancesLeftText();
}

function render() {
  renderChrome();
  const v = {
    title: vTitle, dash: vDash, m1: vM1, m2: vM2, m3: vM3, m4: vM4, m5: vM5, end: vEnd, fail: vFail,
  }[S.failed ? 'fail' : S.screen] || vDash;
  app.innerHTML = v();
  bind();
}

/* ---------- views ---------- */
function vTitle() {
  const started = S.viewed.length > 0 || S.done[1];
  return `<section class="title-screen"><div class="folder">
    <span class="stamp">특별검찰부</span>
    <div class="case">1949 · 반민 사건 제1호</div>
    <h1>반민특위 재판정</h1>
    <div class="sub">1949년, 친일 청산의 증거를 찾아라</div>
    <p class="intro">당신은 1949년 반민족행위특별재판부의 <b>특별검찰관(검사)</b>이다.
      사건 기록을 조사하고, 증거와 법 조항을 연결해 기소장을 완성하라.</p>
    <div class="row" style="justify-content:center">
      <button class="btn rust" data-act="start">${started ? '수사 이어서 하기' : '사건 시작'}</button>
      ${started ? '<button class="btn ghost" data-act="reset">처음부터</button>' : ''}
    </div>
  </div></section>`;
}

function vDash() {
  const total = Object.keys(EVIDENCE).filter(id => EVIDENCE[id].role !== 'noise').length;
  const pct = Math.round((MISSIONS.filter(m => S.done[m.n]).length / MISSIONS.length) * 100);
  const cur = MISSIONS.find(m => m.n === S.mission);
  return `<div class="page-head">
    <div class="kicker">사건 대시보드</div>
    <h2>반민 사건 제1호 · 피의자 박흥식</h2>
    <p>지금 할 일: <b>MISSION ${cur.n}. ${esc(cur.title)}</b></p>
  </div>
  <div class="dash">
    <div class="paper">
      <div class="profile">
        <div class="mug" aria-hidden="true">朴</div>
        <div>
          <h3 style="font-size:22px">박흥식 <span style="font-size:15px;color:var(--ink3)">朴興植 · 1903~1994</span></h3>
          <dl class="kv">
            <dt>출생</dt><dd>평안남도 용강</dd>
            <dt>직업</dt><dd>화신백화점·조선비행기공업㈜ 사장</dd>
            <dt>체포</dt><dd>1949년 1월 8일, 화신 사장실 (반민특위 검거 제1호)</dd>
          </dl>
        </div>
      </div>
      <p class="note" style="margin-top:12px">출처: ${esc(SOURCES.enc)}</p>
      <div class="section-label">사건 진행도</div>
      <div class="meter"><span style="width:${pct}%"></span></div>
      <div class="note">${pct}% 완료 · 보관함 증거 ${S.locker.length}개 · 열람한 자료 ${S.viewed.length}건 · ${chancesLeftText()}</div>
      <div class="row" style="margin-top:16px">
        <button class="btn rust" data-go="m${S.mission}">MISSION ${S.mission} 계속하기</button>
        <button class="btn ghost" data-go="m1">사건 파일 열람</button>
      </div>
    </div>
    <div class="paper">
      <div class="col-title">수사 순서</div>
      <ol class="mission-list">
        ${MISSIONS.map(m => {
          const st = S.done[m.n] ? 'done' : (S.mission === m.n ? 'now' : (m.n > S.mission ? 'lock' : ''));
          return `<li class="${st}"><span class="n">${S.done[m.n] ? '✓' : m.n}</span>
            <div><div class="mt">${esc(m.title)}</div><div class="md">${esc(m.desc)}</div></div></li>`;
        }).join('')}
      </ol>
      <p class="note" style="margin-top:12px">틀리면 ‘보완 조사’를 하고 다시 도전할 수 있다. 기회 ${MAX_CHANCES}번을 모두 쓰면 수사가 실패한다.</p>
    </div>
  </div>`;
}

/* MISSION 1 */
function vM1() {
  const items = stageItems(S.done[1] ? 2 : 1);
  const cur = S.current && items.includes(S.current) ? S.current : null;
  const brief = !S.viewed.length ? `<div class="paper" style="margin-bottom:16px">
      <span class="recon">교육용 재구성</span>
      <p style="margin:0">1949년 1월. 오늘 반민특위 특경대가 화신 사장 박흥식을 체포했다. 당신이 이 사건을 맡는다.
      책상 위 사건 기록을 하나씩 읽고, <b>혐의를 입증할 자료</b>만 골라 증거 보관함에 담아라.</p>
    </div>` : '';
  return `<div class="page-head">
    <div class="kicker">MISSION 1</div>
    <h2>사건 파일: 수사 개시</h2>
    <p>자료를 클릭해 읽고, 혐의 입증에 필요한 것만 보관함에 담자.</p>
  </div>
  ${brief}
  <div class="guide"><b>목표</b><span>박흥식이 어떤 반민족행위를 했는지 보여 주는 <b>핵심 증거</b>를 모아 수사 보고를 하자. 관련 없는 자료를 넣으면 감점이다.</span></div>
  <div class="inv">
    <div class="col-files">
      <div class="col-title"><span>사건 자료 (${items.length})</span><span>${S.viewed.filter(v => items.includes(v)).length}건 열람</span></div>
      <div class="file-list">
        ${items.map(id => {
          const e = ev(id); const inL = S.locker.includes(id); const seen = S.viewed.includes(id);
          const tag = inL ? '<span class="tag in">보관함</span>' : (e.stage === 2 && !seen ? '<span class="tag new">추가</span>' : (seen ? '<span class="tag seen">열람</span>' : ''));
          return `<button class="file ${cur === id ? 'active' : ''}" data-open="${id}">
            <span class="ic">${e.icon}</span><span><div class="ft">${esc(e.title)}</div><div class="fk">${esc(e.kind)} · ${esc(e.period)}</div></span>${tag}</button>`;
        }).join('')}
      </div>
    </div>
    <div class="col-doc">${cur ? docView(cur) : `<div class="doc"><div class="empty">왼쪽 목록에서 자료를 골라 열람하세요.</div></div>`}</div>
    <div class="col-locker">
      <div class="col-title"><span>증거 보관함</span><span>${S.locker.length}/${LOCKER_MAX}</span></div>
      <div class="locker">
        ${S.locker.map(id => `<div class="slot"><span>${ev(id).icon}</span><span>${esc(ev(id).title)}</span><button class="x" data-remove="${id}" aria-label="빼기">×</button></div>`).join('')}
        ${Array.from({ length: Math.max(0, LOCKER_MAX - S.locker.length) }, () => '<div class="slot empty-slot">빈 칸</div>').join('')}
        ${S.done[1]
          ? `<button class="btn" style="width:100%;margin-top:6px" data-go="m${S.mission}">MISSION ${S.mission}로 돌아가기</button>`
          : `<button class="btn rust" style="width:100%;margin-top:6px" data-act="m1submit" ${S.locker.length ? '' : 'disabled'}>수사 보고하기</button>`}
      </div>
    </div>
  </div>`;
}

function docView(id) {
  const e = ev(id); const inL = S.locker.includes(id);
  const canAdd = !S.done[1];
  return `<article class="doc">
    <div class="dk">${esc(e.kind)}</div>
    <h3>${esc(e.title)}</h3>
    <div class="meta">시기: ${esc(e.period)}</div>
    <div class="field"><div class="lb">핵심 내용</div>${esc(e.content)}</div>
    <div class="field proves"><div class="lb">이 자료로 입증할 수 있는 사실</div>${esc(e.proves)}</div>
    <div class="field caution"><div class="lb">주의할 점</div>${esc(e.caution)}</div>
    <div class="orig">원문 발췌: 미수록 (원문 자료 확보 필요) — 위 내용은 아래 연구·사전 자료를 요약한 것이다.</div>
    <div class="src">출처: ${e.source.map(esc).join(' / ')}</div>
    <div class="actions">${canAdd
      ? (inL ? `<button class="btn ghost" data-remove="${id}">보관함에서 빼기</button>` : `<button class="btn rust" data-add="${id}">증거 보관함에 담기</button>`)
      : `<span class="note">${inL ? '보관함에 있는 증거' : (e.stage === 2 ? '추가 수사로 들어온 자료 (증거 조합에서 사용)' : '보관함에 담지 않은 자료')}</span>`}
    </div>
  </article>`;
}

function submitM1() {
  const L = S.locker; const issues = [];
  if (!L.includes('E1')) issues.push({ text: '피의자가 경영한 군수 회사에 대한 기록이 빠졌다. 박흥식이 어떤 회사를 세우고 무슨 자리에 있었는지 확인하자.', recheck: ['E1'] });
  if (!L.includes('E2')) issues.push({ text: '그 회사가 ‘군수’ 회사였다는 근거가 없다. 회사의 성격을 보여 주는 문서를 찾아보자.', recheck: ['E2'] });
  if (!L.includes('E6') && !L.includes('E7')) issues.push({ text: '전쟁 협력을 보여 주는 다른 행적(단체 활동이나 기고문)이 하나도 없다.', recheck: ['E6', 'E7'] });
  const noise = L.filter(id => ev(id).role === 'noise');
  noise.forEach(id => issues.push({ text: `‘${ev(id).title}’은(는) 혐의 입증과 관련이 낮다. ${ev(id).caution}`, recheck: [id] }));
  if (!issues.length) {
    S.done[1] = true; S.mission = 2; save();
    modal(`<span class="mres ok">수사 보고 승인</span><h2>핵심 증거 확보!</h2>
      <p>보관함의 증거로 수사를 진행할 수 있다.</p>
      <div class="issue warn"><b>추가 자료 도착</b>특별조사위원회에서 자료 3건(비행기공업학교, 생산 실적, 군수 보상금)을 보냈다. 다음 미션에서 함께 쓰자.</div>`,
      [{ text: 'MISSION 2로', cls: 'btn rust', fn: () => go('m2') }]);
    return;
  }
  spend(1, issues);
  if (S.failed) { render(); return; }
  modal(`<span class="mres bad">보완 조사 필요</span><h2>보고서가 반려되었다</h2>
    ${issues.map(i => `<div class="issue">${esc(i.text)}</div>`).join('')}
    <p class="note">${chancesLeftText()}</p>`, [{ text: '다시 조사하기', fn: render }]);
}

/* MISSION 2 */
function m2Pool() {
  const evs = [...S.locker, ...['E3', 'E4', 'E5'].filter(id => !S.locker.includes(id))];
  return { evs, laws: Object.keys(LAWS) };
}

function vM2() {
  const { evs, laws } = m2Pool();
  const allFound = REQUIRED_LINKS.every(r => S.found[r.key]);
  const pk = S.pick;
  const lv = S.lastVerdict;
  return `<div class="page-head">
    <div class="kicker">MISSION 2</div>
    <h2>증거 조합: 연결되는 단서</h2>
    <p>카드 두 장을 골라 <b>연결하기</b>를 누르자. 두 자료에서 무엇을 알 수 있는지 판정해 준다.</p>
  </div>
  <div class="guide"><b>목표</b><span>오른쪽 체크리스트의 <b>핵심 연결 3개</b>를 모두 찾자. 증거끼리, 또는 증거와 법 조항을 연결할 수 있다.</span></div>
  <div class="combine">
    <div>
      <div class="section-label">증거 카드</div>
      <div class="cards">${evs.map(id => {
        const e = ev(id);
        return `<button class="ecard ${pk.includes(id) ? 'sel' : ''}" data-pick="${id}"><span class="ek">${esc(e.kind)}${e.stage === 2 ? ' · 추가' : ''}</span><span class="et">${esc(e.title)}</span><span class="ed">${esc(e.period)}</span></button>`;
      }).join('')}</div>
      <div class="section-label">반민족행위처벌법 (1948)</div>
      <div class="cards">${laws.map(id => {
        const l = LAWS[id];
        return `<button class="ecard law ${pk.includes(id) ? 'sel' : ''}" data-pick="${id}" title="${esc(l.text)}"><span class="ek">${esc(l.short)}</span><span class="et">${esc(l.name)}</span><span class="ed">${esc(l.easy)}</span></button>`;
      }).join('')}</div>
      <p class="note" style="margin-top:10px">조문 원문을 보려면 법 카드를 고른 뒤 아래 ‘조문 보기’를 누르자.</p>
      <div class="row"><button class="btn ghost small" data-act="lawtext">조문 보기</button><button class="btn ghost small" data-go="m1">사건 파일 다시 읽기</button></div>
    </div>
    <div class="board"><div class="paper">
      <div class="col-title"><span>연결판</span></div>
      <div class="pair">
        <div class="pslot ${pk[0] ? 'on' : ''}">${pk[0] ? esc(label(pk[0])) : '카드 1'}</div>
        <span class="plus">+</span>
        <div class="pslot ${pk[1] ? 'on' : ''}">${pk[1] ? esc(label(pk[1])) : '카드 2'}</div>
      </div>
      <div class="row"><button class="btn rust" data-act="combine" ${pk.length === 2 ? '' : 'disabled'}>연결하기</button>
        <button class="btn ghost small" data-act="clearpick" ${pk.length ? '' : 'disabled'}>비우기</button></div>
      ${lv ? verdictView(lv) : ''}
      <div class="section-label">핵심 연결 체크리스트</div>
      <ul class="found">${REQUIRED_LINKS.map(r => `<li class="${S.found[r.key] ? 'ok' : ''}"><span class="ck">${S.found[r.key] ? '✓' : ''}</span><span>${esc(r.label)}${S.found[r.key] ? `<br><span class="note">${esc(S.found[r.key])}</span>` : ''}</span></li>`).join('')}
        <li class="${S.found.ISSUE ? 'ok' : ''}"><span class="ck">${S.found.ISSUE ? '!' : ''}</span><span>(선택) 재판에서 쟁점이 될 약점 찾기${S.found.ISSUE ? '<br><span class="note">쟁점 발견: 생산 실적</span>' : ''}</span></li>
      </ul>
      ${S.missStreak >= 3 && !allFound ? `<div class="issue warn" style="margin-top:12px"><b>힌트</b>${esc(m2Hint())}</div>` : ''}
      <button class="btn ${allFound ? 'rust' : ''}" style="width:100%;margin-top:14px" data-act="m2submit" ${allFound ? '' : 'disabled'}>수사 결론 보고 → 기소장 작성</button>
    </div></div>
  </div>`;
}

function verdictView(v) {
  const names = { valid: '타당함', plus: '보강 증거', issue: '쟁점', weak: '근거 부족', wrong: '조항 오적용', noise: '관련성 낮음' };
  return `<div class="verdict v-${v.v}"><div class="vt"><span class="vtag">${names[v.v]}</span>${esc(v.title)}</div>${esc(v.text)}</div>`;
}

function m2Hint() {
  if (!S.found.K1) return '회사 설립 기록(✈)과 일본 육군의 지정 문서(⚙)를 함께 놓아 보자.';
  if (!S.found.K2) return '‘비행기·병기·탄약 등 군수공업’이라는 말이 들어간 조항을 찾아 회사 기록과 연결하자.';
  return '단체 간부 활동(⚑)은 ‘국책 단체 수뇌간부’ 조항과, 기고문(✎)은 ‘언론·저작’ 조항과 맞는지 확인하자.';
}

function judgeCombo(a, b) {
  const k = [a, b].sort().join('+');
  if (COMBOS[k]) return COMBOS[k];
  const d = [a, b].find(id => id.startsWith('D'));
  if (d) return { v: 'noise', title: '관련성 낮음', text: NOISE_TEXT[d] };
  if (a.startsWith('L') && b.startsWith('L')) return { v: 'weak', title: '조항끼리는 연결할 수 없음', text: '법 조항은 그것을 뒷받침하는 증거와 짝지어야 한다.' };
  const law = [a, b].find(id => id.startsWith('L'));
  const e = [a, b].find(id => id.startsWith('E'));
  if (law === 'L47' && (e === 'E3' || e === 'E5')) return { v: 'plus', title: '보강: 7호 혐의 보강', text: `‘${ev(e).title}’은(는) 회사 경영이 실제로 이루어졌음을 보강한다. 다만 사장이었다는 기록(E1)이 먼저 있어야 한다.` };
  if (law === 'L42') return { v: 'wrong', title: '조항 오적용', text: '이 조항은 중추원 부의장·고문·참의를 지낸 사람에게 해당한다. 확인한 자료에는 박흥식의 중추원 경력이 없다.' };
  if (law === 'L2' || law === 'L3') return { v: 'wrong', title: '조항 오적용', text: `${LAWS[law].short}는 ${LAWS[law].easy}에게 적용된다. 이 자료와는 맞지 않는다.` };
  if (law) return { v: 'weak', title: '근거 부족', text: `‘${ev(e).title}’만으로는 ${LAWS[law].short}의 요건을 입증하기 어렵다.` };
  return { v: 'weak', title: '근거 부족', text: '두 자료를 함께 놓아도 바로 이끌어 낼 결론이 뚜렷하지 않다. 다른 짝을 찾아보자.' };
}

function doCombine() {
  const [a, b] = S.pick; if (!a || !b) return;
  const r = judgeCombo(a, b);
  S.lastVerdict = r;
  const k = [a, b].sort().join('+');
  if (!S.tried.includes(k)) S.tried.push(k);
  if (r.key && !S.found[r.key]) {
    S.found[r.key] = `${label(a)} + ${label(b)}`;
    toast(r.key === 'ISSUE' ? '숨은 쟁점을 찾았다!' : '핵심 연결 발견!');
  }
  S.missStreak = (r.v === 'valid' || r.v === 'plus' || r.v === 'issue') ? 0 : S.missStreak + 1;
  S.pick = []; save(); render();
}

function submitM2() {
  S.done[2] = true; S.mission = 3; save();
  modal(`<span class="mres ok">혐의 정리 완료</span><h2>기소할 준비가 되었다</h2>
    <p>핵심 혐의와 보조 혐의를 뒷받침할 연결을 찾았다.</p>
    ${S.found.ISSUE ? '<div class="issue warn"><b>기억해 둘 쟁점</b>생산 실적이 연습기 1기뿐이라는 점은 변호인이 반박 근거로 쓸 것이다.</div>' : '<div class="issue warn"><b>놓친 쟁점이 있다</b>추가 자료 중 피고 측에 유리한 자료가 있다. 결말에서 확인해 보자.</div>'}`,
    [{ text: 'MISSION 3로', cls: 'btn rust', fn: () => go('m3') }]);
}

/* MISSION 3 */
function vM3() {
  const { evs } = m2Pool();
  const I = S.ind;
  const mainOpts = ['L47', 'L410', 'L411', 'L42', 'L2', 'L3'];
  return `<div class="page-head">
    <div class="kicker">MISSION 3</div>
    <h2>기소장 작성: 법적 책임을 입증하라</h2>
    <p>위에서부터 차례로 고르고 <b>기소장 제출</b>을 누르자.</p>
  </div>
  <div class="paper formdoc">
    <div class="fstep"><h3><span class="num">1</span>적용할 핵심 조항</h3>
      <div class="opts two">${mainOpts.map(id => `<label class="opt"><input type="radio" name="main" value="${id}" ${I.main === id ? 'checked' : ''}><span><b>${esc(LAWS[id].short)}</b> ${esc(LAWS[id].name)}<span class="os">${esc(LAWS[id].easy)}</span></span></label>`).join('')}</div>
    </div>
    <div class="fstep"><h3><span class="num">+</span>함께 적용할 보조 조항 <span class="note" style="font-family:var(--sans)">(선택)</span></h3>
      <div class="opts two">${['L410', 'L411', 'L42', 'L3'].map(id => `<label class="opt"><input type="checkbox" name="extra" value="${id}" ${I.extra.includes(id) ? 'checked' : ''} ${I.main === id ? 'disabled' : ''}><span><b>${esc(LAWS[id].short)}</b> ${esc(LAWS[id].name)}</span></label>`).join('')}</div>
    </div>
    <div class="fstep"><h3><span class="num">2</span>혐의를 뒷받침하는 증거 <span class="note" style="font-family:var(--sans)">(여러 개)</span></h3>
      <div class="opts two">${evs.map(id => `<label class="opt"><input type="checkbox" name="ev" value="${id}" ${I.ev.includes(id) ? 'checked' : ''}><span>${ev(id).icon} ${esc(ev(id).title)}<span class="os">${esc(ev(id).period)}</span></span></label>`).join('')}</div>
    </div>
    <div class="fstep"><h3><span class="num">3</span>기소 이유</h3>
      <div class="opts">${REASONS.map(r => `<label class="opt"><input type="radio" name="reason" value="${r.id}" ${I.reason === r.id ? 'checked' : ''}><span>${esc(r.text)}</span></label>`).join('')}</div>
    </div>
    <div class="row" style="justify-content:space-between;margin-top:8px">
      <span class="note">${chancesLeftText()}</span>
      <button class="btn rust" data-act="m3submit">기소장 제출</button>
    </div>
  </div>`;
}

function readM3() {
  const f = app;
  S.ind.main = (f.querySelector('input[name=main]:checked') || {}).value || '';
  S.ind.extra = [...f.querySelectorAll('input[name=extra]:checked')].map(i => i.value).filter(v => v !== S.ind.main);
  S.ind.ev = [...f.querySelectorAll('input[name=ev]:checked')].map(i => i.value);
  S.ind.reason = (f.querySelector('input[name=reason]:checked') || {}).value || '';
  save();
}

function submitM3() {
  readM3();
  const I = S.ind;
  if (!I.main || !I.ev.length || !I.reason) { toast('1·2·3번을 모두 골라야 제출할 수 있다.'); return; }
  const issues = [];
  if (I.main === 'L410' || I.main === 'L411') issues.push({ text: `${LAWS[I.main].short}는 보조 혐의로는 검토할 수 있지만 이 사건의 핵심이 아니다. 이 조항은 ‘악질적’이었다는 점까지 입증해야 한다. 회사 경영 기록에 딱 맞는 조항은 따로 있다.`, recheck: ['E1', 'E2'] });
  if (I.main === 'L42' || I.extra.includes('L42')) issues.push({ text: '제4조 2호(중추원 직책)는 확인되지 않은 경력을 근거로 한다. 확인한 자료에는 박흥식의 중추원 경력이 없다.', recheck: ['E1'] });
  if (I.main === 'L2') issues.push({ text: '제2조는 작위를 받았거나 일본 제국의회 의원이 된 사람에게 적용된다. 박흥식은 해당하지 않는다.', recheck: [] });
  if (I.main === 'L3' || I.extra.includes('L3')) issues.push({ text: '제3조(독립운동가 살상·박해)를 뒷받침할 증거가 없다. 증거 없는 혐의는 기소할 수 없다.', recheck: [] });
  if (I.extra.includes('L410') && !I.ev.includes('E6')) issues.push({ text: '제4조 10호를 함께 적용했다면 단체 간부 활동 자료를 증거로 내야 한다.', recheck: ['E6'] });
  if (I.extra.includes('L411') && !I.ev.includes('E7')) issues.push({ text: '제4조 11호를 함께 적용했다면 기고문 자료를 증거로 내야 한다.', recheck: ['E7'] });
  if (!I.ev.includes('E1')) issues.push({ text: '핵심 증거인 ‘조선비행기공업㈜ 설립과 사장 취임’ 기록이 빠졌다. 책임경영을 입증하려면 꼭 필요하다.', recheck: ['E1'] });
  if (!I.ev.includes('E2')) issues.push({ text: '회사가 군수회사였다는 근거(일본 육군의 지정)가 빠졌다.', recheck: ['E2'] });
  I.ev.filter(id => ev(id).role === 'noise').forEach(id => issues.push({ text: `‘${ev(id).title}’은(는) 혐의와 관련이 낮은 자료다.`, recheck: [id] }));
  const r = REASONS.find(x => x.id === I.reason);
  if (r && !r.ok) issues.push({ text: `기소 이유: ${r.why}`, recheck: [] });

  if (!issues.length) {
    S.done[3] = true; S.mission = 4; save();
    modal(`<span class="mres ok">기소 수리</span><h2>타당한 기소!</h2>
      <p>증거와 조항이 논리적으로 연결되었다. 특별재판부가 기소장을 받아들였다.</p>
      ${I.ev.includes('E4') ? '<div class="issue warn"><b>참고</b>생산 실적 자료(E4)를 증거로 함께 냈다. 이 자료는 오히려 변호인이 쓰기 좋은 자료다. 증거를 낼 때는 불리한 점도 미리 따져 보자.</div>' : ''}`,
      [{ text: 'MISSION 4로', cls: 'btn rust', fn: () => go('m4') }]);
    return;
  }
  const lawErr = issues.some(i => /조항|제2조|제3조|중추원/.test(i.text));
  spend(3, issues);
  if (S.failed) { render(); return; }
  modal(`<span class="mres ${lawErr ? 'bad' : 'part'}">${lawErr ? '법 조항 오적용' : '일부 근거 부족'}</span><h2>보완 조사가 필요하다</h2>
    ${issues.map(i => `<div class="issue">${esc(i.text)}</div>`).join('')}
    <p class="note">${chancesLeftText()}</p>`, [{ text: '사건 파일 다시 보기', cls: 'btn ghost', fn: () => go('m1') }, { text: '기소장 고치기', fn: render }]);
}

/* MISSION 4 */
function vM4() {
  const T = S.sent;
  const types = [
    { v: 'death', t: '사형' }, { v: 'life', t: '무기징역' },
    { v: 'prison', t: '징역', unit: '년' }, { v: 'civil', t: '공민권 정지', unit: '년', s: '선거권·피선거권, 공무원이 될 권리 등을 멈춤' },
  ];
  const needYears = T.type === 'prison' || T.type === 'civil';
  return `<div class="page-head">
    <div class="kicker">MISSION 4</div>
    <h2>구형 의견: 어떤 형벌을 제안할까?</h2>
    <p>구형은 <b>검사가 재판부에 요청하는 형벌</b>이다. 최종 판결은 재판부가 따로 내린다.</p>
  </div>
  <div class="paper formdoc">
    <div class="lawhead"><b>반민족행위처벌법 ${esc(LAWS[S.ind.main] ? LAWS[S.ind.main].short : '제4조')}의 법정형</b><br>${esc(LAW4_HEAD)}</div>
    <p class="note" style="margin-top:-4px">여러 호가 함께 적용되어도 이 게임에서는 제4조에 정한 범위 안에서 구형한다(교육용 단순화).</p>
    <div class="fstep"><h3><span class="num">1</span>형벌 종류</h3>
      <div class="opts two">${types.map(o => `<label class="opt"><input type="radio" name="type" value="${o.v}" ${T.type === o.v ? 'checked' : ''}><span><b>${o.t}</b>${o.s ? `<span class="os">${o.s}</span>` : ''}</span></label>`).join('')}</div>
    </div>
    <div class="fstep ${needYears ? '' : 'hidden'}" id="yearsStep"><h3><span class="num">2</span>기간</h3>
      <div class="num-in"><input type="number" name="years" min="1" max="30" inputmode="numeric" value="${esc(T.years)}" aria-label="기간(년)"><span>년</span></div>
    </div>
    <div class="fstep"><h3><span class="num">3</span>재산 몰수</h3>
      <select name="conf" aria-label="재산 몰수">
        <option value="">선택하세요</option>
        ${[['none', '몰수하지 않음'], ['part', '재산 일부 몰수'], ['all', '재산 전부 몰수']].map(([v, t]) => `<option value="${v}" ${T.conf === v ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <p class="note">제4조는 재산의 전부 또는 일부를 몰수‘할 수 있다’고 정했다. 몰수하지 않는 것도 범위 안이다.</p>
    </div>
    <div class="fstep"><h3><span class="num">4</span>구형 이유</h3>
      <div class="opts">${SENT_REASONS.map(r => `<label class="opt"><input type="radio" name="sreason" value="${r.id}" ${T.reason === r.id ? 'checked' : ''}><span>${esc(r.text)}</span></label>`).join('')}</div>
    </div>
    <div class="row" style="justify-content:space-between;margin-top:8px">
      <span class="note">${chancesLeftText()}</span>
      <button class="btn rust" data-act="m4submit">구형 의견 제출</button>
    </div>
  </div>`;
}

function readM4() {
  S.sent.type = (app.querySelector('input[name=type]:checked') || {}).value || '';
  const y = app.querySelector('input[name=years]'); S.sent.years = y ? y.value : '';
  S.sent.conf = (app.querySelector('select[name=conf]') || {}).value || '';
  S.sent.reason = (app.querySelector('input[name=sreason]:checked') || {}).value || '';
  save();
}

function sentenceText(t = S.sent) {
  const conf = { none: '재산 몰수 없음', part: '재산 일부 몰수', all: '재산 전부 몰수' }[t.conf] || '';
  const main = { death: '사형', life: '무기징역', prison: `징역 ${t.years}년`, civil: `공민권 정지 ${t.years}년` }[t.type] || '';
  return [main, conf].filter(Boolean).join(', ');
}

function submitM4() {
  readM4();
  const T = S.sent;
  if (!T.type || !T.conf || !T.reason) { toast('형벌 종류, 재산 몰수, 구형 이유를 모두 골라야 한다.'); return; }
  const y = Number(T.years);
  if ((T.type === 'prison' || T.type === 'civil') && (!Number.isInteger(y) || y < 1)) { toast('기간을 1 이상의 정수로 입력하자.'); return; }
  const issues = [];
  if (T.type === 'death' || T.type === 'life') issues.push({ text: `${T.type === 'death' ? '사형' : '무기징역'}은 제4조의 법정형에 없다. 제4조는 ‘10년 이하의 징역’ 또는 ‘15년 이하의 공민권 정지’를 정했다. (사형·무기는 제1조~제3조에 있다.)`, recheck: [] });
  if (T.type === 'prison' && y > 10) issues.push({ text: `징역 ${y}년은 법정형 범위를 벗어난다. 제4조의 징역은 10년 이하다.`, recheck: [] });
  if (T.type === 'civil' && y > 15) issues.push({ text: `공민권 정지 ${y}년은 법정형 범위를 벗어난다. 제4조의 공민권 정지는 15년 이하다.`, recheck: [] });
  const r = SENT_REASONS.find(x => x.id === T.reason);
  if (r && !r.ok) issues.push({ text: `구형 이유: ${r.why}`, recheck: [] });
  if (!issues.length) {
    S.done[4] = true; S.mission = 5; save();
    modal(`<span class="mres ok">구형 완료</span><h2>법정형 범위 안의 구형</h2>
      <p>당신의 구형: <b>${esc(sentenceText())}</b></p>
      <p class="note">구형은 검사의 의견일 뿐이다. 이제 1949년 실제 재판이 어떻게 끝났는지 확인하자.</p>`,
      [{ text: 'MISSION 5로', cls: 'btn rust', fn: () => go('m5') }]);
    return;
  }
  spend(4, issues);
  if (S.failed) { render(); return; }
  modal(`<span class="mres bad">구형 반려</span><h2>다시 검토하자</h2>
    ${issues.map(i => `<div class="issue">${esc(i.text)}</div>`).join('')}
    <p class="note">${chancesLeftText()}</p>`, [{ text: '구형 고치기', fn: render }]);
}

/* MISSION 5 */
function indictmentTable() {
  const I = S.ind;
  const laws = [I.main, ...I.extra].filter(Boolean).map(id => LAWS[id].short + ' ' + LAWS[id].name).join(', ');
  return `<div class="result-doc">
    <h3>기 소 장</h3>
    <table>
      <tr><th>피고인</th><td>박흥식 (화신 사장)</td></tr>
      <tr><th>적용 법조</th><td>반민족행위처벌법 ${esc(laws)}</td></tr>
      <tr><th>증거</th><td>${I.ev.map(id => esc(ev(id).title)).join('<br>')}</td></tr>
      <tr><th>기소 이유</th><td>${esc((REASONS.find(r => r.id === I.reason) || {}).text || '')}</td></tr>
      <tr><th>구형</th><td>${esc(sentenceText())}</td></tr>
    </table>
    <span class="stamp">특별검찰관</span>
  </div>`;
}

function vM5() {
  const highlight = ['1949.1.8', '1949.9.26', '1951.2.14'];
  return `<div class="page-head">
    <div class="kicker">MISSION 5</div>
    <h2>역사의 결말: 실제 재판과 비교</h2>
    <p>게임 속 당신의 기소는 교육용 시나리오다. 실제 1949년에는 무슨 일이 있었을까?</p>
  </div>
  ${indictmentTable()}
  <div class="section-label" style="margin-top:24px">나의 판단 vs 1949년 실제 기록</div>
  <div class="compare">
    <div class="paper"><h3>게임 속 나의 수사</h3>
      <p><b>조항:</b> ${esc([S.ind.main, ...S.ind.extra].map(id => LAWS[id].short).join(', '))}</p>
      <p><b>구형:</b> ${esc(sentenceText())}</p>
      <p><b>쟁점 인식:</b> ${S.found.ISSUE ? '생산 실적이 적다는 약점을 미리 찾음' : '생산 실적 쟁점을 놓침'}</p>
    </div>
    <div class="paper real"><h3>1949년 실제 사건</h3>
      <p><b>체포 혐의:</b> 제4조 7호(군수공업 책임경영)</p>
      <p><b>구형:</b> 공민권 정지 2년. 그런데 구형한 검찰관이 무죄 취지로 발언했다.</p>
      <p><b>판결:</b> 1949년 9월 26일 <b>무죄</b></p>
      <p class="note">출처: ${esc(SOURCES.busan49)}; ${esc(SOURCES.enc)}</p>
    </div>
  </div>
  <div class="paper">
    <h3 style="font-size:18px;margin-bottom:6px">재판부가 밝힌 무죄 이유 (신문 보도 요지)</h3>
    <ul style="margin:6px 0;padding-left:20px">
      <li>비행기 공장은 도중에 멈춰 실질적인 일을 하지 않았고, 피동적이었다.</li>
      <li>조선임전보국단 등의 간부였지만 실질적인 활동은 없었다.</li>
      <li>신문에 쓴 글은 남이 시켜서 쓴 피동적인 것이었다.</li>
      <li>판결 이유에는 박흥식이 안창호를 많이 도왔다는 내용도 들어 있었다.</li>
    </ul>
    <p class="note">출처: ${esc(SOURCES.busan49)}; ${esc(SOURCES.ohmy)}. 판결문 원문은 이 앱에 싣지 않았다(원문 확인 필요).</p>
    <div class="issue warn" style="margin-top:10px"><b>생각해 볼 점</b>게임에서 확인한 증거(군수회사 사장, 전쟁 협력 단체 간부, 학병 독려 글)는 실제 재판에서도 알려져 있던 사실이다. 그런데도 결과는 무죄였다.</div>
  </div>

  <div class="section-label" style="margin-top:24px">반민특위는 어떻게 무너졌나</div>
  <div class="paper"><ol class="timeline">
    ${TIMELINE.map(x => `<li class="${highlight.includes(x.d) ? 'hl' : ''}"><div class="d">${esc(x.d)}</div><div class="t">${esc(x.t)}</div><div class="s">출처: ${esc(x.s)}</div></li>`).join('')}
  </ol></div>

  <div class="section-label" style="margin-top:24px">숫자로 본 반민특위</div>
  <div class="stats">
    <div class="stat"><b>682</b><span>처리한 사건</span></div>
    <div class="stat"><b>408</b><span>영장 발부</span></div>
    <div class="stat"><b>221</b><span>기소</span></div>
    <div class="stat"><b>38</b><span>재판 종결</span></div>
    <div class="stat"><b>12</b><span>실형 선고</span></div>
  </div>
  <p class="note">출처: ${esc(SOURCES.seoul98)}; ${esc(SOURCES.nocut)}. 실형을 받은 사람들도 보석·형 집행정지 등으로 곧 풀려났다. 연구·보도에 따라 수치가 조금씩 다르다.</p>
  <p class="note">이후 2009년 정부 기구인 친일반민족행위진상규명위원회는 박흥식을 친일반민족행위자로 결정했다(출처: ${esc(SOURCES.enc)}).</p>

  <div class="section-label" style="margin-top:24px">마지막 질문</div>
  <div class="paper">
    <p class="bigq">친일 행위를 입증할 증거와 처벌할 법이 있었는데도, 친일 청산은 왜 충분히 이루어지지 못했을까?</p>
    <textarea id="reflect" placeholder="위 연표에서 찾은 근거를 들어 2~3문장으로 써 보자. (20자 이상)">${esc(S.reflection)}</textarea>
    <div class="row" style="justify-content:space-between;margin-top:10px">
      <span class="note" id="rcount">${S.reflection.length}자</span>
      <button class="btn rust" data-act="m5submit">답변 제출하고 사건 종결</button>
    </div>
  </div>`;
}

function submitM5() {
  const t = ($('#reflect').value || '').trim();
  S.reflection = t; save();
  if (t.length < 20) { toast('20자 이상 써야 제출할 수 있다.'); return; }
  S.done[5] = true; save(); go('end');
}

function summaryText() {
  const I = S.ind;
  return [
    '[반민특위 재판정] 수사 결과',
    `적용 조항: ${[I.main, ...I.extra].map(id => LAWS[id].short + ' ' + LAWS[id].name).join(', ')}`,
    `증거: ${I.ev.map(id => ev(id).title).join(', ')}`,
    `구형: ${sentenceText()}`,
    `쟁점 발견: ${S.found.ISSUE ? '예' : '아니오'} / 사용한 보완 조사: ${MAX_CHANCES - S.chances}번`,
    `성찰: ${S.reflection}`,
  ].join('\n');
}

function vEnd() {
  return `<div class="page-head"><div class="kicker">사건 종결</div><h2>수사를 마쳤다</h2>
    <p>당신은 교육용 시나리오 안에서 기소 논리를 완성했다. 실제 역사에서 박흥식은 무죄 판결을 받았다.</p></div>
  ${indictmentTable()}
  <div class="paper" style="margin-top:18px">
    <h3 style="font-size:18px">미션별 결과</h3>
    <ul style="padding-left:20px;margin:8px 0">
      ${MISSIONS.map(m => `<li>MISSION ${m.n}. ${esc(m.short)} — ${S.done[m.n] ? '완료' : '미완료'}${S.mistakes.filter(x => x.mission === m.n).length ? ` (보완 조사 ${S.mistakes.filter(x => x.mission === m.n).length}번)` : ''}</li>`).join('')}
    </ul>
    <h3 style="font-size:18px;margin-top:12px">나의 답변</h3>
    <p style="white-space:pre-wrap">${esc(S.reflection)}</p>
    <div class="row" style="margin-top:12px">
      <button class="btn rust" data-act="copy">결과 복사하기</button>
      <button class="btn ghost" data-go="m5">결말 다시 보기</button>
      <button class="btn ghost" data-act="reset">처음부터 다시</button>
    </div>
  </div>`;
}

function vFail() {
  const rechecks = [...new Set(S.mistakes.flatMap(m => m.issues.flatMap(i => i.recheck)))].filter(id => EVIDENCE[id]);
  return `<div class="paper fail-head" style="margin-bottom:18px">
    <span class="mres bad">수사 실패</span>
    <h2 style="font-size:28px;margin:6px 0">보완 조사 기회를 모두 썼다</h2>
    <p>핵심 혐의를 입증하지 못해 사건이 종결되었다. 무엇이 부족했는지 확인하고 다시 도전하자.</p>
  </div>
  <div class="paper">
    <h3 style="font-size:18px">부족했던 점</h3>
    ${[...new Set(S.mistakes.map(m => m.mission))].map(n => {
      const texts = [...new Set(S.mistakes.filter(m => m.mission === n).flatMap(m => m.issues.map(i => i.text)))];
      return `<div style="margin-top:10px"><b>MISSION ${n}</b>${texts.map(t => `<div class="issue">${esc(t)}</div>`).join('')}</div>`;
    }).join('')}
    ${rechecks.length ? `<h3 style="font-size:18px;margin-top:16px">다시 확인할 자료</h3><ul style="padding-left:20px">${rechecks.map(id => `<li>${ev(id).icon} ${esc(ev(id).title)} (${esc(ev(id).period)})</li>`).join('')}</ul>` : ''}
    <p class="note" style="margin-top:10px">조항을 고를 때는 ‘피의자가 실제로 한 일’과 ‘조문의 문구’가 정확히 맞는지 확인하자.</p>
    <div class="row" style="margin-top:14px"><button class="btn rust" data-act="reset-now">처음부터 다시 수사하기</button></div>
  </div>`;
}

/* ---------- events ---------- */
function bind() {
  app.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.go;
    if (t === 'm1' && S.mission === 1) S.current = S.current || null;
    go(t);
  }));
  app.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.open; S.current = id;
    if (!S.viewed.includes(id)) S.viewed.push(id);
    save(); render();
    if (window.innerWidth < 980) { const d = $('.col-doc'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }));
  app.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    if (S.locker.length >= LOCKER_MAX) { toast(`보관함은 ${LOCKER_MAX}칸이다. 필요 없는 증거를 빼자.`); return; }
    S.locker.push(b.dataset.add); save(); toast('보관함에 담았다'); render();
  }));
  app.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
    if (S.done[1]) return;
    S.locker = S.locker.filter(x => x !== b.dataset.remove); save(); render();
  }));
  app.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.pick;
    if (S.pick.includes(id)) S.pick = S.pick.filter(x => x !== id);
    else S.pick = [...S.pick, id].slice(-2);
    save(); render();
  }));
  app.querySelectorAll('input[name=type]').forEach(r => r.addEventListener('change', () => {
    const show = r.value === 'prison' || r.value === 'civil';
    $('#yearsStep').classList.toggle('hidden', !show);
    readM4();
  }));
  app.querySelectorAll('input[name=main]').forEach(r => r.addEventListener('change', () => { readM3(); render(); }));
  const ta = $('#reflect');
  if (ta) ta.addEventListener('input', () => { S.reflection = ta.value; $('#rcount').textContent = ta.value.trim().length + '자'; save(); });

  app.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'start') { go(S.done[1] || S.viewed.length ? 'dash' : 'm1'); }
    else if (a === 'reset') confirmReset();
    else if (a === 'reset-now') { S = fresh(); save(); go('title'); }
    else if (a === 'm1submit') submitM1();
    else if (a === 'combine') doCombine();
    else if (a === 'clearpick') { S.pick = []; save(); render(); }
    else if (a === 'lawtext') showLaw();
    else if (a === 'm2submit') submitM2();
    else if (a === 'm3submit') submitM3();
    else if (a === 'm4submit') submitM4();
    else if (a === 'm5submit') submitM5();
    else if (a === 'copy') copyResult();
  }));
}

function showLaw() {
  const id = S.pick.find(x => x.startsWith('L'));
  const list = id ? [id] : Object.keys(LAWS);
  modal(`<h2>반민족행위처벌법 (1948.9.22 공포)</h2>
    <p class="note">${id ? '고른 조항' : '법 카드를 고르지 않아 주요 조문을 모두 보여 준다.'}</p>
    ${list.map(k => `<div class="lawhead"><b>${esc(LAWS[k].short)}</b> ${esc(LAWS[k].text)}</div>`).join('')}
    ${list.some(k => k.startsWith('L4')) ? `<div class="lawhead"><b>제4조 본문</b> ${esc(LAW4_HEAD)}</div>` : ''}
    <p class="note">출처: ${esc(SOURCES.law)} (위키문헌·국사편찬위원회 『사료로 본 한국사』 수록본)</p>`);
}

function copyResult() {
  const t = summaryText();
  const done = () => toast('결과를 복사했다. 과제 제출란에 붙여 넣자.');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
  else fallbackCopy(t, done);
}
function fallbackCopy(t, cb) {
  const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); cb(); } catch (e) { toast('복사하지 못했다. 직접 선택해 복사하자.'); }
  ta.remove();
}

function confirmReset() {
  modal('<h2>처음부터 다시 할까?</h2><p>지금까지의 진행 상황이 모두 지워진다.</p>',
    [{ text: '취소', cls: 'btn ghost' }, { text: '초기화', cls: 'btn rust', fn: () => { S = fresh(); save(); go('title'); } }]);
}

function showSources() {
  modal(`<h2>자료 출처</h2>
    <p>이 게임의 사실 정보는 아래 자료에서 확인한 내용만 사용했다. 신문 기사·문서의 원문 발췌는 확보하지 못해 싣지 않았고, 각 증거 카드에 ‘원문 미수록’으로 표시했다. 사건 도입부 장면은 ‘교육용 재구성’이다.</p>
    <ul>${Object.values(SOURCES).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <p class="note">플레이어가 맡는 특별검찰관은 가상의 인물이다. 실제 박흥식 사건은 노일환, 이후 정광호 특별검찰관이 맡았다.</p>`);
}

$('.brand').addEventListener('click', () => { if (S.screen !== 'title') go('dash'); });
$('#btnSources').addEventListener('click', showSources);
$('#btnReset').addEventListener('click', confirmReset);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) $('#modal').hidden = true; });

if (S.screen === 'end' && !S.done[5]) S.screen = 'dash';
render();
})();
