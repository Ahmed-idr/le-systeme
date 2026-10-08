import { DEFAULT_PROGRAM, PROGRAM_VERSION } from './program.js';

const KEY = 'sl-state-v1';
const listeners = new Set();

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const todayStr = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const clone = (o) => JSON.parse(JSON.stringify(o));

function freshState() {
  return {
    version: 1,
    updatedAt: 0,
    profile: { name: 'Chasseur', age: 25, height: 178, weight: 80, goalWeight: 75, sex: 'h', activity: 1.55 },
    program: clone(DEFAULT_PROGRAM),
    workouts: [],   // {id, date, dayId, name, startedAt, endedAt, exercises:[{exId,name,sets:[{w,r,done}]}]}
    cardio: [],     // {id, date, type, minutes, km, incline, speed, note}
    weights: [],    // {id, date, kg}
    quests: {},     // {'YYYY-MM-DD': {steps:true, ...}}
    deleted: [],    // ids supprimés (pour la synchro)
    active: null,   // séance en cours
    onboarded: false,
    deloads: [],    // dates de début des semaines allégées
  };
}

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const st = { ...freshState(), ...JSON.parse(raw) };
      // nouvelle version du programme par défaut : on remplace (l'historique est conservé)
      if ((st.program?.version || 1) < PROGRAM_VERSION) st.program = clone(DEFAULT_PROGRAM);
      return st;
    }
  } catch (e) { /* stockage indisponible */ }
  return freshState();
}

export function save({ silent = false, touch = true } = {}) {
  if (touch) state.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* plein ou bloqué */ }
  if (!silent) listeners.forEach((fn) => fn(state, touch));
}

export function replaceState(next, opts) {
  state = { ...freshState(), ...next };
  save(opts);
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function resetAll() { state = freshState(); save(); }

export function removeItem(list, id) {
  state[list] = state[list].filter((x) => x.id !== id);
  if (!state.deleted.includes(id)) state.deleted.push(id);
  save();
}

// ---------- Fusion pour la synchro (local + distant) ----------
export function mergeStates(a, b) {
  const newer = (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b;
  const older = newer === a ? b : a;
  const deleted = [...new Set([...(a.deleted || []), ...(b.deleted || [])])];
  const del = new Set(deleted);
  const unionById = (k) => {
    const map = new Map();
    for (const x of older[k] || []) map.set(x.id, x);
    for (const x of newer[k] || []) map.set(x.id, x);
    return [...map.values()].filter((x) => !del.has(x.id));
  };
  return {
    ...older,
    ...newer,
    workouts: unionById('workouts'),
    cardio: unionById('cardio'),
    weights: unionById('weights'),
    quests: { ...(older.quests || {}), ...(newer.quests || {}) },
    deleted,
    active: newer.active ?? null,
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
  };
}

// ---------- Calculs ----------
export const e1rm = (w, r) => (r > 0 && w > 0 ? w * (1 + r / 30) : 0); // formule d'Epley

export function dayById(id) { return state.program.days.find((d) => d.id === id); }

export function planForDate(dateStr) {
  const wd = new Date(dateStr + 'T12:00:00').getDay();
  return dayById(state.program.week[wd]) || dayById('REST');
}

export function exerciseHistory(exId) {
  // séances terminées, de la plus récente à la plus ancienne
  return state.workouts
    .filter((w) => w.endedAt)
    .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0))
    .map((w) => ({ date: w.date, ex: w.exercises.find((e) => e.exId === exId) }))
    .filter((h) => h.ex && h.ex.sets.some((s) => s.done));
}

