/* Glowdeep — a trench-tank keeper. Plain canvas, no dependencies. */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const cv = $('#c'), ctx = cv.getContext('2d');
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = arr => arr[(Math.random() * arr.length) | 0];

let W = 0, H = 0, U = 1, DPR = 1, bg = null;
let SURF = 20, FLOOR = 0; // water line and sea floor, in px

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */
const LEVELS = [
  { name: 'First Light', blurb: 'Feed your jellies until they bloom, then gather the motes they shed.',
    shop: ['jelly', 'jar'],
    goals: [{ t: 'own', kind: 'jelly', stage: 1, n: 5, label: 'Bloomed jellies' }, { t: 'earn', n: 600, label: 'Sparks gathered' }] },
  { name: 'Uninvited Guests', blurb: 'Murk eels hunt by your light. Tap them until they flee.',
    shop: ['jelly', 'jar', 'rich', 'sonar', 'beacon'],
    goals: [{ t: 'own', kind: 'jelly', stage: 2, n: 3, label: 'Radiant jellies' }, { t: 'defeat', n: 2, label: 'Raiders driven off' }, { t: 'beacon', cost: 1500, label: 'Light the beacon' }],
    raids: { first: 55, gap: [50, 65], waves: [['eel']] } },
  { name: 'Lantern School', blurb: 'Lampfins swallow three motes and breathe out a pearl worth far more.',
    shop: ['jelly', 'jar', 'rich', 'sonar', 'lampfin'],
    goals: [{ t: 'pearls', n: 6, label: 'Pearls collected' }, { t: 'earn', n: 4000, label: 'Sparks gathered' }, { t: 'defeat', n: 3, label: 'Raiders driven off' }],
    raids: { first: 60, gap: [50, 70], waves: [['eel'], ['eel'], ['eel', 'eel']] } },
  { name: 'Ink Tide', blurb: 'Ink blots drink your motes and smother the glow. Skimmer rays save what slips past you.',
    shop: ['jelly', 'jar', 'rich', 'sonar', 'lampfin', 'skimmer', 'beacon'],
    goals: [{ t: 'own', kind: 'jelly', stage: 2, n: 6, label: 'Radiant jellies' }, { t: 'defeat', n: 4, label: 'Raiders driven off' }, { t: 'beacon', cost: 5000, label: 'Light the beacon' }],
    raids: { first: 50, gap: [45, 60], waves: [['blot'], ['eel'], ['blot', 'blot'], ['eel', 'blot']] } },
  { name: 'Spines Out', blurb: 'Spinepuffs chase raiders down for you. You will want a few.',
    shop: ['jelly', 'jar', 'rich', 'sonar', 'lampfin', 'skimmer', 'puff'],
    goals: [{ t: 'own', kind: 'puff', stage: 0, n: 2, label: 'Spinepuffs on guard' }, { t: 'defeat', n: 8, label: 'Raiders driven off' }, { t: 'earn', n: 12000, label: 'Sparks gathered' }],
    raids: { first: 45, gap: [38, 52], waves: [['eel', 'eel'], ['blot', 'eel'], ['eel', 'eel', 'blot']] } },
  { name: 'The Maw Below', blurb: 'Something enormous is rising from the trench. Hold the light.',
    shop: ['jelly', 'jar', 'rich', 'sonar', 'lampfin', 'skimmer', 'puff', 'beacon'],
    goals: [{ t: 'maw', n: 1, label: 'Trench Maw defeated' }, { t: 'beacon', cost: 12000, label: 'Light the beacon' }],
    raids: { first: 50, gap: [40, 55], waves: [['eel'], ['blot', 'eel'], ['maw'], ['eel', 'eel'], ['maw', 'blot']] } },
  { name: 'Endless Drift', blurb: 'No goals. The raids only get worse. How long can the reef stay lit?',
    endless: true,
    shop: ['jelly', 'jar', 'rich', 'sonar', 'lampfin', 'skimmer', 'puff'],
    goals: [],
    raids: { first: 45, gap: [35, 50], waves: null } },
];

const JAR_REFILL = [1.5, 1.15, 0.85, 0.6];
const FOOD_FED = [14, 20, 28], FOOD_MEALS = [1, 2, 3];
const SONAR_DMG = [10, 18, 30];
const STARVE_AT = 24;

const SHOP = {
  jelly:   { name: 'Jelly', cost: 100, cap: 24, desc: 'Eats plankton. Once bloomed it sheds spark motes while it glows.' },
  jar:     { name: 'Jar', costs: [200, 500, 1100], desc: 'A bigger plankton jar that refills faster.' },
  rich:    { name: 'Rich feed', costs: [350, 900], desc: 'Each speck keeps a jelly glowing longer and grows it faster.' },
  sonar:   { name: 'Sonar', costs: [400, 1200], desc: 'Your taps hit raiders much harder.' },
  lampfin: { name: 'Lampfin', cost: 600, cap: 6, desc: 'Swallows 3 motes, breathes out a pearl worth 2.5x. Starves without motes.' },
  skimmer: { name: 'Skimmer', cost: 900, cap: 2, desc: 'Glides under the surface catching whatever you miss.' },
  puff:    { name: 'Spinepuff', cost: 700, cap: 3, desc: 'Hunts raiders and wears them down. Too spiky to eat.' },
  beacon:  { name: 'Beacon', desc: 'Light the reef beacon to finish the job here.' },
};

/* ------------------------------------------------------------------ */
/* Save + audio                                                        */
/* ------------------------------------------------------------------ */
const SAVE_KEY = 'glowdeep.v1';
let save = { unlocked: 0, mute: false, best: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* private mode */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };

let ac = null;
function audioInit() {
  if (ac || save.mute) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) { try { ac = new AC(); } catch (e) { ac = null; } }
}
function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0) {
  if (!ac || save.mute) return;
  if (ac.state === 'suspended') ac.resume();
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  collect: v => { const f = v >= 100 ? 990 : v >= 25 ? 780 : 620; tone(f, 0.12, 'triangle', 0.1); tone(f * 1.5, 0.16, 'sine', 0.07, 0, 0.05); },
  feed: () => tone(300, 0.1, 'sine', 0.07, -120),
  empty: () => tone(140, 0.08, 'square', 0.04),
  buy: () => { tone(440, 0.09, 'triangle', 0.1); tone(660, 0.14, 'triangle', 0.1, 0, 0.08); },
  nope: () => tone(160, 0.14, 'sawtooth', 0.05, -40),
  hit: () => tone(210, 0.07, 'square', 0.06, -90),
  kill: () => { tone(300, 0.25, 'sawtooth', 0.08, -220); tone(880, 0.3, 'triangle', 0.08, 0, 0.1); },
  warn: () => { for (let i = 0; i < 3; i++) tone(190, 0.22, 'sawtooth', 0.07, 60, i * 0.3); },
  die: () => tone(260, 0.5, 'sine', 0.09, -180),
  pearl: () => { tone(880, 0.1, 'sine', 0.08); tone(1320, 0.2, 'sine', 0.07, 0, 0.08); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, 0, i * 0.13)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'sine', 0.1, 0, i * 0.18)),
};

/* ------------------------------------------------------------------ */
/* Game state                                                          */
/* ------------------------------------------------------------------ */
let G = null;
let mode = 'menu'; // menu | play | paused | won | lost

