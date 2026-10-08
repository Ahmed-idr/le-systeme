// Petits graphiques SVG faits maison (aucune dépendance), avec info-bulle au survol / au toucher.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};
const fmtDate = (s) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(2));
  return { lo, hi, ticks };
}

function attachTooltip(wrap, svg, points, render, W, H, pad) {
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  wrap.appendChild(tip);
  const guide = el('line', { class: 'chart-guide', y1: pad.t, y2: H - pad.b, x1: 0, x2: 0, opacity: 0 });
  svg.appendChild(guide);
  const move = (e) => {
    const r = svg.getBoundingClientRect();
    const cx = ((e.clientX - r.left) / r.width) * W;
    let best = points[0], bd = Infinity;
    for (const p of points) { const d = Math.abs(p.px - cx); if (d < bd) { bd = d; best = p; } }
    guide.setAttribute('x1', best.px); guide.setAttribute('x2', best.px); guide.setAttribute('opacity', 1);
    tip.innerHTML = render(best);
    tip.style.opacity = 1;
    const left = (best.px / W) * r.width;
    tip.style.left = Math.min(Math.max(left, 60), r.width - 60) + 'px';
  };
  const leave = () => { tip.style.opacity = 0; guide.setAttribute('opacity', 0); };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', leave);
}

// series: [{date, y}] ; avg: [{date, y}] optionnel (moyenne lissée)
export function lineChart(container, series, { unit = '', avg = null, label = '', avgLabel = '' } = {}) {
  container.innerHTML = '';
  if (series.length < 2) { container.innerHTML = '<p class="chart-empty">Pas encore assez de données (il en faut 2).</p>'; return; }
  const W = 340, H = 180, pad = { l: 36, r: 10, t: 12, b: 24 };
  const ys = series.map((p) => p.y).concat(avg ? avg.map((p) => p.y) : []);
  const { lo, hi, ticks } = niceTicks(Math.min(...ys), Math.max(...ys));
  const t0 = new Date(series[0].date).getTime(), t1 = new Date(series[series.length - 1].date).getTime() || t0 + 1;
  const X = (d) => pad.l + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const Y = (v) => H - pad.b - ((v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);

  const wrap = document.createElement('div');
  wrap.className = 'chart';
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label });
  for (const t of ticks) {
    svg.appendChild(el('line', { class: 'chart-grid', x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t) }));
    const tx = el('text', { class: 'chart-axis', x: pad.l - 6, y: Y(t) + 3, 'text-anchor': 'end' });
    tx.textContent = t; svg.appendChild(tx);
  }
  [series[0], series[series.length - 1]].forEach((p, i) => {
    const tx = el('text', { class: 'chart-axis', x: X(p.date), y: H - 6, 'text-anchor': i ? 'end' : 'start' });
    tx.textContent = fmtDate(p.date); svg.appendChild(tx);
  });
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  if (avg) {
    svg.appendChild(el('path', { d: path(series), class: 'chart-line-muted' }));
    for (const p of series) svg.appendChild(el('circle', { cx: X(p.date), cy: Y(p.y), r: 2.5, class: 'chart-dot-muted' }));
    svg.appendChild(el('path', { d: path(avg), class: 'chart-line' }));
  } else {
    const area = path(series) + `L${X(series[series.length - 1].date)},${H - pad.b}L${X(series[0].date)},${H - pad.b}Z`;
    svg.appendChild(el('path', { d: area, class: 'chart-area' }));
    svg.appendChild(el('path', { d: path(series), class: 'chart-line' }));
    for (const p of series) svg.appendChild(el('circle', { cx: X(p.date), cy: Y(p.y), r: 4, class: 'chart-dot' }));
  }
  wrap.appendChild(svg);
  const pts = series.map((p, i) => ({ ...p, px: X(p.date), a: avg ? avg[i] : null }));
  attachTooltip(wrap, svg, pts, (p) => `<b>${fmtDate(p.date)}</b><br>${label} : ${p.y}${unit}${p.a ? `<br>${avgLabel} : ${p.a.y}${unit}` : ''}`, W, H, pad);
  if (avg) {
    const lg = document.createElement('div');
    lg.className = 'chart-legend';
    lg.innerHTML = `<span><i class="lg-muted"></i>${label}</span><span><i class="lg-main"></i>${avgLabel}</span>`;
    wrap.appendChild(lg);
  }
  container.appendChild(wrap);
}

// bars: [{label, value, title}]
export function barChart(container, bars, { unit = '', label = '' } = {}) {
  container.innerHTML = '';
  if (!bars.some((b) => b.value > 0)) { container.innerHTML = '<p class="chart-empty">Pas encore de données.</p>'; return; }
  const W = 340, H = 170, pad = { l: 36, r: 6, t: 12, b: 22 };
  const { hi, ticks } = niceTicks(0, Math.max(...bars.map((b) => b.value)));
  const bw = (W - pad.l - pad.r) / bars.length;
  const Y = (v) => H - pad.b - (v / (hi || 1)) * (H - pad.t - pad.b);
  const wrap = document.createElement('div');
  wrap.className = 'chart';
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label });
  for (const t of ticks) {
    svg.appendChild(el('line', { class: 'chart-grid', x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t) }));
    const tx = el('text', { class: 'chart-axis', x: pad.l - 6, y: Y(t) + 3, 'text-anchor': 'end' });
    tx.textContent = t >= 1000 ? (t / 1000) + 'k' : t; svg.appendChild(tx);
  }
  const pts = [];
  bars.forEach((b, i) => {
    const x = pad.l + i * bw + 2, w = Math.max(2, bw - 4), y = Y(b.value), h = H - pad.b - y;
    if (h > 0) {
      const r = Math.min(4, w / 2, h);
      svg.appendChild(el('path', { class: 'chart-bar', d: `M${x},${H - pad.b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${H - pad.b}Z` }));
    }
    if (i % Math.ceil(bars.length / 6) === 0 || i === bars.length - 1) {
      const tx = el('text', { class: 'chart-axis', x: x + w / 2, y: H - 6, 'text-anchor': 'middle' });
      tx.textContent = b.label; svg.appendChild(tx);
    }
    pts.push({ ...b, px: x + w / 2 });
  });
  wrap.appendChild(svg);
  attachTooltip(wrap, svg, pts, (p) => `<b>${p.title || p.label}</b><br>${Math.round(p.value).toLocaleString('fr-FR')}${unit}`, W, H, pad);
  container.appendChild(wrap);
}

// Calendrier d'activité (12 dernières semaines) — levels: {date: 0..3}
export function heatmap(container, levels, weeks = 12) {
  container.innerHTML = '';
  const end = new Date(); end.setHours(12);
  const start = new Date(end); start.setDate(end.getDate() - (weeks * 7 - 1));
  // aligne sur un lundi (colonnes = semaines, lignes = jours)
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);
  const grid = document.createElement('div');
  grid.className = 'heatmap';
  const d = new Date(start);
  while (d <= end) {
    const s = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const c = document.createElement('i');
    c.className = 'hm' + (levels[s] || 0);
    c.title = fmtDate(s);
    grid.appendChild(c);
    d.setDate(d.getDate() + 1);
  }
  container.appendChild(grid);
  const lg = document.createElement('div');
  lg.className = 'chart-legend';
  lg.innerHTML = '<span><i class="hm1"></i>Cardio / quêtes</span><span><i class="hm2"></i>Séance salle</span><span><i class="hm3"></i>Journée parfaite</span>';
  container.appendChild(lg);
}