// Suggestion de charge (double progression)
export function suggestion(ex) {
  const h = exerciseHistory(ex.id)[0];
  if (!h) return { w: '', r: ex.repMax ? ex.repMin : '', msg: 'Première fois : trouve une charge où tu fais ' + ex.repMin + '–' + ex.repMax + ' reps propres.' };
  const done = h.ex.sets.filter((s) => s.done);
  const topW = Math.max(...done.map((s) => +s.w || 0));
  const atTop = done.filter((s) => +s.w === topW);
  const allMax = done.length >= ex.sets && atTop.every((s) => +s.r >= ex.repMax);
  if (allMax && ex.inc > 0) {
    return { w: round(topW + ex.inc), r: ex.repMin, up: true, msg: `Level up ! ${topW} kg → ${round(topW + ex.inc)} kg` };
  }
  const minR = Math.min(...atTop.map((s) => +s.r || 0));
  return { w: topW, r: Math.min(minR + 1, ex.repMax), msg: `Dernière fois : ${topW} kg × ${atTop.map((s) => s.r).join('/')}. Vise +1 rep.` };
}
const round = (x) => Math.round(x * 4) / 4;

export function personalRecords() {
  const best = {};
  const sorted = state.workouts.filter((w) => w.endedAt).sort((a, b) => a.endedAt - b.endedAt);
  for (const w of sorted) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        if (!s.done) continue;
        const v = e1rm(+s.w, +s.r);
        if (!best[ex.exId] || v > best[ex.exId].e1rm) best[ex.exId] = { name: ex.name, w: +s.w, r: +s.r, e1rm: v, date: w.date };
      }
    }
  }
  return best;
}

// PRs battus pendant une séance donnée (comparé à l'historique avant elle)
export function prsInWorkout(workout) {
  const before = state.workouts.filter((w) => w.endedAt && w.id !== workout.id && w.endedAt < (workout.endedAt || Date.now()));
  const prev = {};
  for (const w of before) for (const ex of w.exercises) for (const s of ex.sets) {
    if (s.done) prev[ex.exId] = Math.max(prev[ex.exId] || 0, e1rm(+s.w, +s.r));
  }
  const out = [];
  for (const ex of workout.exercises) {
    const best = Math.max(0, ...ex.sets.filter((s) => s.done).map((s) => e1rm(+s.w, +s.r)));
    if (prev[ex.exId] && best > prev[ex.exId] + 0.01) out.push(ex.name);
  }
  return out;
}

export function workoutVolume(w) {
  return w.exercises.reduce((t, ex) => t + ex.sets.filter((s) => s.done).reduce((a, s) => a + (+s.w || 0) * (+s.r || 0), 0), 0);
}

// ---------- Quêtes ----------
export function questsForDate(dateStr) {
  const plan = planForDate(dateStr);
  const p = state.profile;
  const n = nutrition();
  const q = [];
  if (plan.kind === 'gym') q.push({ id: 'workout', label: `Terminer ${plan.name.split('—')[0].trim()}`, auto: true, xp: 60 });
  if (plan.cardio) q.push({ id: 'cardio', label: `Cardio ${plan.cardio.minutes} min${plan.kind === 'gym' ? ' (tapis incliné)' : ''}`, auto: true, xp: 40, target: plan.cardio.minutes });
  q.push({ id: 'steps', label: plan.kind === 'rest' ? '8 000 pas' : '10 000 pas', xp: 20 });
  q.push({ id: 'protein', label: `Protéines : ${n.protein} g`, xp: 20 });
  q.push({ id: 'kcal', label: `Calories ≤ ${n.target} kcal`, xp: 20 });
  q.push({ id: 'water', label: 'Eau : 3 L', xp: 10 });
  q.push({ id: 'sleep', label: 'Dormir 8 h', xp: 10 });
  const st = state.quests[dateStr] || {};
  const cardioMin = state.cardio.filter((c) => c.date === dateStr).reduce((a, c) => a + (+c.minutes || 0), 0);
  for (const it of q) {
    if (it.id === 'workout') it.done = state.workouts.some((w) => w.date === dateStr && w.endedAt);
    else if (it.id === 'cardio') { it.done = cardioMin >= it.target * 0.9; it.progress = cardioMin; }
    else it.done = !!st[it.id];
  }
  void p;
  return { plan, list: q };
}

