// no-alibi 회원 인증 + udb — 공용 모듈 (매직링크 로그인)
// 버튼을 먼저 mount하고 Supabase는 동적 로드(안정 CDN 폴백) → 로드 실패해도 버튼은 뜨고 콘솔에 원인 기록.
const SUPA_URL = 'https://fdbqilofjmrcqzhcivlg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYnFpbG9mam1yY3F6aGNpdmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTk2ODYsImV4cCI6MjEwMjYzNTY4Nn0.YyHEcwHGLggZ7nSqY6MjIV0fUg4QiwTKHfbR8UOZYiQ';

let _readyResolve;
window.NOALIBI = {
  supa: null, user: null, profile: null,
  login: () => openModal(),
  returnTo: () => returnTo(),   // 로그인 왕복용 주소(해시 → ?r=) — 다른 모듈이 직접 signIn 할 때 쓸 것
  ready: new Promise((r) => { _readyResolve = r; })
};
let supa = null;

const KO = (document.documentElement.lang || 'ko') !== 'en';
const T = KO ? {
  login: '로그인', logout: '로그아웃', send: '로그인 링크 받기',
  title: 'no-alibi 로그인 · 가입', desc: '이메일로 로그인 링크를 보내드려요. 비밀번호 없이 클릭 한 번이면 돼요. udb 포인트가 이 계정에 쌓입니다.',
  ph: '이메일 주소', sending: '보내는 중…', sent: '메일함(스팸함도)을 확인하세요 — 로그인 링크를 보냈어요.',
  err: '전송 실패 — 잠시 후 다시 시도해주세요.', invalid: '올바른 이메일을 입력해주세요.',
  loading: '로그인 모듈을 불러오는 중… 잠시 후 다시 눌러주세요.', close: '닫기',
  google: 'Google로 계속하기', kakao: '카카오로 계속하기', or: '또는 이메일로', oauthErr: '로그인 제공자 연결 실패 — 이메일로 시도해주세요.',
  linkErr: '이 로그인 링크는 만료됐거나 이미 한 번 쓰인 링크예요. 아래에서 새 링크를 받아주세요. (링크는 한 번만 열려요)',
  inapp: '인스타그램·카카오톡 같은 앱 안 브라우저에서는 Google 로그인이 막혀 있어요. 이메일 링크로 로그인하거나, 오른쪽 위 ⋯ 메뉴의 <b>다른 브라우저로 열기</b>를 눌러주세요.',
  openBrowser: 'Chrome에서 열기'
} : {
  login: 'Log in', logout: 'Log out', send: 'Send login link',
  title: 'no-alibi login · sign up', desc: 'We email you a login link — one click, no password. Your udb points accrue to this account.',
  ph: 'Email address', sending: 'Sending…', sent: 'Check your inbox (and spam) — we sent a login link.',
  err: 'Failed — please try again shortly.', invalid: 'Enter a valid email.',
  loading: 'Loading login module… try again in a moment.', close: 'Close',
  google: 'Continue with Google', kakao: 'Continue with Kakao', or: 'or with email', oauthErr: 'Provider connection failed — try email instead.',
  linkErr: 'That login link has expired or was already used — each link opens once. Request a new one below.',
  inapp: 'Google login is blocked inside in-app browsers (Instagram, KakaoTalk…). Use the email link, or open this page in your browser via the ⋯ menu.',
  openBrowser: 'Open in Chrome'
};

