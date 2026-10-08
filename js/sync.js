// Synchro en ligne via Supabase (gratuit). Les données restent aussi en local :
// l'app marche hors ligne et se resynchronise dès que le réseau revient.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { state, replaceState, mergeStates, subscribe } from './store.js';

const CFG_KEY = 'sl-supabase-cfg';
let client = null;
let user = null;
let pushTimer = null;
let status = 'off'; // off | idle | syncing | error | offline
export let lastError = '';
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
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/dist/umd/supabase.min.js';
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
    if (user && navigator.onLine) {
      // vérifie côté serveur que le compte existe toujours (sinon session fantôme)
      const { error } = await c.auth.getUser();
      if (error && error.status && error.status < 500) { lastError = explainError(error); await c.auth.signOut({ scope: 'local' }); user = null; setStatus('error'); return; }
    }
    setStatus(user ? 'idle' : 'off');
    if (user) await pull();
  } catch (e) {
    setStatus(navigator.onLine ? 'error' : 'offline');
  }
}

// Messages d'erreur Supabase traduits en clair
export function explainError(err) {
  const m = String(err?.message || err || '').toLowerCase();
  if (m.includes('email not confirmed')) return 'Ton email n’est pas confirmé. Désactive « Confirm email » dans Supabase (Authentication → Sign In / Providers → Email), puis confirme ton compte dans Authentication → Users, ou supprime-le et recrée-le.';
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect. Si tu n’as pas encore de compte, clique sur « Créer mon compte ».';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cet email : clique sur « Se connecter ».';
  if (m.includes('rate limit')) return 'Trop de tentatives : Supabase limite les emails envoyés (2 par heure). Désactive « Confirm email » dans Supabase et réessaie dans quelques minutes.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Les inscriptions sont désactivées dans Supabase (Authentication → Sign In / Providers → « Allow new users to sign up »).';
  if (m.includes('password') && m.includes('6')) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (m.includes('invalid') && m.includes('email')) return 'Adresse email invalide.';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('charger supabase')) return 'Pas de connexion à Supabase. Vérifie ton réseau.';
  if (m.includes('foreign key') || m.includes('user from sub claim') || m.includes('user not found')) return 'Ta session correspond à un compte qui n’existe plus dans Supabase (supprimé ou recréé). Tu as été déconnecté : reconnecte-toi.';
  if (m.includes('row-level security') || m.includes('permission denied') || m.includes('relation') ) return 'La table de synchro n’est pas bien créée : relance le script SQL (fichier supabase.sql) dans Supabase.';
  return err?.message || String(err);
}

export async function signUp(email, password) {
  const c = await getClient();
  if (!c) throw new Error('Configure Supabase d’abord.');
  const { data, error } = await c.auth.signUp({
    email, password,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
  // si Supabase demande une confirmation email, il n'y a pas encore de session
  if (!data.session) return { needsConfirm: true };
  user = data.user;
  lastError = '';
  setStatus('idle');
  await pull();
  return { needsConfirm: false };
}

export async function signIn(email, password) {
  const c = await getClient();
  if (!c) throw new Error('Configure Supabase d’abord.');
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  user = data.user;
  lastError = '';
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
    lastError = explainError(e);
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
    lastError = '';
    setStatus('idle');
  } catch (e) {
    console.warn('sync push', e);
    lastError = explainError(e);
    if (String(e?.message || '').includes('foreign key')) { await c.auth.signOut({ scope: 'local' }); user = null; }
    setStatus('error');
  }
}