function newGame(level) {
  const L = LEVELS[level];
  G = {
    level, L, t: 0, sparks: 150, earned: 0, pearls: 0, defeated: 0, maws: 0, beacon: false,
    jarLvl: 0, richLvl: 0, sonarLvl: 0, jar: 6, jarT: 0,
    creatures: [], foods: [], drops: [], threats: [], fx: [], texts: [], bubbles: [],
    raidT: L.raids ? L.raids.first : Infinity, raidIdx: 0, warned: false,
    goals: L.goals.map(g => ({ ...g, done: false, cur: 0 })),
    hints: {}, endT: 0, shake: 0,
  };
  for (let i = 0; i < 2; i++) G.creatures.push(mkJelly(W * (0.35 + 0.3 * i), H * 0.45, 2));
  for (let i = 0; i < 14; i++) G.bubbles.push({ x: rand(0, W), y: rand(0, H), r: rand(1, 3.5), s: rand(12, 30) });
  mode = 'play';
  buildShop(); refreshHud(true);
  $('#hud').hidden = false; $('#goals').hidden = G.goals.length === 0; $('#overlay').hidden = true;
  resize();
  banner(L.blurb, 6);
}
const jarMax = () => 6 + 2 * G.jarLvl;

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */
function base(kind, x, y) {
  return { kind, x, y, vx: 0, vy: 0, tx: x, ty: y, retT: 0, ph: rand(0, TAU), face: 1, dead: false, deadT: 0, r: 16 * U, born: 0 };
}
function mkJelly(x, y, meals = 0) {
  return Object.assign(base('jelly', x, y), { hue: pick([172, 190, 205, 265, 290, 318]), fed: 10, starve: 0, meals, dropT: rand(2, 4), rr: 0 });
}
const stageOf = c => (c.kind !== 'jelly' ? 0 : c.meals >= 10 ? 2 : c.meals >= 3 ? 1 : 0);
function mkLampfin(x, y) { return Object.assign(base('lampfin', x, y), { belly: 0, bellyVal: 0, hungry: 0, r: 20 * U }); }
function mkSkimmer(x, y) { return Object.assign(base('skimmer', x, y), { dir: pick([-1, 1]), r: 24 * U }); }
function mkPuff(x, y) { return Object.assign(base('puff', x, y), { puffed: 0, r: 17 * U }); }

const DROP = {
  mote:   { v: 10, r: 8, rise: 26 },
  bright: { v: 25, r: 10, rise: 26 },
  pearl:  { v: 0, r: 12, rise: 20 },
  gem:    { v: 0, r: 13, rise: 16 },
};
function mkDrop(type, x, y, v) {
  const d = DROP[type];
  G.drops.push({ type, x, y, v: v || d.v, r: d.r * U, rise: d.rise * U, ph: rand(0, TAU), age: 0 });
  if (G.level === 0 && !G.hints.mote) { G.hints.mote = 1; banner('Tap the rising motes — any that reach the surface are lost!', 6); }
}

function mkThreat(type, mini) {
  const left = Math.random() < 0.5, lv = G.level + (G.L.endless ? G.raidIdx * 0.6 : 0);
  const t = Object.assign(base(type, left ? -70 * U : W + 70 * U, rand(SURF + 60 * U, FLOOR - 60 * U)), {
    threat: true, kx: 0, ky: 0, bite: 1.5, flash: 0, mini: !!mini, trail: [],
  });
  if (type === 'eel') { t.hp = 50 + 12 * lv; t.r = 22 * U; t.speed = 60 * U; t.reward = 150; t.kb = 190; }
  else if (type === 'blot') { t.hp = mini ? 18 : 45 + 8 * lv; t.r = (mini ? 17 : 28) * U; t.speed = (mini ? 52 : 38) * U; t.reward = mini ? 60 : 80; t.kb = 130; }
  else { t.hp = 520 + 60 * lv; t.r = 54 * U; t.speed = 30 * U; t.reward = 1000; t.kb = 34; }
  t.maxHp = t.hp;
  return t;
}

function burst(x, y, hsl, n = 10, sp = 90) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(0.3, 1) * sp * U;
    G.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.8), t: 0, hsl, r: rand(1.5, 3.5) * U });
  }
}
function ring(x, y, hsl, r = 30) { G.fx.push({ ring: true, x, y, life: 0.35, t: 0, hsl, r: r * U }); }
function floatText(x, y, s, color = '#ffe9a3') { G.texts.push({ x, y, s, color, t: 0 }); }

