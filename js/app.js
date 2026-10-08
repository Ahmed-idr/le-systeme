import {
  state, save, subscribe, uid, todayStr, clone, replaceState, resetAll, removeItem,
  dayById, planForDate, suggestion, personalRecords, prsInWorkout, workoutVolume, e1rm,
  questsForDate, toggleQuest, setPenaltyDone, levelInfo, hunterStats, streak, dayComplete,
  nutrition, currentWeight, exerciseHistory, weekProgress, titleProgress, goalProgress,
  deloadActive, deloadAdvice, startDeload,
} from './store.js';
import { CARDIO_TYPES, DEFAULT_PROGRAM } from './program.js';
import { lineChart, barChart, heatmap } from './charts.js';
import * as sync from './sync.js';

// ======================= Utilitaires =======================
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const fmtDay = (s, o = { weekday: 'long', day: 'numeric', month: 'long' }) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', o);
const fmtShort = (s) => fmtDay(s, { day: 'numeric', month: 'short' });
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return todayStr(d); };
const mondayOf = (s) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return todayStr(d); };
const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const num = (v) => (v === '' || v == null ? '' : +(+v).toFixed(2));
const kg = (v) => Math.round(v).toLocaleString('fr-FR');
const shortName = (n) => n.split('—')[0].trim();
const subName = (n) => (n.split('—')[1] || n).trim();
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};
const haptic = (p = 12) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* ignore */ } };
const ring = (pct, size = 84, stroke = 7, cls = '') => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg class="ring ${cls}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bar" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, Math.max(0, pct)))}"/></svg>`;
};

const MESSAGES = [
  'Le Système ne récompense pas le talent. Il récompense la constance.',
  'Chaque série validée te rapproche de ton prochain rang.',
  'Personne ne devient rang S en un jour. Mais tout le monde peut finir la quête du jour.',
  'Le gras part en silence. Continue, la balance finira par parler.',
  'Une séance moyenne vaut infiniment plus qu\'une séance sautée.',
  'Pas besoin de motivation : ouvre l\'app et appuie sur Commencer.',
  'Les protéines, c\'est la moitié du muscle. Ne zappe pas cette quête.',
  'La récupération est une compétence de chasseur. Dors 8 h.',
  'Le tapis incliné n\'est pas glamour. Il est efficace.',
  'Bats ton toi d\'hier. C\'est le seul adversaire qui compte.',
  'Le Joueur qui s\'arrête stagne. Celui qui continue évolue.',
  'Petit déficit, grande patience, énorme résultat.',
  'Les jours sans envie comptent double.',
  'Ton futur toi te remercie déjà pour la séance d\'aujourd\'hui.',
];
const dailyMessage = () => MESSAGES[Math.floor(Date.now() / 864e5) % MESSAGES.length];

let route = 'home';
const ui = { trainTab: 'muscu', statsTab: 'overview', statsEx: null, cardioPrefill: null, openWorkout: null, openEx: null };

// ======================= Toast =======================
let toastTimer;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.className = 'toast show ' + kind;
  t.innerHTML = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
}

// ======================= Bottom sheet =======================
let sheetCleanup = null;
function openSheet(title, body, { wide = false } = {}) {
  const l = $('#sheet');
  l.hidden = false;
  l.innerHTML = `<div class="sheet-backdrop" data-action="sheet-close"></div>
    <div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grip"></div>
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="sheet-close" aria-label="Fermer">${ic('x')}</button></div>
      <div class="sheet-body">${body}</div>
    </div>`;
  requestAnimationFrame(() => l.classList.add('open'));
  document.body.classList.add('locked');
}
function closeSheet() {
  const l = $('#sheet');
  l.classList.remove('open');
  document.body.classList.remove('locked');
  if (sheetCleanup) { sheetCleanup(); sheetCleanup = null; }
  setTimeout(() => { if (!l.classList.contains('open')) { l.hidden = true; l.innerHTML = ''; } }, 220);
}
function confirmSheet(title, text, ok = 'Confirmer', danger = false) {
  return new Promise((resolve) => {
    openSheet(title, `<p class="muted">${text}</p>
      <div class="stack mt"><button class="btn ${danger ? 'danger' : 'primary'} block" data-action="confirm-yes">${esc(ok)}</button>
      <button class="btn ghost block" data-action="sheet-close">Annuler</button></div>`);
    let answered = false;
    const h = (e) => { if (e.target.closest('[data-action="confirm-yes"]')) { answered = true; closeSheet(); resolve(true); } };
    document.addEventListener('click', h);
    sheetCleanup = () => { document.removeEventListener('click', h); if (!answered) resolve(false); };
  });
}

// ======================= Fenêtres "Système" (récompenses) =======================
const popQueue = [];
let popOpen = false;
function systemPopup(title, body, kind = '', btn = 'Continuer') {
  popQueue.push({ title, body, kind, btn });
  if (!popOpen) nextPopup();
}
function nextPopup() {
  const p = popQueue.shift();
  const layer = $('#popup');
  if (!p) { popOpen = false; layer.classList.remove('open'); setTimeout(() => { if (!popOpen) layer.hidden = true; }, 200); return; }
  popOpen = true;
  layer.hidden = false;
  layer.innerHTML = `<div class="sys-pop ${p.kind}" role="alertdialog" aria-live="assertive">
    <div class="sys-pop-head">${ic(p.kind === 'gold' ? 'crown' : p.kind === 'danger' ? 'bolt' : 'info')}<span>${esc(p.title)}</span></div>
    <div class="sys-pop-body">${p.body}</div>
    <button class="btn primary block" data-action="pop-close">${esc(p.btn)}</button></div>`;
  requestAnimationFrame(() => layer.classList.add('open'));
  layer.querySelectorAll('[data-count]').forEach(countUp);
  haptic([20, 40, 20]);
}
function countUp(el) {
  const target = +el.dataset.count, t0 = performance.now(), dur = 900;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(target * e).toLocaleString('fr-FR');
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ======================= Minuteur de repos =======================
let rest = { end: 0, total: 0, timer: null, beeped: false };
let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.22, 0.44].forEach((t, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = i === 2 ? 1175 : 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.22, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.18);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch (e) { /* pas d'audio */ }
}
function startRest(sec) {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* ignore */ }
  rest = { ...rest, end: Date.now() + sec * 1000, total: sec, beeped: false };
  clearInterval(rest.timer);
  rest.timer = setInterval(tickRest, 250);
  tickRest();
}
function tickRest() {
  const bar = $('#rest');
  if (!rest.end) { bar.hidden = true; return; }
  const left = Math.max(0, (rest.end - Date.now()) / 1000);
  bar.hidden = false;
  $('#rest-time').textContent = left > 0 ? mmss(Math.ceil(left)) : 'Go !';
  const c = 2 * Math.PI * 19;
  const r = $('#rest-ring');
  r.style.strokeDasharray = c;
  r.style.strokeDashoffset = c * (left / rest.total);
  bar.classList.toggle('done', left <= 0);
  if (left <= 0 && !rest.beeped) { rest.beeped = true; beep(); haptic([200, 100, 200]); }
  if (left <= -30) stopRest();
}
function stopRest() { clearInterval(rest.timer); rest.end = 0; $('#rest').hidden = true; }

// ======================= Écran allumé pendant la séance =======================
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* refusé */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.active) keepAwake(true); });

// ======================= Rendu =======================
function render() {
  if (!state.onboarded) { document.body.classList.add('no-nav'); app.innerHTML = viewOnboarding(); return; }
  document.body.classList.remove('no-nav');
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.route === route || (route === 'titles' && a.dataset.route === 'profile')));
  $('.fab').classList.toggle('live', !!state.active);
  const views = { home: viewHome, train: viewTrain, stats: viewStats, profile: viewProfile, titles: viewTitles };
  app.innerHTML = (views[route] || viewHome)();
  if (route === 'stats') drawStats();
  if (route === 'train') tickCardio();
  queueMicrotask(checkMilestones);
}

function checkMilestones() {
  if (!state.onboarded) return;
  const li = levelInfo();
  const last = LS.get('sl-last-level', null);
  if (last == null) LS.set('sl-last-level', li.level);
  else if (li.level > last) {
    LS.set('sl-last-level', li.level);
    const lastRank = LS.get('sl-last-rank', 'E');
    systemPopup('Level up', `<div class="lvl-burst"><span class="muted">Niveau</span><b>${li.level}</b></div><p>Toutes tes statistiques ont augmenté.</p>`, 'gold');
    if (li.rank.id !== lastRank) systemPopup('Éveil', `<div class="rank-big" style="--rc:${li.rank.color}">${li.rank.id}</div><p>Tu es maintenant <b>${li.rank.title}</b>.</p>`, 'gold');
  }
  LS.set('sl-last-rank', li.rank.id);
  const known = LS.get('sl-titles', null);
  const unlocked = titleProgress().filter((t) => t.unlocked);
  if (known == null) LS.set('sl-titles', unlocked.map((t) => t.id));
  else {
    for (const t of unlocked) if (!known.includes(t.id)) {
      systemPopup('Titre obtenu', `<div class="title-badge big">${ic(t.icon)}</div><p class="title-name">« ${esc(t.name)} »</p><p class="muted">${esc(t.desc)}</p>`, 'gold', 'Génial');
    }
    LS.set('sl-titles', unlocked.map((t) => t.id));
  }
  const t = todayStr();
  if (dayComplete(t) && !LS.get('sl-done-' + t, false)) {
    LS.set('sl-done-' + t, true);
    systemPopup('Quête quotidienne accomplie', '<p class="reward-xp">+<b data-count="50">0</b> XP</p><p class="muted">Bonus de journée parfaite. VIT +2.</p>');
  }
}

