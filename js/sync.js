// Synchro en ligne via Supabase (gratuit). Les données restent aussi en local :
// l'app marche hors ligne et se resynchronise dès que le réseau revient.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { state, replaceState, mergeStates, subscribe } from './store.js';

const CFG_KEY = 'sl-supabase-cfg';
let client = null;
let user = null;
let pushTimer = null;
let status = 'off'; // off | idle | syncing | error | offline
const statusListeners = new Set();

export function getConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (c && c.url && c.key) return c;
  } catch (e) { /* ignore */ }
  return SUPABASE_URL && SUPABASE_ANON_KEY ? { url: SUPABASE_URL, key: SUPABASE_ANON_KEY } : null;
}

export function setConfig(url, key) {
  try {
    if (url && key) localStorage.setItem(CFG_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
    else localStorage.removeItem(CFG_KEY);
  } catch (e) { /* ignore */ }
  client = null;
}

export const syncStatus = () => ({ status, user });
export function onSyncStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); }
function setStatus(s) { status = s; statusListeners.forEach((fn) => fn({ status, user })); }

async function getClient() {
  if (client) return client;
  const cfg = getConfig();
  if (!cfg) return null;
  if (!window.supabase) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
      s.onload = res; s.onerror = () => rej(new Error('Impossible de charger Supabase (hors ligne ?)'));
      document.head.appendChild(s);
    });
  }
  client = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
  client.auth.onAuthStateChange((_e, session) => {
    user = session?.user || null;
    setStatus(user ? 'idle' : 'off');
  });
  return client;
}

export async function initSync() {
  subscribe((_s, touched) => { if (touched) schedulePush(); });
  window.addEventListener('online', () => pull());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
  try {
    const c = await getClient();
    if (!c) return;
    const { data } = await c.auth.getSession();
    user = data.session?.user || null;
    setStatus(user ? 'idle' : 'off');
    if (user) await pull();
  } catch (e) {
    setStatus(navigator.onLine ? 'error' : 'offline');
  }
}

export async function signUp(email, password) {
  const c = await getClient();
  if (!c) throw new Error('Configure Supabase d\'abord.');
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) throw error;
  user = data.user;
  if (data.session) await pull();
  return data;
}

export async function signIn(email, password) {
  const c = await getClient();
  if (!c) throw new Error('Configure Supabase d\'abord.');
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  user = data.user;
  setStatus('idle');
  await pull();
}

export async function signOut() {
  const c = await getClient();
  if (c) await c.auth.signOut();
  user = null;
  setStatus('off');
}

export async function pull() {
  if (!user || !navigator.onLine) { if (user) setStatus('offline'); return; }
  const c = await getClient();
  setStatus('syncing');
  try {
    const { data, error } = await c.from('sl_data').select('data').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (data?.data) {
      const merged = mergeStates(state, data.data);
      replaceState(merged, { touch: false });
    }
    await push();
  } catch (e) {
    console.warn('sync pull', e);
    setStatus('error');
  }
}

function schedulePush() {
  if (!user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push(), 1500);
}

export async function push() {
  if (!user || !navigator.onLine) return;
  const c = await getClient();
  setStatus('syncing');
  try {
    const { error } = await c.from('sl_data').upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() });
    if (error) throw error;
    setStatus('idle');
  } catch (e) {
    console.warn('sync push', e);
    setStatus('error');
  }
}
