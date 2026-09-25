/* Phase 1 authentication integration. No data migration or cloud data writes are performed here. */
(function () {
  const CONFIG = window.SPLITMATE_SUPABASE_CONFIG || { url: '', anonKey: '' };
  const root = () => document.getElementById('authRoot');
  const client = () => window.supabase && CONFIG.url && CONFIG.anonKey ? window.supabase.createClient(CONFIG.url, CONFIG.anonKey) : null;
  let supabaseClient = client();

  const styles = `
    .auth-card{display:grid;gap:12px}.auth-grid{display:grid;gap:10px}.auth-actions{display:flex;gap:8px;flex-wrap:wrap}.auth-status{padding:10px 12px;border-radius:12px;background:var(--surface-alt);color:var(--text-soft);font-size:.86rem}.auth-status.success{color:var(--success)}.auth-status.error{color:var(--danger)}.auth-note{margin:0;color:var(--text-soft);font-size:.82rem;line-height:1.5}
  `;
  const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style);

  function message(text, kind = '') { const el = document.getElementById('authStatus'); if (el) { el.textContent = text; el.className = `auth-status ${kind}`; } }
  function render(user) {
    const el = root(); if (!el) return;
    if (!supabaseClient) {
      el.innerHTML = `<div class="auth-card"><div class="auth-status">Local-only mode is active. Add your Supabase URL and public key in <code>auth.js</code> to enable authentication. Existing localStorage data is unchanged.</div></div>`;
      return;
    }
    if (user) {
      const email = user.email || 'Authenticated user';
      el.innerHTML = `<div class="auth-card"><div class="auth-status success">Signed in as <strong>${escapeText(email)}</strong></div><p class="auth-note">Authentication is enabled. Cloud data synchronization is not active yet; your existing localStorage data remains local.</p><div class="auth-actions"><button id="signOutButton" class="secondary-button" type="button">Sign out</button></div></div>`;
      document.getElementById('signOutButton').onclick = async () => { const { error } = await supabaseClient.auth.signOut(); if (error) message(error.message, 'error'); };
      return;
    }
    el.innerHTML = `<div class="auth-card"><div class="auth-grid"><div class="field"><label for="authEmail">Email</label><input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com"></div><div class="field"><label for="authPassword">Password</label><input id="authPassword" type="password" autocomplete="current-password" minlength="6" placeholder="At least 6 characters"></div></div><div class="auth-actions"><button id="signInButton" class="primary-button" type="button">Sign in</button><button id="signUpButton" class="secondary-button" type="button">Create account</button></div><div id="authStatus" class="auth-status">Signed out. LocalStorage mode is active.</div><p class="auth-note">Signing in only establishes your account session in Phase 1. No existing local data is migrated or uploaded.</p></div>`;
    const credentials = () => ({ email: document.getElementById('authEmail').value.trim(), password: document.getElementById('authPassword').value });
    document.getElementById('signInButton').onclick = async () => { const { email, password } = credentials(); if (!email || password.length < 6) return message('Enter a valid email and a password of at least 6 characters.', 'error'); message('Signing in…'); const { error } = await supabaseClient.auth.signInWithPassword({ email, password }); if (error) message(error.message, 'error'); };
    document.getElementById('signUpButton').onclick = async () => { const { email, password } = credentials(); if (!email || password.length < 6) return message('Enter a valid email and a password of at least 6 characters.', 'error'); message('Creating account…'); const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href } }); if (error) return message(error.message, 'error'); message(data.session ? 'Account created and signed in.' : 'Account created. Check your email to confirm it.', 'success'); };
  }
  function escapeText(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char])); }
  function start() {
    if (!window.supabase && CONFIG.url && CONFIG.anonKey) { message('Supabase client could not load. LocalStorage mode is still available.', 'error'); render(null); return; }
    render(null);
    if (supabaseClient) { supabaseClient.auth.getSession().then(({ data }) => render(data.session && data.session.user)); supabaseClient.auth.onAuthStateChange((_event, session) => render(session && session.user)); }
  }
  window.addEventListener('DOMContentLoaded', start);
  window.SplitMateAuth = { getClient: () => supabaseClient, configure: (url, anonKey) => { CONFIG.url = url; CONFIG.anonKey = anonKey; supabaseClient = client(); start(); } };
})();