// ======================= Onboarding =======================
let obStep = 0;
function viewOnboarding() {
  const p = state.profile;
  if (obStep === 0) return `
  <div class="ob">
    <div class="ob-glow"></div>
    <div class="sys-pop static">
      <div class="sys-pop-head">${ic('info')}<span>Notification</span></div>
      <div class="sys-pop-body">
        <p>Tu as rempli les conditions secrètes pour devenir <b>Joueur</b>.</p>
        <p class="muted">Le Système te confiera chaque jour des quêtes. Accomplis-les pour gagner de l'XP, monter de niveau et passer du rang E au rang S.</p>
      </div>
      <button class="btn primary block" data-action="ob-next">Accepter</button>
    </div>
  </div>`;
  if (obStep === 1) return `
  <div class="ob">
    <div class="ob-head"><span class="step">Étape 1 / 2</span><h1>Ton profil de Joueur</h1><p class="muted">Sert à calculer tes calories, tes protéines et ta progression.</p></div>
    <form class="form card" data-form="ob-profile">
      <label>Prénom<input name="name" value="${esc(p.name === 'Chasseur' ? '' : p.name)}" placeholder="Ton prénom" maxlength="24" required></label>
      <div class="grid2">
        <label>Âge<input type="number" inputmode="numeric" name="age" value="${p.age}" min="12" max="99" required></label>
        <label>Taille (cm)<input type="number" inputmode="numeric" name="height" value="${p.height}" min="120" max="230" required></label>
        <label>Poids actuel (kg)<input type="number" inputmode="decimal" step="0.1" name="weight" value="${p.weight}" required></label>
        <label>Poids visé (kg)<input type="number" inputmode="decimal" step="0.1" name="goalWeight" value="${p.goalWeight}" required></label>
      </div>
      <button class="btn primary block" type="submit">Continuer</button>
    </form>
  </div>`;
  const n = nutrition();
  const wk = [1, 2, 3, 4, 5, 6, 0].map((wd) => dayById(state.program.week[wd]));
  return `
  <div class="ob">
    <div class="ob-head"><span class="step">Étape 2 / 2</span><h1>Ton programme est prêt</h1><p class="muted">Objectif : un V athlétique et sec. Dos large, épaules larges, haut des pecs, taille fine. 3 séances salle + cardio.</p></div>
    <div class="card">
      ${wk.map((d, i) => `<div class="list-row"><span class="day-pill k-${d.kind}">${DAYS_FR[[1, 2, 3, 4, 5, 6, 0][i]]}</span><span class="grow">${esc(subName(d.name))}</span><span class="muted small">${d.kind === 'gym' ? '1h30' : d.cardio.minutes + ' min'}</span></div>`).join('')}
    </div>
    <div class="tiles3">
      <div class="tile"><span class="lbl">Calories</span><b>${n.target}</b></div>
      <div class="tile"><span class="lbl">Protéines</span><b>${n.protein}<small>g</small></b></div>
      <div class="tile"><span class="lbl">Cardio/sem</span><b>${state.program.days.filter((d) => d.cardio).reduce((a, d) => a + (Object.values(state.program.week).filter((x) => x === d.id).length * d.cardio.minutes), 0)}<small>min</small></b></div>
    </div>
    <button class="btn primary block lg" data-action="ob-finish">Commencer l'aventure</button>
  </div>`;
}

// ======================= Accueil =======================
function viewHome() {
  const t = todayStr();
  const li = levelInfo();
  const sk = streak();
  const { plan, list } = questsForDate(t);
  const y = addDays(t, -1);
  const yPlan = questsForDate(y);
  const yq = yPlan.plan.kind === 'rest' ? [] : yPlan.list.filter((q) => q.auto);
  const hasHistory = state.workouts.length + state.cardio.length > 0;
  const penalty = hasHistory && yq.length && !yq.every((q) => q.done) && !(state.quests[t] || {})._penalty;
  const qDone = list.filter((q) => q.done).length;
  const mainDone = list.filter((q) => q.auto).every((q) => q.done);
  const wp = weekProgress(t);
  const gp = goalProgress();
  const titles = titleProgress();
  const title = titles.find((x) => x.id === state.profile.title && x.unlocked) || [...titles].reverse().find((x) => x.unlocked);
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';

  return `
  <header class="page-head">
    <div><p class="muted small cap">${fmtDay(t)}</p><h1>${hello}, ${esc(state.profile.name)}</h1></div>
    <a class="avatar" href="#/profile" style="--rc:${li.rank.color}" aria-label="Profil">${li.rank.id}</a>
  </header>

  <section class="hero">
    <div class="hero-ring">
      ${ring(li.xp / li.need, 92, 7, 'grad')}
      <div class="hero-ring-in"><span>NIV.</span><b>${li.level}</b></div>
    </div>
    <div class="hero-info">
      <span class="rank-chip" style="--rc:${li.rank.color}">${li.rank.title}</span>
      ${title ? `<p class="hero-title">« ${esc(title.name)} »</p>` : '<p class="hero-title muted">Aucun titre pour l\'instant</p>'}
      <div class="bar"><i style="width:${(100 * li.xp) / li.need}%"></i></div>
      <p class="small muted">${li.xp} / ${li.need} XP · niveau ${li.level + 1}</p>
    </div>
    <div class="streak ${sk.current ? 'on' : ''}" title="Série en cours">${ic('flame')}<b>${sk.current}</b><span>jours</span></div>
  </section>

  ${penalty ? `
  <section class="card danger-card">
    <div class="card-head">${ic('bolt')}<h2>Quête de pénalité</h2></div>
    <p class="small">La quête principale d'hier n'a pas été accomplie. Le Système impose :</p>
    <div class="penalty-grid"><span><b>100</b> squats</span><span><b>50</b> pompes</span><span><b>100</b> crunchs</span><span><b>10</b> min marche</span></div>
    <button class="btn danger block" data-action="penalty-done">Pénalité accomplie · +30 XP</button>
  </section>` : ''}

  ${deloadCard()}

  <section class="card today ${mainDone ? 'is-done' : ''}">
    <div class="today-top">
      <div>
        <p class="eyebrow">Aujourd'hui</p>
        <h2>${esc(plan.kind === 'gym' ? shortName(plan.name) : subName(plan.name))}</h2>
        <p class="muted small">${plan.kind === 'gym'
          ? `${esc(subName(plan.name))} · ${plan.exercises.length} exercices · + ${plan.cardio.minutes} min tapis`
          : esc(plan.cardio.note.split('.')[0])}</p>
      </div>
      <div class="today-icon">${ic(mainDone ? 'check' : plan.kind === 'gym' ? 'dumbbell' : plan.kind === 'rest' ? 'shield' : 'run')}</div>
    </div>
    ${mainDone
      ? '<p class="done-line">' + ic('check') + 'Quête principale accomplie. Le Système est satisfait.</p>'
      : `<button class="btn primary block lg" data-action="fab">${ic('play')}${state.active ? 'Reprendre la séance' : plan.kind === 'gym' ? 'Commencer la séance' : 'Lancer le cardio'}</button>`}
  </section>

  <section class="card">
    <div class="card-head between">
      <div class="row gap"><div class="mini-ring">${ring(qDone / list.length, 40, 5)}<span>${qDone}/${list.length}</span></div><div><h2>Quêtes du jour</h2><p class="muted small">Termine-les toutes : +50 XP bonus</p></div></div>
    </div>
    <ul class="quests">
      ${list.map((q) => `
        <li class="${q.done ? 'done' : ''}">
          ${q.auto
            ? `<span class="qcheck auto">${q.done ? ic('check') : ''}</span>
               <span class="qlabel">${esc(q.label)}${q.id === 'cardio' && !q.done && q.progress ? `<small>${q.progress}/${q.target} min</small>` : ''}</span>
               ${q.done ? '' : `<button class="link-btn" data-action="fab">Go ${ic('chevron')}</button>`}`
            : `<button class="qcheck" data-action="quest" data-id="${q.id}" aria-pressed="${q.done}" aria-label="${esc(q.label)}">${q.done ? ic('check') : ''}</button>
               <span class="qlabel" data-action="quest" data-id="${q.id}">${esc(q.label)}</span>`}
          <span class="xp">+${q.xp}</span>
        </li>`).join('')}
    </ul>
  </section>

  <section class="card">
    <div class="card-head between"><h2>Cette semaine</h2><span class="pill">${wp.done}/${wp.planned} objectifs</span></div>
    <div class="week">
      ${wp.days.map((d) => {
        const past = d.date < t;
        const cls = [d.date === t ? 'today' : '', d.done ? 'done' : '', past && !d.done && d.plan.kind !== 'rest' ? 'missed' : '', "k-" + d.plan.kind].join(' ');
        return `<div class="wday ${cls}"><span>${DAYS_FR[new Date(d.date + 'T12:00:00').getDay()][0]}</span><i>${d.done ? ic('check') : d.plan.kind === 'rest' ? '–' : esc(d.plan.short)}</i></div>`;
      }).join('')}
    </div>
  </section>

  <section class="card">
    <div class="card-head between"><div class="row gap">${ic('target', 'accent')}<h2>Objectif poids</h2></div><button class="link-btn" data-action="weigh">${ic('plus')} Pesée</button></div>
    <div class="goal-nums"><div><span class="lbl">Départ</span><b>${gp.start}</b></div><div class="cur"><span class="lbl">Actuel</span><b>${gp.cur}<small> kg</small></b></div><div><span class="lbl">Objectif</span><b>${gp.goal}</b></div></div>
    <div class="bar lg"><i style="width:${gp.pct}%"></i></div>
    <p class="small muted">${gp.left > 0 ? `Encore <b>${gp.left} kg</b> · ${Math.round(gp.pct)} % du chemin` : 'Objectif atteint. Fixe-toi le suivant dans ton profil.'}</p>
  </section>

  <section class="sys-msg">
    <span class="eyebrow">${ic('info')} Message du Système</span>
    <p>${esc(dailyMessage())}</p>
  </section>`;
}