export function toggleQuest(dateStr, id) {
  const st = state.quests[dateStr] || (state.quests[dateStr] = {});
  st[id] = !st[id];
  save();
}

export function setPenaltyDone(dateStr) {
  const st = state.quests[dateStr] || (state.quests[dateStr] = {});
  st._penalty = true;
  save();
}

// ---------- XP / niveaux / rangs ----------
export function xpBreakdown() {
  let xp = 0;
  for (const w of state.workouts) if (w.endedAt) {
    xp += 60;
    for (const ex of w.exercises) xp += ex.sets.filter((s) => s.done).length * 8;
    xp += prsInWorkout(w).length * 25;
  }
  for (const c of state.cardio) xp += Math.round((+c.minutes || 0) * 1.5);
  for (const date of Object.keys(state.quests)) {
    const { list } = questsForDate(date);
    const manual = list.filter((q) => !q.auto && q.done);
    xp += manual.reduce((a, q) => a + q.xp, 0);
    if (list.every((q) => q.done)) xp += 50;
    if (state.quests[date]._penalty) xp += 30;
  }
  xp += state.weights.length * 5;
  return xp;
}

// XP pour passer lvl -> lvl+1. Calibré pour un rythme régulier (3 salle + 3 cardio + quêtes) :
// rang D ≈ 3 semaines, C ≈ 2 mois, B ≈ 5 mois, A ≈ 10 mois, S ≈ 1 an et demi.
export const xpForLevel = (lvl) => Math.round(35 * Math.pow(lvl, 1.2));

export function levelInfo() {
  let xp = xpBreakdown();
  const total = xp;
  let level = 1;
  while (xp >= xpForLevel(level)) { xp -= xpForLevel(level); level++; }
  return { level, xp, need: xpForLevel(level), total, rank: rankFor(level) };
}

export function rankFor(level) {
  if (level >= 60) return { id: 'S', title: 'Chasseur de rang S', color: '#ffd166' };
  if (level >= 45) return { id: 'A', title: 'Chasseur de rang A', color: '#ff6b6b' };
  if (level >= 32) return { id: 'B', title: 'Chasseur de rang B', color: '#c77dff' };
  if (level >= 20) return { id: 'C', title: 'Chasseur de rang C', color: '#4cc9f0' };
  if (level >= 10) return { id: 'D', title: 'Chasseur de rang D', color: '#80ed99' };
  return { id: 'E', title: 'Chasseur de rang E', color: '#adb5bd' };
}

export function hunterStats() {
  const doneSets = state.workouts.filter((w) => w.endedAt).reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.filter((s) => s.done).length, 0), 0);
  const cardioMin = state.cardio.reduce((a, c) => a + (+c.minutes || 0), 0);
  const intervals = state.cardio.filter((c) => ['intervalles', 'course'].includes(c.type)).length;
  const perfectDays = Object.keys(state.quests).filter((d) => questsForDate(d).list.every((q) => q.done)).length;
  const prs = Object.keys(personalRecords()).length;
  return {
    FOR: 10 + Math.floor(doneSets / 12) + prs,
    END: 10 + Math.floor(cardioMin / 45),
    AGI: 10 + intervals * 2 + Math.floor(cardioMin / 120),
    VIT: 10 + perfectDays * 2 + streak().best,
  };
}

export function dayComplete(dateStr) {
  return questsForDate(dateStr).list.every((q) => q.done);
}

export function streak() {
  // jours consécutifs où la quête principale (séance / cardio) est faite
  const mainDone = (d) => {
    const { plan, list } = questsForDate(d);
    if (plan.kind === 'rest') return true; // un jour de repos ne casse pas la série
    const main = list.filter((q) => q.auto);
    return main.length ? main.every((q) => q.done) : true;
  };
  const dates = new Set([...state.workouts.map((w) => w.date), ...state.cardio.map((c) => c.date)]);
  if (!dates.size) return { current: 0, best: 0 };
  const first = [...dates].sort()[0];
  let cur = 0, best = 0;
  const d = new Date(first + 'T12:00:00');
  const today = todayStr();
  while (todayStr(d) <= today) {
    const s = todayStr(d);
    if (mainDone(s)) { cur++; best = Math.max(best, cur); }
    else if (s !== today) cur = 0;
    d.setDate(d.getDate() + 1);
  }
  return { current: cur, best };
}

