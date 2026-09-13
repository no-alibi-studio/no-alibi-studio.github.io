// media.js — 영상 · 이미지 한 페이지의 참여: 영상은 시간 칩, 이미지는 누르면 그 자리에 참여 창, 아래에 참여 목록
(function () {
  'use strict';
  var F = window.FEEDBACK; if (!F) return;
  var T = F.T, el = F.el, esc = F.esc;
  var video = document.getElementById('mainVideo');
  var vRef = video ? (video.dataset.ref || 'trailer') : 'trailer';
  var grid = document.getElementById('imgGrid');
  var cells = grid ? Array.prototype.slice.call(grid.querySelectorAll('.img-cell')) : [];
  var byRef = {}; cells.forEach(function (c) { byRef[c.dataset.ref] = c; });
  function shortLabel(cell) { var m = (cell.dataset.label || '').match(/^\d+(\.\d+)?/); return m ? m[0] : (cell.dataset.label || ''); }

  function chip(label, cls, title) { var s = el('span', 'pf-chip ' + (cls || ''), esc(label)); if (title) s.title = title; return s; }
  function xBtn(onClick) { var b = el('button', 'pf-chip-x', '×'); b.type = 'button'; b.addEventListener('click', onClick); return b; }

  // ── 영상 참여 창 ──
  var timeMs = null, vf = null;
  if (video && document.getElementById('videoForm')) {
    vf = F.buildForm({
      channel: 'media', showCategory: true, showLink: true, showAttach: true,
      renderChips: function (c) {
        c.appendChild(chip(T.video, 'tg'));
        if (timeMs != null) {
          var tc = chip(F.fmtTime(timeMs), 'time'); tc.appendChild(xBtn(function () { timeMs = null; vf.refreshChips(); }));
          c.appendChild(tc);
        }
        var b = el('button', 'pf-chip-btn', esc(T.nowTime)); b.type = 'button'; b.title = T.timeHint;
        b.addEventListener('click', function () { try { video.pause(); } catch (e) {} timeMs = Math.round((video.currentTime || 0) * 1000); vf.refreshChips(); vf.focus(); });
        c.appendChild(b);
      },
      getTarget: function () { return { target_type: 'video', target_ref: vRef, target_time_ms: timeMs }; },
      onSent: function () { timeMs = null; vf.refreshChips(); if (list) list.reload(); }
    });
    document.getElementById('videoForm').appendChild(vf.el);
  }

  // ── 이미지: 누르면 그 자리에 참여 창 ──
  var curCell = null, imgForm = null, imgWrap = null, imgHead = null;
  function closeImg() { if (imgWrap && imgWrap.parentNode) imgWrap.parentNode.removeChild(imgWrap); if (curCell) curCell.classList.remove('on'); curCell = null; }
  function openImg(cell) {
    if (curCell === cell) { closeImg(); return; }
    closeImg();
    curCell = cell; cell.classList.add('on');
    if (!imgWrap) {
      imgWrap = el('div', 'media-form img-form');
      imgHead = el('div', 'img-form-head');
      var x = el('button', 'pf-modal-x', '×'); x.type = 'button'; x.setAttribute('aria-label', T.close); x.addEventListener('click', closeImg);
      imgWrap.append(imgHead, x);
      imgForm = F.buildForm({
        channel: 'media', showCategory: true, showLink: true, showAttach: true,
        renderChips: function (c) { if (curCell) c.appendChild(chip(T.image + ' ' + shortLabel(curCell), 'tg', curCell.dataset.label)); },
        getTarget: function () { return { target_type: 'image', target_ref: curCell ? curCell.dataset.ref : null }; },
        onSent: function () { if (list) list.reload(); }
      });
      imgWrap.appendChild(imgForm.el);
    }
    imgHead.innerHTML = '<span class="img-form-k">' + esc(T.image) + '</span> ' + esc(cell.dataset.label || '');
    imgForm.refreshChips();
    cell.parentNode.insertBefore(imgWrap, cell.nextSibling);
    setTimeout(function () { imgWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); imgForm.focus(); }, 30);
  }
  cells.forEach(function (cell) {
    cell.classList.add('clickable');
    cell.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.img-form')) return; openImg(cell); });
    cell.setAttribute('tabindex', '0');
    cell.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openImg(cell); } });
  });

  // ── 참여 목록 (미디어 채널 전체) ──
  var listEl = document.getElementById('mediaList'), list = null;
  if (listEl) list = F.renderList(listEl, {
    channel: 'media',
    chips: function (r) {
      var out = F.defaultChips(r);
      out.forEach(function (c) {
        if (c.time != null && video) c.onClick = function () { try { video.currentTime = c.time / 1000; video.pause(); } catch (e) {} video.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
        if (c.ref && byRef[c.ref]) { c.label = T.image + ' ' + shortLabel(byRef[c.ref]); c.onClick = function () { openImg(byRef[c.ref]); }; }
      });
      return out;
    }
  });

  // #images / #video 해시로 들어오면 그 자리로
  if (location.hash === '#images' && grid) setTimeout(function () { grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
})();