// ── 로그인 왕복 주소 ──
// 매직링크·OAuth(implicit)는 돌아올 때 주소 뒤에 #access_token=… 을 붙인다. 현재 주소에 이미 해시(#act1 · #read · #crew)가 있으면
// "…#act1#access_token=…" 이 되어 supabase-js 가 토큰을 못 읽는다 → 로그인 안 됨 + 링크는 이미 소모(재클릭 시 '만료'). 실제로 모바일 리더에서 이렇게 실패했음.
// 그래서 해시를 떼고 ?r= 로 옮겨 보냈다가, 돌아오면 다시 해시로 복원한다(리더·크루 창이 다시 열린다).
function returnTo() {
  const u = new URL(location.href);
  const h = (location.hash || '').replace(/^#/, '');
  u.hash = '';
  if (h && /^[\w-]+$/.test(h)) u.searchParams.set('r', h);   // 토큰·에러 조각(=, & 포함)은 옮기지 않는다
  return u.toString();
}
let restoredHash = false;
function restoreHash() {
  if (restoredHash) return; restoredHash = true;
  const u = new URL(location.href);
  const r = u.searchParams.get('r');
  if (r == null) return;
  u.searchParams.delete('r'); u.hash = '';
  const clean = u.pathname + u.search;
  const ok = /^[\w-]+$/.test(r);
  try { history.replaceState(null, '', ok ? clean + '#' + r : clean); } catch (e) { return; }
  if (!ok) return;
  // replaceState 는 hashchange 를 내지 않으므로 직접 알린다 → ebook.js(#actN/#read) · feedback-core.js(#crew) 가 받는다
  try { window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL: location.origin + clean, newURL: location.href })); }
  catch (e) { try { window.dispatchEvent(new Event('hashchange')); } catch (e2) {} }
}
// 돌아온 주소의 #error=…(만료·재사용 링크) 를 읽고 지운다
function authErrorFromUrl() {
  const h = (location.hash || '').replace(/^#/, '');
  if (!/(^|&)error(_code|_description)?=/.test(h)) return null;
  const p = new URLSearchParams(h);
  const err = { code: p.get('error_code') || p.get('error') || '', desc: p.get('error_description') || '' };
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  return err;
}
// 앱 안 브라우저(인스타·카톡·페북·라인·네이버·안드로이드 WebView): Google 이 OAuth 를 차단(disallowed_useragent)
const UA = navigator.userAgent || '';
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|KAKAOTALK|Line\/|NAVER\(inapp|DaumApps|; wv\)/i.test(UA);
const ANDROID = /Android/i.test(UA);
function chromeIntent() {
  const u = new URL(returnTo());
  return 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(u.toString()) + ';end';
}

// ── 위젯 mount (즉시, Supabase와 무관) ──
function mountWidget() {
  // 모든 페이지에서 index와 동일 위치(우상단 고정)
  const w = document.createElement('span');
  w.className = 'authbar authbar-fixed';
  document.body.appendChild(w);
  return w;
}
const widget = mountWidget();

function renderLoggedOut() {
  // 헤더 로그인 버튼 제거 — 로그인은 피드백·이북·방명록 흐름(구글/게이트)에서 진행
  widget.innerHTML = '';
}
function renderLoggedIn(bal, name) {
  widget.innerHTML = '';
  const cin = document.createElement('span');
  cin.className = 'auth-cin'; cin.textContent = 'udb ' + bal; cin.title = name || '';
  const out = document.createElement('button');
  out.type = 'button'; out.className = 'auth-btn'; out.textContent = T.logout;
  out.addEventListener('click', async () => { if (supa) await supa.auth.signOut(); });
  widget.append(cin, out);
}
renderLoggedOut(); // 로그인 버튼 즉시 표시

// ── 로그인 모달 ──
let overlay = null;
function openModal(opts) {
  opts = opts || {};
  closeModal();
  overlay = document.createElement('div');
  overlay.className = 'auth-modal';
  const googleBtn = IN_APP
    ? '<p class="auth-inapp">' + T.inapp + '</p>' +
      (ANDROID ? '<a class="auth-oauth auth-open" href="' + chromeIntent() + '">' + T.openBrowser + '</a>' : '')
    : '<button type="button" class="auth-oauth auth-google" data-provider="google">' +
      '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"/></svg>' +
      '<span>' + T.google + '</span></button>';
  overlay.innerHTML =
    '<div class="auth-box">' +
    '<button class="auth-x" aria-label="' + T.close + '">×</button>' +
    '<h3>' + T.title + '</h3><p>' + T.desc + '</p>' +
    googleBtn +
    '<div class="auth-or"><span>' + T.or + '</span></div>' +
    '<form class="auth-form"><input type="email" required placeholder="' + T.ph + '" autocomplete="email">' +
    '<button type="submit" class="auth-send">' + T.send + '</button></form>' +
    '<p class="auth-status" aria-live="polite"></p></div>';
  document.body.appendChild(overlay);
  const form = overlay.querySelector('.auth-form');
  const input = overlay.querySelector('input');
  const status = overlay.querySelector('.auth-status');
  const sendBtn = overlay.querySelector('.auth-send');
  const oauth = async (provider) => {
    if (!supa) { status.textContent = T.loading; return; }
    status.classList.remove('ok'); status.textContent = '';
    const { error } = await supa.auth.signInWithOAuth({ provider, options: { redirectTo: returnTo() } });
    if (error) { status.textContent = T.oauthErr; console.error('[noalibi] oauth ' + provider, error); }
  };
  const gBtn = overlay.querySelector('.auth-google');
  if (gBtn) gBtn.addEventListener('click', () => oauth('google'));
  overlay.querySelector('.auth-x').addEventListener('click', closeModal);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
  if (opts.error) { status.classList.add('err'); status.textContent = opts.error; }
  if (opts.email) input.value = opts.email;
  setTimeout(() => input.focus(), 50);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supa) { status.textContent = T.loading; return; }
    const email = input.value.trim();
    if (!email || email.indexOf('@') < 1) { status.textContent = T.invalid; return; }
    sendBtn.disabled = true; status.classList.remove('ok', 'err'); status.textContent = T.sending;
    const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: returnTo() } });
    if (error) { status.textContent = T.err; sendBtn.disabled = false; console.error('[noalibi] signInWithOtp', error); }
    else { status.classList.add('ok'); status.textContent = T.sent; try { localStorage.setItem('noalibi-login-email', email); } catch (e2) {} }
  });
}
function closeModal() { if (overlay) { overlay.remove(); overlay = null; } }

