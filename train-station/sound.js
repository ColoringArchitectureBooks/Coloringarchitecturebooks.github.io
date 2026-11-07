// Train sounds made in code with Web Audio (no recordings, so nothing to license):
// soft steam puffs in time with the smoke over a quiet steady hiss, and a two-blast steam whistle.
// Sound starts OFF (browsers block sound until the reader taps anyway); the Sound button,
// or a tap on the train, turns it on.

let ctx = null, master = null, noise = null, bed = null, on = false, lastBeat = -1;

function setup() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);           // 3 s of steam noise: white plus a little brown, reused everywhere
  const d = noise.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 3; }
  return true;
}

function env(g, t, peak, a, hold, r) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
}
function burst(t, { type = "lowpass", f = 800, q = 0.7, peak = 0.3, a = 0.02, hold = 0, r = 0.3 }) {   // a puff of filtered noise
  const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); env(g, t, peak, a, hold, r);
  s.connect(fl).connect(g).connect(master); s.start(t, Math.random() * 2, a + hold + r + 0.05);
}

function startBed() {                                                         // the quiet steady hiss between puffs
  if (bed) return;
  const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 650;
  const g = ctx.createGain(); g.gain.value = 0.045;
  s.connect(lp).connect(g).connect(master); s.start(); bed = s;
}

function chuff() { burst(ctx.currentTime, { f: 700, q: 0.5, peak: 0.24, a: 0.07, r: 0.6 }); }

function pipe(t, freqs, { peak = 0.22, a = 0.18, hold = 1.2, r = 0.5, bend = 0.96, air = 0.35, tone = 0.5, q = 40 }) {   // one blast of a chime whistle
  const g = ctx.createGain(); env(g, t, peak, a, hold, r);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200; g.connect(lp).connect(master);
  const end = t + a + hold + r + 0.1;
  for (const [f, v] of freqs) {
    const o = ctx.createOscillator(); o.type = "sine";                                       // the pure part of the pipe's note
    o.frequency.setValueAtTime(f * bend, t); o.frequency.exponentialRampToValueAtTime(f, t + a + 0.08);
    o.frequency.setValueAtTime(f, t + a + hold); o.frequency.exponentialRampToValueAtTime(f * 0.97, t + a + hold + r);
    const og = ctx.createGain(); og.gain.value = v * tone; o.connect(og).connect(g); o.start(t); o.stop(end);
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;                      // steam blowing through the pipe: noise ringing at the note
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
    const sg = ctx.createGain(); sg.gain.value = v * 6 * air; s.connect(bp).connect(sg).connect(g); s.start(t, Math.random(), end - t);
  }
  burst(t, { type: "highpass", f: 2500, q: 0.5, peak: peak * 0.12, a, hold, r });             // hiss around it
}

export function whistle() {                                                   // short blast, then a longer one
  if (!on || !ctx) return;
  const t = ctx.currentTime + 0.03, ch = [[311, 1], [370, 0.85], [466, 0.6]];
  pipe(t, ch, { a: 0.12, hold: 0.23, r: 0.17 });
  pipe(t + 0.57, ch, { a: 0.12, hold: 1.25, r: 0.4 });
}

export function isSoundOn() { return on; }
export function setSound(v) {                                                 // call from a tap or click, so the browser lets the sound start
  on = v; if (!setup()) return;
  if (ctx.state !== "running") ctx.resume();
  if (on) startBed();
  master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.08);
}

// called every frame with the clock the smoke uses; one puff each time smoke leaves the stack
export function tickSound(t, beat) {
  const k = Math.floor(t / beat); if (k === lastBeat) return; lastBeat = k;
  if (on && ctx && ctx.state === "running") chuff();
}