function deloadCard() {
  if (deloadActive()) return `
  <section class="card deload-card">
    <div class="card-head">${ic('shield')}<h2>Semaine allégée en cours</h2></div>
    <p class="small muted">Mêmes charges, 1/3 de séries en moins, arrête-toi loin de l'échec. Tes séances sont déjà ajustées. Tu reviendras plus fort la semaine prochaine.</p>
  </section>`;
  const adv = deloadAdvice();
  if (!adv || LS.get('sl-deload-snooze', '') >= todayStr()) return '';
  return `
  <section class="card deload-card">
    <div class="card-head">${ic('shield')}<h2>Le Système recommande une semaine allégée</h2></div>
    <p class="small">${esc(adv.text)}</p>
    <p class="small muted">7 jours : mêmes charges, 1/3 de séries en moins. Le cardio et la nutrition ne changent pas.</p>
    <div class="row gap mt"><button class="btn primary grow" data-action="deload-start">Lancer la semaine allégée</button><button class="btn ghost" data-action="deload-snooze">Plus tard</button></div>
  </section>`;
}

// ======================= Entraînement =======================
function viewTrain() {
  if (state.active) return viewWorkout();
  return `
  <header class="page-head"><h1>Entraînement</h1></header>
  <div class="segmented" role="tablist">
    <button role="tab" aria-selected="${ui.trainTab === 'muscu'}" data-action="train-tab" data-tab="muscu">${ic('dumbbell')}Musculation</button>
    <button role="tab" aria-selected="${ui.trainTab === 'cardio'}" data-action="train-tab" data-tab="cardio">${ic('run')}Cardio</button>
  </div>
  ${ui.trainTab === 'cardio' ? viewCardio() : viewMuscu()}`;
}

function viewMuscu() {
  const plan = planForDate(todayStr());
  const gymDays = state.program.days.filter((d) => d.kind === 'gym');
  const recent = state.workouts.filter((w) => w.endedAt).sort((x, y) => y.endedAt - x.endedAt).slice(0, 4);
  return `
  ${gymDays.map((d) => {
    const last = state.workouts.filter((w) => w.endedAt && w.dayId === d.id).sort((a, b) => b.endedAt - a.endedAt)[0];
    return `
    <section class="card session ${d.id === plan.id ? 'planned' : ''}">
      <div class="session-top">
        <div class="session-badge">${esc(d.short)}</div>
        <div class="grow">
          <h2>${esc(subName(d.name))}</h2>
          <p class="muted small">${d.exercises.length} exercices · ${d.exercises.reduce((a, e) => a + e.sets, 0)} séries${last ? ` · dernière : ${fmtShort(last.date)}` : ''}</p>
        </div>
        ${d.id === plan.id ? '<span class="pill accent">Aujourd\'hui</span>' : ''}
      </div>
      <p class="session-ex">${d.exercises.map((e) => esc(e.name)).join(' · ')}</p>
      <button class="btn ${d.id === plan.id ? 'primary' : 'secondary'} block" data-action="start-workout" data-day="${d.id}">${ic('play')}Démarrer</button>
    </section>`;
  }).join('')}
  <section class="card">
    <div class="card-head between"><h2>Dernières séances</h2><a class="link-btn" href="#/stats" data-action="stats-history">Tout voir ${ic('chevron')}</a></div>
    ${recent.length ? recent.map(workoutSummary).join('') : emptyState('dumbbell', 'Aucune séance', 'Ta première séance débloquera le titre « Le Premier Pas ».')}
  </section>`;
}

const emptyState = (icon, title, text) => `<div class="empty">${ic(icon)}<b>${esc(title)}</b><span>${esc(text)}</span></div>`;

function startWorkout(dayId) {
  const day = dayById(dayId);
  if (!day || day.kind !== 'gym') return;
  const deload = deloadActive();
  state.active = {
    id: uid(), date: todayStr(), dayId, name: day.name, startedAt: Date.now(), deload,
    exercises: day.exercises.map((e) => {
      const s = suggestion(e);
      const prev = exerciseHistory(e.id)[0];
      // semaine allégée : même charge que la dernière fois, 1/3 de séries en moins
      if (deload && s.up) { s.w = +(s.w - e.inc).toFixed(2); s.up = false; }
      const nSets = deload ? Math.max(1, Math.round((e.sets * 2) / 3)) : e.sets;
      return {
        exId: e.id, name: e.name, tip: e.tip, sug: deload ? "Semaine allégée : même charge, moins de séries, arrête-toi 3 reps avant l'échec." : s.msg,
        up: !!s.up, inc: e.inc, ss: e.ss || null, rir: deload ? '' : e.rir || '',
        prev: prev ? prev.ex.sets.filter((x) => x.done).map((x) => [x.w, x.r]) : [],
        target: { sets: nSets, repMin: e.repMin, repMax: e.repMax, rest: e.rest },
        sets: Array.from({ length: nSets }, () => ({ w: s.w, r: s.r, done: false })),
      };
    }),
  };
  ui.openEx = null;
  save();
  keepAwake(true);
  haptic(30);
  if (location.hash !== '#/train') location.hash = '#/train'; else render();
}

function partnerIdx(a, ei) {
  const ss = a.exercises[ei].ss;
  if (!ss) return null;
  const j = a.exercises.findIndex((e, k) => k !== ei && e.ss === ss);
  return j === -1 ? null : j;
}

function currentExIndex() {
  const a = state.active;
  if (ui.openEx != null && a.exercises[ui.openEx]) return ui.openEx;
  const i = a.exercises.findIndex((e) => e.sets.some((s) => !s.done));
  return i === -1 ? a.exercises.length - 1 : i;
}

function viewWorkout() {
  const a = state.active;
  const doneSets = a.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done).length, 0);
  const totalSets = a.exercises.reduce((t, e) => t + e.sets.length, 0);
  const cur = currentExIndex();
  const vol = workoutVolume(a);
  return `
  <header class="wk-head">
    <button class="icon-btn" data-action="cancel-workout" aria-label="Abandonner">${ic('x')}</button>
    <div class="wk-title"><b>${esc(shortName(a.name))}</b><span id="elapsed" class="mono">${mmss((Date.now() - a.startedAt) / 1000)}</span></div>
    <button class="btn primary sm" data-action="finish-workout">Terminer</button>
    <div class="wk-progress"><i style="width:${(100 * doneSets) / totalSets}%"></i></div>
  </header>
  <div class="wk-stats"><span><b>${doneSets}</b>/${totalSets} séries</span><span><b>${kg(vol)}</b> kg</span><span><b>${a.exercises.filter((e) => e.sets.every((s) => s.done)).length}</b>/${a.exercises.length} exos</span></div>

  ${a.exercises.map((ex, ei) => {
    const open = ei === cur;
    const nDone = ex.sets.filter((s) => s.done).length;
    const complete = nDone === ex.sets.length;
    const si = ex.sets.findIndex((s) => !s.done);
    const pi = partnerIdx(a, ei);
    const partner = pi != null ? a.exercises[pi] : null;
    return `
    ${partner && pi > ei ? `<div class="ss-label">${ic('bolt')}Superset · enchaîne les 2 exercices, repos après le 2e</div>` : ''}
    <section class="ex-card ${partner ? 'in-ss' : ''} ${partner && pi > ei ? 'ss-first' : ''} ${partner && pi < ei ? 'ss-second' : ''} ${open ? 'open' : ''} ${complete ? 'complete' : ''}">
      <button class="ex-head" data-action="open-ex" data-ei="${ei}" aria-expanded="${open}">
        <span class="ex-num">${complete ? ic('check') : ei + 1}</span>
        <span class="grow"><b>${esc(ex.name)}</b><small>${ex.target.sets} × ${ex.target.repMin}–${ex.target.repMax} · ${partner && pi > ei ? `puis ${esc(partner.name.split(' ')[0])}…` : `repos ${mmss(ex.target.rest)}`}</small></span>
        <span class="ex-count">${nDone}/${ex.sets.length}</span>
      </button>
      ${open ? `
      <div class="ex-body">
        <div class="hint ${ex.up ? 'up' : ''}">${ic(ex.up ? 'up' : 'info')}<span>${esc(ex.sug)}${ex.tip ? `<br><small class="muted">${esc(ex.tip)}</small>` : ''}</span></div>
        ${ex.rir ? `<div class="hint effort">${ic('target')}<span>${esc(ex.rir)}</span></div>` : ''}
        <div class="sets">
          <div class="set head"><span>Série</span><span>Précédent</span><span>kg</span><span>Reps</span><span></span></div>
          ${ex.sets.map((s, k) => `
          <div class="set ${s.done ? 'done' : ''} ${k === si ? 'current' : ''}">
            <span class="set-n">${k + 1}</span>
            <button class="prev" data-action="use-prev" data-ei="${ei}" data-si="${k}" ${ex.prev[k] ? '' : 'disabled'}>${ex.prev[k] ? `${ex.prev[k][0]}×${ex.prev[k][1]}` : '—'}</button>
            <input type="number" inputmode="decimal" step="0.25" min="0" value="${esc(num(s.w))}" placeholder="0" data-action="set-field" data-ei="${ei}" data-si="${k}" data-f="w" aria-label="Charge série ${k + 1}">
            <input type="number" inputmode="numeric" min="0" value="${esc(num(s.r))}" placeholder="${ex.target.repMin}" data-action="set-field" data-ei="${ei}" data-si="${k}" data-f="r" aria-label="Reps série ${k + 1}">
            <button class="check ${s.done ? 'on' : ''}" data-action="set-done" data-ei="${ei}" data-si="${k}" aria-label="Valider la série ${k + 1}">${ic('check')}</button>
          </div>`).join('')}
        </div>
        <div class="row between">
          <button class="link-btn" data-action="add-set" data-ei="${ei}">${ic('plus')} Série</button>
          ${ex.sets.length > 1 ? `<button class="link-btn muted" data-action="del-set" data-ei="${ei}">${ic('minus')} Retirer</button>` : ''}
          <button class="link-btn" data-action="ex-history" data-ex="${ex.exId}">${ic('history')} Historique</button>
        </div>
        ${si !== -1 ? `
        <div class="quick">
          <div class="stepper"><button data-action="step" data-ei="${ei}" data-f="w" data-d="-${ex.inc || 1}" aria-label="Moins de charge">${ic('minus')}</button><div><b>${num(ex.sets[si].w) || 0}</b><span>kg</span></div><button data-action="step" data-ei="${ei}" data-f="w" data-d="${ex.inc || 1}" aria-label="Plus de charge">${ic('plus')}</button></div>
          <div class="stepper"><button data-action="step" data-ei="${ei}" data-f="r" data-d="-1" aria-label="Moins de reps">${ic('minus')}</button><div><b>${num(ex.sets[si].r) || ex.target.repMin}</b><span>reps</span></div><button data-action="step" data-ei="${ei}" data-f="r" data-d="1" aria-label="Plus de reps">${ic('plus')}</button></div>
          <button class="btn primary block lg" data-action="set-done" data-ei="${ei}" data-si="${si}">${ic('check')}Valider la série ${si + 1}</button>
        </div>` : `<button class="btn secondary block" data-action="next-ex" data-ei="${ei}">Exercice suivant ${ic('chevron')}</button>`}
      </div>` : ''}
    </section>`;
  }).join('')}
  <button class="btn primary block lg mt" data-action="finish-workout">${ic('check')}Terminer la séance</button>`;
}

