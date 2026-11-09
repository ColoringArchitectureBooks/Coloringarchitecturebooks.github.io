// Fire engine sounds, made in the browser (no files).
// An air horn as it starts, an electronic siren that winds up, wails and switches to a fast yelp,
// and the diesel engine. The siren goes through a horn-speaker filter, its pitch bends as the
// truck comes toward you or drives away (Doppler), and it pans left and right with the truck.
// Starts only from a tap (browsers allow sound after the reader touches the page).
let ctx = null, out = null, pan = null, sir = [], sirG = null, eng = null, engF = null, nodes = [], t0 = 0, lastD = null, dop = 1;

// pitch of the siren (Hz) at time s after the call: wind up, then 8 s wail, 4 s yelp, again
function sirenHz(s) {
  if (s < 1.6) return 250 + 450 * (s / 1.6) ** 2;          // winds up under the horn
  const c = (s - 1.6) % 12;
  if (c < 8) return 1075 - 425 * Math.cos(Math.PI * 2 * c / 4);   // wail: low to high and back every 4 s
  const y = ((c - 8) / 0.32) % 1;                            // yelp: a quick rise about 3 times a second
  return 650 + 850 * Math.sqrt(y);
}

function hornBlast(t, len) {   // three brassy air-horn tones, a little out of tune like real horns
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.04); g.gain.setValueAtTime(0.32, t + len - 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800; lp.Q.value = 1.5;
  lp.connect(g).connect(pan);
  for (const f of [185, 233, 311]) {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
    o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);   // a horn bends up as the air hits it
    o.connect(lp); o.start(t); o.stop(t + len + 0.05); nodes.push(o);
  }
}

// iPhone: let the sound play even with the ring/silent switch on. Safari 17+ has audioSession;
// older iPhones do the same once any <audio> element is playing, so a short silent clip loops quietly.
function playThroughSilentSwitch() {
  try { if (navigator.audioSession) { navigator.audioSession.type = "playback"; return; } } catch (e) {}
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent) || playThroughSilentSwitch.el) return;
  const a = new Audio("data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=="); a.loop = true; a.setAttribute("playsinline", "");
  playThroughSilentSwitch.el = a; a.play().catch(() => { playThroughSilentSwitch.el = null; });
}

export function sirenStart() {
  playThroughSilentSwitch();
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  ctx.resume();
  const t = ctx.currentTime; t0 = t; lastD = null; dop = 1;
  out = ctx.createGain(); out.gain.value = 0.0001; out.connect(ctx.destination); out.gain.exponentialRampToValueAtTime(0.5, t + 0.3);
  pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); pan.connect(out);
  // siren: a square and a saw a little apart, a soft clip, then the horn speaker's band (no deep bass, a bright peak)
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 420;
  const pk = ctx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 1900; pk.Q.value = 1.2; pk.gain.value = 6;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3800;
  const clip = ctx.createWaveShaper(); const k = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; k[i] = Math.tanh(2.2 * x); } clip.curve = k;
  sirG = ctx.createGain(); sirG.gain.setValueAtTime(0.0001, t); sirG.gain.exponentialRampToValueAtTime(0.16, t + 1.2);
  sir = [["square", 1], ["sawtooth", 1.004]].map(([type, m]) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = 250 * m; o.connect(clip); o.start(t); o._m = m; return o;
  });
  clip.connect(hp).connect(pk).connect(lp).connect(sirG).connect(pan);
  // air horn: two blasts as the doors clear
  hornBlast(t, 0.7); hornBlast(t + 0.9, 0.9);
  // diesel engine: a low rumble whose pitch follows the speed, with a slow throb
  eng = ctx.createOscillator(); eng.type = "sawtooth"; eng.frequency.value = 38;
  engF = ctx.createBiquadFilter(); engF.type = "lowpass"; engF.frequency.value = 260;
  const eg = ctx.createGain(); eg.gain.value = 0.3; eng.connect(engF).connect(eg).connect(pan);
  const throb = ctx.createOscillator(); throb.frequency.value = 7; const tg = ctx.createGain(); tg.gain.value = 0.08;
  throb.connect(tg).connect(eg.gain); eng.start(t); throb.start(t);
  nodes.push(...sir, eng, throb);
}

// each frame: distance from the camera to the truck (m), its speed (m/s), and left/right (-1..1) as you see it
export function sirenUpdate(dist, speed, side = 0) {
  if (!ctx || !out) return;
  const t = ctx.currentTime, g = Math.min(0.6, 25 / Math.max(25, dist));
  out.gain.setTargetAtTime(g, t, 0.1);
  if (pan.pan) pan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, side)), t, 0.08);
  // Doppler: higher while the truck comes closer, lower once it is going away
  if (lastD !== null) { const vr = (dist - lastD.d) / Math.max(0.005, t - lastD.t); dop += (343 / (343 + Math.max(-40, Math.min(40, vr))) - dop) * 0.15; }
  lastD = { d: dist, t };
  const f = sirenHz(t - t0) * dop;
  for (const o of sir) o.frequency.setTargetAtTime(f * o._m, t, 0.012);
  if (eng) { eng.frequency.setTargetAtTime(38 + speed * 4, t, 0.2); engF.frequency.setTargetAtTime(260 + speed * 25, t, 0.2); }
}

export function sirenStop() {
  if (!ctx || !out) return;
  const t = ctx.currentTime, o = out; o.gain.setTargetAtTime(0.0001, t, 0.05);   // cut off with the truck
  for (const n of nodes) { try { n.stop(t + 0.4); } catch (e) {} }
  out = null; eng = null; sir = []; nodes = [];
}
