// 허브 홈 — 부문 스와이프(cin_mAIte ⇄ vers_O) + 더 알아보기 펼침
(function () {
  var track = document.getElementById('divTrack');
  var works = document.getElementById('hubWorks');
  var dots = Array.prototype.slice.call(document.querySelectorAll('.hub-dot'));
  var N = dots.length || 2, idx = 0;

  function go(i) {
    idx = Math.max(0, Math.min(N - 1, i));
    if (track) track.style.transform = 'translateX(' + (-idx * 100) + '%)';
    dots.forEach(function (d, j) { d.classList.toggle('on', j === idx); });
    if (works) works.hidden = (idx !== 0); // cin_mAIte(0)일 때만 포스터 노출
  }
  dots.forEach(function (d, j) { d.addEventListener('click', function () { go(j); }); });

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

  var more = document.getElementById('cinMore'), howto = document.getElementById('cinHowto');
  if (more && howto) {
    var moreLabel = more.textContent;
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
