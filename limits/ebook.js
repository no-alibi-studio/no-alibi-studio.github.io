// 이북 모드 — 스토리를 미색 라이트 화면으로 읽고, 문장에 바로 메모(피드백) · 책갈피
(function () {
  var WORK_ID = '7c9de32b-71d9-4ba4-85e5-6279f3cc73f3';
  var BM_KEY = 'eb-bm-' + WORK_ID;
  var FS_KEY = 'eb-fontsize';
  var btn = document.getElementById('ebookBtn');
  if (!btn) return;

  var overlay = null, bookEl = null, barEl = null, quoteEl = null, memoWrap = null;
  var curRange = null, curBody = null;
  var fs = Math.min(24, Math.max(15, +(localStorage.getItem(FS_KEY) || 19)));

  function supa() { return window.NOALIBI && window.NOALIBI.supa; }
  function user() { return window.NOALIBI && window.NOALIBI.user; }
  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fig(im) {
    var f = document.createElement('figure'); f.className = 'eb-fig';
    var img = document.createElement('img'); img.src = im.src; img.alt = im.alt; img.loading = 'lazy';
    f.appendChild(img);
    if (im.cap) { var c = document.createElement('figcaption'); c.textContent = im.cap; f.appendChild(c); }
    return f;
  }

  // ── 스토리 노드 → 이북 챕터 ──
  function buildBook() {
    var book = document.createElement('div'); book.className = 'eb-book';
    book.style.fontSize = fs + 'px';
    document.querySelectorAll('main details.node').forEach(function (node, i) {
      var titleEl = node.querySelector('.node-title');
      var title = titleEl && titleEl.childNodes[0] ? titleEl.childNodes[0].textContent.trim() : '';
      var smallEl = titleEl ? titleEl.querySelector('small') : null;
      var sub = smallEl ? smallEl.textContent.trim() : '';
      var actN = 'ACT ' + (i + 1);
      var imgs = Array.prototype.map.call(node.querySelectorAll('.node-imgs figure'), function (fg) {
        var im = fg.querySelector('img'), cp = fg.querySelector('figcaption');
        return { src: im.getAttribute('src'), alt: im.getAttribute('alt') || '', cap: cp ? cp.textContent.trim() : '' };
      });
      var script = node.querySelector('.script');

      var ch = document.createElement('section'); ch.className = 'eb-ch'; ch.dataset.act = actN;
      var h = document.createElement('h2'); h.className = 'eb-ch-h';
      h.innerHTML = '<span class="eb-ch-n">' + actN + '</span><span class="eb-ch-t">' + esc(title) + '</span>' + (sub ? '<span class="eb-ch-sub">' + esc(sub) + '</span>' : '');
      ch.appendChild(h);

      // 스크립트 op 나열
      var ops = [];
      if (script) Array.prototype.forEach.call(script.children, function (el) {
        if (el.tagName === 'H5') ops.push({ t: 'scene', text: el.textContent.trim() });
        else if (el.tagName === 'P') ops.push({ t: 'p', html: el.innerHTML });
      });
      // 이미지를 챕터 전체에 고르게 분산 삽입(일러스트)
      var placed = {};
      if (ops.length && imgs.length) imgs.forEach(function (im, k) {
        var idx = Math.min(ops.length - 1, Math.round(k * ops.length / imgs.length));
        while (placed[idx] && idx < ops.length - 1) idx++;
        placed[idx] = im;
      });
      if (!ops.length) imgs.forEach(function (im) { ch.appendChild(fig(im)); });
      ops.forEach(function (op, idx) {
        if (placed[idx]) ch.appendChild(fig(placed[idx]));
        if (op.t === 'scene') { var s = document.createElement('h3'); s.className = 'eb-scene'; s.textContent = op.text; ch.appendChild(s); }
        else { var p = document.createElement('p'); p.className = 'eb-p'; p.innerHTML = op.html; ch.appendChild(p); }
      });
      book.appendChild(ch);
    });
    var end = document.createElement('div'); end.className = 'eb-end';
    end.innerHTML = '<p>여기까지 읽어주셔서 고마워요.</p><button type="button" id="ebAllFb" class="eb-allfb">✎ 이 이야기 전체에 피드백 남기기</button>';
    book.appendChild(end);
    return book;
  }

  // ── 오버레이 조립 ──
  function build() {
    overlay = document.createElement('div'); overlay.className = 'eb-overlay'; overlay.hidden = true;
    overlay.innerHTML =
      '<div class="eb-top">' +
        '<button type="button" class="eb-x" id="ebX">← 나가기</button>' +
        '<span class="eb-resume" id="ebResume" hidden></span>' +
        '<span class="eb-fs"><button type="button" id="ebFsm">가−</button><button type="button" id="ebFsp">가+</button></span>' +
      '</div>' +
      '<div class="eb-scroll" id="ebScroll"></div>' +
      '<div class="eb-bar" id="ebBar"><span class="eb-bar-hint" id="ebBarHint">문장을 선택하면 <b>메모</b>할 수 있어요 · 맨 끝에 전체 피드백</span>' +
        '<button type="button" class="eb-bar-add" id="ebBarAdd" hidden>✎ 여기 메모</button></div>' +
      '<div class="eb-memo" id="ebMemo" hidden>' +
        '<div class="eb-memo-box">' +
          '<p class="eb-memo-q" id="ebMemoQ"></p>' +
          '<p class="eb-memo-login" id="ebMemoLogin" hidden>보내려면 <b>로그인</b>이 필요해요 — 로그인해야 누구의 메모인지 크레딧에 남아요. <button type="button" id="ebMemoLoginBtn">로그인</button></p>' +
          '<textarea id="ebMemoText" placeholder="이 부분에 대한 의견·제안을 자유롭게…" maxlength="2000"></textarea>' +
          '<div class="eb-memo-act"><button type="button" class="eb-memo-cancel" id="ebMemoCancel">취소</button><button type="button" class="eb-memo-save" id="ebMemoSave">저장</button><span class="eb-memo-status" id="ebMemoStatus"></span></div>' +
        '</div></div>' +
      '<div class="eb-splash" id="ebSplash">' +
        '<div class="eb-splash-in">' +
          '<p class="eb-splash-k">E-BOOK</p><h2>내 세계의 한계</h2>' +
          '<ul class="eb-splash-list"><li>📖 눈이 편한 미색 화면으로 읽어요</li><li>✎ 문장을 선택하면 그 자리에 바로 <b>메모</b>(피드백)</li><li>🔖 <b>언제든 이어읽기</b> — 읽던 곳을 기억해요</li></ul>' +
          '<button type="button" class="eb-splash-go" id="ebSplashGo">지금 들어가기 →</button>' +
        '</div></div>';
    document.body.appendChild(overlay);

    bookEl = overlay.querySelector('#ebScroll');
    barEl = overlay.querySelector('#ebBar');
    quoteEl = overlay.querySelector('#ebBarHint');
    memoWrap = overlay.querySelector('#ebMemo');

    overlay.querySelector('#ebX').addEventListener('click', close);
    overlay.querySelector('#ebFsm').addEventListener('click', function () { setFs(fs - 1); });
    overlay.querySelector('#ebFsp').addEventListener('click', function () { setFs(fs + 1); });
    overlay.querySelector('#ebBarAdd').addEventListener('click', openMemo);
    overlay.querySelector('#ebMemoCancel').addEventListener('click', closeMemo);
    overlay.querySelector('#ebMemoSave').addEventListener('click', saveMemo);
    overlay.querySelector('#ebMemoLoginBtn').addEventListener('click', function () { if (window.NOALIBI && window.NOALIBI.login) window.NOALIBI.login(); });

    // 선택 감지(모바일 포함)
    var selTimer = null;
    document.addEventListener('selectionchange', function () {
      if (!overlay || overlay.hidden) return;
      clearTimeout(selTimer);
      selTimer = setTimeout(updateSel, 160);
    });
    // 책갈피 저장
    bookEl.addEventListener('scroll', function () { clearTimeout(bmTimer); bmTimer = setTimeout(saveBm, 400); });
  }
  var bmTimer = null;

  function setFs(v) {
    fs = Math.min(24, Math.max(15, v));
    localStorage.setItem(FS_KEY, fs);
    var b = bookEl.querySelector('.eb-book'); if (b) b.style.fontSize = fs + 'px';
  }

  // ── 선택 → 메모 ──
  function updateSel() {
    var addBtn = overlay.querySelector('#ebBarAdd');
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { return; } // 마지막 선택 유지
    var range = sel.getRangeAt(0);
    var el = range.commonAncestorContainer; if (el.nodeType === 3) el = el.parentElement;
    var body = el && el.closest ? el.closest('.eb-p') : null;
    if (!body) return;
    curRange = range.cloneRange(); curBody = body;
    var t = curRange.toString().trim();
    quoteEl.innerHTML = '선택: 「' + esc(t.slice(0, 40)) + (t.length > 40 ? '…' : '') + '」';
    quoteEl.classList.add('has'); addBtn.hidden = false;
  }
  function clearSel() {
    curRange = null; curBody = null;
    var addBtn = overlay.querySelector('#ebBarAdd');
    if (addBtn) addBtn.hidden = true;
    quoteEl.innerHTML = '문장을 선택하면 <b>메모</b>할 수 있어요 · 맨 끝에 전체 피드백';
    quoteEl.classList.remove('has');
  }

  var memoMode = 'part'; // part | all
  function openMemo() {
    memoMode = 'part';
    if (!curRange || !curRange.toString().trim()) return;
    overlay.querySelector('#ebMemoQ').textContent = '「' + curRange.toString().trim().slice(0, 120) + (curRange.toString().trim().length > 120 ? '…' : '') + '」';
    overlay.querySelector('#ebMemoQ').hidden = false;
    showMemo();
  }
  function openAll() {
    memoMode = 'all';
    var q = overlay.querySelector('#ebMemoQ'); q.textContent = '이 이야기 전체에 대한 피드백'; q.hidden = false;
    showMemo();
  }
  function showMemo() {
    overlay.querySelector('#ebMemoLogin').hidden = !!user();
    overlay.querySelector('#ebMemoText').value = '';
    overlay.querySelector('#ebMemoStatus').textContent = '';
    memoWrap.hidden = false;
    setTimeout(function () { overlay.querySelector('#ebMemoText').focus(); }, 60);
  }
  function closeMemo() { memoWrap.hidden = true; }

  async function saveMemo() {
    var status = overlay.querySelector('#ebMemoStatus');
    var u = user();
    if (!u) { overlay.querySelector('#ebMemoLogin').hidden = false; if (window.NOALIBI && window.NOALIBI.login) window.NOALIBI.login(); status.textContent = '로그인 후 다시 저장해주세요.'; return; }
    if (!supa()) { status.textContent = '잠시 후 다시 시도해주세요.'; return; }
    var note = overlay.querySelector('#ebMemoText').value.trim();
    var quote = (memoMode === 'part' && curRange) ? curRange.toString().trim().slice(0, 300) : '';
    if (!note && !quote) { status.textContent = '내용을 입력해주세요.'; return; }
    var actN = '스토리 전체', passages = null, mark = null;
    if (memoMode === 'part' && curRange) {
      var chEl = curBody.closest('.eb-ch'); actN = chEl ? (chEl.dataset.act || '스토리') : '스토리';
      try { mark = document.createElement('mark'); mark.className = 'eb-mark'; curRange.surroundContents(mark); } catch (e) { mark = null; }
      passages = [{ quote: quote, node: actN }];
    }
    var body = (quote ? '[메모] 「' + quote + '」[' + actN + ']\n' : '') + (note ? '[내용]\n' + note : '');
    status.textContent = '저장 중…';
    var res = await supa().from('feedback').insert({ user_id: u.id, work_id: WORK_ID, node: actN, body: body, passages: passages });
    if (res.error) { status.textContent = '저장 실패 — 잠시 후 다시.'; console.error('[ebook] insert', res.error); return; }
    if (mark) { mark.title = '내 메모: ' + (note || '(부분 표시)'); mark.addEventListener('click', function () { alert('내 메모\n\n「' + quote + '」\n\n' + (note || '(내용 없음)')); }); }
    status.textContent = '';
    closeMemo(); clearSel();
    window.getSelection().removeAllRanges();
    document.dispatchEvent(new CustomEvent('noalibi-refresh'));
    toast('저장했어요 · +10 cin — 고마워요!');
  }

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'eb-toast'; t.textContent = msg;
    overlay.appendChild(t); setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2200);
  }

  // ── 책갈피 ──
  function saveBm() {
    if (!bookEl.scrollHeight) return;
    var r = bookEl.scrollTop / (bookEl.scrollHeight - bookEl.clientHeight);
    try { localStorage.setItem(BM_KEY, JSON.stringify({ r: r, t: Date.now() })); } catch (e) {}
  }
  function readBm() { try { return JSON.parse(localStorage.getItem(BM_KEY) || 'null'); } catch (e) { return null; } }
  function showResume() {
    var bm = readBm(); var chip = overlay.querySelector('#ebResume');
    if (bm && bm.r > 0.03) {
      chip.hidden = false; chip.textContent = '🔖 이어읽기 (' + Math.round(bm.r * 100) + '%)';
      chip.onclick = function () { bookEl.scrollTo({ top: bm.r * (bookEl.scrollHeight - bookEl.clientHeight), behavior: 'smooth' }); };
    } else chip.hidden = true;
  }

  // ── 열기/닫기 + 스플래시 ──
  function open() {
    if (!overlay) build();
    bookEl.innerHTML = ''; bookEl.appendChild(buildBook());
    bookEl.querySelector('#ebAllFb').addEventListener('click', openAll);
    document.body.classList.add('eb-lock');
    overlay.hidden = false;
    clearSel();
    var splash = overlay.querySelector('#ebSplash'); splash.style.display = 'flex';
    var go = overlay.querySelector('#ebSplashGo');
    var done = false;
    function enter() { if (done) return; done = true; splash.style.opacity = '0'; setTimeout(function () { splash.style.display = 'none'; splash.style.opacity = ''; }, 350); showResume(); }
    go.onclick = enter;
    setTimeout(enter, 2500);
  }
  function close() {
    saveBm();
    overlay.hidden = true; document.body.classList.remove('eb-lock');
    closeMemo();
  }

  btn.addEventListener('click', open);
})();
