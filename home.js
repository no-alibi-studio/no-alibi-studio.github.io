// 허브 홈 — 부문 스와이프(POLYPHONY ⇄ vers_O) + 화살표 + 더 알아보기 펼침
(function () {
  var track = document.getElementById('divTrack');
  var works = document.getElementById('hubWorks');
  var dots = Array.prototype.slice.call(document.querySelectorAll('.hub-dot'));
  var prevBtn = document.querySelector('.hub-arrow.prev');
  var nextBtn = document.querySelector('.hub-arrow.next');
  var more = document.getElementById('cinMore');
  var howto = document.getElementById('cinHowto');
  var moreLabel = more ? more.textContent : '';
  var N = dots.length || 2, idx = 0;

  function closeHowto() {
    if (howto && !howto.hidden) {
      howto.hidden = true;
      if (more) { more.setAttribute('aria-expanded', 'false'); more.textContent = moreLabel; }
    }
  }

  function go(i) {
    idx = Math.max(0, Math.min(N - 1, i));
    if (track) track.style.transform = 'translateX(' + (-idx * 100) + '%)';
    dots.forEach(function (d, j) { d.classList.toggle('on', j === idx); });
    if (prevBtn) prevBtn.hidden = (idx === 0);
    if (nextBtn) nextBtn.hidden = (idx === N - 1);
    if (works) works.hidden = (idx !== 0);   // POLYPHONY(0)일 때만 포스터
    if (idx !== 0) closeHowto();               // vers로 가면 참여방법 접기
  }

  dots.forEach(function (d, j) { d.addEventListener('click', function () { go(j); }); });
  if (prevBtn) prevBtn.addEventListener('click', function () { go(idx - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { go(idx + 1); });

  var vp = track ? track.closest('.hub-viewport') : null;
  if (vp) {
    var tx = null;
    vp.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    vp.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 45) go(idx + (dx < 0 ? 1 : -1));
      tx = null;
    });
    var px = null;
    vp.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') return; px = e.clientX; });
    window.addEventListener('pointerup', function (e) {
      if (px === null) return;
      var dx = e.clientX - px;
      if (Math.abs(dx) > 60) go(idx + (dx < 0 ? 1 : -1));
      px = null;
    });
  }

  if (more && howto) {
    more.addEventListener('click', function () {
      var open = howto.hidden;
      howto.hidden = !open;
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
      more.textContent = open ? '접기' : moreLabel;
      if (open) howto.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  go(0);
})();
