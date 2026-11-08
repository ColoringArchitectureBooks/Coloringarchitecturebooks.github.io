// Fire engine sounds, made in the browser (no files): an air horn as it starts, the wailing siren, and the diesel engine.
// Starts only from a tap (browsers allow sound after the reader touches the page). Louder when the truck is near the camera.
let ctx = null, out = null, eng = null, engF = null, nodes = [];
export function sirenStart() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  ctx.resume();
  const t = ctx.currentTime;
  out = ctx.createGain(); out.gain.value = 0.0001; out.connect(ctx.destination); out.gain.exponentialRampToValueAtTime(0.5, t + 0.3);
  // siren: a bright wail rising and falling between about 650 and 1500 Hz every 4 s
  const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 1075;
  const lfo = ctx.createOscillator(); lfo.type = "triangle"; lfo.frequency.value = 0.25;
  const depth = ctx.createGain(); depth.gain.value = 425; lfo.connect(depth).connect(osc.frequency);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
  const sg = ctx.createGain(); sg.gain.value = 0.22; osc.connect(lp).connect(sg).connect(out);
  // air horn: two low brassy tones for the first second
  const hg = ctx.createGain(); hg.gain.setValueAtTime(0.0001, t); hg.gain.exponentialRampToValueAtTime(0.35, t + 0.05); hg.gain.setValueAtTime(0.35, t + 0.9); hg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  const hlp = ctx.createBiquadFilter(); hlp.type = "lowpass"; hlp.frequency.value = 1400; hlp.connect(hg).connect(out);
  const horns = [233, 277].map(f => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.connect(hlp); o.start(t); o.stop(t + 1.3); return o; });
  // diesel engine: a low rumble whose pitch follows the speed
  eng = ctx.createOscillator(); eng.type = "sawtooth"; eng.frequency.value = 38;
  engF = ctx.createBiquadFilter(); engF.type = "lowpass"; engF.frequency.value = 260;
  const eg = ctx.createGain(); eg.gain.value = 0.3; eng.connect(engF).connect(eg).connect(out);
  for (const o of [osc, lfo, eng]) o.start(t);
  nodes = [osc, lfo, eng, ...horns];
}
// each frame: distance from the camera to the truck (m) and its speed (m/s)
export function sirenUpdate(dist, speed) {
  if (!ctx || !out) return;
  const t = ctx.currentTime, g = Math.min(0.6, 25 / Math.max(25, dist));
  out.gain.setTargetAtTime(g, t, 0.1);
  if (eng) { eng.frequency.setTargetAtTime(38 + speed * 4, t, 0.2); engF.frequency.setTargetAtTime(260 + speed * 25, t, 0.2); }
}
export function sirenStop() {
  if (!ctx || !out) return;
  const t = ctx.currentTime, o = out; o.gain.setTargetAtTime(0.0001, t, 0.3);
  for (const n of nodes) { try { n.stop(t + 1.5); } catch (e) {} }
  out = null; eng = null; nodes = [];
}