/* ------------------------------------------------------------------ */
/* Update                                                              */
/* ------------------------------------------------------------------ */
function steer(e, tx, ty, speed, accel, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, accel * dt);
  e.vx += (dx / d * speed - e.vx) * k; e.vy += (dy / d * speed - e.vy) * k;
  if (Math.abs(e.vx) > 4 * U) e.face = e.vx > 0 ? 1 : -1;
  return d;
}
function wander(e, dt, yMin = SURF + 40 * U, yMax = FLOOR - 30 * U) {
  e.retT -= dt;
  if (e.retT <= 0 || Math.hypot(e.tx - e.x, e.ty - e.y) < 12 * U) {
    e.tx = rand(30 * U, W - 30 * U); e.ty = rand(yMin, Math.max(yMin + 10, yMax)); e.retT = rand(3, 7);
  }
}
function nearest(list, e, filter) {
  let best = null, bd = Infinity;
  for (const o of list) {
    if (filter && !filter(o)) continue;
    const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function kill(c, why) {
  if (c.dead) return;
  c.dead = true; c.deadT = 0; sfx.die();
  if (why === 'eaten') { burst(c.x, c.y, '350,90%,65%', 14); c.deadT = 9; }
  else floatText(c.x, c.y - c.r, c.kind === 'jelly' ? 'went dark…' : 'starved…', '#ff9c8a');
}
function collect(d, by) {
  d.gone = true;
  G.sparks += d.v; G.earned += d.v;
  if (d.type === 'pearl') G.pearls++;
  floatText(d.x, d.y, '+' + d.v, d.type === 'gem' ? '#d9b3ff' : d.type === 'pearl' ? '#ffd9ef' : '#ffe9a3');
  burst(d.x, d.y, d.type === 'gem' ? '275,90%,75%' : '45,100%,70%', 6, 60);
  if (!by) sfx.collect(d.v);
}

function updateCreature(c, dt) {
  c.ph += dt * 3; c.born += dt;
  if (c.dead) { c.deadT += dt; c.vy += 20 * U * dt; c.x += c.vx * dt; c.y += c.vy * dt; return; }

  if (c.kind === 'jelly') {
    const st = stageOf(c);
    c.rr += (([15, 22, 30][st]) - c.rr) * Math.min(1, dt * 3); c.r = c.rr * U;
    c.fed -= dt;
    if (c.fed <= 0) { c.starve += dt; if (c.starve > STARVE_AT) return kill(c); } else c.starve = 0;
    const hungry = c.fed < 5;
    const food = hungry ? nearest(G.foods, c) : null;
    if (food) {
      const d = steer(c, food.x, food.y, 78 * U, 5, dt);
      if (d < c.r + 8 * U) {
        food.gone = true;
        c.fed = Math.max(0, c.fed) + FOOD_FED[G.richLvl]; c.starve = 0;
        const before = stageOf(c); c.meals += FOOD_MEALS[G.richLvl];
        ring(c.x, c.y, c.hue + ',90%,70%', c.r * 1.2 / U);
        if (stageOf(c) > before) { burst(c.x, c.y, c.hue + ',95%,75%', 18, 120); floatText(c.x, c.y - c.r * 1.4, stageOf(c) === 2 ? 'Radiant!' : 'Bloomed!', '#bff4ff'); sfx.pearl(); }
      }
    } else {
      wander(c, dt);
      const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(c.ph));
      steer(c, c.tx, c.ty, 26 * U * pulse, 2, dt);
    }
    if (c.fed > 0 && st > 0) {
      c.dropT -= dt;
      if (c.dropT <= 0) { c.dropT = 5; mkDrop(st === 2 ? 'bright' : 'mote', c.x, c.y - c.r * 0.9); }
    }
  } else if (c.kind === 'lampfin') {
    c.hungry += dt;
    if (c.hungry > 50) return kill(c);
    const m = nearest(G.drops, c, d => d.type === 'mote' || d.type === 'bright');
    if (m) {
      const d = steer(c, m.x, m.y, 95 * U, 4, dt);
      if (d < c.r + m.r) {
        m.gone = true; c.hungry = 0; c.belly++; c.bellyVal += m.v;
        if (c.belly >= 3) {
          mkDrop('pearl', c.x + c.face * c.r, c.y, Math.round(c.bellyVal * 2.5 / 5) * 5);
          ring(c.x, c.y, '320,90%,80%', 26); c.belly = 0; c.bellyVal = 0;
        }
      }
    } else { wander(c, dt); steer(c, c.tx, c.ty, 34 * U, 2, dt); }
  } else if (c.kind === 'skimmer') {
    const band = SURF + (FLOOR - SURF) * 0.32;
    const m = nearest(G.drops, c, d => d.y < band);
    if (m) steer(c, m.x, Math.max(m.y, SURF + 22 * U), 120 * U, 4, dt);
    else {
      if (c.x < 50 * U) c.dir = 1; else if (c.x > W - 50 * U) c.dir = -1;
      steer(c, c.x + c.dir * 100, SURF + 46 * U, 42 * U, 2, dt);
    }
    for (const d of G.drops) if (!d.gone && Math.hypot(d.x - c.x, d.y - c.y) < c.r + d.r) { collect(d, c); }
  } else if (c.kind === 'puff') {
    const t = nearest(G.threats, c);
    c.puffed += ((t ? 1 : 0) - c.puffed) * Math.min(1, dt * 4);
    if (t) {
      const d = steer(c, t.x, t.y, 88 * U, 4, dt);
      if (d < c.r * 1.5 + t.r) { hurt(t, 14 * dt, c.x, c.y, true); }
    } else { wander(c, dt); steer(c, c.tx, c.ty, 28 * U, 2, dt); }
  }
  c.x += c.vx * dt; c.y += c.vy * dt;
  c.x = clamp(c.x, c.r, W - c.r); c.y = clamp(c.y, SURF + c.r, FLOOR - c.r * 0.6);
}

function hurt(t, dmg, fromX, fromY, quiet) {
  t.hp -= dmg;
  if (!quiet) {
    t.flash = 0.12;
    const dx = t.x - fromX, dy = t.y - fromY, d = Math.hypot(dx, dy) || 1;
    t.kx += dx / d * t.kb * U; t.ky += dy / d * t.kb * U;
    sfx.hit();
  } else if (Math.random() < 0.08) burst(t.x, t.y, '30,100%,65%', 1, 50);
  if (t.hp <= 0 && !t.gone) {
    t.gone = true; sfx.kill(); G.shake = t.kind === 'maw' ? 0.6 : 0.2;
    burst(t.x, t.y, t.kind === 'blot' ? '260,60%,55%' : '350,90%,60%', t.kind === 'maw' ? 60 : 22, 200);
    if (t.kind === 'blot' && !t.mini) {
      for (const s of [-1, 1]) { const m = mkThreat('blot', true); m.x = t.x + s * 14 * U; m.y = t.y; m.kx = s * 160 * U; G.threats.push(m); }
    }
    if (t.kind === 'maw') { G.maws++; for (let i = 0; i < 4; i++) mkDrop('gem', t.x + rand(-40, 40) * U, t.y + rand(-30, 30) * U, 250); }
    else mkDrop('gem', t.x, t.y, t.reward);
    if (!t.mini) G.defeated++;
  }
}

function updateThreat(t, dt) {
  t.ph += dt * 4; t.bite -= dt; t.flash -= dt;
  const prey = c => !c.dead && (c.kind === 'jelly' || c.kind === 'lampfin');
  if (t.kind === 'blot') {
    const d = nearest(G.drops, t, d => d.type !== 'gem');
    const target = d || nearest(G.creatures, t, prey);
    if (target) steer(t, target.x, target.y, t.speed, 2, dt); else { wander(t, dt); steer(t, t.tx, t.ty, t.speed * 0.6, 2, dt); }
    for (const dr of G.drops) if (!dr.gone && dr.type !== 'gem' && Math.hypot(dr.x - t.x, dr.y - t.y) < t.r + dr.r) {
      dr.gone = true; t.hp = Math.min(t.maxHp * 1.5, t.hp + 6); burst(dr.x, dr.y, '260,50%,45%', 5, 40);
    }
    for (const c of G.creatures) if (prey(c) && c.kind === 'jelly' && Math.hypot(c.x - t.x, c.y - t.y) < t.r + c.r) c.fed -= 4 * dt;
  } else {
    const c = nearest(G.creatures, t, prey);
    if (c) {
      const d = steer(t, c.x, c.y, t.speed, t.kind === 'maw' ? 1.2 : 2.5, dt);
      if (d < t.r + c.r * 0.6 && t.bite <= 0) { kill(c, 'eaten'); t.bite = t.kind === 'maw' ? 2.6 : 3.6; t.chomp = 0.4; }
    } else { wander(t, dt); steer(t, t.tx, t.ty, t.speed * 0.6, 2, dt); }
  }
  if (t.chomp > 0) t.chomp -= dt;
  t.kx *= Math.pow(0.02, dt); t.ky *= Math.pow(0.02, dt);
  t.x += (t.vx + t.kx) * dt; t.y += (t.vy + t.ky) * dt;
  t.y = clamp(t.y, SURF + t.r, FLOOR - t.r * 0.5);
  t.x = clamp(t.x, -90 * U, W + 90 * U);
  if (t.kind === 'eel') { t.trail.unshift({ x: t.x, y: t.y }); if (t.trail.length > 34) t.trail.pop(); }
}

function spawnWave() {
  const R = G.L.raids;
  let wave;
  if (R.waves) {
    const n = R.waves.length, i = G.raidIdx;
    wave = i < n ? R.waves[i] : R.waves[n - 1 - ((i - n) % Math.min(2, n))]; // then alternate the last two
  }
  else {
    const n = 1 + Math.floor(G.raidIdx / 2); wave = [];
    if (G.raidIdx > 0 && G.raidIdx % 4 === 3) wave.push('maw');
    while (wave.length < Math.min(n, 6)) wave.push(Math.random() < 0.6 ? 'eel' : 'blot');
  }
  for (const type of wave) G.threats.push(mkThreat(type));
  G.raidIdx++;
}

function update(dt) {
  G.t += dt;
  // plankton jar
  if (G.jar < jarMax()) { G.jarT += dt; const r = JAR_REFILL[G.jarLvl]; if (G.jarT >= r) { G.jarT -= r; G.jar++; } } else G.jarT = 0;

  // food sinks
  for (const f of G.foods) { f.age += dt; f.y += 34 * U * dt; f.x += Math.sin(f.age * 3 + f.ph) * 10 * U * dt; if (f.y > FLOOR - 4 * U) f.gone = true; }
  // drops rise
  for (const d of G.drops) {
    d.age += dt; d.y -= d.rise * dt; d.x += Math.sin(d.age * 2 + d.ph) * 8 * U * dt;
    if (d.y < SURF + d.r * 0.5 && !d.gone) { d.gone = true; ring(d.x, SURF, '195,60%,70%', 14); }
  }
  for (const c of G.creatures) updateCreature(c, dt);
  for (const t of G.threats) updateThreat(t, dt);

  // raids
  if (G.L.raids && G.threats.length === 0 && mode === 'play') {
    G.raidT -= dt;
    if (G.raidT < 5 && !G.warned) { G.warned = true; sfx.warn(); banner(G.L.raids.waves && G.L.raids.waves[Math.min(G.raidIdx, G.L.raids.waves.length - 1)].includes('maw') ? 'The water goes cold. The Maw is coming!' : 'Something stirs in the dark…', 4.5, 'warn'); }
    if (G.raidT <= 0) { spawnWave(); G.raidT = rand(G.L.raids.gap[0], G.L.raids.gap[1]); G.warned = false; }
  }

  for (const p of G.fx) { p.t += dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; } }
  for (const t of G.texts) { t.t += dt; t.y -= 26 * U * dt; }
  for (const b of G.bubbles) { b.y -= b.s * U * dt; b.x += Math.sin(G.t * 2 + b.r * 9) * 6 * dt; if (b.y < SURF) { b.y = FLOOR + rand(0, 30); b.x = rand(0, W); } }
  if (G.shake > 0) G.shake -= dt;

  G.foods = G.foods.filter(f => !f.gone);
  G.drops = G.drops.filter(d => !d.gone);
  G.threats = G.threats.filter(t => !t.gone);
  G.creatures = G.creatures.filter(c => !(c.dead && c.deadT > 2.2));
  G.fx = G.fx.filter(p => p.t < p.life);
  G.texts = G.texts.filter(t => t.t < 1.1);

  // tutorial nudges
  if (G.level === 0) {
    if (!G.hints.feed && G.t > 7) { G.hints.feed = 1; banner('Tap open water to sprinkle plankton. Hungry jellies lose their glow.', 6); }
    if (!G.hints.buy && G.sparks >= 250) { G.hints.buy = 1; banner('Spend sparks in the shop above — more jellies, more motes.', 6); }
  }

  // goals
  let all = G.goals.length > 0;
  for (const g of G.goals) {
    if (g.t === 'own') g.cur = G.creatures.filter(c => !c.dead && c.kind === g.kind && stageOf(c) >= g.stage).length;
    else if (g.t === 'earn') g.cur = G.earned;
    else if (g.t === 'defeat') g.cur = G.defeated;
    else if (g.t === 'pearls') g.cur = G.pearls;
    else if (g.t === 'maw') g.cur = G.maws;
    else if (g.t === 'beacon') g.cur = G.beacon ? 1 : 0;
    if (!g.done && g.cur >= (g.n || 1)) { g.done = true; sfx.pearl(); banner('Goal met: ' + g.label, 3, 'good'); }
    if (!g.done) all = false;
  }
  if (mode === 'play') {
    if (all) { mode = 'won'; G.endT = 0; sfx.win(); if (save.unlocked < G.level + 1) { save.unlocked = Math.min(LEVELS.length - 1, G.level + 1); persist(); } }
    else if (!G.creatures.some(c => !c.dead && c.kind === 'jelly') && G.sparks < SHOP.jelly.cost && G.drops.length === 0) { mode = 'lost'; G.endT = 0; sfx.lose(); }
  } else {
    G.endT += dt;
    if (G.endT > 1.8 && $('#overlay').hidden) showEnd();
  }
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */
let pointerDown = false;
function pos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function sweep(p, pad) {
  let got = false;
  for (const d of G.drops) if (!d.gone && Math.hypot(d.x - p.x, d.y - p.y) < d.r + pad) { collect(d); got = true; }
  return got;
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); audioInit();
  if (mode !== 'play' || !G) return;
  pointerDown = true;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const p = pos(e), touch = e.pointerType !== 'mouse', pad = (touch ? 30 : 18) * Math.max(U, 0.8);
  // 1. raiders
  let hit = null, hd = Infinity;
  for (const t of G.threats) { const d = Math.hypot(t.x - p.x, t.y - p.y) - t.r; if (d < pad * 0.6 && d < hd) { hd = d; hit = t; } }
  if (hit) { hurt(hit, SONAR_DMG[G.sonarLvl], p.x, p.y); ring(p.x, p.y, '10,100%,70%', 22 + 10 * G.sonarLvl); return; }
  // 2. drops
  if (sweep(p, pad)) return;
  // 3. plankton
  if (p.y < SURF) p.y = SURF + 4;
  if (p.y > FLOOR - 10 * U) return;
  if (G.jar >= 1) {
    G.jar--; sfx.feed();
    G.foods.push({ x: p.x, y: p.y, age: 0, ph: rand(0, TAU) });
    ring(p.x, p.y, '95,90%,70%', 12);
  } else { sfx.empty(); $('#jar').classList.add('empty'); setTimeout(() => $('#jar').classList.remove('empty'), 300); }
});
cv.addEventListener('pointermove', e => {
  if (!pointerDown || mode !== 'play' || !G) return;
  sweep(pos(e), (e.pointerType !== 'mouse' ? 26 : 16) * Math.max(U, 0.8));
});
const up = () => { pointerDown = false; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });

