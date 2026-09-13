// feedback-core.js — 참여(댓글) 공통 모듈: 세션 · 동의 · 대상 칩 · 제출 · 첨부 · 목록 · 좋아요 · 관리자 · 프로필
// 모든 참여는 public.feedback 한 테이블로 간다. 채널(source_channel)은 media | story | guestbook.
// auth.js 가 window.NOALIBI { supa, user, profile, login(), ready } 를 준비하면 그 위에서 동작한다.
(function () {
  'use strict';
  var WORK_ID = '7c9de32b-71d9-4ba4-85e5-6279f3cc73f3';
  var PRIVACY_VERSION = '1.1';                 // privacy.html 의 현재 버전과 맞춘다
  var BUCKET = 'feedback-attachments';
  var MAX_FILE = 5 * 1024 * 1024;
  var MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'];
  var KO = (document.documentElement.lang || 'ko') !== 'en';

  var T = KO ? {
    gate: '로그인을 하면 참여가 가능해집니다.', login: '로그인', logout: '로그아웃',
    submit: '참여하기', sending: '보내는 중…', sent: '참여가 기록됐어요 · +10 udb', failed: '전송 실패 — 잠시 후 다시 시도해주세요.',
    attachFail: '참여는 기록됐지만 첨부는 올리지 못했어요.', needBody: '내용을 적어주세요.', tooLong: '글이 너무 길어요 — 4000자 이내로 줄여주세요.',
    ph: { media: '이 장면에 대한 의견 · 레퍼런스 · 제안을 자유롭게…', story: '담은 문장, 또는 이야기 전체에 대한 의견을…', guestbook: '작품에 대해 어떤 말이든 자유롭게…' },
    catNone: '종류 (선택)', cats: ['레퍼런스 추천', '연출 피드백', '디자인 피드백', '기타'],
    linkPh: '참고 링크 (선택) https://…', attach: '이미지·영상 첨부', attachHint: '5MB 이하 · 작가만 봅니다',
    attachTooBig: '5MB 이하 파일만 올릴 수 있어요.', attachType: '이미지(jpg·png·webp·gif) 또는 영상(mp4·mov·webm)만 올릴 수 있어요.',
    pub: '홈페이지에 공개', pubNote: '체크를 풀면 작가만 봅니다. 이름은 크레딧에 남아요.',
    consent: '개인정보 수집·이용에 동의합니다', consentNote: '이름/닉네임과 남긴 글을 게시·크레딧 표기·포인트 적립에 씁니다. 보유 기간은 탈퇴 시까지.',
    policy: '→ 처리방침', needConsent: '개인정보 수집·이용에 동의해주세요.',
    whole: '작품 전체', wholeStory: '이야기 전체', video: '영상', image: '이미지', act: 'ACT', sentence: '문장', link: '링크 ↗',
    nowTime: '⏱ 지금 시간 담기', timeHint: '영상을 멈춘 지점이 칩으로 담겨요',
    empty: '아직 참여가 없어요 — 첫 번째가 되어주세요.', loadFail: '목록을 불러오지 못했어요.',
    anon: '익명', pending: '승인 대기', priv: '비공개', adopted: '채택됨',
    approve: '승인', unapprove: '승인 취소', adopt: '채택', unadopt: '채택 취소', adminFail: '처리하지 못했어요 — 잠시 후 다시.',
    del: '삭제', delTitle: '내 글 삭제 (받은 udb 회수)',
    delConfirm: '이 글을 삭제하면 이 글로 받은 udb 포인트도 함께 회수됩니다.\n(작성 +10 · 채택됐다면 +50 · 받은 좋아요 +1씩)\n\n그래도 삭제할까요?',
    delFail: '삭제하지 못했어요 — 잠시 후 다시 시도해주세요.',
    profTitle: '내 프로필', profName: '표시 이름 / 닉네임', profInsta: '인스타그램 (선택)', profCredit: '크레딧 표기',
    creditOpts: { name: '이름 / 닉네임', email: '이메일 아이디', insta: '인스타그램' },
    crew: '이 작품의 제작 크루로 함께할 의향이 있어요', crewNote: '본 제작 시점에 참여 조건·계약서를 이메일로 보내드리고, 그때 다시 확인해요.',
    news: '작품 소식·수익 공지를 이메일로 받을게요', save: '저장', saved: '저장됐어요', saveFail: '저장하지 못했어요 — 잠시 후 다시.',
    profGate: '로그인하면 프로필을 설정할 수 있어요.', close: '닫기', myProfile: '내 프로필 열기'
  } : {
    gate: 'Log in to participate.', login: 'Log in', logout: 'Log out',
    submit: 'Participate', sending: 'Sending…', sent: 'Recorded · +10 udb', failed: 'Failed — please try again shortly.',
    attachFail: 'Your comment was recorded, but the attachment failed to upload.', needBody: 'Please write something.', tooLong: 'Too long — please keep it under 4000 characters.',
    ph: { media: 'Your thoughts, references, or suggestions for this scene…', story: 'About the sentences you picked, or the story as a whole…', guestbook: 'Anything about the work…' },
    catNone: 'Type (optional)', cats: ['Reference', 'Direction', 'Design', 'Other'],
    linkPh: 'Reference link (optional) https://…', attach: 'Attach image · video', attachHint: 'up to 5MB · seen by the author only',
    attachTooBig: 'Files must be 5MB or smaller.', attachType: 'Images (jpg·png·webp·gif) or video (mp4·mov·webm) only.',
    pub: 'Show on the site', pubNote: 'Untick and only the author sees it. Your name stays in the credits.',
    consent: 'I consent to the collection and use of my personal data', consentNote: 'Your name and text are used for posting, credits and point accrual. Kept until you close your account.',
    policy: '→ Policy', needConsent: 'Please agree to the collection and use of your personal data.',
    whole: 'the whole work', wholeStory: 'the whole story', video: 'video', image: 'image', act: 'ACT', sentence: 'line', link: 'link ↗',
    nowTime: '⏱ Pin current time', timeHint: 'The point where you paused the video becomes a chip',
    empty: 'No participation yet — be the first.', loadFail: 'Could not load the list.',
    anon: 'anon', pending: 'pending review', priv: 'private', adopted: 'adopted',
    approve: 'Approve', unapprove: 'Unapprove', adopt: 'Adopt', unadopt: 'Unadopt', adminFail: 'Could not update — try again.',
    del: 'Delete', delTitle: 'Delete my note (udb earned is taken back)',
    delConfirm: 'Deleting this note also takes back the udb points it earned.\n(+10 for writing · +50 if adopted · +1 per like received)\n\nDelete anyway?',
    delFail: 'Could not delete — please try again.',
    profTitle: 'My profile', profName: 'Display name', profInsta: 'Instagram (optional)', profCredit: 'Credit as',
    creditOpts: { name: 'Name / nickname', email: 'Email id', insta: 'Instagram' },
    crew: 'I would like to join the production crew of this work', crewNote: 'Terms and a contract are emailed before main production; you confirm again then.',
    news: 'Email me news about the work and revenue reports', save: 'Save', saved: 'Saved', saveFail: 'Could not save — try again.',
    profGate: 'Log in to set up your profile.', close: 'Close', myProfile: 'Open my profile'
  };

  // ── 기본 도우미 ──
  function supa() { return window.NOALIBI && window.NOALIBI.supa; }
  function user() { return (window.NOALIBI && window.NOALIBI.user) || null; }
  function profile() { return (window.NOALIBI && window.NOALIBI.profile) || null; }
  function isAdmin() { var p = profile(); return !!(p && p.is_admin); }
  function login() { if (window.NOALIBI && window.NOALIBI.login) window.NOALIBI.login(); }
  function whenReady(cb) {
    (function poll() {
      if (window.NOALIBI && window.NOALIBI.ready) window.NOALIBI.ready.then(cb);
      else setTimeout(poll, 60);
    })();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function fmtTime(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function fmtDate(iso) { return (iso || '').slice(0, 10); }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  }
  function fire() { document.dispatchEvent(new CustomEvent('noalibi-refresh')); }

  // 로그인 안내 한 줄 — 참여 창이 있을 자리에 이것만 보인다
  function gateLine() {
    var g = el('div', 'pf-gate');
    var p = el('span', 'pf-gate-t', esc(T.gate));
    var b = el('button', 'pf-gate-btn', esc(T.login)); b.type = 'button';
    b.addEventListener('click', login);
    g.append(p, b);
    return g;
  }
  function check(labelHtml, checked, noteHtml) {
    var lab = el('label', 'pf-check');
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!checked;
    var sp = el('span', null, labelHtml + (noteHtml ? '<small>' + noteHtml + '</small>' : ''));
    lab.append(cb, sp);
    return { el: lab, box: cb };
  }

  // ── 참여 창 ──
  // opts: channel ('media'|'story'|'guestbook'), compact, placeholder, showCategory, showLink, showAttach,
  //       renderChips(chipsEl)  — 대상 칩을 그린다 (페이지가 소유)
  //       getTarget()           — { target_type, target_ref, target_time_ms, passages } 를 돌려준다
  //       canSend()             — 보낼 수 있는 상태인지 (없으면 항상 true)
  //       onSent(result)        — 전송 뒤 콜백
  function buildForm(opts) {
    opts = opts || {};
    var wrap = el('div', 'pf' + (opts.compact ? ' pf-compact' : ''));
    var api = { el: wrap, chipsEl: null, ta: null, painted: undefined };
    var fileInput = null, pickedFile = null, catSel = null, linkIn = null, pubC = null, conC = null, status = null, sendBtn = null;

    function paint(force) {
      var uid = user() ? user().id : null;
      if (!force && api.painted === uid) return;   // 토큰 갱신마다 다시 그리면 쓰던 글이 날아간다 → 로그인 상태가 바뀔 때만
      api.painted = uid;
      wrap.innerHTML = ''; pickedFile = null;
      if (!uid) { wrap.appendChild(gateLine()); api.chipsEl = null; api.ta = null; return; }

      api.chipsEl = el('div', 'pf-chips'); wrap.appendChild(api.chipsEl);
      if (opts.renderChips) opts.renderChips(api.chipsEl);

      if (opts.showCategory || opts.showLink) {
        var row = el('div', 'pf-row');
        if (opts.showCategory) {
          catSel = document.createElement('select'); catSel.className = 'pf-sel';
          catSel.appendChild(new Option(T.catNone, ''));
          T.cats.forEach(function (c) { catSel.appendChild(new Option(c, c)); });
          row.appendChild(catSel);
        }
        if (opts.showLink) {
          linkIn = document.createElement('input'); linkIn.type = 'url'; linkIn.className = 'pf-in'; linkIn.placeholder = T.linkPh; linkIn.maxLength = 500;
          row.appendChild(linkIn);
        }
        wrap.appendChild(row);
      }

      api.ta = document.createElement('textarea'); api.ta.className = 'pf-ta'; api.ta.maxLength = 2000;
      api.ta.placeholder = opts.placeholder || T.ph[opts.channel] || '';
      wrap.appendChild(api.ta);

      if (opts.showAttach) {
        var at = el('div', 'pf-attach');
        fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = MIMES.join(','); fileInput.id = 'pfFile' + Math.random().toString(36).slice(2, 7);
        var lab = document.createElement('label'); lab.htmlFor = fileInput.id; lab.className = 'pf-attach-btn'; lab.textContent = '＋ ' + T.attach;
        var nm = el('span', 'pf-attach-name', esc(T.attachHint));
        fileInput.addEventListener('change', function () {
          var f = fileInput.files && fileInput.files[0];
          pickedFile = null;
          if (!f) { nm.textContent = T.attachHint; nm.classList.remove('has'); return; }
          if (f.size > MAX_FILE) { nm.textContent = T.attachTooBig; nm.classList.remove('has'); fileInput.value = ''; return; }
          if (MIMES.indexOf(f.type) === -1) { nm.textContent = T.attachType; nm.classList.remove('has'); fileInput.value = ''; return; }
          pickedFile = f; nm.textContent = f.name + ' · ' + Math.round(f.size / 1024) + 'KB'; nm.classList.add('has');
        });
        at.append(fileInput, lab, nm); wrap.appendChild(at);
      }

      pubC = check(esc(T.pub), true, esc(T.pubNote));
      conC = check('<b>' + esc(T.consent) + '</b> <span class="req">*</span>', false, esc(T.consentNote) + ' <a href="privacy.html" target="_blank" rel="noopener">' + esc(T.policy) + '</a>');
      wrap.append(pubC.el, conC.el);

      var sub = el('div', 'pf-submit');
      sendBtn = el('button', 'pf-send', esc(T.submit)); sendBtn.type = 'button';
      status = el('span', 'pf-status');
      sub.append(sendBtn, status); wrap.appendChild(sub);
      sendBtn.addEventListener('click', function () { api.submit(); });
    }

    function setStatus(msg, ok) { if (!status) return; status.classList.toggle('ok', !!ok); status.textContent = msg || ''; }

    api.submit = async function () {
      if (!user()) { login(); return; }
      if (opts.canSend && !opts.canSend()) return;
      var overall = (api.ta.value || '').trim();
      var tg = (opts.getTarget && opts.getTarget(overall)) || {};
      var body = (tg.body != null ? tg.body : overall).trim();      // 페이지가 본문을 조립할 수 있다 (스토리: 전체 의견 + 문장별 메모)
      if (!body) { setStatus(tg.needBodyMsg || T.needBody); api.ta.focus(); return; }
      if (body.length > 4000) { setStatus(T.tooLong); return; }
      if (!conC.box.checked) { setStatus(T.needConsent); conC.box.focus(); return; }
      var link = linkIn ? linkIn.value.trim() : '';
      if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
      sendBtn.classList.add('disabled'); setStatus(T.sending);
      var res = await submit({
        channel: opts.channel, target_type: tg.target_type, target_ref: tg.target_ref, target_time_ms: tg.target_time_ms,
        passages: tg.passages, category: catSel ? catSel.value : '', link: link, body: body, is_public: pubC.box.checked
      }, pickedFile);
      sendBtn.classList.remove('disabled');
      if (res.error) { setStatus(T.failed); console.error('[feedback] submit', res.error); return; }
      setStatus(res.attachError ? T.attachFail : T.sent, true);
      if (res.attachError) console.error('[feedback] attach', res.attachError);
      api.ta.value = ''; conC.box.checked = false;
      if (fileInput) { fileInput.value = ''; pickedFile = null; var n = wrap.querySelector('.pf-attach-name'); if (n) { n.textContent = T.attachHint; n.classList.remove('has'); } }
      if (opts.onSent) opts.onSent(res);
    };
    api.repaint = function () { paint(true); };
    api.refreshChips = function () { if (api.chipsEl && opts.renderChips) { api.chipsEl.innerHTML = ''; opts.renderChips(api.chipsEl); } };
    api.focus = function () { if (api.ta) api.ta.focus(); };
    api.status = setStatus;

    paint(true);
    document.addEventListener('noalibi-auth', function () { paint(false); });
    return api;
  }

  // ── 제출 · 첨부 ──
  async function submit(p, file) {
    var u = user(); if (!u) { login(); return { error: 'login' }; }
    var s = supa(); if (!s) return { error: 'supabase not ready' };
    var tt = p.target_type || 'work';
    var row = {
      user_id: u.id, work_id: WORK_ID, source_channel: p.channel,
      target_type: tt, target_ref: p.target_ref || null,
      target_time_ms: (tt === 'video' && p.target_time_ms != null) ? Math.max(0, Math.round(p.target_time_ms)) : null,
      category: p.category || null, link: p.link || null, body: p.body,
      passages: (p.passages && p.passages.length) ? p.passages : null,
      is_public: p.is_public !== false,
      privacy_consent: true, privacy_version: PRIVACY_VERSION, consented_at: new Date().toISOString()
    };
    var res = await s.from('feedback').insert(row).select('id').single();
    if (res.error) return { error: res.error };
    var id = res.data.id, attachError = null;
    if (file) attachError = await attach(id, file);
    fire();
    return { id: id, attachError: attachError };
  }
  async function attach(feedbackId, file) {
    var u = user(), s = supa();
    var ext = ((file.name || '').split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    var path = u.id + '/' + feedbackId + '/' + uuid() + '.' + ext;
    var up = await s.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) return up.error;
    var ins = await s.from('feedback_attachments').insert({ feedback_id: feedbackId, user_id: u.id, bucket_path: path, mime: file.type, size_bytes: file.size });
    return ins.error || null;
  }

  // ── 목록 ──
  var COLS = 'id, body, created_at, user_id, guest_name, adopted, approved, is_public, source_channel, target_type, target_ref, target_time_ms, category, link, passages';
  async function fetchRows(channel) {
    var s = supa(); if (!s) return null;
    var q = s.from('feedback').select(COLS).eq('work_id', WORK_ID).order('created_at', { ascending: false });
    if (channel) q = q.eq('source_channel', channel);
    var r = await q;
    if (r.error) { console.error('[feedback] rows', r.error); return null; }
    return r.data || [];
  }
  async function fetchNames(rows) {
    var s = supa(), ids = [], map = {};
    rows.forEach(function (r) { if (r.user_id && ids.indexOf(r.user_id) === -1) ids.push(r.user_id); });
    if (!ids.length || !s) return map;
    var pr = await s.from('profiles').select('id, display_name').in('id', ids);
    if (pr.error) { console.warn('[feedback] profiles', pr.error); return map; }
    (pr.data || []).forEach(function (p) { map[p.id] = p.display_name; });
    return map;
  }
  async function fetchLikes() {
    var s = supa(), counts = {}, mine = {};
    if (!s) return { counts: counts, mine: mine };
    var lk = await s.from('likes').select('feedback_id, user_id');
    if (lk.error) { console.warn('[feedback] likes', lk.error); return { counts: counts, mine: mine }; }
    (lk.data || []).forEach(function (x) {
      counts[x.feedback_id] = (counts[x.feedback_id] || 0) + 1;
      if (user() && x.user_id === user().id) mine[x.feedback_id] = 1;
    });
    return { counts: counts, mine: mine };
  }
  function whoName(r, names) { return names[r.user_id] || r.guest_name || T.anon; }

  function heart(r, count0, liked0) {
    var liked = liked0, count = count0;
    var b = el('button', 'gb-heart'); b.type = 'button';
    function paint() { b.classList.toggle('liked', liked); b.textContent = (liked ? '♥' : '♡') + ' ' + count; }
    paint();
    b.addEventListener('click', async function () {
      if (!user()) { login(); return; }
      var was = liked; liked = !liked; count = Math.max(0, count + (liked ? 1 : -1)); paint();
      var res = was
        ? await supa().from('likes').delete().eq('user_id', user().id).eq('feedback_id', r.id)
        : await supa().from('likes').insert({ user_id: user().id, feedback_id: r.id });
      if (res.error) { liked = was; count = count0; paint(); console.error('[feedback] like', res.error); }
    });
    return b;
  }
  function delBtn(r, reload) {
    var b = el('button', 'gb-del', esc(T.del)); b.type = 'button'; b.title = T.delTitle;
    b.addEventListener('click', async function () {
      if (!window.confirm(T.delConfirm)) return;
      b.disabled = true;
      var d = await supa().from('feedback').delete().eq('id', r.id).eq('user_id', user().id);
      if (d.error) { b.disabled = false; window.alert(T.delFail); console.error('[feedback] delete', d.error); return; }
      fire(); if (reload) reload();
    });
    return b;
  }
  // 관리자: 승인 · 채택 토글 (feedback_admin_update 정책 + 트리거가 시각·적립을 처리)
  function adminButtons(r, reload) {
    var box = el('span', 'fl-admin');
    if (!isAdmin()) return box;
    [['approved', T.approve, T.unapprove], ['adopted', T.adopt, T.unadopt]].forEach(function (d) {
      var key = d[0];
      if (key === 'approved' && r.approved) return;   // 승인된 글엔 '승인 취소'를 두지 않는다 (결정: 숨김)
      var b = el('button', 'fl-adm k-' + key + (r[key] ? ' on' : ''), esc(r[key] ? d[2] : d[1])); b.type = 'button';
      b.addEventListener('click', async function () {
        b.disabled = true;
        var patch = {}; patch[key] = !r[key];
        var res = await supa().from('feedback').update(patch).eq('id', r.id);
        if (res.error) { b.disabled = false; window.alert(T.adminFail); console.error('[feedback] admin ' + key, res.error); return; }
        fire(); if (reload) reload();
      });
      box.appendChild(b);
    });
    return box;
  }

  function legacyAct(node) { var m = /(\d+)/.exec(node || ''); return m ? 'ACT ' + m[1] : null; }   // 'NODE 1' → 'ACT 1'
  // 칩: 페이지가 targetChips(row) 를 주면 그걸 쓰고, 없으면 기본 규칙
  function defaultChips(r) {
    var out = [];
    if (r.category) out.push({ label: r.category, cls: 'cat' });
    if (r.target_type === 'video') out.push({ label: T.video + (r.target_time_ms != null ? ' · ' + fmtTime(r.target_time_ms) : ''), cls: 'tg', time: r.target_time_ms });
    else if (r.target_type === 'image') out.push({ label: T.image + (r.target_ref ? ' · ' + r.target_ref : ''), cls: 'tg', ref: r.target_ref });
    else if (r.source_channel === 'story') {
      var ps = Array.isArray(r.passages) ? r.passages : [];
      if (ps.length) ps.forEach(function (p) {
        // 구형 passages({node, quote}) 도 읽는다: NODE n → ACT n, 인용은 앞 14자만
        var act = p.act || legacyAct(p.node) || T.act;
        var head = p.head || (p.quote ? String(p.quote).trim().slice(0, 14) : '');
        var num = (typeof p.idx === 'number') ? ' · ' + T.sentence + ' ' + (p.idx + 1) : '';
        out.push({ label: act + num + (head ? ' 「' + head + '…」' : ''), cls: 'tg', passage: { act: act, idx: p.idx, head: head } });
      });
      else out.push({ label: T.wholeStory, cls: 'tg dim' });
    }
    if (r.link) out.push({ label: T.link, cls: 'lnk', href: r.link });
    return out;
  }

  // renderList(container, opts): opts.channel · opts.filter(row) · opts.chips(row) → [{label, cls, href, onClick}] · opts.onRows(rows) · opts.limit
  function renderList(container, opts) {
    opts = opts || {};
    var api = { rows: [], reload: load };
    var loadTimer = null, loading = false, again = false;
    function load() { clearTimeout(loadTimer); loadTimer = setTimeout(run, 120); }
    async function run() {
      if (loading) { again = true; return; }
      loading = true;
      try { await doLoad(); } finally { loading = false; if (again) { again = false; load(); } }
    }
    async function doLoad() {
      var rows = await fetchRows(opts.channel);
      if (rows == null) { container.innerHTML = '<p class="fl-empty">' + esc(T.loadFail) + '</p>'; return; }
      if (opts.onRows) opts.onRows(rows);
      if (opts.filter) rows = rows.filter(opts.filter);
      api.rows = rows;
      var names = await fetchNames(rows), likes = await fetchLikes();
      container.innerHTML = '';
      if (!rows.length) { container.appendChild(el('p', 'fl-empty', esc(opts.emptyText || T.empty))); return; }
      if (opts.limit) rows = rows.slice(0, opts.limit);
      rows.forEach(function (r) {
        var item = el('div', 'fl-item' + (r.adopted ? ' adopted' : ''));
        var who = el('p', 'fl-who');
        who.appendChild(el('span', 'fl-name', esc(whoName(r, names))));
        var allChips = opts.chips ? opts.chips(r) : defaultChips(r);
        var ps = Array.isArray(r.passages) ? r.passages : [];
        var noted = ps.some(function (p) { return p && p.note; });   // 문장별 메모 형식
        function chipEl(c) {
          var chip;
          if (c.href) { chip = el('a', 'fl-chip ' + (c.cls || ''), esc(c.label)); chip.href = c.href; chip.target = '_blank'; chip.rel = 'noopener'; }
          else { chip = el('span', 'fl-chip ' + (c.cls || ''), esc(c.label)); if (c.onClick) { chip.classList.add('go'); chip.addEventListener('click', c.onClick); } }
          return chip;
        }
        allChips.forEach(function (c) { if (noted && c.passage) return; who.appendChild(chipEl(c)); });
        who.appendChild(el('span', 'fl-when', esc(fmtDate(r.created_at))));
        if (r.adopted) who.appendChild(el('span', 'fl-badge adopted', esc(T.adopted)));
        if (!r.approved) who.appendChild(el('span', 'fl-badge pend', esc(T.pending)));
        if (!r.is_public) who.appendChild(el('span', 'fl-badge priv', esc(T.priv)));
        if (user() && r.user_id === user().id) who.appendChild(delBtn(r, load));
        item.appendChild(who);
        if (noted) {
          ps.forEach(function (p) {
            if (p.whole) { if (p.note) item.appendChild(el('p', 'fl-body', esc(p.note))); return; }
            var c = null; allChips.forEach(function (x) { if (x.passage && x.passage.act === (p.act || '') && x.passage.idx === p.idx) c = x; });
            var blk = el('div', 'fl-note');
            if (c) blk.appendChild(chipEl(c));
            if (p.note) blk.appendChild(el('p', 'fl-note-t', esc(p.note)));
            item.appendChild(blk);
          });
        } else item.appendChild(el('p', 'fl-body', esc(r.body)));
        var act = el('div', 'fl-actions');
        act.appendChild(heart(r, likes.counts[r.id] || 0, !!likes.mine[r.id]));
        act.appendChild(adminButtons(r, load));
        item.appendChild(act);
        container.appendChild(item);
      });
    }
    whenReady(load);
    document.addEventListener('noalibi-auth', load);
    return api;
  }

  // 스토리 ACT 배지: 문장 칩(passages) 또는 target_ref 로 ACT 별 참여 인원
  function storyCounts(rows) {
    var byAct = {};
    rows.forEach(function (r) {
      if (r.source_channel !== 'story') return;
      var acts = [];
      if (Array.isArray(r.passages)) r.passages.forEach(function (p) { var a = p.act || legacyAct(p.node); if (a && acts.indexOf(a) === -1) acts.push(a); });
      if (!acts.length && r.target_ref) r.target_ref.split(',').forEach(function (a) { a = a.trim(); if (/^NODE/i.test(a)) a = legacyAct(a) || a; if (a && acts.indexOf(a) === -1) acts.push(a); });
      var who = r.user_id || ('g:' + (r.guest_name || '')) ;
      acts.forEach(function (a) { byAct[a] = byAct[a] || {}; byAct[a][who] = 1; });
    });
    var out = {}; Object.keys(byAct).forEach(function (a) { out[a] = Object.keys(byAct[a]).length; });
    return out;
  }

  // ── 프로필 창: 표시 이름 · 인스타 · 크레딧 표기 · 크루 의향 · 소식 수신 ──
  var profModal = null;
  function closeProfile() { if (profModal) { profModal.remove(); profModal = null; } }
  function openProfile(o) {
    o = o || {};
    if (!user()) { login(); return; }
    closeProfile();
    var p = profile() || {};
    profModal = el('div', 'pf-modal');
    var box = el('div', 'pf-modal-box');
    var x = el('button', 'pf-modal-x', '×'); x.type = 'button'; x.setAttribute('aria-label', T.close);
    box.appendChild(x);
    box.appendChild(el('h3', null, esc(T.profTitle)));
    function field(labelText, input) { var l = el('label', 'pf-field'); l.appendChild(el('span', null, esc(labelText))); l.appendChild(input); return l; }
    var nameIn = document.createElement('input'); nameIn.type = 'text'; nameIn.maxLength = 40; nameIn.className = 'pf-in'; nameIn.value = p.display_name || '';
    var instaIn = document.createElement('input'); instaIn.type = 'text'; instaIn.maxLength = 40; instaIn.className = 'pf-in'; instaIn.placeholder = '@youraccount'; instaIn.value = p.insta || '';
    var credSel = document.createElement('select'); credSel.className = 'pf-sel';
    Object.keys(T.creditOpts).forEach(function (k) { credSel.appendChild(new Option(T.creditOpts[k], k)); });
    credSel.value = p.credit_pref || 'name';
    var crewC = check(esc(T.crew), !!p.crew_intent, esc(T.crewNote));
    var newsC = check(esc(T.news), !!p.news_opt_in);
    if (o.focus === 'crew') crewC.el.classList.add('hl');
    var st = el('span', 'pf-status');
    var save = el('button', 'pf-send', esc(T.save)); save.type = 'button';
    var row = el('div', 'pf-submit'); row.append(save, st);
    box.append(field(T.profName, nameIn), field(T.profInsta, instaIn), field(T.profCredit, credSel), crewC.el, newsC.el, row);
    profModal.appendChild(box);
    document.body.appendChild(profModal);
    x.addEventListener('click', closeProfile);
    profModal.addEventListener('mousedown', function (e) { if (e.target === profModal) closeProfile(); });
    document.addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { closeProfile(); document.removeEventListener('keydown', esc_); } });
    setTimeout(function () { (o.focus === 'crew' ? crewC.box : nameIn).focus(); }, 40);
    save.addEventListener('click', async function () {
      var name = nameIn.value.trim(), insta = instaIn.value.trim().replace(/\s+/g, '');
      if (insta && insta[0] !== '@') insta = '@' + insta;
      save.classList.add('disabled'); st.classList.remove('ok'); st.textContent = T.sending;
      var res = await supa().from('profiles').update({
        display_name: name || null, insta: insta || null, credit_pref: credSel.value,
        crew_intent: crewC.box.checked, news_opt_in: newsC.box.checked
      }).eq('id', user().id);
      save.classList.remove('disabled');
      if (res.error) { st.textContent = T.saveFail; console.error('[feedback] profile save', res.error); return; }
      st.classList.add('ok'); st.textContent = T.saved;
      fire();
      setTimeout(closeProfile, 900);
    });
  }
  // 우상단 'udb N' 칩을 누르면 프로필 창. #crew 로 들어오면(참여 창 02) 프로필 창의 크루 항목으로.
  document.addEventListener('click', function (e) {
    var c = e.target && e.target.closest ? e.target.closest('.auth-cin') : null;
    if (c) { e.preventDefault(); openProfile(); }
  });
  function hashCrew() {
    if (location.hash !== '#crew') return;
    if (user()) { openProfile({ focus: 'crew' }); history.replaceState(null, '', location.pathname + location.search); }
    else login();   // OAuth 는 같은 주소(#crew 포함)로 돌아오므로 로그인 뒤 다시 이 함수가 돈다
  }
  var crewChecked = false;
  document.addEventListener('noalibi-auth', function () { if (!crewChecked || location.hash === '#crew') { crewChecked = true; hashCrew(); } });
  window.addEventListener('hashchange', hashCrew);
  document.addEventListener('noalibi-auth', function () { var c = document.querySelector('.auth-cin'); if (c) { c.title = T.myProfile; c.style.cursor = 'pointer'; } });

  window.FEEDBACK = {
    WORK_ID: WORK_ID, PRIVACY_VERSION: PRIVACY_VERSION, KO: KO, T: T,
    supa: supa, user: user, profile: profile, isAdmin: isAdmin, login: login, whenReady: whenReady,
    esc: esc, el: el, fmtTime: fmtTime, fmtDate: fmtDate,
    gateLine: gateLine, check: check, buildForm: buildForm, submit: submit, attach: attach,
    fetchRows: fetchRows, fetchNames: fetchNames, fetchLikes: fetchLikes, whoName: whoName,
    heart: heart, delBtn: delBtn, adminButtons: adminButtons, defaultChips: defaultChips, renderList: renderList, storyCounts: storyCounts,
    openProfile: openProfile, closeProfile: closeProfile, refresh: fire
  };
})();