// ---------- Nutrition (Mifflin-St Jeor) ----------
export function currentWeight() {
  const w = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  return w.length ? +w[w.length - 1].kg : +state.profile.weight;
}

export function nutrition() {
  const p = state.profile;
  const kg = currentWeight();
  const bmr = 10 * kg + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  const tdee = bmr * (+p.activity || 1.55);
  const target = Math.round((tdee - 550) / 50) * 50;
  const protein = Math.round((kg * 1.8) / 5) * 5;
  const fat = Math.round((kg * 0.8) / 5) * 5;
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4 / 5) * 5);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), target, protein, fat, carbs };
}

// ---------- Semaine ----------
export function weekProgress(dateStr = todayStr()) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  let planned = 0, done = 0;
  const days = [];
  for (let i = 0; i < 7; i++) {
    const s = todayStr(d);
    const { plan, list } = questsForDate(s);
    const main = list.filter((q) => q.auto);
    const ok = plan.kind !== 'rest' && main.length > 0 && main.every((q) => q.done);
    if (plan.kind !== 'rest') { planned++; if (ok) done++; }
    days.push({ date: s, plan, done: ok });
    d.setDate(d.getDate() + 1);
  }
  return { planned, done, days };
}

// ---------- Titres (succès) ----------
export const TITLES = [
  { id: 'first_workout', name: 'Le Premier Pas', desc: 'Terminer ta première séance', icon: 'dumbbell', get: (c) => [c.workouts, 1] },
  { id: 'workouts_10', name: 'Habitué du Donjon', desc: 'Terminer 10 séances', icon: 'dumbbell', get: (c) => [c.workouts, 10] },
  { id: 'workouts_50', name: 'Chasseur Acharné', desc: 'Terminer 50 séances', icon: 'dumbbell', get: (c) => [c.workouts, 50] },
  { id: 'workouts_150', name: 'Monarque de la Fonte', desc: 'Terminer 150 séances', icon: 'crown', get: (c) => [c.workouts, 150] },
  { id: 'first_pr', name: 'Briseur de Limites', desc: 'Battre un record personnel', icon: 'trophy', get: (c) => [c.prs, 1] },
  { id: 'prs_25', name: 'Au-delà des Limites', desc: 'Battre 25 records', icon: 'trophy', get: (c) => [c.prs, 25] },
  { id: 'streak_7', name: 'Volonté de Fer', desc: 'Série de 7 jours', icon: 'flame', get: (c) => [c.streak, 7] },
  { id: 'streak_30', name: 'Inarrêtable', desc: 'Série de 30 jours', icon: 'flame', get: (c) => [c.streak, 30] },
  { id: 'cardio_600', name: 'Souffle du Chasseur', desc: '10 h de cardio cumulées', icon: 'run', get: (c) => [c.cardioMin, 600] },
  { id: 'cardio_3000', name: 'Endurance Infinie', desc: '50 h de cardio cumulées', icon: 'run', get: (c) => [c.cardioMin, 3000] },
  { id: 'perfect_7', name: 'Discipline Absolue', desc: '7 journées parfaites', icon: 'check', get: (c) => [c.perfect, 7] },
  { id: 'penalty', name: 'Rédemption', desc: 'Accomplir une quête de pénalité', icon: 'bolt', get: (c) => [c.penalties, 1] },
  { id: 'lost_3', name: 'La Mue', desc: 'Perdre 3 kg', icon: 'scale', get: (c) => [c.lost, 3] },
  { id: 'lost_8', name: 'Renaissance', desc: 'Perdre 8 kg', icon: 'scale', get: (c) => [c.lost, 8] },
  { id: 'goal', name: 'Objectif Atteint', desc: 'Atteindre ton poids objectif', icon: 'crown', get: (c) => [c.goalPct, 100] },
];