function workoutSummary(w) {
  const open = ui.openWorkout === w.id;
  const sets = w.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done).length, 0);
  const dur = w.endedAt ? Math.round((w.endedAt - w.startedAt) / 60000) : 0;
  const prs = prsInWorkout(w).length;
  return `<div class="hist ${open ? 'open' : ''}">
    <button class="hist-head" data-action="toggle-workout" data-id="${w.id}" aria-expanded="${open}">
      <span class="session-badge sm">${esc(dayById(w.dayId)?.short || '•')}</span>
      <span class="grow"><b>${esc(subName(w.name))}</b><small>${fmtDay(w.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${dur} min · ${sets} séries · ${kg(workoutVolume(w))} kg</small></span>
      ${prs ? `<span class="pill gold">${ic('trophy')}${prs}</span>` : ''}
      ${ic(open ? 'chevron-down' : 'chevron', 'muted')}
    </button>
    ${open ? `<div class="hist-body">
      ${w.exercises.map((e) => `<div class="list-row sm"><span class="grow">${esc(e.name)}</span><span class="muted mono">${e.sets.filter((s) => s.done).map((s) => `${num(s.w)}×${s.r}`).join('  ') || '—'}</span></div>`).join('')}
      <button class="link-btn danger" data-action="del-workout" data-id="${w.id}">${ic('trash')} Supprimer</button>
    </div>` : ''}
  </div>`;
}

async function finishWorkout() {
  const a = state.active;
  const done = a.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done).length, 0);
  if (!done) {
    if (await confirmSheet('Aucune série validée', 'Rien ne sera enregistré. Quitter la séance ?', 'Quitter', true)) { state.active = null; save(); keepAwake(false); stopRest(); render(); }
    return;
  }
  const left = a.exercises.reduce((t, e) => t + e.sets.filter((s) => !s.done).length, 0);
  if (left && !(await confirmSheet('Terminer la séance ?', `Il reste ${left} série${left > 1 ? 's' : ''} non validée${left > 1 ? 's' : ''}. Elles ne seront pas comptées.`, 'Terminer'))) return;
  a.endedAt = Date.now();
  const w = clone(a);
  w.exercises.forEach((e) => { delete e.sug; delete e.tip; delete e.up; delete e.prev; delete e.inc; delete e.ss; delete e.rir; e.sets = e.sets.filter((s) => s.done); });
  state.workouts.push(w);
  state.active = null;
  save({ silent: true });
  stopRest();
  keepAwake(false);
  const prs = prsInWorkout(w);
  const xp = 60 + done * 8 + prs.length * 25;
  const day = dayById(w.dayId);
  const mins = Math.round((w.endedAt - w.startedAt) / 60000);
  systemPopup('Donjon terminé', `
    <p class="reward-xp">+<b data-count="${xp}">0</b> XP</p>
    <div class="reward-grid">
      <div><b>${mins}</b><span>minutes</span></div>
      <div><b>${done}</b><span>séries</span></div>
      <div><b>${kg(workoutVolume(w))}</b><span>kg soulevés</span></div>
    </div>
    ${prs.length ? `<div class="reward-prs">${ic('trophy')}<span><b>${prs.length} nouveau${prs.length > 1 ? 'x' : ''} record${prs.length > 1 ? 's' : ''}</b><br><small>${prs.map(esc).join(', ')}</small></span></div>` : ''}
    ${day?.cardio ? `<p class="muted small">Dernière étape : ${day.cardio.minutes} min de tapis incliné.</p>` : ''}`, '', day?.cardio ? 'Passer au cardio' : 'Continuer');
  if (day?.cardio) { ui.cardioPrefill = { type: 'tapis', minutes: day.cardio.minutes, incline: 12, speed: 5.2 }; ui.trainTab = 'cardio'; }
  route = day?.cardio ? 'train' : 'home';
  if (location.hash !== '#/' + route) location.hash = '#/' + route; else render();
}

// ======================= Cardio =======================
const CT_KEY = 'sl-cardio-timer';
let cardioTick = null;
function cardioTimer() { return LS.get(CT_KEY, { start: 0, acc: 0, running: false }); }
function cardioElapsed(t = cardioTimer()) { return t.acc + (t.running ? (Date.now() - t.start) / 1000 : 0); }
function cardioTarget() {
  const plan = planForDate(todayStr());
  return (ui.cardioPrefill?.minutes || plan.cardio?.minutes || 30) * 60;
}
function tickCardio() {
  clearInterval(cardioTick);
  if (!$('#ctimer')) return;
  const upd = () => {
    const el = $('#ctimer');
    if (!el) { clearInterval(cardioTick); return; }
    const e = cardioElapsed();
    el.textContent = `${Math.floor(e / 3600) ? Math.floor(e / 3600) + ':' : ''}${mmss(e % 3600)}`;
    const bar = $('#cring .ring-bar');
    if (bar) { const c = +bar.getAttribute('stroke-dasharray'); bar.setAttribute('stroke-dashoffset', c * (1 - Math.min(1, e / cardioTarget()))); }
  };
  upd();
  if (cardioTimer().running) cardioTick = setInterval(upd, 500);
}

