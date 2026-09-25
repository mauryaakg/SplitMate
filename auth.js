/* SplitMate Phase 1 authentication. No expense or budget synchronization is performed. */
(function () {
  'use strict';

  const PLACEHOLDER_URL = 'https://YOUR-PROJECT-REF.supabase.co';
  const PLACEHOLDER_KEY = 'YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY';
  const supplied = window.SPLITMATE_SUPABASE_CONFIG || {};
  const config = {
    url: String(supplied.url || '').trim(),
    anonKey: String(supplied.anonKey || '').trim()
  };
  const configured = config.url && config.anonKey && config.url !== PLACEHOLDER_URL && config.anonKey !== PLACEHOLDER_KEY;
  let client = null;
  let authSubscription = null;

  const escapeText = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const root = () => document.getElementById('authRoot');
  const status = (text, type = '') => { const element = document.getElementById('authStatus'); if (element) { element.textContent = text; element.className = `auth-status ${type}`; } };
  const style = document.createElement('style');
  style.textContent = '.auth-card{display:grid;gap:12px}.auth-grid{display:grid;gap:10px}.auth-actions{display:flex;gap:8px;flex-wrap:wrap}.auth-status{padding:10px 12px;border-radius:12px;background:var(--surface-alt);color:var(--text-soft);font-size:.86rem}.auth-status.success{color:var(--success)}.auth-status.error{color:var(--danger)}.auth-note{margin:0;color:var(--text-soft);font-size:.82rem;line-height:1.5}';
  document.head.appendChild(style);

  function render(user) {
    const element = root();
    if (!element) return;
    if (!configured || !client) {
      element.innerHTML = '<div class="auth-card"><div class="auth-status">Local-only mode is active. Configure the public Supabase URL and key in <code>auth.js</code> to enable authentication. Existing localStorage data is unchanged.</div></div>';
      return;
    }
    if (user) {
      element.innerHTML = `<div class="auth-card"><div class="auth-status success">Signed in as <strong>${escapeText(user.email || 'Authenticated user')}</strong></div><p class="auth-note">Authentication is active. Cloud expense synchronization is not enabled yet; all SplitMate data remains local.</p><div class="auth-actions"><button id="signOutButton" class="secondary-button" type="button">Sign out</button></div></div>`;
      document.getElementById('signOutButton').addEventListener('click', async () => {
        status('Signing out…');
        const { error } = await client.auth.signOut();
        if (error) status(error.message, 'error');
      }, { once: true });
      return;
    }
    element.innerHTML = `<div class="auth-card"><div class="auth-grid"><div class="field"><label for="authEmail">Email</label><input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com"></div><div class="field"><label for="authPassword">Password</label><input id="authPassword" type="password" autocomplete="current-password" minlength="6" placeholder="At least 6 characters"></div></div><div class="auth-actions"><button id="signInButton" class="primary-button" type="button">Sign in</button><button id="signUpButton" class="secondary-button" type="button">Create account</button></div><div id="authStatus" class="auth-status">Signed out. LocalStorage mode remains active.</div><p class="auth-note">Phase 1 only manages authentication. It does not migrate or upload existing local data.</p></div>`;
    const credentials = () => ({ email: document.getElementById('authEmail').value.trim(), password: document.getElementById('authPassword').value });
    const validate = ({ email, password }) => { if (!email || !email.includes('@')) { status('Enter a valid email address.', 'error'); return false; } if (password.length < 6) { status('Password must be at least 6 characters.', 'error'); return false; } return true; };
    document.getElementById('signInButton').addEventListener('click', async () => { const values = credentials(); if (!validate(values)) return; status('Signing in…'); const { error } = await client.auth.signInWithPassword(values); if (error) status(error.message, 'error'); }, { once: true });
    document.getElementById('signUpButton').addEventListener('click', async () => { const values = credentials(); if (!validate(values)) return; status('Creating account…'); const { data, error } = await client.auth.signUp({ ...values, options: { emailRedirectTo: window.location.href } }); if (error) status(error.message, 'error'); else status(data.session ? 'Account created and signed in.' : 'Account created. Check your email to confirm it.', 'success'); }, { once: true });
  }

  function ensureRoot() {
    if (root()) return;
    const settings = document.getElementById('settings');
    const panel = settings && settings.querySelector('.panel');
    if (!panel) return;
    const heading = document.createElement('div'); heading.className = 'panel-header'; heading.innerHTML = '<h3>Account</h3>';
    const account = document.createElement('div'); account.id = 'authRoot';
    panel.before(heading, account);
  }

  function initialize() {
    ensureRoot();
    if (window.supabase && configured) client = window.supabase.createClient(config.url, config.anonKey);
    render(null);
    if (!client) return;
    client.auth.getSession().then(({ data, error }) => { if (error) status(error.message, 'error'); render(data && data.session ? data.session.user : null); });
    if (authSubscription) authSubscription.unsubscribe();
    authSubscription = client.auth.onAuthStateChange((_event, session) => render(session && session.user ? session.user : null)).data.subscription;
  }

  function loadSupabaseAndInitialize() {
    if (window.supabase || !configured) { initialize(); return; }
    const sdk = document.createElement('script'); sdk.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; sdk.async = true; sdk.onload = initialize; sdk.onerror = () => { ensureRoot(); render(null); }; document.head.appendChild(sdk);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadSupabaseAndInitialize, { once: true }); else loadSupabaseAndInitialize();
  window.SplitMateAuth = { getClient: () => client };
})();
