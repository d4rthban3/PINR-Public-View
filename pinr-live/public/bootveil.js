//
// It plays for at least 2.1 s (3.6 s on a desktop) once started, and never holds a slow load: hidden once the app is up (and the sequence has played), or at 3.5 s (5 s on a desktop) at most. A coin opened
// directly gets no veil.
(function () {
  var c = document.getElementById("bootCover"), done = false, t0 = Date.now();
  //
  var wide = innerWidth >= 760, minMs = wide ? 3600 : 2100, capMs = wide ? 5000 : 3500;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  //
  // (the art's own 35.2 s loop: 0.96 to 1.045 with ease-in-out, started when the SVG loaded) and its brightness at that moment. Nothing jumps and nothing doubles when the veil lifts.
  var SETTLE_MS = 450;
  function bez(p) { // CSS ease-in-out, cubic-bezier(.42, 0, .58, 1): progress for time p (0..1)
    var lo = 0, hi = 1, x = p, i;
    function X(t) { return 3 * (1 - t) * (1 - t) * t * 0.42 + 3 * (1 - t) * t * t * 0.58 + t * t * t; }
    for (i = 0; i < 24; i++) { x = (lo + hi) / 2; if (X(x) < p) lo = x; else hi = x; }
    return 3 * (1 - x) * (1 - x) * x * 0 + 3 * (1 - x) * x * x * 1 + x * x * x;
  }
  window.__bootBreathe = function (tSec) { // { scale, opacity } of the background logo tSec seconds into its loop
    var T = 35.2, ph = ((tSec % T) + T) % T / T, h = ph < 0.5 ? ph * 2 : (1 - ph) * 2, e = bez(h);
    return { scale: 0.96 + (1.045 - 0.96) * e, opacity: 0.56 + (1 - 0.56) * e };
  };
  function settle() {
    var anchor = c.querySelector(".boot-anchor"), mark = c.querySelector(".boot-mark");
    if (!anchor || !mark) return;
    var svg = document.getElementById("bgsvg"), vid = document.getElementById("bgvid");
    var useSvg = !!svg && getComputedStyle(svg).display !== "none";
    var el = useSvg ? svg : vid, place = (el && el.style.transform) || "";
    var t = 0;
    if (useSvg) {
      var s0 = window.__bgLogoStart;
      if (typeof s0 === "number") t = Math.max(0, (performance.now() - s0) / 1000);
      else { var r = performance.getEntriesByType("resource").filter(function (e) { return e.name.indexOf("bgl-") >= 0; })[0]; t = Math.max(0, (performance.now() - (r ? r.responseEnd : 0)) / 1000); }
    }
    var b = window.__bootBreathe(t);
    var tr = "transform " + SETTLE_MS + "ms ease-in-out, opacity " + SETTLE_MS + "ms ease-in-out";
    if (!still) { mark.style.transition = tr; anchor.style.transition = "transform " + SETTLE_MS + "ms ease-in-out"; }
    anchor.style.transform = place;
    // From here the anchor follows the background's own placement every frame (it keeps easing with the camera), one write only when it changed.
    var last = place, t0s = Date.now();
    (function follow() {
      if (!c.isConnected) return;
      var p = el.style.transform || "";
      if (p !== last) { last = p; anchor.style.transform = p; }
      if (Date.now() - t0s > SETTLE_MS) anchor.style.transition = "none";
      requestAnimationFrame(follow);
    })();
    mark.style.transform = "scale(" + b.scale.toFixed(4) + ")";
    mark.style.opacity = b.opacity.toFixed(3);
    window.__bootSettled = { place: place, scale: b.scale, opacity: b.opacity, t: t };
  }
  function hide() {
    if (done) return; done = true;
    settle();
    setTimeout(function () {
      c.classList.add("boot-hide");
      setTimeout(function () { c.remove(); }, 2800);
    }, still ? 0 : SETTLE_MS);
  }
  if (/[?&]coin=/.test(location.search)) { c.remove(); done = true; return; }
  window.__bootHide = function () { setTimeout(hide, still ? 300 : Math.max(300 - SETTLE_MS, minMs - SETTLE_MS - (Date.now() - t0))); };
  setTimeout(hide, still ? 2500 : capMs);
})();