function viewCardio() {
  const t = todayStr();
  const plan = planForDate(t);
  const pre = ui.cardioPrefill || {};
  const tm = cardioTimer();
  const defType = pre.type || (plan.kind === 'gym' ? 'tapis' : plan.id === 'HIIT' ? 'intervalles' : 'marche');
  const recent = [...state.cardio].sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1)).slice(0, 8);
  const weekMin = state.cardio.filter((c) => c.date >= mondayOf(t)).reduce((a, c) => a + (+c.minutes || 0), 0);
  const tgt = Math.round(cardioTarget() / 60);
  return `
  <section class="card center-card">
    ${plan.cardio ? `<p class="eyebrow">Prévu aujourd'hui · ${plan.cardio.minutes} min</p><p class="small muted">${esc(plan.cardio.note)}</p>` : ''}
    <div class="timer-wrap" id="cring">
      ${ring(cardioElapsed(tm) / cardioTarget(), 220, 10, 'grad')}
      <div class="timer-in"><b id="ctimer" class="mono">0:00</b><span class="muted small">objectif ${tgt} min</span></div>
    </div>
    <div class="row gap center">
      ${tm.running
        ? `<button class="round-btn" data-action="ct-pause" aria-label="Pause">${ic('pause')}</button>`
        : `<button class="round-btn primary" data-action="ct-start" aria-label="Démarrer">${ic('play')}</button>`}
      ${tm.acc || tm.running ? `<button class="round-btn" data-action="ct-stop" aria-label="Arrêter et enregistrer">${ic('stop')}</button>` : ''}
    </div>
    ${tm.acc || tm.running ? '<button class="link-btn muted" data-action="ct-reset">Remettre à zéro</button>' : ''}
  </section>

  <section class="card">
    <div class="card-head between"><h2>Enregistrer</h2><span class="pill">${weekMin} min cette semaine</span></div>
    <form class="form" data-form="cardio">
      <div class="chips" role="radiogroup" aria-label="Type">
        ${CARDIO_TYPES.map((c) => `<label class="chip"><input type="radio" name="type" value="${c.id}" ${c.id === defType ? 'checked' : ''}><span>${c.label}</span></label>`).join('')}
      </div>
      <div class="grid2">
        <label>Durée (min)<input type="number" name="minutes" inputmode="numeric" min="1" required value="${pre.minutes || ''}"></label>
        <label>Date<input type="date" name="date" value="${t}" max="${t}" required></label>
        <label>Inclinaison (%)<input type="number" name="incline" inputmode="decimal" step="0.5" min="0" value="${pre.incline ?? ''}"></label>
        <label>Vitesse (km/h)<input type="number" name="speed" inputmode="decimal" step="0.1" min="0" value="${pre.speed ?? ''}"></label>
        <label>Distance (km)<input type="number" name="km" inputmode="decimal" step="0.01" min="0" value="${pre.km || ''}"></label>
        <label>Ressenti<input type="text" name="note" placeholder="facile, dur…"></label>
      </div>
      <button class="btn primary block lg" type="submit">${ic('check')}Valider le cardio</button>
    </form>
  </section>

  <section class="card">
    <h2>Historique</h2>
    ${recent.length ? recent.map((c) => `
      <div class="list-row">
        <span class="row-icon">${ic('run')}</span>
        <span class="grow"><b>${esc((CARDIO_TYPES.find((x) => x.id === c.type) || {}).label || c.type)}</b>
        <small>${fmtShort(c.date)} · ${c.minutes} min${c.km ? ` · ${c.km} km` : ''}${c.incline ? ` · ${c.incline} %` : ''}${c.speed ? ` · ${c.speed} km/h` : ''}${c.note ? ` · ${esc(c.note)}` : ''}</small></span>
        <button class="icon-btn muted" data-action="del-cardio" data-id="${c.id}" aria-label="Supprimer">${ic('trash')}</button>
      </div>`).join('') : emptyState('run', 'Aucun cardio', 'Chaque minute te rapporte 1,5 XP et augmente END.')}
  </section>`;
}

// ======================= Progrès =======================
function viewStats() {
  const tabs = [['overview', 'Aperçu'], ['strength', 'Force'], ['history', 'Historique']];
  return `
  <header class="page-head"><h1>Progrès</h1></header>
  <div class="segmented" role="tablist">
    ${tabs.map(([id, l]) => `<button role="tab" aria-selected="${ui.statsTab === id}" data-action="stats-tab" data-tab="${id}">${l}</button>`).join('')}
  </div>
  ${ui.statsTab === 'strength' ? statsStrength() : ui.statsTab === 'history' ? statsHistory() : statsOverview()}`;
}

function statsOverview() {
  const t = todayStr();
  const done = state.workouts.filter((w) => w.endedAt);
  const monthW = done.filter((w) => w.date.slice(0, 7) === t.slice(0, 7)).length;
  const weekCardio = state.cardio.filter((c) => c.date >= mondayOf(t)).reduce((a, c) => a + (+c.minutes || 0), 0);
  const weights = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const gp = goalProgress();
  const rate = weightRate(weights);
  const st = hunterStats();
  return `
  <section class="tiles">
    <div class="tile"><span class="lbl">${ic('scale')}Poids</span><b>${gp.cur}<small>kg</small></b><span class="delta ${gp.cur <= gp.start ? 'up' : 'down'}">${gp.cur - gp.start > 0 ? '+' : ''}${(gp.cur - gp.start).toFixed(1)} kg</span></div>
    <div class="tile"><span class="lbl">${ic('dumbbell')}Séances</span><b>${monthW}</b><span class="delta muted">ce mois</span></div>
    <div class="tile"><span class="lbl">${ic('run')}Cardio</span><b>${weekCardio}<small>min</small></b><span class="delta muted">cette semaine</span></div>
    <div class="tile"><span class="lbl">${ic('flame')}Série</span><b>${streak().current}<small>j</small></b><span class="delta muted">record ${streak().best} j</span></div>
  </section>

  <section class="card">
    <div class="card-head between"><h2>Poids de corps</h2><button class="link-btn" data-action="weigh">${ic('plus')} Pesée</button></div>
    ${rate != null ? `<p class="small ${rate <= 0 ? 'up' : 'down'}">${rate > 0 ? '+' : ''}${rate.toFixed(2)} kg / semaine ${rateComment(rate, gp.cur)}</p>` : '<p class="small muted">Pèse-toi le matin à jeun, 3 à 7 fois par semaine, pour une tendance fiable.</p>'}
    <div id="ch-weight"></div>
  </section>

  <section class="card">
    <h2>Statistiques du Joueur</h2>
    <div class="attrs">
      ${[['FOR', 'Force', 'dumbbell'], ['END', 'Endurance', 'run'], ['AGI', 'Agilité', 'bolt'], ['VIT', 'Vitalité', 'shield']].map(([k, l, i]) => `
        <div class="attr"><span class="attr-ic">${ic(i)}</span><span class="grow"><b>${l}</b><div class="bar sm"><i style="width:${Math.min(100, st[k])}%"></i></div></span><b class="attr-v">${st[k]}</b></div>`).join('')}
    </div>
  </section>

  <section class="card"><h2>Cardio par semaine</h2><div id="ch-cardio"></div><p class="small muted">Repère : 150 à 250 min/semaine pour une perte de gras efficace.</p></section>
  <section class="card"><h2>Assiduité</h2><div id="ch-heat"></div></section>`;
}

function statsStrength() {
  const prs = personalRecords();
  const exIds = Object.keys(prs);
  if (!ui.statsEx || !prs[ui.statsEx]) ui.statsEx = exIds[0] || null;
  return `
  <section class="card">
    <h2>Force estimée (1RM)</h2>
    ${exIds.length ? `<select data-action="stats-ex" aria-label="Exercice">${exIds.map((id) => `<option value="${id}" ${id === ui.statsEx ? 'selected' : ''}>${esc(prs[id].name)}</option>`).join('')}</select>` : ''}
    <div id="ch-e1rm"></div>
    <p class="small muted">La charge max que tu pourrais soulever une fois, estimée depuis tes séries. Garder ta force en sèche = garder ton muscle.</p>
  </section>
  <section class="card"><h2>Volume soulevé par semaine</h2><div id="ch-volume"></div></section>
  <section class="card">
    <div class="card-head between"><h2>Records personnels</h2><span class="pill gold">${ic('trophy')}${exIds.length}</span></div>
    ${exIds.length ? exIds.map((id) => `
      <div class="list-row"><span class="grow"><b>${esc(prs[id].name)}</b><small>${num(prs[id].w)} kg × ${prs[id].r} · ${fmtShort(prs[id].date)}</small></span><span class="pr-val">${Math.round(prs[id].e1rm)}<small> kg</small></span></div>`).join('')
    : emptyState('trophy', 'Aucun record', 'Termine une séance pour débloquer tes records.')}
  </section>`;
}

function statsHistory() {
  const done = state.workouts.filter((w) => w.endedAt).sort((a, b) => b.endedAt - a.endedAt);
  const weights = [...state.weights].sort((a, b) => b.date.localeCompare(a.date));
  return `
  <section class="card">
    <h2>Séances</h2>
    ${done.length ? done.map(workoutSummary).join('') : emptyState('dumbbell', 'Aucune séance', 'Elles apparaîtront ici.')}
  </section>
  <section class="card">
    <div class="card-head between"><h2>Pesées</h2><button class="link-btn" data-action="weigh">${ic('plus')} Pesée</button></div>
    ${weights.length ? weights.slice(0, 30).map((w) => `<div class="list-row"><span class="grow">${fmtDay(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><b>${w.kg} kg</b><button class="icon-btn muted" data-action="del-weight" data-id="${w.id}" aria-label="Supprimer">${ic('trash')}</button></div>`).join('') : emptyState('scale', 'Aucune pesée', 'Ajoute ton poids pour suivre ta tendance.')}
  </section>`;
}

function weightRate(weights) {
  const t = todayStr();
  const recent = weights.filter((w) => w.date >= addDays(t, -28));
  if (recent.length < 3) return null;
  const xs = recent.map((w) => (new Date(w.date) - new Date(recent[0].date)) / 864e5);
  const ys = recent.map((w) => +w.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const nu = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return den ? (nu / den) * 7 : null;
}
function rateComment(rate, w) {
  const pct = (-rate / w) * 100;
  if (rate > 0.1) return '· tu reprends, réduis un peu les calories.';
  if (pct < 0.3) return '· un peu lent : retire ~150 kcal ou ajoute du cardio.';
  if (pct > 1.2) return '· trop rapide : mange un peu plus pour garder ton muscle.';
  return '· rythme idéal.';
}

function drawStats() {
  const t = todayStr();
  const weeks = [];
  for (let i = 9; i >= 0; i--) { const start = addDays(mondayOf(t), -7 * i); weeks.push({ start, end: addDays(start, 6), label: fmtShort(start) }); }
  const cw = $('#ch-weight');
  if (cw) {
    const ser = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => ({ date: w.date, y: +w.kg }));
    const avg = ser.map((p, i) => { const win = ser.slice(Math.max(0, i - 6), i + 1); return { date: p.date, y: +(win.reduce((a, b) => a + b.y, 0) / win.length).toFixed(1) }; });
    lineChart(cw, ser, { unit: ' kg', avg, label: 'Pesée', avgLabel: 'Moyenne 7 pesées' });
  }
  const ce = $('#ch-e1rm');
  if (ce) {
    if (ui.statsEx) lineChart(ce, exerciseHistory(ui.statsEx).reverse().map((h) => ({ date: h.date, y: Math.round(Math.max(...h.ex.sets.filter((s) => s.done).map((s) => e1rm(+s.w, +s.r)))) })), { unit: ' kg', label: '1RM estimé' });
    else ce.innerHTML = '<p class="chart-empty">Pas encore de données.</p>';
  }
  const cv = $('#ch-volume');
  if (cv) barChart(cv, weeks.map((w) => ({ label: w.label, title: `Semaine du ${w.label}`, value: state.workouts.filter((x) => x.endedAt && x.date >= w.start && x.date <= w.end).reduce((a, x) => a + workoutVolume(x), 0) })), { unit: ' kg', label: 'Volume par semaine' });
  const cc = $('#ch-cardio');
  if (cc) barChart(cc, weeks.map((w) => ({ label: w.label, title: `Semaine du ${w.label}`, value: state.cardio.filter((x) => x.date >= w.start && x.date <= w.end).reduce((a, x) => a + (+x.minutes || 0), 0) })), { unit: ' min', label: 'Cardio par semaine' });
  const ch = $('#ch-heat');
  if (ch) {
    const lv = {};
    for (const c of state.cardio) lv[c.date] = Math.max(lv[c.date] || 0, 1);
    for (const d of Object.keys(state.quests)) if (Object.values(state.quests[d]).some(Boolean)) lv[d] = Math.max(lv[d] || 0, 1);
    for (const w of state.workouts) if (w.endedAt) lv[w.date] = Math.max(lv[w.date] || 0, 2);
    for (const d of Object.keys(lv)) if (dayComplete(d)) lv[d] = 3;
    heatmap(ch, lv);
  }
}

// ======================= Profil =======================
function viewProfile() {
  const li = levelInfo();
  const titles = titleProgress();
  const nUnlocked = titles.filter((x) => x.unlocked).length;
  const title = titles.find((x) => x.id === state.profile.title && x.unlocked) || [...titles].reverse().find((x) => x.unlocked);
  const { status, user } = sync.syncStatus();
  const syncTxt = { off: 'Désactivée', idle: 'Synchronisé', syncing: 'En cours…', error: 'Erreur', offline: 'Hors ligne' }[status];
  const row = (action, icon, label, value = '', extra = '') => `<button class="list-row tap" data-action="${action}" ${extra}><span class="row-icon">${ic(icon)}</span><span class="grow">${label}</span><span class="muted small">${value}</span>${ic('chevron', 'muted')}</button>`;
  return `
  <header class="page-head"><h1>Profil</h1></header>
  <section class="card profile-card">
    <div class="avatar xl" style="--rc:${li.rank.color}">${li.rank.id}</div>
    <div class="grow">
      <h2>${esc(state.profile.name)}</h2>
      <p class="muted small">Niveau ${li.level} · ${li.rank.title}</p>
      ${title ? `<p class="hero-title">« ${esc(title.name)} »</p>` : ''}
    </div>
  </section>
  <section class="card list">
    ${row('go-titles', 'trophy', 'Titres', `${nUnlocked}/${titles.length}`)}
    ${row('sheet-profile', 'user', 'Mon profil', `${currentWeight()} kg`)}
    ${row('sheet-nutrition', 'food', 'Nutrition', `${nutrition().target} kcal`)}
    ${row('sheet-program', 'calendar', 'Programme', '3 salle + 3 cardio')}
  </section>
  <section class="card list">
    ${row('sheet-sync', 'cloud', 'Synchronisation', user ? syncTxt : 'Désactivée')}
    ${row('sheet-data', 'database', 'Sauvegarde', 'Export / import')}
    ${row('sheet-install', 'download', 'Installer l\'app')}
  </section>
  <section class="card list">
    <button class="list-row tap danger" data-action="reset"><span class="row-icon">${ic('trash')}</span><span class="grow">Effacer les données de cet appareil</span></button>
  </section>
  <p class="center muted small">Le Système · v2</p>`;
}

function viewTitles() {
  const titles = titleProgress();
  const equipped = state.profile.title;
  return `
  <header class="page-head"><a class="icon-btn" href="#/profile" aria-label="Retour">${ic('back')}</a><h1>Titres</h1><span></span></header>
  <p class="muted small">Accomplis des exploits pour obtenir des titres. Équipe ton préféré : il s'affiche sur ton profil.</p>
  <div class="titles">
    ${titles.map((t) => `
    <div class="title-card ${t.unlocked ? 'unlocked' : ''} ${equipped === t.id ? 'equipped' : ''}">
      <div class="title-badge">${ic(t.unlocked ? t.icon : 'lock')}</div>
      <b>${esc(t.name)}</b>
      <small class="muted">${esc(t.desc)}</small>
      ${t.unlocked
        ? `<button class="link-btn" data-action="equip-title" data-id="${t.id}">${equipped === t.id ? ic('check') + ' Équipé' : 'Équiper'}</button>`
        : `<div class="bar sm"><i style="width:${t.pct}%"></i></div><small class="muted">${Math.floor(Math.min(t.value, t.target))} / ${t.target}</small>`}
    </div>`).join('')}
  </div>`;
}

// ---------- Sheets du profil ----------
function sheetProfile() {
  const p = state.profile;
  openSheet('Mon profil', `
    <form class="form" data-form="profile">
      <label>Prénom<input name="name" value="${esc(p.name)}" maxlength="24"></label>
      <div class="grid2">
        <label>Âge<input type="number" inputmode="numeric" name="age" value="${p.age}" min="10" max="99"></label>
        <label>Sexe<select name="sex"><option value="h" ${p.sex !== 'f' ? 'selected' : ''}>Homme</option><option value="f" ${p.sex === 'f' ? 'selected' : ''}>Femme</option></select></label>
        <label>Taille (cm)<input type="number" inputmode="numeric" name="height" value="${p.height}" min="100" max="250"></label>
        <label>Poids de départ (kg)<input type="number" inputmode="decimal" name="weight" step="0.1" value="${p.weight}"></label>
        <label>Poids visé (kg)<input type="number" inputmode="decimal" name="goalWeight" step="0.1" value="${p.goalWeight}"></label>
        <label>Activité<select name="activity">
          ${[[1.4, 'Faible'], [1.55, 'Modérée'], [1.7, 'Élevée']].map(([v, l]) => `<option value="${v}" ${+p.activity === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      </div>
      <button class="btn primary block lg" type="submit">Enregistrer</button>
    </form>`);
}