/* ------------------------------------------------------------------ */
/* Shop + HUD                                                          */
/* ------------------------------------------------------------------ */
const count = kind => G.creatures.filter(c => !c.dead && c.kind === kind).length;
const lvlKey = { jar: 'jarLvl', rich: 'richLvl', sonar: 'sonarLvl' };
function itemState(id) {
  const s = SHOP[id];
  if (id === 'beacon') { const g = G.goals.find(g => g.t === 'beacon'); return { cost: g.cost, max: G.beacon }; }
  if (s.costs) { const lv = G[lvlKey[id]]; return { cost: s.costs[lv], max: lv >= s.costs.length, lv }; }
  return { cost: s.cost, max: count(id) >= s.cap };
}
function buy(id, el) {
  if (mode !== 'play') return;
  audioInit();
  const s = SHOP[id], st = itemState(id);
  if (st.max || G.sparks < st.cost) {
    sfx.nope(); el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope');
    banner(s.name + ' — ' + (st.max ? 'already maxed out.' : s.desc + ' Costs ' + st.cost + '.'), 3.5);
    return;
  }
  G.sparks -= st.cost; sfx.buy();
  const x = rand(W * 0.2, W * 0.8), y = SURF + 30 * U;
  if (id === 'jelly') G.creatures.push(mkJelly(x, y));
  else if (id === 'lampfin') G.creatures.push(mkLampfin(x, y));
  else if (id === 'skimmer') G.creatures.push(mkSkimmer(x, y));
  else if (id === 'puff') G.creatures.push(mkPuff(x, y));
  else if (id === 'beacon') { G.beacon = true; G.shake = 0.4; burst(W / 2, FLOOR - 90 * U, '45,100%,70%', 50, 260); }
  else { G[lvlKey[id]]++; if (id === 'jar') G.jar = jarMax(); }
  if (s.cap) { ring(x, SURF, '195,80%,80%', 26); burst(x, SURF + 6, '195,80%,85%', 10, 80); }
  banner(s.name + ' — ' + s.desc, 3.5);
  refreshHud(true);
}
function icon(id) {
  const c = document.createElement('canvas'); c.width = c.height = 88;
  const x = c.getContext('2d'); x.translate(44, 44);
  const keepU = U; U = 1; iconMode = true;
  if (id === 'jelly') drawJelly(x, 0, -4, 22, 0.6, 190, 1, 1, 1, 0);
  else if (id === 'lampfin') drawLampfin(x, -2, 2, 24, 1, 0, 1, 0);
  else if (id === 'skimmer') drawSkimmer(x, 0, 0, 28, 1, 0.8, 1);
  else if (id === 'puff') drawPuff(x, 0, 0, 20, 1, 0, 0.6, 1);
  else if (id === 'jar') {
    x.strokeStyle = '#bfefff'; x.lineWidth = 4; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(-14, -24); x.lineTo(14, -24); x.lineTo(14, -16); x.quadraticCurveTo(24, -10, 24, 4); x.lineTo(24, 20); x.quadraticCurveTo(24, 28, 16, 28); x.lineTo(-16, 28); x.quadraticCurveTo(-24, 28, -24, 20); x.lineTo(-24, 4); x.quadraticCurveTo(-24, -10, -14, -16); x.closePath(); x.stroke();
    x.fillStyle = '#b6ff7a'; for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(-16 + (i % 4) * 10.5 + (i > 7 ? 3 : 0), 20 - Math.floor(i / 4) * 10, 3.6, 0, TAU); x.fill(); }
  } else if (id === 'rich') {
    for (let i = 0; i < 7; i++) { const a = i * 0.9, r = i ? 17 : 0; x.fillStyle = i % 2 ? '#ffe27a' : '#b6ff7a'; x.beginPath(); x.arc(Math.cos(a) * r, Math.sin(a) * r, i ? 6 : 10, 0, TAU); x.fill(); }
    x.fillStyle = '#fff'; x.fillRect(-2, -7, 4, 14); x.fillRect(-7, -2, 14, 4);
  } else if (id === 'sonar') {
    x.strokeStyle = '#ff9a8a'; x.lineCap = 'round';
    for (let i = 1; i <= 3; i++) { x.lineWidth = 5 - i; x.globalAlpha = 1.1 - i * 0.25; x.beginPath(); x.arc(0, 0, i * 11, 0, TAU); x.stroke(); }
    x.globalAlpha = 1; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.fill();
  } else if (id === 'beacon') drawBeacon(x, 0, 32, 0.62, true, 0);
  U = keepU; iconMode = false;
  return c.toDataURL();
}
function buildShop() {
  const shop = $('#shop'); shop.innerHTML = '';
  for (const id of G.L.shop) {
    const b = document.createElement('button');
    b.className = 'item' + (id === 'beacon' ? ' goal' : ''); b.dataset.id = id; b.title = SHOP[id].desc;
    b.innerHTML = `<span class="lv"></span><img alt="" src="${icon(id)}"><span class="nm">${SHOP[id].name}</span><span class="ct"></span>`;
    b.addEventListener('click', () => buy(id, b));
    shop.appendChild(b);
  }
}
let hudKey = '';
function refreshHud(force) {
  if (!G) return;
  const jm = jarMax();
  const key = [G.sparks, G.jar, jm, G.jarLvl, G.richLvl, G.sonarLvl, G.beacon, G.creatures.length, G.goals.map(g => g.cur + (g.done ? 'd' : '')).join()].join('|');
  if (key === hudKey && !force) return; hudKey = key;
  $('#sparkNum').textContent = G.sparks.toLocaleString();
  const pips = $('#jarPips');
  if (pips.children.length !== jm) pips.innerHTML = '<i></i>'.repeat(jm);
  for (let i = 0; i < jm; i++) pips.children[i].className = i < G.jar ? 'on' : '';
  for (const b of $('#shop').children) {
    const st = itemState(b.dataset.id);
    b.classList.toggle('max', !!st.max); b.classList.toggle('poor', !st.max && G.sparks < st.cost);
    b.querySelector('.ct').textContent = st.max ? (b.dataset.id === 'beacon' ? 'LIT' : 'MAX') : st.cost.toLocaleString();
    b.querySelector('.lv').textContent = st.lv ? '★'.repeat(st.lv) : '';
  }
  $('#goals').innerHTML = G.goals.map(g => {
    const n = g.n || 1, cur = Math.min(g.cur, n);
    return `<div class="goal-chip${g.done ? ' done' : ''}">${g.done ? '✓ ' : ''}${g.label}${g.t === 'beacon' ? '' : ` <b>${g.done ? n.toLocaleString() : cur.toLocaleString()}/${n.toLocaleString()}</b>`}</div>`;
  }).join('');
}
let bannerTimer = 0;
function banner(text, secs = 4, cls = '') {
  const b = $('#banner'); b.textContent = text; b.className = 'show ' + cls;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.className = cls; }, secs * 1000);
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */
function panel(html) { $('#panel').innerHTML = html; $('#overlay').hidden = false; }
function showMenu() {
  mode = 'menu'; $('#hud').hidden = true; $('#goals').hidden = true; $('#banner').className = '';
  panel(`<h1>GLOWDEEP</h1>
    <p>Keep a tank of living light at the bottom of the sea.</p>
    <div class="levels">${LEVELS.map((L, i) => `<button class="btn${i === save.unlocked ? ' primary' : ''}" data-level="${i}" ${i > save.unlocked ? 'disabled' : ''}>${L.endless ? '∞' : i + 1}. ${L.name}<small>${i > save.unlocked ? 'Locked' : L.endless ? (save.best ? 'Best: ' + fmtTime(save.best) : 'Survive') : i < save.unlocked ? 'Cleared' : 'Play'}</small></button>`).join('')}</div>
    <ul class="how">
      <li><b>Tap water</b> to sprinkle plankton from your jar. It refills on its own.</li>
      <li>Fed jellies <b>glow</b> and shed motes. <b>Tap or swipe</b> motes before they reach the surface.</li>
      <li>A jelly marked <b>!</b> is starving. Feed it or it goes dark for good.</li>
      <li><b>Tap raiders</b> repeatedly to drive them off, then grab the gem they leave.</li>
    </ul>`);
  resize();
}
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function showEnd() {
  const won = mode === 'won', next = G.level + 1;
  if (G.L.endless && G.t > save.best) { save.best = G.t; persist(); }
  panel(`<h2>${won ? 'The reef is glowing!' : 'The tank went dark'}</h2>
    <p>${won ? `${G.L.name} cleared in ${fmtTime(G.t)} with ${G.earned.toLocaleString()} sparks gathered.` : G.L.endless ? `You kept the light alive for ${fmtTime(G.t)}.` : 'No jellies left and not enough sparks for another. Keep them fed and guard them from raiders.'}</p>
    <div class="row">
      ${won && next < LEVELS.length ? `<button class="btn primary" data-level="${next}">Next: ${LEVELS[next].name}</button>` : ''}
      <button class="btn" data-level="${G.level}">${won ? 'Replay' : 'Try again'}</button>
      <button class="btn" data-act="menu">Levels</button>
    </div>`);
}
function togglePause() {
  if (mode === 'play') {
    mode = 'paused';
    panel(`<h2>Paused</h2><p>${G.L.name}</p><div class="row">
      <button class="btn primary" data-act="resume">Resume</button>
      <button class="btn" data-level="${G.level}">Restart</button>
      <button class="btn" data-act="menu">Levels</button></div>`);
  } else if (mode === 'paused') { mode = 'play'; $('#overlay').hidden = true; last = performance.now(); }
}
$('#panel').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  audioInit();
  if (b.dataset.level !== undefined) newGame(+b.dataset.level);
  else if (b.dataset.act === 'menu') showMenu();
  else if (b.dataset.act === 'resume') togglePause();
});
$('#pauseBtn').addEventListener('click', togglePause);
const muteBtn = $('#muteBtn');
muteBtn.classList.toggle('off', save.mute);
muteBtn.addEventListener('click', () => { save.mute = !save.mute; persist(); muteBtn.classList.toggle('off', save.mute); audioInit(); });

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */
const glowCache = {};
let iconMode = false;
function glow(c, x, y, r, hsl, a) {
  if (a <= 0.01 || (iconMode && r > 40)) return; // big halos would clip to a square on shop icons
  let s = glowCache[hsl];
  if (!s) {
    s = glowCache[hsl] = document.createElement('canvas'); s.width = s.height = 64;
    const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `hsla(${hsl},0.9)`); gr.addColorStop(0.35, `hsla(${hsl},0.35)`); gr.addColorStop(1, `hsla(${hsl},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const ga = c.globalAlpha, op = c.globalCompositeOperation;
  c.globalAlpha = ga * Math.min(1, a); c.globalCompositeOperation = 'lighter';
  c.drawImage(s, x - r, y - r, r * 2, r * 2);
  c.globalAlpha = ga; c.globalCompositeOperation = op;
}

function drawJelly(c, x, y, r, ph, hue, lit, alpha, stage, starve) {
  const sq = Math.sin(ph), w = r * (1 + 0.1 * sq), h = r * (0.95 - 0.1 * sq);
  const sat = 25 + 65 * lit, li = 38 + 28 * lit;
  c.save(); c.globalAlpha = alpha;
  glow(c, x, y, r * 2.8, `${hue},95%,65%`, 0.45 * lit);
  // tentacles
  c.strokeStyle = `hsla(${hue},${sat}%,${li + 8}%,0.7)`; c.lineWidth = Math.max(1.2, r * 0.09); c.lineCap = 'round';
  const n = stage === 2 ? 6 : stage === 1 ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const bx = x + (i / (n - 1) - 0.5) * w * 1.4;
    c.beginPath(); c.moveTo(bx, y + h * 0.2);
    for (let s = 1; s <= 5; s++) c.lineTo(bx + Math.sin(ph * 0.9 + s * 0.9 + i * 1.7) * r * 0.07 * s, y + h * 0.2 + s * r * (0.24 + 0.05 * stage));
    c.stroke();
  }
  // bell
  const g = c.createLinearGradient(x, y - h, x, y + h * 0.4);
  g.addColorStop(0, `hsla(${hue},${sat}%,${li + 22}%,0.95)`); g.addColorStop(1, `hsla(${hue + 25},${sat}%,${li - 8}%,0.8)`);
  c.fillStyle = g; c.beginPath(); c.moveTo(x - w, y + h * 0.25);
  c.bezierCurveTo(x - w, y - h * 1.15, x + w, y - h * 1.15, x + w, y + h * 0.25);
  const sc = 4; for (let i = 0; i < sc; i++) { const x1 = x + w - (i + 1) * (2 * w / sc); c.quadraticCurveTo(x1 + w / sc, y + h * 0.55, x1, y + h * 0.25); }
  c.fill();
  if (stage === 2) { c.strokeStyle = `hsla(${hue + 40},100%,88%,${0.5 + 0.4 * lit})`; c.lineWidth = r * 0.07; c.beginPath(); c.arc(x, y - h * 0.15, w * 0.62, Math.PI * 1.12, Math.PI * 1.88); c.stroke(); }
  // highlight + face
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(x - w * 0.4, y - h * 0.45, w * 0.18, h * 0.12, -0.5, 0, TAU); c.fill();
  c.fillStyle = '#06202f'; const ey = y - h * 0.05, er = Math.max(1.2, r * 0.09);
  c.beginPath(); c.arc(x - w * 0.3, ey, er, 0, TAU); c.arc(x + w * 0.3, ey, er, 0, TAU); c.fill();
  c.strokeStyle = '#06202f'; c.lineWidth = Math.max(1, r * 0.06); c.beginPath();
  if (lit > 0.3) c.arc(x, ey + r * 0.05, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); else c.arc(x, ey + r * 0.22, r * 0.12, 1.15 * Math.PI, 1.85 * Math.PI);
  c.stroke();
  if (starve > 0) {
    const urgent = starve > STARVE_AT * 0.55, b = 0.6 + 0.4 * Math.sin(ph * (urgent ? 4 : 2));
    c.globalAlpha = alpha * b; c.fillStyle = urgent ? '#ff5a4a' : '#ffb14a';
    c.font = `800 ${Math.max(13, r * 0.9)}px system-ui,sans-serif`; c.textAlign = 'center'; c.fillText('!', x, y - h * 1.25);
  }
  c.restore();
}

function drawLampfin(c, x, y, r, face, ph, alpha, hungry) {
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.scale(face, 1);
  const tw = Math.sin(ph * 2) * 0.35, dim = hungry > 32 ? 0.35 : 1;
  c.fillStyle = '#1b5f7a'; c.beginPath(); c.moveTo(-r * 0.8, 0); c.lineTo(-r * 1.55, -r * 0.55 + tw * r * 0.3); c.lineTo(-r * 1.4, 0); c.lineTo(-r * 1.55, r * 0.55 + tw * r * 0.3); c.closePath(); c.fill();
  const g = c.createLinearGradient(0, -r * 0.7, 0, r * 0.7); g.addColorStop(0, '#2f8fb0'); g.addColorStop(1, '#0f4259');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, r, r * 0.66, 0, 0, TAU); c.fill();
  c.fillStyle = '#1b5f7a'; c.beginPath(); c.moveTo(-r * 0.3, -r * 0.6); c.lineTo(-r * 0.1, -r * 1.0); c.lineTo(r * 0.3, -r * 0.55); c.fill();
  for (let i = 0; i < 4; i++) { const px = -r * 0.55 + i * r * 0.3; glow(c, px, r * 0.15, r * 0.3, '55,100%,70%', 0.9 * dim); c.fillStyle = `rgba(255,236,150,${dim})`; c.beginPath(); c.arc(px, r * 0.15, r * 0.07, 0, TAU); c.fill(); }
  // lantern
  c.strokeStyle = '#7fd4ff'; c.lineWidth = Math.max(1, r * 0.07); c.beginPath(); c.moveTo(r * 0.45, -r * 0.5); c.quadraticCurveTo(r * 0.9, -r * 1.3, r * 1.3, -r * 0.75); c.stroke();
  glow(c, r * 1.3, -r * 0.7, r * 0.9, '55,100%,70%', 0.9 * dim); c.fillStyle = '#fff6c2'; c.beginPath(); c.arc(r * 1.3, -r * 0.7, r * 0.16, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(r * 0.5, -r * 0.12, r * 0.2, 0, TAU); c.fill();
  c.fillStyle = '#04141f'; c.beginPath(); c.arc(r * 0.56, -r * 0.12, r * 0.1, 0, TAU); c.fill();
  c.restore();
  if (hungry > 32) { c.save(); c.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(ph * 3)); c.fillStyle = '#ffb14a'; c.font = `800 ${Math.max(13, r * 0.9)}px system-ui,sans-serif`; c.textAlign = 'center'; c.fillText('!', x, y - r * 1.2); c.restore(); }
}

function drawSkimmer(c, x, y, r, face, ph, alpha) {
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.scale(face, 1);
  const fl = Math.sin(ph * 1.6) * r * 0.35;
  glow(c, 0, 0, r * 1.6, '160,90%,65%', 0.25);
  c.strokeStyle = '#6fe0c0'; c.lineWidth = Math.max(1, r * 0.07); c.beginPath(); c.moveTo(-r * 0.6, 0); c.quadraticCurveTo(-r * 1.3, fl * 0.5, -r * 1.8, -fl * 0.4); c.stroke();
  const g = c.createLinearGradient(0, -r * 0.6, 0, r * 0.6); g.addColorStop(0, '#59d6b8'); g.addColorStop(1, '#1d6f73');
  c.fillStyle = g; c.beginPath(); c.moveTo(r, 0);
  c.quadraticCurveTo(r * 0.2, -r * 0.3, -r * 0.1, -r * 0.85 - fl); c.quadraticCurveTo(-r * 0.4, -r * 0.2, -r * 0.7, 0);
  c.quadraticCurveTo(-r * 0.4, r * 0.2, -r * 0.1, r * 0.85 + fl); c.quadraticCurveTo(r * 0.2, r * 0.3, r, 0); c.fill();
  c.fillStyle = '#d7fff3'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-r * 0.25 + i * r * 0.25, 0, r * 0.06, 0, TAU); c.fill(); }
  c.fillStyle = '#04141f'; c.beginPath(); c.arc(r * 0.55, -r * 0.1, r * 0.07, 0, TAU); c.arc(r * 0.55, r * 0.1, r * 0.07, 0, TAU); c.fill();
  c.restore();
}

function drawPuff(c, x, y, r, face, ph, puffed, alpha) {
  const R = r * (1 + 0.45 * puffed);
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.scale(face, 1);
  c.strokeStyle = '#ffd08a'; c.lineWidth = Math.max(1.2, r * 0.1); c.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.2, l = R * (1.12 + 0.3 * puffed); c.beginPath(); c.moveTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9); c.lineTo(Math.cos(a) * l, Math.sin(a) * l); c.stroke(); }
  c.fillStyle = '#e8902f'; c.beginPath(); c.moveTo(-R * 0.8, 0); c.lineTo(-R * 1.45, -R * 0.4 + Math.sin(ph * 2) * R * 0.15); c.lineTo(-R * 1.45, R * 0.4 + Math.sin(ph * 2) * R * 0.15); c.fill();
  const g = c.createRadialGradient(-R * 0.2, -R * 0.3, R * 0.1, 0, 0, R); g.addColorStop(0, '#ffd27a'); g.addColorStop(1, '#e07a22');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
  c.fillStyle = '#fff3d6'; c.beginPath(); c.ellipse(R * 0.1, R * 0.45, R * 0.6, R * 0.35, 0, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(R * 0.4, -R * 0.2, R * 0.24, 0, TAU); c.fill();
  c.fillStyle = '#2a1205'; c.beginPath(); c.arc(R * 0.47, -R * 0.2, R * 0.12, 0, TAU); c.fill();
  if (puffed > 0.5) { c.strokeStyle = '#2a1205'; c.lineWidth = R * 0.08; c.beginPath(); c.moveTo(R * 0.15, -R * 0.55); c.lineTo(R * 0.65, -R * 0.42); c.stroke(); }
  c.restore();
}

function hpBar(c, t) {
  if (t.hp >= t.maxHp) return;
  const w = t.r * 1.6, x = t.x - w / 2, y = t.y - t.r - 12 * U;
  c.fillStyle = '#000a'; c.fillRect(x, y, w, 5 * U);
  c.fillStyle = '#ff5a4a'; c.fillRect(x, y, w * clamp(t.hp / t.maxHp, 0, 1), 5 * U);
}
function drawEel(c, t) {
  const fl = t.flash > 0;
  for (let i = t.trail.length - 1; i >= 0; i -= 3) {
    const p = t.trail[i], k = 1 - i / 36, wob = Math.sin(t.ph - i * 0.35) * 5 * U * (i / 34);
    c.fillStyle = fl ? '#fff' : `hsl(${285 - i},45%,${14 + 10 * k}%)`;
    c.beginPath(); c.arc(p.x, p.y + wob, t.r * (0.35 + 0.6 * k), 0, TAU); c.fill();
  }
  c.save(); c.translate(t.x, t.y); c.scale(t.face, 1);
  c.fillStyle = fl ? '#fff' : '#3a1650'; c.beginPath(); c.ellipse(0, 0, t.r * 1.15, t.r * 0.9, 0, 0, TAU); c.fill();
  const open = t.chomp > 0 ? 0.5 : 0.18 + 0.08 * Math.sin(t.ph);
  c.fillStyle = '#12020f'; c.beginPath(); c.moveTo(t.r * 1.15, 0); c.lineTo(t.r * 0.2, -t.r * open); c.lineTo(t.r * 0.2, t.r * open); c.fill();
  c.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { const tx = t.r * (0.4 + i * 0.25); c.beginPath(); c.moveTo(tx, -t.r * open * (1 - i * 0.28)); c.lineTo(tx + t.r * 0.08, 0); c.lineTo(tx + t.r * 0.16, -t.r * open * (1 - (i + 0.6) * 0.28)); c.fill(); }
  glow(c, t.r * 0.25, -t.r * 0.45, t.r * 0.7, '0,100%,60%', 0.9);
  c.fillStyle = '#ff5a4a'; c.beginPath(); c.arc(t.r * 0.25, -t.r * 0.45, t.r * 0.16, 0, TAU); c.fill();
  c.restore();
}
function drawBlot(c, t) {
  c.save(); c.translate(t.x, t.y);
  c.fillStyle = t.flash > 0 ? '#fff' : '#120a26';
  c.globalAlpha = 0.92;
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + t.ph * 0.15, rr = t.r * (0.62 + 0.14 * Math.sin(t.ph + i * 2)); c.beginPath(); c.arc(Math.cos(a) * t.r * 0.5, Math.sin(a) * t.r * 0.5, rr, 0, TAU); c.fill(); }
  c.beginPath(); c.arc(0, 0, t.r * 0.8, 0, TAU); c.fill();
  c.globalAlpha = 1; glow(c, 0, 0, t.r * 1.5, '265,80%,55%', 0.25);
  c.fillStyle = '#d9c8ff'; const ex = t.r * 0.28, er = t.r * 0.17;
  c.beginPath(); c.ellipse(-ex, -t.r * 0.1, er, er * 1.3, 0, 0, TAU); c.ellipse(ex, -t.r * 0.1, er, er * 1.3, 0, 0, TAU); c.fill();
  c.fillStyle = '#120a26'; c.beginPath(); c.arc(-ex + t.face * er * 0.3, -t.r * 0.08, er * 0.5, 0, TAU); c.arc(ex + t.face * er * 0.3, -t.r * 0.08, er * 0.5, 0, TAU); c.fill();
  c.restore();
}
function drawMaw(c, t) {
  const r = t.r, fl = t.flash > 0;
  c.save(); c.translate(t.x, t.y); c.scale(t.face, 1);
  glow(c, 0, 0, r * 2.2, '350,90%,45%', 0.3);
  const tw = Math.sin(t.ph * 0.6) * r * 0.2;
  c.fillStyle = fl ? '#fff' : '#1a0b1f';
  c.beginPath(); c.moveTo(-r * 0.8, 0); c.lineTo(-r * 1.7, -r * 0.7 + tw); c.lineTo(-r * 1.4, 0); c.lineTo(-r * 1.7, r * 0.7 + tw); c.fill();
  c.beginPath(); c.moveTo(-r * 0.5, -r * 0.7); c.lineTo(-r * 0.1, -r * 1.3); c.lineTo(r * 0.4, -r * 0.7); c.fill();
  const g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#3b1640'); g.addColorStop(1, '#12060f');
  c.fillStyle = fl ? '#fff' : g; c.beginPath(); c.ellipse(0, 0, r * 1.1, r * 0.85, 0, 0, TAU); c.fill();
  const open = (t.chomp > 0 ? 0.6 : 0.3 + 0.12 * Math.sin(t.ph * 0.8)) * r;
  c.fillStyle = '#060106'; c.beginPath(); c.moveTo(r * 1.08, 0); c.lineTo(r * 0.05, -open); c.lineTo(r * 0.05, open); c.fill();
  c.fillStyle = '#f4ecff';
  for (let i = 0; i < 5; i++) {
    const tx = r * (0.14 + i * 0.18), top = -open * (1 - (tx - r * 0.05) / (r * 1.03)), top2 = -open * (1 - (tx + r * 0.14 - r * 0.05) / (r * 1.03));
    c.beginPath(); c.moveTo(tx, top); c.lineTo(tx + r * 0.07, top + r * 0.22); c.lineTo(tx + r * 0.14, top2); c.fill();
    c.beginPath(); c.moveTo(tx, -top); c.lineTo(tx + r * 0.07, -top - r * 0.22); c.lineTo(tx + r * 0.14, -top2); c.fill();
  }
  glow(c, r * 0.3, -r * 0.5, r * 0.6, '0,100%,60%', 1);
  c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(r * 0.3, -r * 0.5, r * 0.14, 0, TAU); c.fill();
  c.fillStyle = '#200'; c.beginPath(); c.ellipse(r * 0.32, -r * 0.5, r * 0.04, r * 0.11, 0, 0, TAU); c.fill();
  c.restore();
}

function drawDrop(c, d) {
  const bob = 1 + 0.08 * Math.sin(d.age * 6 + d.ph), r = d.r * bob;
  if (d.type === 'gem') {
    glow(c, d.x, d.y, r * 2.6, '275,95%,70%', 0.7);
    c.fillStyle = '#c59bff'; c.beginPath(); c.moveTo(d.x, d.y - r * 1.2); c.lineTo(d.x + r, d.y); c.lineTo(d.x, d.y + r * 1.2); c.lineTo(d.x - r, d.y); c.fill();
    c.fillStyle = '#efe0ff'; c.beginPath(); c.moveTo(d.x, d.y - r * 1.2); c.lineTo(d.x + r * 0.4, d.y); c.lineTo(d.x - r * 0.4, d.y); c.fill();
  } else if (d.type === 'pearl') {
    glow(c, d.x, d.y, r * 2.6, '325,100%,82%', 0.7);
    const g = c.createRadialGradient(d.x - r * 0.3, d.y - r * 0.3, r * 0.1, d.x, d.y, r); g.addColorStop(0, '#fff'); g.addColorStop(1, '#f6a8d6');
    c.fillStyle = g; c.beginPath(); c.arc(d.x, d.y, r, 0, TAU); c.fill();
  } else {
    const gold = d.type === 'bright';
    glow(c, d.x, d.y, r * 2.8, gold ? '42,100%,62%' : '185,100%,68%', 0.8);
    c.fillStyle = gold ? '#fff0b0' : '#dffcff'; c.beginPath(); c.arc(d.x, d.y, r * 0.55, 0, TAU); c.fill();
    c.strokeStyle = gold ? '#ffd76a' : '#8ff3ff'; c.lineWidth = 1.5; c.beginPath(); c.arc(d.x, d.y, r, 0, TAU); c.stroke();
  }
}

function drawBeacon(c, x, baseY, s, lit, t) {
  c.save(); c.translate(x, baseY); c.scale(s, s);
  c.fillStyle = '#0b2a3d'; c.beginPath(); c.moveTo(-34, 0); c.lineTo(-20, -70); c.lineTo(20, -70); c.lineTo(34, 0); c.fill();
  c.fillStyle = '#123f58'; c.fillRect(-26, -82, 52, 12);
  c.strokeStyle = '#1c5878'; c.lineWidth = 3; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-34 + i * 3.5, -i * 17.5); c.lineTo(34 - i * 3.5, -i * 17.5); c.stroke(); }
  if (lit) { const p = 0.8 + 0.2 * Math.sin(t * 3); glow(c, 0, -100, 150 * p, '45,100%,65%', 0.8); glow(c, 0, -100, 50, '50,100%,85%', 1); }
  c.fillStyle = lit ? '#fff3b8' : '#1a3344'; c.beginPath(); c.arc(0, -100, 17, 0, TAU); c.fill();
  c.strokeStyle = lit ? '#ffd76a' : '#2b5a75'; c.lineWidth = 3; c.stroke();
  c.restore();
}

function makeBackground() {
  bg = document.createElement('canvas'); bg.width = Math.max(1, W * DPR); bg.height = Math.max(1, H * DPR);
  const c = bg.getContext('2d'); c.scale(DPR, DPR);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b3d5c'); g.addColorStop(0.45, '#062338'); g.addColorStop(1, '#020b16');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // far ridges (seeded so resize keeps the same skyline)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let layer = 0; layer < 3; layer++) {
    c.fillStyle = ['#062a40', '#051e30', '#041523'][layer];
    c.beginPath(); c.moveTo(0, H);
    const baseY = FLOOR - (70 - layer * 28) * U;
    for (let x = 0; x <= W + 40; x += 40 * U) c.lineTo(x, baseY - rnd() * (90 - layer * 25) * U);
    c.lineTo(W, H); c.fill();
  }
  // floor
  const fg = c.createLinearGradient(0, FLOOR - 10 * U, 0, H); fg.addColorStop(0, '#0d2c3a'); fg.addColorStop(1, '#030d14');
  c.fillStyle = fg; c.beginPath(); c.moveTo(0, H); c.lineTo(0, FLOOR);
  for (let x = 0; x <= W + 30; x += 30) c.lineTo(x, FLOOR + Math.sin(x * 0.02) * 5 * U);
  c.lineTo(W, H); c.fill();
  // glow corals
  for (let i = 0; i < Math.max(5, W / 110); i++) {
    const x = rnd() * W, y = FLOOR + 4 * U, hue = [180, 290, 320, 150][i % 4], n = 3 + (rnd() * 3 | 0);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.35, len = (18 + rnd() * 26) * U;
      c.strokeStyle = `hsl(${hue},55%,28%)`; c.lineWidth = 4 * U; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
      glow(c, x + Math.cos(a) * len, y + Math.sin(a) * len, 12 * U, `${hue},95%,65%`, 0.8);
    }
  }
}

function drawKelp(t) {
  const n = Math.max(3, Math.round(W / 190));
  for (let i = 0; i < n; i++) {
    const bx = (i + 0.5) / n * W + Math.sin(i * 7.3) * 40 * U, hgt = (110 + (i * 53 % 80)) * U;
    ctx.strokeStyle = i % 2 ? 'rgba(20,90,84,0.75)' : 'rgba(14,70,78,0.75)'; ctx.lineWidth = 7 * U; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, FLOOR + 6 * U);
    for (let s = 1; s <= 8; s++) ctx.lineTo(bx + Math.sin(t * 0.9 + s * 0.6 + i) * 3.2 * U * s, FLOOR + 6 * U - hgt * s / 8);
    ctx.stroke();
  }
}

function render() {
  const t = G ? G.t : performance.now() / 1000;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G && G.shake > 0) ctx.translate(rand(-1, 1) * G.shake * 12 * U, rand(-1, 1) * G.shake * 12 * U);
  ctx.drawImage(bg, 0, 0, W, H);
  // light shafts
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x = W * (0.1 + i * 0.2) + Math.sin(t * 0.25 + i * 2) * 40 * U, w = (36 + 20 * Math.sin(t * 0.4 + i)) * U;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.75); g.addColorStop(0, 'rgba(120,220,255,0.10)'); g.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w + 110 * U, H * 0.75); ctx.lineTo(x + 70 * U, H * 0.75); ctx.fill();
  }
  ctx.restore();
  if (!G) return;
  if (G.goals.some(g => g.t === 'beacon')) drawBeacon(ctx, W / 2, FLOOR + 6 * U, U * 0.9, G.beacon, t);
  drawKelp(t);
  ctx.fillStyle = 'rgba(190,240,255,0.25)';
  for (const b of G.bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r * U, 0, TAU); ctx.fill(); }

  for (const f of G.foods) {
    glow(ctx, f.x, f.y, 12 * U, '95,100%,65%', 0.7);
    ctx.fillStyle = '#d8ff9a';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(f.x + Math.cos(f.ph + i * 2.1 + f.age) * 3 * U, f.y + Math.sin(f.ph + i * 2.1 + f.age) * 3 * U, 2.2 * U, 0, TAU); ctx.fill(); }
  }
  for (const c of G.creatures) {
    const a = c.dead ? clamp(1 - c.deadT / 2, 0, 1) : Math.min(1, c.born * 3);
    if (c.kind === 'jelly') drawJelly(ctx, c.x, c.y, c.r, c.ph, c.hue, c.dead ? 0 : clamp(c.fed / 3, 0, 1), a, stageOf(c), c.dead ? 0 : c.starve);
    else if (c.kind === 'lampfin') drawLampfin(ctx, c.x, c.y, c.r, c.face, c.ph, a, c.hungry);
    else if (c.kind === 'skimmer') drawSkimmer(ctx, c.x, c.y, c.r, c.face, c.ph, a);
    else drawPuff(ctx, c.x, c.y, c.r, c.face, c.ph, c.puffed, a);
  }
  for (const d of G.drops) drawDrop(ctx, d);
  for (const th of G.threats) { (th.kind === 'eel' ? drawEel : th.kind === 'blot' ? drawBlot : drawMaw)(ctx, th); hpBar(ctx, th); }

  for (const p of G.fx) {
    const k = 1 - p.t / p.life;
    if (p.ring) { ctx.strokeStyle = `hsla(${p.hsl},${k})`; ctx.lineWidth = 2.5 * U; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + 1.2 * (1 - k)), 0, TAU); ctx.stroke(); }
    else glow(ctx, p.x, p.y, p.r * 3, p.hsl, k);
  }
  ctx.textAlign = 'center'; ctx.font = `800 ${Math.max(13, 15 * U)}px system-ui,sans-serif`;
  for (const tx of G.texts) { ctx.globalAlpha = clamp(1.1 - tx.t, 0, 1); ctx.fillStyle = '#021018'; ctx.fillText(tx.s, tx.x + 1, tx.y + 1); ctx.fillStyle = tx.color; ctx.fillText(tx.s, tx.x, tx.y); }
  ctx.globalAlpha = 1;

  // water line
  ctx.strokeStyle = 'rgba(170,235,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= W; x += 16) ctx.lineTo(x, SURF + Math.sin(x * 0.03 + t * 1.6) * 2.5);
  ctx.stroke();
  // edge arrows for raiders still off-screen
  for (const th of G.threats) if (th.x < 0 || th.x > W) {
    const left = th.x < 0, ax = left ? 16 : W - 16, s = left ? 1 : -1;
    ctx.fillStyle = `rgba(255,90,74,${0.6 + 0.4 * Math.sin(t * 10)})`;
    ctx.beginPath(); ctx.moveTo(ax - s * 8, th.y); ctx.lineTo(ax + s * 8, th.y - 11); ctx.lineTo(ax + s * 8, th.y + 11); ctx.fill();
  }
  if (G.L.endless) { ctx.fillStyle = '#bff4ff'; ctx.textAlign = 'right'; ctx.font = `700 ${Math.max(13, 15 * U)}px system-ui,sans-serif`; ctx.fillText(fmtTime(G.t), W - 10, SURF + 22 * U); }
}

/* ------------------------------------------------------------------ */
/* Resize + loop                                                       */
/* ------------------------------------------------------------------ */
function resize() {
  const st = $('#stage'), w = st.clientWidth, h = st.clientHeight;
  if (!w || !h) return;
  const ow = W, oh = H, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (bg && w === W && h === H && dpr === DPR) return;
  W = w; H = h; DPR = dpr;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const oldU = U; U = clamp(0.45 + Math.sqrt(W * H) / 1250, 0.8, 1.5); // phones get relatively larger creatures
  SURF = 18 * U; FLOOR = H - 42 * U;
  if (G && ow && oh && (ow !== W || oh !== H)) {
    const sx = W / ow, sy = H / oh, su = U / oldU;
    for (const list of [G.creatures, G.foods, G.drops, G.threats, G.bubbles, G.fx, G.texts]) for (const e of list) {
      e.x *= sx; e.y *= sy;
      if (e.tx !== undefined) { e.tx *= sx; e.ty *= sy; }
      if (e.trail) e.trail.length = 0;
      if (list !== G.bubbles && e.r) e.r *= su;
      if (e.rise) e.rise *= su;
      if (e.speed) e.speed *= su;
    }
  }
  makeBackground();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.ResizeObserver) new ResizeObserver(resize).observe($('#stage'));

let last = performance.now(), hudT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G && mode !== 'paused' && mode !== 'menu') {
    update(dt);
    hudT += dt; if (hudT > 0.1) { hudT = 0; refreshHud(); }
  }
  if (W) render();
  requestAnimationFrame(frame);
}

window.__glowdeep = { get G() { return G; }, get mode() { return mode; }, update: dt => update(dt), newGame, LEVELS };
resize(); showMenu();
requestAnimationFrame(frame);
})();
