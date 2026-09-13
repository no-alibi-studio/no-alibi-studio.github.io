// ebook.js — 스토리 리더 + 참여
// · ACT 를 누르면 리더(다크)가 열리고, '이북 모드' 버튼은 미색 리더.
// · 본문은 복사·선택이 안 된다(작품 IP). 대신 문장을 길게 누르면(0.4초) 그 문장이 참여 창에 담긴다.
// · 맨 아래 고정된 '참여하기' 창에서 담은 문장(또는 이야기 전체)에 대한 의견을 보낸다. 로그아웃 상태엔 로그인 안내 한 줄만.
// · 저장되는 것은 문장 위치(ACT · 번호)와 첫 몇 글자뿐. 대본 전문은 DB 에 남지 않는다.
(function () {
  'use strict';
  var WORK_ID = '7c9de32b-71d9-4ba4-85e5-6279f3cc73f3';
  var BM_KEY = 'eb-bm-' + WORK_ID;
  var FS_KEY = 'eb-fontsize';
  var KO = (document.documentElement.lang || 'ko') !== 'en';
  var T = KO ? {
    exit: '← 나가기', resume: '🔖 이어읽기', next: '↓ ACT {n} 이어보기', thanks: '여기까지 읽어주셔서 고마워요.',
    participate: '참여하기', picked: '담긴 문장', hint: '문장을 <b>길게 누르면</b> 참여 창에 담겨요', hintDesk: '문장을 <b>길게 누르면</b>(마우스 꾹) 참여 창에 담겨요',
    added: '담겼어요', removed: '뺐어요', sheetTitle: '참여하기', sheetWhole: '담은 문장이 없으면 이야기 전체에 대한 참여예요',
    sent: '참여가 기록됐어요 · +10 udb — 고마워요!', listTitle: '이 이야기에 남겨진 참여',
    splashK: 'E-BOOK', splashTitle: '내 세계의 한계',
    splash: ['📖 눈이 편한 화면으로 읽어요', '✎ 문장을 <b>길게 누르면</b> 그 문장에 참여', '🔖 <b>언제든 이어읽기</b> — 읽던 곳을 기억해요'],
    go: '지금 들어가기 →', readMark: '읽기 →', sentence: '문장', act: 'ACT', badge: '참여 {n}명', wholeStory: '이야기 전체'
  } : {
    exit: '← Exit', resume: '🔖 Resume', next: '↓ Continue to ACT {n}', thanks: 'Thank you for reading this far.',
    participate: 'Participate', picked: 'picked', hint: '<b>Press and hold</b> a line to pick it', hintDesk: '<b>Press and hold</b> a line (hold the mouse) to pick it',
    added: 'Picked', removed: 'Removed', sheetTitle: 'Participate', sheetWhole: 'With no lines picked, this is about the whole story',
    sent: 'Recorded · +10 udb — thank you!', listTitle: 'Participation on this story',
    splashK: 'E-BOOK', splashTitle: 'The Limits of My World',
    splash: ['📖 An easy-on-the-eyes reader', '✎ <b>Press and hold</b> a line to participate on it', '🔖 <b>Resume anytime</b> — we remember where you were'],
    go: 'Enter →', readMark: 'Read →', sentence: 'line', act: 'ACT', badge: '{n} participating', wholeStory: 'the whole story'
  };
  var btn = document.getElementById('ebookBtn');
  var nodes = document.querySelectorAll('main details.node');
  if (!nodes.length) return;

  var overlay = null, bookEl = null, sheet = null, form = null, countEl = null, barBtn = null, listBox = null, listApi = null;
  var picked = [];            // { act, idx, head, el }
  var bmTimer = null;
  var fs = Math.min(24, Math.max(15, +(localStorage.getItem(FS_KEY) || 19)));
  var F = window.FEEDBACK;

  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtPara(html) {
    var m = html.match(/^\s*<b>([\s\S]*?)<\/b>/);
    if (m && /\b(INT|EXT|INSERT)\b/i.test(m[1])) return html.replace(/^(\s*)<b>/, '$1<b class="eb-slug">');
    return html;
  }
  // 줄 = 문장 단위. 태그는 줄을 넘지 않는다(대본 HTML 규칙).
  function sentencize(html, act, counter) {
    return html.split('\n').map(function (line) {
      if (!line.trim()) return line;
      var i = counter.n++;
      return '<span class="sent" data-act="' + act + '" data-i="' + i + '">' + line + '</span>';
    }).join('\n');
  }
  function fig(im) {
    var f = document.createElement('figure'); f.className = 'eb-fig';
    var img = document.createElement('img'); img.src = im.src; img.alt = im.alt; img.loading = 'lazy'; img.draggable = false; f.appendChild(img);
    if (im.cap) { var c = document.createElement('figcaption'); c.textContent = im.cap; f.appendChild(c); }
    return f;
  }

  // ── 스토리 노드 → 이북 챕터 ──
  function buildBook() {
    var book = document.createElement('div'); book.className = 'eb-book'; book.style.fontSize = fs + 'px';
    var total = nodes.length;
    Array.prototype.forEach.call(nodes, function (node, i) {
      var titleEl = node.querySelector('.node-title');
      var title = titleEl && titleEl.childNodes[0] ? titleEl.childNodes[0].textContent.trim() : '';
      var smallEl = titleEl ? titleEl.querySelector('small') : null;
      var sub = smallEl ? smallEl.textContent.trim() : '';
      var actN = 'ACT ' + (i + 1);
      var counter = { n: 0 };
      var imgs = Array.prototype.map.call(node.querySelectorAll('.node-imgs figure'), function (fg) {
        var im = fg.querySelector('img'), cp = fg.querySelector('figcaption');
        return { src: im.getAttribute('src'), alt: im.getAttribute('alt') || '', cap: cp ? cp.textContent.trim() : '' };
      });
      var script = node.querySelector('.script');
      var ch = document.createElement('section'); ch.className = 'eb-ch'; ch.dataset.act = actN; ch.id = 'eb-act-' + (i + 1);
      var h = document.createElement('h2'); h.className = 'eb-ch-h';
      h.innerHTML = '<span class="eb-ch-n">' + actN + '</span><span class="eb-ch-t">' + esc(title) + '</span>' + (sub ? '<span class="eb-ch-sub">' + esc(sub) + '</span>' : '');
      ch.appendChild(h);
      var ops = [];
      if (script) Array.prototype.forEach.call(script.children, function (el) {
        if (el.tagName === 'H5') ops.push({ t: 'scene', text: el.textContent.trim() });
        else if (el.tagName === 'P') ops.push({ t: 'p', html: el.innerHTML });
        else if (el.tagName === 'FIGURE') {
          var fim = el.querySelector('img'), fcp = el.querySelector('figcaption');
          if (fim) ops.push({ t: 'fig', im: { src: fim.getAttribute('src'), alt: fim.getAttribute('alt') || '', cap: fcp ? fcp.textContent.trim() : '' } });
        }
      });
      function renderOp(op) {
        if (op.t === 'scene') { var s = document.createElement('h3'); s.className = 'eb-scene'; s.textContent = op.text; ch.appendChild(s); }
        else if (op.t === 'fig') { ch.appendChild(fig(op.im)); }
        else { var p = document.createElement('p'); p.className = 'eb-p'; p.innerHTML = sentencize(fmtPara(op.html), actN, counter); ch.appendChild(p); }
      }
      if (ops.some(function (o) { return o.t === 'fig'; })) ops.forEach(renderOp);
      else {
        var placed = {};
        if (ops.length && imgs.length) imgs.forEach(function (im, k) {
          var idx = Math.min(ops.length - 1, Math.round(k * ops.length / imgs.length));
          while (placed[idx] && idx < ops.length - 1) idx++;
          placed[idx] = im;
        });
        if (!ops.length) imgs.forEach(function (im) { ch.appendChild(fig(im)); });
        ops.forEach(function (op, idx) { if (placed[idx]) ch.appendChild(fig(placed[idx])); renderOp(op); });
      }
      book.appendChild(ch);
      if (i < total - 1) {
        var nx = document.createElement('div'); nx.className = 'eb-next';
        var nb = document.createElement('button'); nb.type = 'button'; nb.className = 'eb-next-btn';
        nb.textContent = T.next.replace('{n}', i + 2);
        nb.addEventListener('click', function () { var t = nx.nextElementSibling; if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        nx.appendChild(nb); book.appendChild(nx);
      }
    });
    var end = document.createElement('div'); end.className = 'eb-end';
    end.innerHTML = '<p>' + esc(T.thanks) + '</p><button type="button" id="ebEndFb" class="eb-allfb">✎ ' + esc(T.participate) + '</button>' +
      '<h3 class="eb-list-h">' + esc(T.listTitle) + '</h3><div class="fl eb-list" id="ebList"></div>';
    book.appendChild(end);
    return book;
  }

  // ── 리더 뼈대 ──
  function build() {
    overlay = document.createElement('div'); overlay.className = 'eb-overlay'; overlay.hidden = true;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    overlay.innerHTML =
      '<div class="eb-top">' +
        '<button type="button" class="eb-x" id="ebX">' + esc(T.exit) + '</button>' +
        '<span class="eb-resume" id="ebResume" hidden></span>' +
        '<span class="eb-fs"><button type="button" id="ebFsm">' + (KO ? '가−' : 'A−') + '</button><button type="button" id="ebFsp">' + (KO ? '가+' : 'A+') + '</button></span>' +
      '</div>' +
      '<div class="eb-scroll" id="ebScroll"></div>' +
      '<div class="eb-bar">' +
        '<span class="eb-bar-hint" id="ebHint">' + (coarse ? T.hint : T.hintDesk) + '</span>' +
        '<button type="button" class="eb-bar-go" id="ebBarGo">✎ ' + esc(T.participate) + ' <span class="eb-count" id="ebCount" hidden>0</span></button>' +
      '</div>' +
      '<div class="eb-sheet" id="ebSheet" hidden>' +
        '<div class="eb-sheet-head"><span>' + esc(T.sheetTitle) + ' · <span class="eb-sheet-n" id="ebSheetN"></span></span><button type="button" id="ebSheetX" aria-label="close">×</button></div>' +
        '<p class="eb-sheet-note">' + esc(T.sheetWhole) + '</p>' +
        '<div class="eb-sheet-body" id="ebSheetBody"></div>' +
      '</div>' +
      '<div class="eb-splash" id="ebSplash"><div class="eb-splash-in">' +
        '<p class="eb-splash-k">' + esc(T.splashK) + '</p><h2>' + esc(T.splashTitle) + '</h2>' +
        '<ul class="eb-splash-list">' + T.splash.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>' +
        '<button type="button" class="eb-splash-go" id="ebSplashGo">' + esc(T.go) + '</button>' +
      '</div></div>';
    document.body.appendChild(overlay);

    bookEl = overlay.querySelector('#ebScroll');
    sheet = overlay.querySelector('#ebSheet');
    countEl = overlay.querySelector('#ebCount');
    barBtn = overlay.querySelector('#ebBarGo');

    overlay.querySelector('#ebX').addEventListener('click', close);
    overlay.querySelector('#ebFsm').addEventListener('click', function () { setFs(fs - 1); });
    overlay.querySelector('#ebFsp').addEventListener('click', function () { setFs(fs + 1); });
    barBtn.addEventListener('click', function () { toggleSheet(); });
    overlay.querySelector('#ebSheetX').addEventListener('click', function () { toggleSheet(false); });
    bookEl.addEventListener('scroll', function () { clearTimeout(bmTimer); bmTimer = setTimeout(saveBm, 400); });
    bookEl.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('.eb-book')) e.preventDefault(); });
    bindLongPress(bookEl);

    if (F) {
      form = F.buildForm({
        channel: 'story', compact: true,
        renderChips: renderChips,
        getTarget: function () {
          var ps = picked.map(function (p) { return { act: p.act, idx: p.idx, head: p.head }; });
          var acts = []; picked.forEach(function (p) { if (acts.indexOf(p.act) === -1) acts.push(p.act); });
          return { target_type: ps.length ? 'story_node' : 'work', target_ref: acts.length ? acts.join(', ') : null, passages: ps };
        },
        onSent: function () { clearPicked(); toggleSheet(false); toast(T.sent); if (listApi) listApi.reload(); if (window.EBOOK && EBOOK.onSent) EBOOK.onSent(); }
      });
      overlay.querySelector('#ebSheetBody').appendChild(form.el);
    }
  }
  function setFs(v) { fs = Math.min(24, Math.max(15, v)); localStorage.setItem(FS_KEY, fs); var b = bookEl.querySelector('.eb-book'); if (b) b.style.fontSize = fs + 'px'; }

  // ── 문장 길게 누르기 → 담기 ──
  function bindLongPress(root) {
    var timer = null, sx = 0, sy = 0, target = null;
    function cancel() { clearTimeout(timer); timer = null; if (target) target.classList.remove('pressing'); target = null; }
    root.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      var s = e.target.closest ? e.target.closest('.sent') : null;
      if (!s) return;
      cancel(); target = s; sx = e.clientX; sy = e.clientY;
      s.classList.add('pressing');
      timer = setTimeout(function () { var t = target; cancel(); if (t) togglePick(t); }, 420);
    });
    root.addEventListener('pointermove', function (e) { if (timer && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) cancel(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { root.addEventListener(ev, cancel); });
    root.addEventListener('scroll', cancel, { passive: true });
  }
  function headOf(el) { return (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 14); }
  function findPick(el) { for (var i = 0; i < picked.length; i++) if (picked[i].el === el) return i; return -1; }
  function togglePick(el) {
    var i = findPick(el);
    if (i >= 0) { picked.splice(i, 1); el.classList.remove('picked'); toast(T.removed + ' · ' + picked.length); }
    else {
      picked.push({ act: el.dataset.act, idx: +el.dataset.i, head: headOf(el), el: el });
      picked.sort(function (a, b) { return a.act === b.act ? a.idx - b.idx : a.act.localeCompare(b.act); });
      el.classList.add('picked'); toast(T.added + ' · ' + picked.length);
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    }
    updateCount();
  }
  function clearPicked() { picked.forEach(function (p) { p.el.classList.remove('picked'); }); picked = []; updateCount(); }
  function updateCount() {
    var n = picked.length;
    if (countEl) { countEl.textContent = n; countEl.hidden = !n; }
    var sn = overlay.querySelector('#ebSheetN'); if (sn) sn.textContent = T.picked + ' ' + n;
    if (form) form.refreshChips();
  }
  function renderChips(c) {
    if (!picked.length) { c.appendChild(chipEl(T.wholeStory, 'tg dim')); return; }
    picked.forEach(function (p) {
      var ch = chipEl(p.act + ' · ' + T.sentence + ' ' + (p.idx + 1) + ' 「' + p.head + '…」', 'tg');
      ch.title = p.head; ch.classList.add('go');
      ch.addEventListener('click', function () { jumpTo(p.act, p.idx); });
      var x = document.createElement('button'); x.type = 'button'; x.className = 'pf-chip-x'; x.textContent = '×';
      x.addEventListener('click', function (e) { e.stopPropagation(); togglePick(p.el); });
      ch.appendChild(x); c.appendChild(ch);
    });
  }
  function chipEl(label, cls) { var s = document.createElement('span'); s.className = 'pf-chip ' + (cls || ''); s.textContent = label; return s; }
  function jumpTo(act, idx) {
    var s = bookEl.querySelector('.sent[data-act="' + act + '"][data-i="' + idx + '"]');
    if (!s) return;
    toggleSheet(false);
    s.scrollIntoView({ behavior: 'smooth', block: 'center' });
    s.classList.add('flash'); setTimeout(function () { s.classList.remove('flash'); }, 1400);
  }
  function toggleSheet(on) {
    if (on == null) on = sheet.hidden;
    sheet.hidden = !on;
    barBtn.classList.toggle('on', on);
    if (on) { updateCount(); setTimeout(function () { if (form) form.focus(); }, 60); }
  }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'eb-toast'; t.textContent = msg;
    overlay.appendChild(t); setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 1800);
  }

  // ── 책갈피 ──
  function saveBm() { if (!bookEl || !bookEl.scrollHeight) return; var r = bookEl.scrollTop / (bookEl.scrollHeight - bookEl.clientHeight); try { localStorage.setItem(BM_KEY, JSON.stringify({ r: r, t: Date.now() })); } catch (e) {} }
  function readBm() { try { return JSON.parse(localStorage.getItem(BM_KEY) || 'null'); } catch (e) { return null; } }
  function showResume() {
    var bm = readBm(); var chip = overlay.querySelector('#ebResume');
    if (bm && bm.r > 0.03) { chip.hidden = false; chip.textContent = T.resume + ' (' + Math.round(bm.r * 100) + '%)'; chip.onclick = function () { bookEl.scrollTo({ top: bm.r * (bookEl.scrollHeight - bookEl.clientHeight), behavior: 'smooth' }); }; }
    else chip.hidden = true;
  }

  // ── 열기 · 닫기 ──
  function open(opts) {
    opts = opts || {};
    if (!overlay) build();
    overlay.classList.toggle('eb-dark', opts.theme === 'dark');
    clearPicked();
    bookEl.innerHTML = ''; bookEl.appendChild(buildBook());
    bookEl.querySelector('#ebEndFb').addEventListener('click', function () { toggleSheet(true); });
    listBox = bookEl.querySelector('#ebList');
    if (F && listBox) listApi = F.renderList(listBox, { channel: 'story', chips: storyChips });
    document.body.classList.add('eb-lock'); overlay.hidden = false; sheet.hidden = true; barBtn.classList.remove('on');
    bookEl.scrollTop = 0;
    var splash = overlay.querySelector('#ebSplash');
    if (opts.startAct != null) {
      splash.style.display = 'none';
      overlay.querySelector('#ebResume').hidden = true;
      var chs = bookEl.querySelectorAll('.eb-ch');
      var t = chs[Math.max(0, Math.min(chs.length - 1, opts.startAct))];
      if (t) setTimeout(function () { t.scrollIntoView({ block: 'start' }); if (opts.jump) jumpTo(opts.jump.act, opts.jump.idx); }, 20);
      try { history.replaceState(null, '', location.pathname + location.search + '#act' + (opts.startAct + 1)); } catch (e) {}
    } else {
      splash.style.display = 'flex'; splash.style.opacity = '';
      var go = overlay.querySelector('#ebSplashGo'), done = false;
      var enter = function () { if (done) return; done = true; splash.style.opacity = '0'; setTimeout(function () { splash.style.display = 'none'; }, 350); showResume(); };
      go.onclick = enter; setTimeout(enter, 2500);
      try { history.replaceState(null, '', location.pathname + location.search + '#read'); } catch (e) {}
    }
    if (opts.participate) setTimeout(function () { toggleSheet(true); }, 300);
  }
  function close() {
    saveBm(); overlay.hidden = true; document.body.classList.remove('eb-lock'); sheet.hidden = true;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  function storyChips(r) {
    var out = F.defaultChips(r);
    out.forEach(function (c) { if (c.passage) c.onClick = function () { if (overlay && !overlay.hidden) jumpTo(c.passage.act, c.passage.idx); else openAtAct(c.passage.act, c.passage); }; });
    return out;
  }
  function openAtAct(act, jump) { var m = /(\d+)/.exec(act || ''); var i = m ? (+m[1] - 1) : 0; open({ startAct: i, theme: 'dark', jump: jump }); }

  if (btn) btn.addEventListener('click', function () { open({ theme: 'cream' }); });
  window.EBOOK = {
    open: function (o) { open(o || {}); },
    openAt: function (i, theme, participate) { open({ startAct: i, theme: theme || 'dark', participate: !!participate }); },
    close: close, onSent: null
  };

  // ── 스토리 ACT 아코디언 = 목차 → 클릭 시 리더로 그 장부터 ──
  Array.prototype.forEach.call(nodes, function (node, i) {
    node.classList.add('act-toc');
    var mk = node.querySelector('.node-marker'); if (mk) mk.textContent = T.readMark;
    var sum = node.querySelector('summary');
    if (sum) sum.addEventListener('click', function (e) { e.preventDefault(); open({ startAct: i, theme: 'dark' }); });
  });

  // ── 참여 배지 (목차) + 페이지 하단 참여 목록 ──
  var pageList = document.getElementById('storyList');
  function paintBadges(rows) {
    var counts = F.storyCounts(rows);
    document.querySelectorAll('.node-count').forEach(function (x) { x.remove(); });
    Array.prototype.forEach.call(nodes, function (node, i) {
      var n = counts['ACT ' + (i + 1)]; if (!n) return;
      var b = document.createElement('span'); b.className = 'node-count'; b.textContent = T.badge.replace('{n}', n);
      var t = node.querySelector('.node-title'); if (t) t.appendChild(b);
    });
  }
  if (F && pageList) F.renderList(pageList, { channel: 'story', chips: storyChips, onRows: paintBadges });
  else if (F) F.whenReady(async function () { var rows = await F.fetchRows('story'); if (rows) paintBadges(rows); });

  // ── 로그인 왕복(#actN / #read) 뒤 리더 복귀 ──
  var hm = /^#act(\d+)$/.exec(location.hash);
  if (hm) open({ startAct: Math.max(0, +hm[1] - 1), theme: 'dark' });
  else if (location.hash === '#read') open({ theme: 'cream' });
  else if (location.hash === '#participate') open({ startAct: 0, theme: 'dark', participate: true });
})();