async function refresh() {
  if (!supa) return;
  const { data: { session } } = await supa.auth.getSession();
  const user = session && session.user;
  window.NOALIBI.user = user || null;
  window.NOALIBI.profile = null;
  if (user) {
    let bal = 0, name = (user.email || '').split('@')[0];
    try {
      // 전체 컬럼: is_admin(관리자 버튼) · insta/credit_pref/crew_intent/news_opt_in(프로필 창) — feedback-core.js 가 쓴다
      const { data } = await supa.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) { bal = data.cin_balance; if (data.display_name) name = data.display_name; window.NOALIBI.profile = data; }
    } catch (e) { console.warn('[noalibi] profile fetch', e); }
    renderLoggedIn(bal, name);
    document.dispatchEvent(new CustomEvent('noalibi-auth', { detail: { user, balance: bal } }));
  } else {
    renderLoggedOut();
    document.dispatchEvent(new CustomEvent('noalibi-auth', { detail: { user: null } }));
  }
}

// ── Supabase 동적 로드 (CDN 폴백) ──
(async () => {
  const CDNS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
    'https://esm.sh/@supabase/supabase-js@2'
  ];
  let createClient = null;
  for (const url of CDNS) {
    try { const m = await import(url); createClient = m.createClient || (m.default && m.default.createClient); if (createClient) break; }
    catch (e) { console.warn('[noalibi] supabase load fail:', url, e); }
  }
  if (!createClient) { console.error('[noalibi] Supabase 모듈 로드 실패 — 로그인 비활성'); return; }
  supa = createClient(SUPA_URL, SUPA_KEY);
  window.NOALIBI.supa = supa;
  supa.auth.onAuthStateChange((event) => { refresh(); if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') closeModal(); });
  document.addEventListener('noalibi-refresh', () => refresh());
  if (_readyResolve) _readyResolve(supa);
  await refresh();   // getSession() 은 주소의 토큰 처리(#access_token 소비)가 끝난 뒤 돌아온다
  console.log('[noalibi] auth ready');
  // 로그인 왕복 뒤처리: 만료·재사용 링크 안내(#error=…) → ?r= 해시 복원(리더·크루 창 재개)
  const err = authErrorFromUrl();
  restoreHash();
  if (err) {
    console.warn('[noalibi] auth redirect error', err);
    let email = ''; try { email = localStorage.getItem('noalibi-login-email') || ''; } catch (e) {}
    openModal({ error: T.linkErr, email });
  }
})();
