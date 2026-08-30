// 이북 모드 — 미색 라이트 리더 · 밑줄(선택)→자동 메모 · 메모 모아보기 창 · 책갈피
(function () {
  var WORK_ID = '7c9de32b-71d9-4ba4-85e5-6279f3cc73f3';
  var BM_KEY = 'eb-bm-' + WORK_ID;
  var FS_KEY = 'eb-fontsize';
  var btn = document.getElementById('ebookBtn');
  if (!btn) return;

  var overlay = null, bookEl = null, panel = null, listEl = null, wholeEl = null, countEl = null;
  var memos = [], selBusy = false, bmTimer = null, selTimer = null;
  var fs = Math.min(24, Math.max(15, +(localStorage.getItem(FS_KEY) || 19)));

  function supa() { return window.NOALIBI && window.NOALIBI.supa; }
  function user() { return window.NOALIBI && window.NOALIBI.user; }
  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // INT/EXT/INSERT 슬러그라인(볼드) 다음에 줄바꿈 → 내용은 새 줄에서 시작
  function fmtPara(html) {
    var m = html.match(/^(\s*<b>)([\s\S]*?)(<\/b>)(\s*)/);
    if (m && /\b(INT|EXT|INSERT)\b/i.test(m[2])) return '<b class="eb-slug">' + m[2] + '</b><br>' + html.slice(m[0].length);
    return html;
  }
  function fig(im) {
    var f = document.createElement('figure'); f.className = 'eb-fig';
    var img = document.createElement('img'); img.src = im.src; img.alt = im.alt; img.loading = 'lazy'; f.appendChild(img);
    if (im.cap) { var c = document.createElement('figcaption'); c.textContent = im.cap; f.appendChild(c); }
    return f;
  }

  // ── 스토리 노드 → 이북 챕터 (장면마다 이미지 삽입) ──
  function buildBook() {
    var book = document.createElement('div'); book.className = 'eb-book'; book.style.fontSize = fs + 'px';
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
      var ops = [];
      if (script) Array.prototype.forEach.call(script.children, function (el) {
        if (el.tagName === 'H5') ops.push({ t: 'scene', text: el.textContent.trim() });
        else if (el.tagName === 'P') ops.push({ t: 'p', html: el.innerHTML });
      });
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
        else { var p = document.createElement('p'); p.className = 'eb-p'; p.innerHTML = fmtPara(op.html); ch.appendChild(p); }
      });
      book.appendChild(ch);
    });
    var end = document.createElement('div'); end.className = 'eb-end';
    end.innerHTML = '<p>여기까지 읽어주셔서 고마워요.</p><button type="button" id="ebEndFb" class="eb-allfb">✎ 의견 남기기</button>';
    book.appendChild(end);
    return book;
  }

  function build() {
    overlay = document.createElement('div'); overlay.className = 'eb-overlay'; overlay.hidden = true;
    overlay.innerHTML =
      '<div class="eb-top">' +
        '<button type="button" class="eb-x" id="ebX">← 나가기</button>' +
        '<span class="eb-resume" id="ebResume" hidden></span>' +
        '<span class="eb-fs"><button type="button" id="ebFsm">가−</button><button type="button" id="ebFsp">가+</button></span>' +
      '</div>' +
      '<div class="eb-scroll" id="ebScroll"></div>' +
      '<div class="eb-bar">' +
        '<span class="eb-bar-hint">밑줄을 그으면(문장 선택) <b>의견</b>을 남길 수 있어요</span>' +
        '<button type="button" class="eb-bar-panel" id="ebBarPanel">📝 모아보기 <span id="ebCount">0</span></button>' +
      '</div>' +
      '<div class="eb-panel" id="ebPanel" hidden>' +
        '<div class="eb-panel-head" id="ebPanelHead"><span>메모 모아보기</span><button type="button" id="ebPanelX" aria-label="닫기">×</button></div>' +
        '<div class="eb-panel-body">' +
          '<p class="eb-panel-login" id="ebPanelLogin" hidden>보내려면 <b>로그인</b>이 필요해요 — 로그인해야 누구 의견인지 크레딧에 남아요. <button type="button" id="ebPanelLoginBtn">로그인</button></p>' +
          '<label class="eb-whole-l">이야기 전체 의견 <small>(선택)</small></label>' +
          '<textarea id="ebWhole" class="eb-whole" placeholder="이 이야기 전체에 대한 의견을 자유롭게…" maxlength="2000"></textarea>' +
          '<div class="eb-panel-list" id="ebPanelList"></div>' +
        '</div>' +
        '<div class="eb-panel-foot"><button type="button" id="ebPanelSend" class="eb-panel-send">의견 보내기</button><span class="eb-panel-status" id="ebPanelStatus"></span></div>' +
      '</div>' +
      '<div class="eb-splash" id="ebSplash">' +
        '<div class="eb-splash-in">' +
          '<p class="eb-splash-k">E-BOOK</p><h2>내 세계의 한계</h2>' +
          '<ul class="eb-splash-list"><li>📖 눈이 편한 미색 화면으로 읽어요</li><li>✎ 문장에 <b>밑줄을 그으면</b> 그 자리에 바로 의견</li><li>🔖 <b>언제든 이어읽기</b> — 읽던 곳을 기억해요</li></ul>' +
          '<button type="button" class="eb-splash-go" id="ebSplashGo">지금 들어가기 →</button>' +
        '</div></div>';
    document.body.appendChild(overlay);

    bookEl = overlay.querySelector('#ebScroll');
    panel = overlay.querySelector('#ebPanel');
    listEl = overlay.querySelector('#ebPanelList');
    wholeEl = overlay.querySelector('#ebWhole');
    countEl = overlay.querySelector('#ebCount');

    overlay.querySelector('#ebX').addEventListener('click', close);
    overlay.querySelector('#ebFsm').addEventListener('click', function () { setFs(fs - 1); });
    overlay.querySelector('#ebFsp').addEventListener('click', function () { setFs(fs + 1); });
    overlay.querySelector('#ebBarPanel').addEventListener('click', function () { openPanel(); });
    overlay.querySelector('#ebPanelX').addEventListener('click', function () { panel.hidden = true; });
    overlay.querySelector('#ebPanelSend').addEventListener('click', send);
    overlay.querySelector('#ebPanelLoginBtn').addEventListener('click', function () { if (window.NOALIBI && window.NOALIBI.login) window.NOALIBI.login(); });
    wholeEl.addEventListener('input', function () { updateCount(); });

    document.addEventListener('selectionchange', function () {
      if (!overlay || overlay.hidden || selBusy) return;
      clearTimeout(selTimer); selTimer = setTimeout(onSel, 320);
    });
    bookEl.addEventListener('scroll', function () { clearTimeout(bmTimer); bmTimer = setTimeout(saveBm, 400); });
    makeDraggable(overlay.querySelector('#ebPanelHead'), panel);
  }

  function setFs(v) { fs = Math.min(24, Math.max(15, v)); localStorage.setItem(FS_KEY, fs); var b = bookEl.querySelector('.eb-book'); if (b) b.style.fontSize = fs + 'px'; }

  // ── 밑줄(선택) → 자동 메모 ──
  function onSel() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    var range = sel.getRangeAt(0);
    var el = range.commonAncestorContainer; if (el.nodeType === 3) el = el.parentElement;
    if (el && el.closest('.eb-mark')) return;               // 이미 밑줄 친 곳
    var para = el && el.closest ? el.closest('.eb-p') : null;
    if (!para) return;                                      // 한 문단 안에서만
    autoAdd(range, para);
  }
  function autoAdd(range, para) {
    var quote = range.toString().trim().slice(0, 300);
    if (quote.length < 2) return;
    selBusy = true;
    var chEl = para.closest('.eb-ch'); var act = chEl ? (chEl.dataset.act || '스토리') : '스토리';
    var mark = null;
    try { mark = document.createElement('mark'); mark.className = 'eb-mark'; range.surroundContents(mark); } catch (e) { mark = null; }
    var memo = { quote: quote, node: act, note: '', mark: mark, num: 0, noteEl: null };
    var box = document.createElement('div'); box.className = 'eb-note';
    box.innerHTML = '<div class="eb-note-h"><span class="eb-note-n"></span><button type="button" class="eb-note-x">삭제</button></div><textarea class="eb-note-t" placeholder="이 부분에 대한 의견을 적어주세요…" maxlength="1500"></textarea>';
    para.parentNode.insertBefore(box, para.nextSibling);
    memo.noteEl = box;
    var ta = box.querySelector('.eb-note-t');
    ta.addEventListener('input', function () { memo.note = ta.value; refreshPanel(); });
    box.querySelector('.eb-note-x').addEventListener('click', function () { removeMemo(memo); });
    if (mark) mark.addEventListener('click', function () { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); ta.focus(); });
    memos.push(memo); renumber(); updateCount();
    window.getSelection().removeAllRanges();
    setTimeout(function () { ta.focus(); }, 60);
    setTimeout(function () { selBusy = false; }, 500);
  }
  function removeMemo(m) {
    if (m.mark && m.mark.parentNode) { var t = document.createTextNode(m.mark.textContent); m.mark.parentNode.replaceChild(t, m.mark); }
    if (m.noteEl && m.noteEl.parentNode) m.noteEl.parentNode.removeChild(m.noteEl);
    var i = memos.indexOf(m); if (i >= 0) memos.splice(i, 1);
    renumber(); updateCount(); refreshPanel();
  }
  function renumber() { memos.forEach(function (m, i) { m.num = i + 1; if (m.noteEl) m.noteEl.querySelector('.eb-note-n').textContent = '메모 ' + m.num; }); }
  function updateCount() { var n = memos.length; countEl.textContent = n; }

  // ── 메모 모아보기 창 ──
  function openPanel() {
    overlay.querySelector('#ebPanelLogin').hidden = !!user();
    refreshPanel(); panel.hidden = false;
  }
  function refreshPanel() {
    listEl.innerHTML = '';
    if (!memos.length) { listEl.innerHTML = '<p class="eb-panel-empty">문장에 밑줄을 그으면 여기에 메모가 모여요.</p>'; return; }
    memos.forEach(function (m) {
      var row = document.createElement('div'); row.className = 'eb-panel-item';
      row.innerHTML = '<span class="eb-pi-n">메모 ' + m.num + ' · ' + esc(m.node) + '</span>' +
        '<span class="eb-pi-q">「' + esc(m.quote.slice(0, 60)) + (m.quote.length > 60 ? '…' : '') + '」</span>' +
        (m.note ? '<span class="eb-pi-note">' + esc(m.note.slice(0, 80)) + (m.note.length > 80 ? '…' : '') + '</span>' : '<span class="eb-pi-empty">— 의견 미작성</span>');
      row.addEventListener('click', function () { if (m.noteEl) { panel.hidden = true; m.noteEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); m.noteEl.querySelector('.eb-note-t').focus(); } });
      listEl.appendChild(row);
    });
  }

  async function send() {
    var status = overlay.querySelector('#ebPanelStatus');
    var u = user();
    if (!u) { overlay.querySelector('#ebPanelLogin').hidden = false; if (window.NOALIBI && window.NOALIBI.login) window.NOALIBI.login(); status.textContent = '로그인 후 다시 보내주세요.'; return; }
    if (!supa()) { status.textContent = '잠시 후 다시 시도해주세요.'; return; }
    var whole = wholeEl.value.trim();
    if (!memos.length && !whole) { status.textContent = '메모하거나 전체 의견을 적어주세요.'; return; }
    var parts = memos.map(function (m, i) { return (i + 1) + '. 「' + m.quote + '」[' + m.node + ']' + (m.note ? ' — ' + m.note : ''); }).join('\n');
    var body = (parts ? '[메모]\n' + parts + '\n\n' : '') + (whole ? '[전체 의견]\n' + whole : '');
    var nodes = []; memos.forEach(function (m) { if (nodes.indexOf(m.node) === -1) nodes.push(m.node); });
    var nodeField = memos.length ? (nodes.length === 1 ? nodes[0] : '여러 장') : '스토리 전체';
    var passages = memos.map(function (m) { return { quote: m.quote, node: m.node }; });
    status.textContent = '보내는 중…';
    var res = await supa().from('feedback').insert({ user_id: u.id, work_id: WORK_ID, node: nodeField, body: body, passages: passages.length ? passages : null });
    if (res.error) { status.textContent = '전송 실패 — 잠시 후 다시.'; console.error('[ebook] insert', res.error); return; }
    // 정리
    memos.slice().forEach(removeMemo); wholeEl.value = ''; status.textContent = '';
    panel.hidden = true; updateCount();
    document.dispatchEvent(new CustomEvent('noalibi-refresh'));
    toast('의견을 보냈어요 · +10 cin — 고마워요!');
  }

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'eb-toast'; t.textContent = msg;
    overlay.appendChild(t); setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2400);
  }

  // ── 창 드래그(디자인 변경 가능) ──
  function makeDraggable(handle, box) {
    var sx, sy, ox, oy, drag = false;
    handle.style.cursor = 'move';
    handle.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      drag = true; var r = box.getBoundingClientRect();
      box.style.left = r.left + 'px'; box.style.top = r.top + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto'; box.style.transform = 'none';
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var nx = Math.max(4, Math.min(window.innerWidth - box.offsetWidth - 4, ox + e.clientX - sx));
      var ny = Math.max(4, Math.min(window.innerHeight - 60, oy + e.clientY - sy));
      box.style.left = nx + 'px'; box.style.top = ny + 'px';
    });
    handle.addEventListener('pointerup', function () { drag = false; });
  }

  // ── 책갈피 ──
  function saveBm() { if (!bookEl.scrollHeight) return; var r = bookEl.scrollTop / (bookEl.scrollHeight - bookEl.clientHeight); try { localStorage.setItem(BM_KEY, JSON.stringify({ r: r, t: Date.now() })); } catch (e) {} }
  function readBm() { try { return JSON.parse(localStorage.getItem(BM_KEY) || 'null'); } catch (e) { return null; } }
  function showResume() {
    var bm = readBm(); var chip = overlay.querySelector('#ebResume');
    if (bm && bm.r > 0.03) { chip.hidden = false; chip.textContent = '🔖 이어읽기 (' + Math.round(bm.r * 100) + '%)'; chip.onclick = function () { bookEl.scrollTo({ top: bm.r * (bookEl.scrollHeight - bookEl.clientHeight), behavior: 'smooth' }); }; }
    else chip.hidden = true;
  }

  function open() {
    if (!overlay) build();
    memos = []; updateCount();
    bookEl.innerHTML = ''; bookEl.appendChild(buildBook());
    bookEl.querySelector('#ebEndFb').addEventListener('click', function () { openPanel(); setTimeout(function () { wholeEl.focus(); }, 80); });
    document.body.classList.add('eb-lock'); overlay.hidden = false; panel.hidden = true;
    var splash = overlay.querySelector('#ebSplash'); splash.style.display = 'flex'; splash.style.opacity = '';
    var go = overlay.querySelector('#ebSplashGo'), done = false;
    function enter() { if (done) return; done = true; splash.style.opacity = '0'; setTimeout(function () { splash.style.display = 'none'; }, 350); showResume(); }
    go.onclick = enter; setTimeout(enter, 2500);
  }
  function close() { saveBm(); overlay.hidden = true; document.body.classList.remove('eb-lock'); panel.hidden = true; }

  btn.addEventListener('click', open);
})();
