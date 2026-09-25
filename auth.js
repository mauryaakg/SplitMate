/* SplitMate Phase 1 authentication. Auth only; expense data remains localStorage-only. */
(function () {
  'use strict';

  const PLACEHOLDER_URL = 'https://YOUR-PROJECT-REF.supabase.co';
  const PLACEHOLDER_KEY = 'YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY';
  const supplied = window.SPLITMATE_SUPABASE_CONFIG || {};
  const config = {
    url: String(supplied.url || '').trim(),
    anonKey: String(supplied.anonKey || '').trim()
  };
  const configured = Boolean(
    /^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(config.url) &&
    config.url !== PLACEHOLDER_URL &&
    config.anonKey &&
    config.anonKey !== PLACEHOLDER_KEY
  );

  let client = null;
  let subscription = null;
  let initialized = false;

  const root = () => document.getElementById('authRoot');
  const escapeText = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));

  const setStatus = (message, type = '') => {
    const element = document.getElementById('authStatus');
    if (!element) return;
    element.textContent = message;
    element.className = `auth-status ${type}`.trim();
  };

  const addStyles = () => {
    if (document.getElementById('splitmate-auth-styles')) return;
    const style = document.createElement('style');
    style.id = 'splitmate-auth-styles';
    style.textContent = `
      .auth-card{display:grid;gap:12px}.auth-grid{display:grid;gap:10px}.auth-actions{display:flex;gap:8px;flex-wrap:wrap}.auth-status{padding:10px 12px;border-radius:12px;background:var(--surface-alt);color:var(--text-soft);line-height:1.45}.auth-status.success{background:var(--success-soft);color:var(--success)}.auth-status.error{background:var(--danger-soft);color:var(--danger)}.auth-note{margin:0;color:var(--text-soft);font-size:.84rem;line-height:1.5}.auth-card code{overflow-wrap:anywhere}
    `;
    document.head.appendChild(style);
  };

  const renderLocalMode = (message = 'Local-only mode is active. Configure the Supabase URL and public client key to enable authentication.') => {
    const element = root();
    if (!element) return;
    element.innerHTML = `<div class="auth-card"><div id="authStatus" class="auth-status">${escapeText(message)}</div><p class="auth-note">Authentication is optional. Expenses, budgets, groups, statistics, import/export, and dark mode continue to use localStorage.</p></div>`;
  };

  const credentials = () => ({
    email: String(document.getElementById('authEmail')?.value || '').trim(),
    password: String(document.getElementById('authPassword')?.value || '')
  });

  const validate = ({ email, password }) => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus('Enter a valid email address.', 'error');
      return false;
    }
    if (password.length < 6) {
      setStatus('Password must be at least 6 characters.', 'error');
      return false;
    }
    return true;
  };

  const renderSignedOut = () => {
    const element = root();
    if (!element) return;
    element.innerHTML = `
      <div class="auth-card">
        <div id="authStatus" class="auth-status">Signed out. Sign in to enable your optional account.</div>
        <div class="auth-grid">
          <div class="field"><label for="authEmail">Email</label><input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com" /></div>
          <div class="field"><label for="authPassword">Password</label><input id="authPassword" type="password" autocomplete="current-password" minlength="6" placeholder="At least 6 characters" /></div>
        </div>
        <div class="auth-actions"><button id="signInButton" class="primary-button" type="button">Sign in</button><button id="signUpButton" class="secondary-button" type="button">Sign up</button></div>
        <p class="auth-note">Phase 1 authentication does not upload or synchronize expense data.</p>
      </div>`;

    document.getElementById('signInButton').addEventListener('click', async () => {
      const values = credentials();
      if (!validate(values)) return;
      setStatus('Signing in…');
      const { error } = await client.auth.signInWithPassword(values);
      if (error) setStatus(error.message || 'Sign-in failed. Try again.', 'error');
      else setStatus('Signed in successfully.', 'success');
    });

    document.getElementById('signUpButton').addEventListener('click', async () => {
      const values = credentials();
      if (!validate(values)) return;
      setStatus('Creating account…');
      const { data, error } = await client.auth.signUp(values);
      if (error) {
        setStatus(error.message || 'Sign-up failed. Try again.', 'error');
      } else if (data?.session) {
        setStatus('Account created and signed in.', 'success');
      } else {
        setStatus('Account created. Check your email to confirm it, then sign in.', 'success');
      }
    });
  };

  const renderSignedIn = (user) => {
    const element = root();
    if (!element) return;
    element.innerHTML = `<div class="auth-card"><div id="authStatus" class="auth-status success">Signed in as <strong>${escapeText(user.email || 'Authenticated user')}</strong></div><div class="auth-actions"><button id="signOutButton" class="secondary-button" type="button">Sign out</button></div><p class="auth-note">Your SplitMate expense data remains local until cloud synchronization is implemented.</p></div>`;
    document.getElementById('signOutButton').addEventListener('click', async () => {
      setStatus('Signing out…');
      const { error } = await client.auth.signOut();
      if (error) setStatus(error.message || 'Sign-out failed. Try again.', 'error');
    });
  };

  const render = (user = null) => {
    if (!configured || !client) {
      renderLocalMode(!configured ? undefined : 'Supabase SDK is unavailable. Local-only mode is active.');
      return;
    }
    if (user) renderSignedIn(user);
    else renderSignedOut();
  };

  const initialize = () => {
    if (initialized) return;
    initialized = true;
    addStyles();

    if (!root()) {
      console.error('SplitMate authRoot element is missing.');
      return;
    }
    if (!configured) {
      renderLocalMode();
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      renderLocalMode('Supabase SDK could not be loaded. Local-only mode is active.');
      return;
    }

    try {
      client = window.supabase.createClient(config.url, config.anonKey);
    } catch (error) {
      console.error('Supabase client initialization failed:', error);
      renderLocalMode('Supabase configuration is invalid. Local-only mode is active.');
      return;
    }

    render(null);
    client.auth.getSession().then(({ data, error }) => {
      if (error) setStatus(error.message || 'Could not restore the auth session.', 'error');
      render(data?.session?.user || null);
    }).catch((error) => {
      console.error('Supabase session restoration failed:', error);
      setStatus('Could not restore the auth session. You can try signing in again.', 'error');
    });

    const result = client.auth.onAuthStateChange((_event, session) => render(session?.user || null));
    subscription = result?.data?.subscription || null;
  };

  window.SplitMateAuth = { getClient: () => client };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
}());