function sheetNutrition() {
  const n = nutrition();
  openSheet('Nutrition', `
    <div class="macro-hero"><span class="lbl">Objectif quotidien</span><b>${n.target}</b><span class="muted">kcal</span></div>
    <div class="macros">
      ${[['Protéines', n.protein, 4], ['Glucides', n.carbs, 4], ['Lipides', n.fat, 9]].map(([l, g, k]) => `
        <div class="macro"><span class="lbl">${l}</span><b>${g}<small>g</small></b><div class="bar sm"><i style="width:${Math.round((g * k * 100) / n.target)}%"></i></div><small class="muted">${Math.round((g * k * 100) / n.target)} %</small></div>`).join('')}
    </div>
    <p class="small muted">Maintien estimé : ${n.tdee} kcal. Déficit d'environ 550 kcal, soit 0,5 à 0,8 kg perdu par semaine. Recalculé automatiquement quand ton poids baisse.</p>
    <details class="faq"><summary>Le gras des pecs, la vérité</summary>
      <p class="small">On ne peut pas brûler le gras d'une zone précise : les pompes n'enlèvent pas le gras des pecs. Le gras part partout, et la poitrine fait souvent partie des dernières zones chez les hommes. Ce qui marche : un déficit régulier + des pecs plus développés (le programme les travaille à chaque séance). Si tu sens une petite masse dure sous le téton qui ne bouge pas malgré la perte de poids, parles-en à un médecin : c'est fréquent et ça se traite.</p>
    </details>
    <details class="faq"><summary>Repères simples</summary>
      <ul class="small"><li>Une source de protéines à chaque repas : poulet, œufs, thon, skyr, steak 5 %, lentilles.</li><li>Légumes à volonté pour le volume et la satiété.</li><li>Les boissons sucrées et le fast-food sont les premiers à couper.</li><li>8 h de sommeil = moins de fringales.</li></ul>
    </details>`);
}

function sheetProgram() {
  openSheet('Programme', `
    <p class="small muted">Choisis ce que tu fais chaque jour, puis touche une séance pour modifier ses exercices.</p>
    <div class="weekplan">
      ${[1, 2, 3, 4, 5, 6, 0].map((wd) => `<label><span>${DAYS_FR[wd]}</span><select data-action="week-day" data-wd="${wd}">${state.program.days.map((d) => `<option value="${d.id}" ${state.program.week[wd] === d.id ? 'selected' : ''}>${esc(subName(d.name))}</option>`).join('')}</select></label>`).join('')}
    </div>
    <h3 class="mt">Séances</h3>
    <div class="list">
      ${state.program.days.filter((d) => d.kind === 'gym').map((d) => `<button class="list-row tap" data-action="sheet-day" data-day="${d.id}"><span class="session-badge sm">${esc(d.short)}</span><span class="grow">${esc(subName(d.name))}<small>${d.exercises.length} exercices</small></span>${ic('chevron', 'muted')}</button>`).join('')}
    </div>
    <button class="link-btn muted mt" data-action="prog-reset">${ic('sync')} Remettre le programme d'origine</button>`, { wide: true });
}

