// Train sounds made in code with Web Audio (no recordings, so nothing to license):
// a soft "chuff" each time a smoke puff leaves the stack, and a steam whistle on demand.
// Browsers only let a page make sound after the reader touches it, so sound is ON by default
// and starts at the first touch, click or key press; the Sound button turns it off and on.

let ctx = null, out = null, noise = null, on = true, lastBeat = -1;

function setup() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  out = ctx.createGain(); out.gain.value = on ? 1 : 0; out.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);           // 2 s of white noise, reused for steam
  const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function unlock() { setup(); if (ctx && ctx.state !== "running") ctx.resume(); }
for (const ev of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(ev, unlock, { capture: true, passive: true });
setup();                                                                      // some browsers allow sound right away; the rest wait for the first touch

function steam(t, dur, f, q, peak, attack, decay) {                           // a burst of filtered noise
  const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.9 + Math.random() * 0.2;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  s.connect(bp).connect(g).connect(out); s.start(t, Math.random() * 1.5, dur + 0.05);
}

function chuff() {
  const t = ctx.currentTime;
  steam(t, 0.35, 520 + Math.random() * 120, 0.9, 0.22, 0.015, 0.3);          // the low "chuff" of the exhaust
  steam(t, 0.2, 2400, 1.2, 0.05, 0.01, 0.16);                                  // a little hiss on top
}

export function whistle() {
  unlock(); if (!ctx || !on) return;
  const t = ctx.currentTime + 0.02, hold = 1.3, end = t + 0.12 + hold + 0.45;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.12); g.gain.setValueAtTime(0.16, t + 0.12 + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
  g.connect(lp).connect(out);
  for (const [f, type, v] of [[370, "triangle", 1], [440, "sine", 0.8], [554, "sine", 0.6], [740, "sine", 0.15]]) {   // three-chime steam whistle chord
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.18);                 // steam pushes the pitch up as it opens
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.5; vg.gain.value = f * 0.004;  // slight waver
    vib.connect(vg).connect(o.frequency);
    const og = ctx.createGain(); og.gain.value = v; o.connect(og).connect(g);
    o.start(t); vib.start(t); o.stop(end + 0.05); vib.stop(end + 0.05);
  }
  steam(t, hold + 0.6, 1800, 0.7, 0.05, 0.12, hold + 0.4);                      // breathy steam under the tone
}

export function setSound(v) {
  on = v; unlock();
  if (out) out.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
}

// called every frame with the clock the smoke uses; one chuff per puff
export function tickSound(t, beat) {
  const k = Math.floor(t / beat); if (k === lastBeat) return; lastBeat = k;
  if (on && ctx && ctx.state === "running") chuff();
}
