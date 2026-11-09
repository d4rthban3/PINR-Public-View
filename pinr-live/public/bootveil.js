//
// It plays for at least 2.1 s (3.6 s on a desktop) once started, and never holds a slow load: hidden once the app is up (and the sequence has played), or at 3.5 s (5 s on a desktop) at most. A coin opened
// directly gets no veil.
(function () {
  var c = document.getElementById("bootCover"), done = false, t0 = Date.now();
  // The page begins to fade in 2.0 s after the sound starts (its tail has thinned to a ring); a slow load is never held past 7.5 s (the sound's 5 s fail-safe plus the veil's 2 s). Same on a phone and a desktop.
  var minMs = 2000, capMs = 7500;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  //
  // background logo, then following the background's drift) is gone.
  var capT = 0, failT = 0;
  function hide() {
    if (done) return; done = true;
    clearTimeout(capT); clearTimeout(failT);
    c.classList.add("boot-hide");
    setTimeout(function () { c.remove(); }, 2800);
  }
  if (/[?&]coin=/.test(location.search)) { c.remove(); done = true; return; }
  //
  // The sound starts the veil (the blades begin sliding when the sound is playing, at once when the browser refuses it, or after at most 1.5 s when it is slow to arrive, so the veil never waits for sound it cannot play). Its own moments:
  //   0.10 s the sound begins: the blades start to slide in;  1.25 s its sharp accent: the blades lock into the mark;  2.00 s its tail has thinned to a ring: the page begins to fade in;  4.00 s the sound ends: the veil is gone.
  // A play the browser blocks is ignored: no button, no error.
  var tGo = 0;
  var ready = false, planned = false;
  // The page fades in 2.0 s after the sound starts: planned once the app is up AND the sound has started, so an app that is ready early still waits for the sound's own 2.0 s moment.
  function plan() {
    if (planned || !ready || !tGo) return;
    planned = true;
    setTimeout(hide, still ? 300 : Math.max(0, minMs - (Date.now() - tGo)));
  }
  function go() { if (tGo) return; clearTimeout(failT); tGo = Date.now(); c.classList.add("boot-go"); plan(); }
  //
  // browser's audio engine, and started the moment it is ready; the veil starts in the same instant. A browser that refuses sound until a tap (the audio engine stays "suspended") runs the veil at once,
  //
  // lets the veil start without it. A play the browser blocks is ignored: no button, no error.
  var FAILSAFE_MS = 5000, pinBuf = null, pinPlayed = false, ctx = null, blocked = false;
  function playPin() { // start the decoded sound now, once
    if (pinPlayed || !pinBuf || !ctx) return false;
    pinPlayed = true;
    try { var src = ctx.createBufferSource(); src.buffer = pinBuf; src.connect(ctx.destination); src.onended = closeAudio; src.start(0); } catch (e) { return false; }
    return true;
  }
  // Item 134 (the page felt laggy): once the sound has played, the audio engine and the decoded sound are let go, so nothing about the veil keeps costing; a context left open keeps rendering silence for ever.
  function closeAudio() {
    var c2 = ctx; ctx = null; pinBuf = null;
    if (!c2) return;
    try { c2.onstatechange = null; var r = c2.close(); if (r && r.catch) r.catch(function () {}); } catch (e) {}
  }
  function armTap() {
    var evs = ["pointerdown", "touchend", "keydown"];
    function fire() {
      for (var i = 0; i < evs.length; i++) removeEventListener(evs[i], fire, true);
      if (pinPlayed) return;
      var go2 = function () { playPin(); };
      try { var r = ctx && ctx.resume(); if (r && r.then) r.then(go2, function () {}); else go2(); } catch (e) {}
    }
    for (var i = 0; i < evs.length; i++) addEventListener(evs[i], fire, { capture: true, passive: true });
  }
  function ready2() { // the sound is decoded and sound may run: play it, and the veil starts with it (if the veil already started without it, the sound simply comes in)
    if (ctx && ctx.state === "running" && playPin()) go();
  }
  function decode(buf, alt) {
    ctx.decodeAudioData(buf, function (b) { pinBuf = b; ready2(); }, function () { if (alt) load(alt, null); else go(); });
  }
  function load(url, alt) {
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (buf) { decode(buf, alt); }).catch(function () { if (alt) load(alt, null); else go(); });
  }
  if (still || /[?&]coin=/.test(location.search)) go();
  else {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      ctx.onstatechange = function () { if (ctx.state === "running") ready2(); }; // sound became allowed (a slow resume, or a tap)
      var canAac = !!document.createElement("audio").canPlayType('audio/mp4; codecs="mp4a.40.2"');
      load(canAac ? "/art/pinr-pin.m4a" : "/art/pinr-pin.wav", canAac ? "/art/pinr-pin.wav" : null);
      // Is sound allowed right now? A context that is not running after a resume attempt is refused until a tap.
      var check = function () {
        if (ctx.state === "running") { if (pinBuf) ready2(); return; }
        blocked = true; armTap(); go();
      };
      try { var rs = ctx.resume(); if (rs && rs.then) rs.then(function () {}, function () {}); } catch (e) {}
      setTimeout(check, 120);
    } catch (e) { go(); }
    failT = setTimeout(go, FAILSAFE_MS);
  }
  window.__bootHide = function () { ready = true; plan(); };
  capT = setTimeout(hide, still ? 2500 : capMs);
})();