function sheetDay(dayId) {
  const d = dayById(dayId);
  openSheet(subName(d.name), `
    ${d.exercises.map((e, i) => `
    <div class="prog-ex">
      <div class="row gap"><input class="grow" value="${esc(e.name)}" data-action="prog-ex" data-day="${d.id}" data-i="${i}" data-f="name" aria-label="Nom de l'exercice">
        <button class="icon-btn muted" data-action="prog-move" data-day="${d.id}" data-i="${i}" data-dir="-1" aria-label="Monter">${ic('up')}</button>
        <button class="icon-btn muted" data-action="prog-move" data-day="${d.id}" data-i="${i}" data-dir="1" aria-label="Descendre">${ic('down')}</button>
        <button class="icon-btn muted" data-action="prog-del" data-day="${d.id}" data-i="${i}" aria-label="Supprimer">${ic('trash')}</button></div>
      <div class="grid5">
        ${[['sets', 'Séries', 1], ['repMin', 'Reps min', 1], ['repMax', 'Reps max', 1], ['rest', 'Repos s', 15], ['inc', '+kg', 0.25]].map(([f, l, st]) => `<label>${l}<input type="number" inputmode="decimal" min="0" step="${st}" value="${e[f]}" data-action="prog-ex" data-day="${d.id}" data-i="${i}" data-f="${f}"></label>`).join('')}
      </div>
    </div>`).join('')}
    <button class="btn secondary block" data-action="prog-add" data-day="${d.id}">${ic('plus')}Ajouter un exercice</button>
    <button class="link-btn mt" data-action="sheet-program">${ic('back')} Retour au programme</button>`, { wide: true });
}

function sheetSync() {
  const cfg = sync.getConfig();
  const { status, user } = sync.syncStatus();
  const statusTxt = { off: 'Non connecté', idle: 'Synchronisé', syncing: 'Synchronisation…', error: 'Erreur de synchro', offline: 'Hors ligne : synchro au retour du réseau' }[status];
  openSheet('Synchronisation', `
    <div class="sync-state s-${status}">${ic('cloud')}<span><b>${statusTxt}</b>${user ? `<br><small>${esc(user.email)}</small>` : ''}</span></div>
    ${user ? `<div class="stack mt"><button class="btn secondary block" data-action="sync-now">${ic('sync')}Synchroniser maintenant</button><button class="btn ghost block" data-action="sync-out">Se déconnecter</button></div>`
    : cfg ? `
      <form class="form mt" data-form="auth">
        <label>Email<input type="email" name="email" autocomplete="email" required></label>
        <label>Mot de passe<input type="password" name="password" autocomplete="current-password" minlength="6" required></label>
        <button class="btn primary block" type="submit" name="mode" value="in">Se connecter</button>
        <button class="btn secondary block" type="submit" name="mode" value="up">Créer mon compte</button>
      </form>
      <button class="link-btn muted mt" data-action="sync-cfg-clear">Changer de projet Supabase</button>`
    : `
      <p class="small muted mt">Retrouve tes données sur ton téléphone et ton PC. Crée un projet gratuit sur supabase.com, exécute le fichier <code>supabase.sql</code>, puis colle l'URL et la clé « anon public » (Project Settings → API). Détails dans le README.</p>
      <form class="form" data-form="sync-cfg">
        <label>Project URL<input name="url" placeholder="https://xxxx.supabase.co" required></label>
        <label>Clé anon public<input name="key" required></label>
        <button class="btn primary block" type="submit">Enregistrer</button>
      </form>`}`);
}

function sheetData() {
  openSheet('Sauvegarde', `
    <p class="small muted">Télécharge une copie de toutes tes données, ou restaure une sauvegarde.</p>
    <div class="stack mt">
      <button class="btn secondary block" data-action="export">${ic('download')}Exporter mes données</button>
      <label class="btn secondary block">${ic('upload')}Importer une sauvegarde<input type="file" accept="application/json" data-action="import" hidden></label>
    </div>`);
}

function sheetInstall() {
  openSheet('Installer l\'app', `
    <div class="install"><b>Android (Chrome)</b><p class="small muted">Menu ⋮ en haut à droite → « Installer l'application ».</p></div>
    <div class="install"><b>iPhone (Safari)</b><p class="small muted">Bouton Partager → « Sur l'écran d'accueil ».</p></div>
    <p class="small muted">L'app s'ouvre ensuite en plein écran et fonctionne même sans réseau.</p>`);
}

function sheetWeigh() {
  const cur = currentWeight();
  openSheet('Pesée du jour', `
    <form class="form" data-form="weight">
      <div class="big-stepper">
        <button type="button" data-action="kg-step" data-d="-0.1" aria-label="Moins 100 g">${ic('minus')}</button>
        <input type="number" name="kg" inputmode="decimal" step="0.1" min="30" max="300" value="${cur}" required aria-label="Poids en kg">
        <button type="button" data-action="kg-step" data-d="0.1" aria-label="Plus 100 g">${ic('plus')}</button>
      </div>
      <p class="center muted small">kg · le matin à jeun, après les toilettes</p>
      <button class="btn primary block lg" type="submit">Enregistrer · +5 XP</button>
    </form>`);
}

function fabAction() {
  if (state.active) { location.hash = '#/train'; return; }
  const plan = planForDate(todayStr());
  if (plan.kind === 'gym' && !state.workouts.some((w) => w.date === todayStr() && w.endedAt)) { startWorkout(plan.id); return; }
  ui.trainTab = 'cardio';
  if (location.hash !== '#/train') location.hash = '#/train'; else render();
}

