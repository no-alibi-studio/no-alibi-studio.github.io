/* 저장 방지(마찰용): 이미지·영상·음악을 우클릭/길게 눌러 저장하거나 드래그해 빼가지 못하게 한다.
   완전한 차단은 아니다(스크린샷·소스 보기는 못 막음). .allow-save 가 붙은 요소(포스터)는 제외. */
(function () {
  function guarded(t) {
    if (!t || !t.closest) return false;
    if (t.closest('.allow-save')) return false;
    return !!t.closest('img, picture, video, audio');
  }
  document.addEventListener('contextmenu', function (e) { if (guarded(e.target)) e.preventDefault(); }, true);
  document.addEventListener('dragstart',   function (e) { if (guarded(e.target)) e.preventDefault(); }, true);
  function harden(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('img').forEach(function (el) { if (!el.closest('.allow-save')) el.setAttribute('draggable', 'false'); });
    root.querySelectorAll('video, audio').forEach(function (el) {
      el.setAttribute('controlsList', 'nodownload');
      if (el.tagName === 'VIDEO') el.setAttribute('disablePictureInPicture', '');
    });
  }
  harden(document);
  new MutationObserver(function (muts) {
    muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) harden(n); }); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