export function titleProgress() {
  const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const start = weights.length ? Math.max(+state.profile.weight, +weights[0].kg) : +state.profile.weight;
  const cur = currentWeight();
  const goal = +state.profile.goalWeight;
  const prs = state.workouts.filter((w) => w.endedAt).reduce((a, w) => a + prsInWorkout(w).length, 0);
  const c = {
    workouts: state.workouts.filter((w) => w.endedAt).length,
    prs,
    streak: streak().best,
    cardioMin: state.cardio.reduce((a, x) => a + (+x.minutes || 0), 0),
    perfect: Object.keys(state.quests).filter((d) => dayComplete(d)).length,
    penalties: Object.values(state.quests).filter((q) => q._penalty).length,
    lost: Math.max(0, +(start - cur).toFixed(1)),
    goalPct: start > goal ? Math.max(0, Math.min(100, ((start - cur) / (start - goal)) * 100)) : 0,
  };
  return TITLES.map((t) => {
    const [v, target] = t.get(c);
    return { ...t, value: v, target, pct: Math.min(100, (v / target) * 100), unlocked: v >= target };
  });
}

export function goalProgress() {
  const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const start = weights.length ? Math.max(+state.profile.weight, +weights[0].kg) : +state.profile.weight;
  const cur = currentWeight();
  const goal = +state.profile.goalWeight;
  const pct = start > goal ? Math.max(0, Math.min(100, ((start - cur) / (start - goal)) * 100)) : 0;
  return { start, cur, goal, pct, left: Math.max(0, +(cur - goal).toFixed(1)) };
}

// ---------- Semaine allégée (deload) ----------
const DELOAD_DAYS = 7;
export function deloadActive(dateStr = todayStr()) {
  const last = [...(state.deloads || [])].sort().pop();
  if (!last) return false;
  const end = new Date(last + 'T12:00:00'); end.setDate(end.getDate() + DELOAD_DAYS - 1);
  return dateStr >= last && dateStr <= todayStr(end);
}

// Conseille une semaine allégée si : force en baisse 2 séances de suite sur ≥ 2 gros exercices,
// ou ≥ 7 semaines d'entraînement depuis le début / la dernière semaine allégée.
export function deloadAdvice() {
  if (deloadActive()) return null;
  const done = state.workouts.filter((w) => w.endedAt);
  if (done.length < 6) return null;
  const last = [...(state.deloads || [])].sort().pop();
  const since = last || [...done].sort((a, b) => a.date.localeCompare(b.date))[0].date;
  const weeks = (Date.now() - new Date(since + 'T12:00:00')) / (7 * 864e5);
  const heavy = new Set(state.program.days.flatMap((d) => (d.exercises || []).filter((e) => e.rest >= 120).map((e) => e.id)));
  const dropping = [];
  for (const id of heavy) {
    const h = exerciseHistory(id).slice(0, 3).map((x) => Math.max(...x.ex.sets.filter((s) => s.done).map((s) => e1rm(+s.w, +s.r))));
    if (h.length === 3 && h[0] < h[1] - 0.5 && h[1] < h[2] - 0.5) dropping.push(exerciseHistory(id)[0].ex.name);
  }
  if (dropping.length >= 2) return { reason: 'drop', text: `Ta force baisse depuis 2 séances sur ${dropping.slice(0, 3).join(', ')}. C'est la fatigue du déficit, pas un manque de volonté.` };
  if (weeks >= 7) return { reason: 'time', text: `${Math.floor(weeks)} semaines d'entraînement sans pause. Une semaine allégée maintenant = meilleure progression ensuite.` };
  return null;
}

export function startDeload() {
  state.deloads = [...(state.deloads || []), todayStr()];
  save();
}