// ======================= Événements =======================
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
  const d = b.dataset;
  const act = {
    fab: fabAction,
    'deload-start': () => { startDeload(); toast(ic('check') + ' Semaine allégée activée'); },
    'deload-snooze': () => { LS.set('sl-deload-snooze', addDays(todayStr(), 3)); render(); },
    'ob-next': () => { obStep = 1; render(); },
    'ob-finish': () => { state.onboarded = true; obStep = 0; save(); LS.set('sl-last-level', levelInfo().level); location.hash = '#/home'; render(); systemPopup('Bienvenue, Joueur', '<p>Ta première quête t\'attend sur l\'accueil.</p><p class="muted small">Astuce : le bouton central lance directement l\'entraînement du jour.</p>'); },
    quest: () => { toggleQuest(todayStr(), d.id); haptic(); },
    'penalty-done': () => { setPenaltyDone(todayStr()); toast(ic('check') + ' Pénalité accomplie · +30 XP'); },
    'train-tab': () => { ui.trainTab = d.tab; render(); },
    'stats-tab': () => { ui.statsTab = d.tab; render(); },
    'stats-history': () => { ui.statsTab = 'history'; },
    'start-workout': async () => {
      if (state.active && !(await confirmSheet('Séance en cours', 'Une séance est déjà en cours. La remplacer ?', 'Remplacer', true))) return;
      startWorkout(d.day);
    },
    'open-ex': () => { ui.openEx = currentExIndex() === +d.ei ? -1 : +d.ei; if (ui.openEx === -1) ui.openEx = null; render(); },
    'next-ex': () => { ui.openEx = Math.min(+d.ei + 1, state.active.exercises.length - 1); render(); },
    'set-done': () => {
      const ex = state.active.exercises[+d.ei], s = ex.sets[+d.si];
      if (!s.done) {
        if (s.w === '' || s.w == null) s.w = 0;
        if (s.r === '' || s.r == null) s.r = ex.target.repMin;
        s.done = true;
        const next = ex.sets[+d.si + 1];
        if (next && !next.done && (next.w === '' || next.w == null)) next.w = s.w;
        const a = state.active, ei = +d.ei, pi = partnerIdx(a, ei);
        const partner = pi != null ? a.exercises[pi] : null;
        const nDone = (e2) => e2.sets.filter((x) => x.done).length;
        const pairRest = partner ? Math.max(ex.target.rest, partner.target.rest) : ex.target.rest;
        if (partner && partner.sets.some((x) => !x.done)) {
          // superset : on bascule sur l'autre exercice
          ui.openEx = pi;
          if (nDone(partner) < nDone(ex) && ex.target.rest <= 20) toast(ic('bolt') + ' Enchaîne : ' + esc(partner.name));
          else startRest(pairRest);
        } else {
          if (ex.sets.every((x) => x.done)) { ui.openEx = null; toast(ic('check') + ' ' + esc(ex.name) + ' terminé'); }
          startRest(pairRest);
        }
        haptic(30);
      } else s.done = false;
      save({ silent: true });
      render();
    },
    step: () => {
      const ex = state.active.exercises[+d.ei];
      const si = ex.sets.findIndex((s) => !s.done);
      if (si < 0) return;
      const s = ex.sets[si];
      const base = d.f === 'w' ? (+s.w || 0) : (+s.r || ex.target.repMin);
      const v = Math.max(0, +(base + +d.d).toFixed(2));
      if (d.f === 'w') { for (let k = si + 1; k < ex.sets.length; k++) if (!ex.sets[k].done && +ex.sets[k].w === +s.w) ex.sets[k].w = v; }
      s[d.f] = v;
      save({ silent: true });
      haptic(8);
      render();
    },
    'use-prev': () => {
      const ex = state.active.exercises[+d.ei], p = ex.prev[+d.si];
      if (!p) return;
      Object.assign(ex.sets[+d.si], { w: p[0], r: p[1] });
      save({ silent: true }); render();
    },
    'add-set': () => { const ex = state.active.exercises[+d.ei]; const last = ex.sets[ex.sets.length - 1] || { w: '', r: '' }; ex.sets.push({ w: last.w, r: last.r, done: false }); save({ silent: true }); render(); },
    'del-set': () => { state.active.exercises[+d.ei].sets.pop(); save({ silent: true }); render(); },
    'finish-workout': finishWorkout,
    'cancel-workout': async () => { if (await confirmSheet('Abandonner la séance ?', 'Rien ne sera enregistré.', 'Abandonner', true)) { state.active = null; save(); stopRest(); keepAwake(false); render(); } },
    'ex-history': () => {
      const h = exerciseHistory(d.ex).slice(0, 6);
      openSheet('Historique', h.length ? h.map((x) => `<div class="list-row"><span class="grow">${fmtDay(x.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span class="mono">${x.ex.sets.filter((s) => s.done).map((s) => `${num(s.w)}×${s.r}`).join('  ')}</span></div>`).join('') : emptyState('history', 'Pas encore d\'historique', 'Il apparaîtra après ta première séance avec cet exercice.'));
    },
    'toggle-workout': () => { ui.openWorkout = ui.openWorkout === d.id ? null : d.id; render(); },
    'del-workout': async () => { if (await confirmSheet('Supprimer cette séance ?', 'Cette action est définitive.', 'Supprimer', true)) removeItem('workouts', d.id); },
    'del-cardio': async () => { if (await confirmSheet('Supprimer ce cardio ?', 'Cette action est définitive.', 'Supprimer', true)) removeItem('cardio', d.id); },
    'del-weight': () => { removeItem('weights', d.id); toast('Pesée supprimée'); },
    'ct-start': () => { const t = cardioTimer(); LS.set(CT_KEY, { ...t, start: Date.now(), running: true }); haptic(); render(); },
    'ct-pause': () => { const t = cardioTimer(); LS.set(CT_KEY, { acc: cardioElapsed(t), start: 0, running: false }); render(); },
    'ct-stop': () => {
      const min = Math.max(1, Math.round(cardioElapsed() / 60));
      LS.set(CT_KEY, { start: 0, acc: 0, running: false });
      ui.cardioPrefill = { ...(ui.cardioPrefill || {}), minutes: min };
      render();
      $('[data-form="cardio"]')?.scrollIntoView({ behavior: 'smooth' });
      toast(`${min} min · vérifie et valide`);
    },
    'ct-reset': async () => { if (await confirmSheet('Remettre à zéro ?', 'Le chrono repartira de 0.', 'Remettre à zéro')) { LS.set(CT_KEY, { start: 0, acc: 0, running: false }); render(); } },
    weigh: sheetWeigh,
    'kg-step': () => { const i = $('#sheet [name="kg"]'); i.value = Math.max(30, +(+i.value + +d.d).toFixed(1)); haptic(6); },
    'go-titles': () => { location.hash = '#/titles'; },
    'equip-title': () => { state.profile.title = d.id; save(); toast(ic('check') + ' Titre équipé'); },
    'sheet-profile': sheetProfile,
    'sheet-nutrition': sheetNutrition,
    'sheet-program': sheetProgram,
    'sheet-day': () => sheetDay(d.day),
    'sheet-sync': sheetSync,
    'sheet-data': sheetData,
    'sheet-install': sheetInstall,
    'sheet-close': closeSheet,
    'pop-close': nextPopup,
    'prog-move': () => {
      const ex = dayById(d.day).exercises, i = +d.i, j = i + +d.dir;
      if (j < 0 || j >= ex.length) return;
      [ex[i], ex[j]] = [ex[j], ex[i]]; save(); sheetDay(d.day);
    },
    'prog-del': async () => { const day = d.day, i = +d.i; if (await confirmSheet('Retirer cet exercice ?', esc(dayById(day).exercises[i].name), 'Retirer', true)) { dayById(day).exercises.splice(i, 1); save(); } sheetDay(day); },
    'prog-add': () => { dayById(d.day).exercises.push({ id: 'custom_' + uid(), name: 'Nouvel exercice', sets: 3, repMin: 8, repMax: 12, rest: 90, inc: 2.5, tip: '' }); save(); sheetDay(d.day); },
    'prog-reset': async () => { if (await confirmSheet('Programme d\'origine', 'Ton historique est conservé.', 'Réinitialiser', true)) { state.program = clone(DEFAULT_PROGRAM); save(); toast('Programme réinitialisé'); } },
    'sync-now': () => { sync.pull(); toast('Synchronisation…'); },
    'sync-out': async () => { await sync.signOut(); sheetSync(); },
    'sync-cfg-clear': () => { sync.setConfig('', ''); sheetSync(); },
    export: () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `le-systeme-${todayStr()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(ic('check') + ' Sauvegarde téléchargée');
    },
    reset: async () => {
      if (await confirmSheet('Tout effacer ?', 'Toutes les données de cet appareil seront supprimées. Exporte une sauvegarde avant si besoin.', 'Tout effacer', true)) {
        resetAll(); ['sl-last-level', 'sl-last-rank', 'sl-titles'].forEach((k) => { try { localStorage.removeItem(k); } catch (er) { /* ignore */ } }); render();
      }
    },
  }[d.action];
  if (act) act();
});

document.addEventListener('change', (e) => {
  const t = e.target, d = t.dataset;
  if (d.action === 'set-field') {
    const ex = state.active.exercises[+d.ei];
    const s = ex.sets[+d.si];
    const old = s[d.f];
    const v = t.value === '' ? '' : +t.value;
    // la nouvelle charge se propage aux séries suivantes (sans re-rendu, pour garder le clavier ouvert)
    if (d.f === 'w') for (let k = +d.si + 1; k < ex.sets.length; k++) if (!ex.sets[k].done && ex.sets[k].w === old) {
      ex.sets[k].w = v;
      const inp = $(`input[data-ei="${d.ei}"][data-si="${k}"][data-f="w"]`);
      if (inp && inp !== document.activeElement) inp.value = v;
    }
    s[d.f] = v;
    save({ silent: true });
  } else if (d.action === 'week-day') {
    state.program.week[d.wd] = t.value; save();
  } else if (d.action === 'prog-ex') {
    const ex = dayById(d.day).exercises[+d.i];
    ex[d.f] = d.f === 'name' ? t.value.trim() || ex.name : +t.value;
    save();
  } else if (d.action === 'stats-ex') {
    ui.statsEx = t.value; drawStats();
  } else if (d.action === 'import') {
    const f = t.files[0];
    if (!f) return;
    f.text().then(async (txt) => {
      const data = JSON.parse(txt);
      if (!data.program || !Array.isArray(data.workouts)) throw new Error('format');
      if (await confirmSheet('Restaurer cette sauvegarde ?', 'Les données actuelles seront remplacées.', 'Restaurer', true)) { replaceState(data); toast(ic('check') + ' Données restaurées'); }
    }).catch(() => toast('Fichier invalide', 'err'));
  }
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, fd = Object.fromEntries(new FormData(f));
  const kind = f.dataset.form;
  if (kind === 'ob-profile') {
    Object.assign(state.profile, { name: fd.name.trim() || 'Joueur', age: +fd.age, height: +fd.height, weight: +fd.weight, goalWeight: +fd.goalWeight });
    state.weights = state.weights.filter((w) => w.date !== todayStr());
    state.weights.push({ id: uid(), date: todayStr(), kg: +fd.weight });
    save({ silent: true });
    obStep = 2; render();
  } else if (kind === 'cardio') {
    state.cardio.push({ id: uid(), date: fd.date, type: fd.type, minutes: +fd.minutes, km: fd.km ? +fd.km : null, incline: fd.incline ? +fd.incline : null, speed: fd.speed ? +fd.speed : null, note: fd.note || '' });
    ui.cardioPrefill = null;
    save({ silent: true });
    systemPopup('Cardio enregistré', `<p class="reward-xp">+<b data-count="${Math.round(fd.minutes * 1.5)}">0</b> XP</p><p class="muted">${fd.minutes} min · END et AGI progressent.</p>`);
    render();
  } else if (kind === 'weight') {
    const t = todayStr();
    for (const w of state.weights) if (w.date === t) state.deleted.push(w.id);
    state.weights = state.weights.filter((w) => w.date !== t);
    state.weights.push({ id: uid(), date: t, kg: +fd.kg });
    closeSheet();
    save();
    toast(ic('check') + ` ${fd.kg} kg enregistré · +5 XP`);
  } else if (kind === 'profile') {
    Object.assign(state.profile, { name: fd.name || 'Joueur', age: +fd.age, sex: fd.sex, height: +fd.height, weight: +fd.weight, goalWeight: +fd.goalWeight, activity: +fd.activity });
    closeSheet();
    save();
    toast(ic('check') + ' Profil mis à jour');
  } else if (kind === 'sync-cfg') {
    sync.setConfig(fd.url, fd.key);
    sheetSync();
  } else if (kind === 'auth') {
    const mode = e.submitter?.value || 'in';
    try {
      if (mode === 'up') {
        const r = await sync.signUp(fd.email, fd.password);
        toast(r.session ? 'Compte créé, synchro activée' : 'Compte créé : confirme ton email puis connecte-toi');
      } else { await sync.signIn(fd.email, fd.password); toast(ic('check') + ' Connecté'); }
      sheetSync();
    } catch (err) { toast('Erreur : ' + esc(err.message || err), 'err'); }
  }
});

$('#rest').addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]')?.dataset.action;
  if (a === 'rest-plus') { rest.end += 15000; rest.total += 15; rest.beeped = false; tickRest(); }
  if (a === 'rest-minus') { rest.end -= 15000; tickRest(); }
  if (a === 'rest-skip') stopRest();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

// ======================= Routage & démarrage =======================
function onHash() {
  const r = location.hash.replace('#/', '') || 'home';
  route = ['home', 'train', 'stats', 'profile', 'titles'].includes(r) ? r : 'home';
  if (!$('#sheet').hidden) closeSheet();
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', onHash);

subscribe(() => {
  const a = document.activeElement;
  if (a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName)) return; // pas de re-rendu pendant la saisie
  render();
});
sync.onSyncStatus(() => { if (!$('#sheet').hidden && $('#sheet .sync-state')) sheetSync(); });

setInterval(() => { const el = $('#elapsed'); if (el && state.active) el.textContent = mmss((Date.now() - state.active.startedAt) / 1000); }, 1000);

if (state.active) keepAwake(true);
onHash();
sync.initSync();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
